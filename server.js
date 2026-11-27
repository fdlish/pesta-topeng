'use strict';
// .env lokal (opsional). Di Render, env diisi lewat dashboard.
try { if (require('fs').existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env'); } catch (e) { console.warn('.env:', e.message); }
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const G = require('./game');
const LAYOUT = require('./layout');
const SCORING = require('./scoring');
const MISSIONS = require('./missions');
const { createStore, pub, withRanks, StoreError, validateUsername } = require('./store');

const store = createStore();
console.log(`[store] mode: ${store.mode}`);

const TURN_MS = Number(process.env.TURN_MS || 45000);      // batas waktu per giliran
const OFFLINE_TURN_MS = Number(process.env.OFFLINE_TURN_MS || 8000); // giliran pemain offline
const LOBBY_GRACE_MS = 30000;   // pemain offline di lobby dihapus setelah ini
const EMPTY_ROOM_MS = 10 * 60000;

const app = express();
app.use('/vo', express.static('public/vo', { maxAge: '7d' }));
// Halaman utama dengan pratinjau undangan (WhatsApp/Telegram/X) yang menyebut kode room bila ada.
const fs = require('fs');
const INDEX_TPL = () => fs.readFileSync(require('path').join(__dirname, 'public', 'index.html'), 'utf8');
let indexCache = null;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function sendIndex(req, res) {
  if (!indexCache || process.env.NODE_ENV !== 'production') indexCache = INDEX_TPL();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  const origin = `${proto}://${req.get('host')}`;
  const code = String(req.query.room || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const room = code && rooms.get(code);
  const host = room && G.player(room.game, room.hostId);
  const title = code ? `Undangan Pesta Topeng: kode ${code}` : 'Pesta Topeng: game deduksi bertopeng';
  const desc = code
    ? `${host ? host.name + ' mengundangmu' : 'Kamu diundang'} ke Pesta Topeng. Ketuk untuk masuk room ${code}, tanpa perlu instal apa pun.`
    : 'Dua puluh tamu bertopeng di lima pulau, dan salah satunya kamu. Main 3 sampai 8 orang langsung di browser.';
  res.set('Cache-Control', 'no-cache').type('html').send(indexCache
    .replaceAll('%OG_TITLE%', esc(title)).replaceAll('%OG_DESC%', esc(desc))
    .replaceAll('%OG_ORIGIN%', esc(origin)).replaceAll('%OG_URL%', esc(origin + req.originalUrl)));
}
app.get(['/', '/index.html'], sendIndex);
app.use(express.static('public'));
app.use('/vendor/fonts', express.static('node_modules/@fontsource', { maxAge: '30d' }));
app.use('/vendor/three', express.static('node_modules/three', { maxAge: '7d' }));
app.use('/vendor/supabase', express.static('node_modules/@supabase/supabase-js/dist/umd', { maxAge: '7d' }));
app.get('/health', (_, res) => res.send('ok'));
app.get('/config', (_, res) => res.json({ ...store.clientConfig(), missions: MISSIONS.catalog(), scoring: { rules: SCORING.RULES, tiers: SCORING.TIERS, table: SCORING.table(G.MIN_PLAYERS, G.MAX_PLAYERS) } }));

// ---- Papan peringkat (cache singkat agar hemat kuota free-tier) ----
let lbCache = null;
async function getLeaderboard() {
  if (lbCache && Date.now() - lbCache.at < 15000) return lbCache;
  const rows = withRanks((await store.leaderboard(50)).map(pub));
  lbCache = { at: Date.now(), rows };
  return lbCache;
}
app.get('/api/leaderboard', async (_, res) => {
  try { const lb = await getLeaderboard(); res.set('Cache-Control', 'public, max-age=10').json({ rows: lb.rows, updatedAt: lb.at }); }
  catch (e) { console.error('leaderboard', e.message); res.status(503).json({ error: 'Papan peringkat sedang tidak tersedia' }); }
});
app.get('/api/player/:publicId', async (req, res) => {
  const id = String(req.params.publicId || '').toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(id)) return res.status(400).json({ error: 'ID tidak valid' });
  try {
    const p = await store.byPublicId(id);
    if (!p) return res.status(404).json({ error: 'Pemain tidak ditemukan' });
    res.json({ profile: pub(p), rank: await store.rank(p.user_id), recent: await store.recent(p.user_id), unlocked: Object.keys(p.progress?.done || {}) });
  } catch (e) { console.error('player', e.message); res.status(503).json({ error: 'Data pemain sedang tidak tersedia' }); }
});
app.get('/meta', (_, res) => res.json({ rooms: G.ROOMS, roomLabel: G.ROOM_LABEL, roomColorName: G.ROOM_COLOR_NAME, adj: G.ADJ, characters: G.CHARACTERS, layout: LAYOUT.forClient(), minPlayers: G.MIN_PLAYERS, maxPlayers: G.MAX_PLAYERS }));

const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map(); // code -> { code, hostId, game, turnTimer, turnEndsAt, emptyTimer }

const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ';
function makeCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join(''); } while (rooms.has(c));
  return c;
}

// ---- Daftar room publik untuk lobby ----
function roomSummary(room) {
  const g = room.game, host = G.player(g, room.hostId);
  return {
    code: room.code, host: host ? host.name : '—', hostPublicId: host?.publicId || null,
    players: g.players.length, max: G.MAX_PLAYERS, phase: g.phase,
    avatars: g.players.slice(0, 8).map(p => ({ name: p.name, avatarUrl: p.avatarUrl || null })),
    createdAt: room.createdAt,
  };
}
function publicRooms() {
  return [...rooms.values()]
    .filter(r => r.visibility === 'public' && r.game.players.some(p => p.connected && !p.bot))
    .map(roomSummary)
    .sort((a, b) => (a.phase === 'LOBBY' ? 0 : 1) - (b.phase === 'LOBBY' ? 0 : 1) || b.createdAt - a.createdAt)
    .slice(0, 40);
}
let roomsTimer = null;
function broadcastRooms() {
  if (roomsTimer) return;
  roomsTimer = setTimeout(() => { roomsTimer = null; io.to('browser').emit('rooms', publicRooms()); }, 250);
}

// ---- Poin di akhir pertandingan ----
async function awardRoom(room) {
  const g = room.game;
  if (room.awarded || g.phase !== 'GAME_OVER' || !g.standings) return;
  room.awarded = true;
  const n = g.players.length;
  const ranked = g.standings
    .map(s => ({ ...s, p: G.player(g, s.id) }))
    .filter(s => s.p && s.p.uid && !s.practice); // latihan lawan bot tidak dicatat
  if (!ranked.length) return;
  try {
    await store.awardMatch(room.code, n, ranked.map(s => ({ uid: s.p.uid, placement: s.placement, points: s.points, unmasks: s.unmasks })));
    lbCache = null;
    for (const s of ranked) {
      // misi & gelar
      let missions = null;
      try {
        const before = await store.getProfile(s.p.uid);
        const st = (g.stat && g.stat[s.p.id]) || {};
        const sec = G.secretStatus(g, s.p, true);
        const x = { won: g.winnerId === s.p.id, placement: s.placement, players: n, unmasks: s.unmasks || 0, cards: st.cards || 0,
          accuseHits: st.accuseHits || 0, selfMoves: st.selfMoves || 0, aloneTurns: st.aloneTurns || 0, midnight: !!g.midnight, secretDone: !!(sec && sec.done) };
        // statistik profil SEBELUM pesta ini dipakai sebagai titik awal (awardMatch sudah menambah 1 pesta)
        const base = { games: Math.max(0, (before?.games || 1) - 1), wins: Math.max(0, (before?.wins || 0) - (x.won ? 1 : 0)), unmasks: Math.max(0, (before?.unmasks || 0) - x.unmasks) };
        const r = MISSIONS.apply(before?.progress, x, base);
        await store.saveProgress(s.p.uid, r.progress);
        missions = { secret: sec, unlocked: r.unlocked.map(MISSIONS.titleOf) };
      } catch (e) { console.error('missions', e.message); }
      const prof = await store.getProfile(s.p.uid);
      const total = Number(prof?.points) || 0;
      const reward = {
        placement: s.placement, points: s.points, total,
        tierBefore: SCORING.tierOf(total - s.points), tierAfter: SCORING.tierOf(total),
        rank: await store.rank(s.p.uid).catch(() => null),
        missions,
      };
      for (const sock of userSockets(s.p.uid)) { sock.data.profile = prof; sock.emit('reward', reward); sock.emit('me', mePayload(sock)); }
    }
  } catch (e) {
    console.error('awardMatch', e.message);
    for (const s of ranked) for (const sock of userSockets(s.p.uid)) sock.emit('reward', { error: 'Poin gagal disimpan, coba lagi nanti.' });
  }
}
const userSockets = uid => [...io.sockets.sockets.values()].filter(s => s.data.user?.uid === uid);
const mePayload = sock => ({
  mode: store.mode,
  signedIn: !!sock.data.user,
  needsUsername: !!sock.data.user && !sock.data.profile,
  suggestion: sock.data.user && !sock.data.profile ? suggestUsername(sock.data.user) : null,
  profile: pub(sock.data.profile),
});
function suggestUsername(u) {
  const base = String(u.displayName || u.email?.split('@')[0] || '').normalize('NFKD').replace(/[^A-Za-z0-9_]/g, '').slice(0, 12);
  return base.length >= 3 ? base : '';
}

function cleanName(n) {
  return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

function sync(room) {
  const g = room.game;
  const view = G.publicView(g);
  const extra = Object.fromEntries(g.players.map(p => [p.id, { publicId: p.publicId || null, avatarUrl: p.avatarUrl || null, tier: p.uid ? p.tier : null, title: p.uid ? p.title || null : null, guest: !p.uid }]));
  view.players = view.players.map(p => ({ ...p, ...extra[p.id] }));
  const pub = { ...view, code: room.code, hostId: room.hostId, visibility: room.visibility, tutorial: !!room.tutorial, turnEndsAt: room.turnEndsAt, serverNow: Date.now() };
  io.to(room.code).emit('state', pub);
  if (room.visibility === 'public') broadcastRooms();
  for (const p of g.players) if (p.connected && p.socketId) io.to(p.socketId).emit('private', G.privateView(g, p));
}

function scheduleTurn(room) {
  clearTimeout(room.turnTimer);
  room.turnTimer = null; room.turnEndsAt = null;
  const cp = G.currentPlayer(room.game);
  if (!cp) return;
  // bot "berpikir" sebentar; setelah dadu dilempar tunggu animasi dadu/terbang selesai di layar pemain
  const ms = cp.bot ? (room.game.step === 'ROLL' ? rnd(5200, 6500) : rnd(5500, 7000)) /* ±6 detik per langkah: cukup waktu untuk mengikuti gerak bot */ : cp.connected ? TURN_MS * (room.tutorial ? 2 : 1) : OFFLINE_TURN_MS;
  room.turnEndsAt = Date.now() + ms;
  room.turnTimer = setTimeout(() => {
    try { cp.bot ? G.botAct(room.game) : G.autoAct(room.game); } catch (e) { console.error('autoAct', e.message); try { G.autoAct(room.game); } catch {} }
    afterChange(room);
  }, ms);
}

// Setiap perubahan state lewat sini: atur ulang timer jika giliran/step berubah, lalu sync.
const ORDER_MS = Number(process.env.ORDER_MS) || 15000;
const BOT_SPEED = Number(process.env.BOT_SPEED) || 1; // <1 = bot lebih cepat (untuk pengujian)
const rnd = (a, b) => Math.round((a + Math.floor(Math.random() * (b - a))) * BOT_SPEED);
function scheduleBotOrder(room) { // bot melempar 2 dadu urutan dengan jeda acak, seperti manusia
  const g = room.game;
  room.botOrder = room.botOrder || {};
  for (const id of g.order.pending) {
    const b = G.player(g, id);
    const key = `${id}:${g.order.round}`;
    if (!b || !b.bot || room.botOrder[key]) continue;
    room.botOrder[key] = setTimeout(() => {
      if (g.phase !== 'ORDER' || !g.order.pending.includes(id)) return;
      try { G.orderRoll(g, id); } catch (e) { console.error('botOrder', e.message); }
      afterChange(room);
    }, rnd(900, 2600));
  }
}
function scheduleOrder(room) {
  clearTimeout(room.turnTimer);
  room.turnEndsAt = Date.now() + ORDER_MS;
  room.turnTimer = setTimeout(() => {
    try { G.orderAutoRoll(room.game); } catch (e) { console.error('orderAuto', e.message); }
    afterChange(room);
  }, ORDER_MS);
}
function afterChange(room) {
  const g = room.game;
  if (g.phase === 'ORDER') { // pemain offline langsung dilemparkan otomatis
    const off = g.order.pending.filter(id => !G.player(g, id)?.connected);
    if (off.length) G.orderAutoRoll(g, off);
  }
  if (g.phase === 'ORDER') {
    scheduleBotOrder(room);
    const key = `O:${g.order.round}`;
    if (key !== room.turnKey) { room.turnKey = key; scheduleOrder(room); }
    return sync(room);
  }
  const key = g.phase === 'PLAYING' ? `${g.turnIdx}:${g.step}:${g.seq}` : null;
  if (key !== room.turnKey) { room.turnKey = key; key ? scheduleTurn(room) : (clearTimeout(room.turnTimer), room.turnEndsAt = null); }
  sync(room);
  botReact(room);
  if (g.phase === 'GAME_OVER') awardRoom(room);
}

// ---- Reaksi cepat (stiker) ----
const REACTIONS = ['curiga', 'waduh', 'sstt', 'wkwk', 'bukan', 'mantap'];
function botReact(room) { // bot ikut heboh saat topeng terbongkar
  const g = room.game, ev = g.lastEvent;
  if (!ev || room.botReactedEv === ev.id || !['eliminated', 'killed', 'left'].includes(ev.type)) return;
  room.botReactedEv = ev.id;
  const pool = ev.type === 'eliminated' ? ['waduh', 'wkwk', 'mantap', 'curiga'] : ev.type === 'killed' ? ['wkwk', 'sstt', 'bukan'] : ['curiga', 'sstt'];
  for (const b of g.players.filter(p => p.bot)) {
    if (Math.random() > (ev.victim === b.id ? 0.9 : 0.28)) continue;
    const k = ev.victim === b.id ? 'waduh' : pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => io.to(room.code).emit('reaction', { pid: b.id, k }), rnd(1800, 4200));
  }
}

function migrateHost(room) {
  const host = G.player(room.game, room.hostId);
  if (host && host.connected) return;
  const next = room.game.players.find(p => p.connected && !p.bot);
  if (next) room.hostId = next.id;
}

function removePlayer(room, pid) {
  const g = room.game;
  g.players = g.players.filter(p => p.id !== pid);
  migrateHost(room);
  if (!g.players.some(p => !p.bot)) { clearTimeout(room.turnTimer); rooms.delete(room.code); broadcastRooms(); return; } // tinggal bot → bubarkan
  afterChange(room);
}

function checkEmpty(room) {
  clearTimeout(room.emptyTimer);
  if (room.game.players.some(p => p.connected && !p.bot)) return;
  broadcastRooms();
  room.emptyTimer = setTimeout(() => { clearTimeout(room.turnTimer); rooms.delete(room.code); broadcastRooms(); }, EMPTY_ROOM_MS);
}

io.on('connection', socket => {
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    const p = room && G.player(room.game, socket.data.playerId);
    return { room, p };
  };
  const reply = (cb, data) => typeof cb === 'function' && cb(data);
  const attach = (room, p) => {
    if (p.socketId && p.socketId !== socket.id) io.sockets.sockets.get(p.socketId)?.disconnect(true); // tab lama
    p.socketId = socket.id; p.connected = true;
    clearTimeout(p.graceTimer); clearTimeout(room.emptyTimer);
    socket.data.code = room.code; socket.data.playerId = p.id;
    socket.join(room.code);
  };
  // Identitas pemain di room: akun (username + ID) atau tamu (nama bebas).
  const newPlayer = (name) => {
    const prof = socket.data.profile;
    const p = { id: nanoid(10), name, connected: true, alive: true, cards: [], charId: null };
    if (prof) Object.assign(p, { name: prof.username, uid: socket.data.user.uid, publicId: prof.public_id, avatarUrl: prof.avatar_url || null, tier: SCORING.tierOf(Number(prof.points) || 0), title: pub(prof).title });
    return p;
  };
  const displayName = (name) => socket.data.profile ? socket.data.profile.username : cleanName(name);

  // ---- Akun ----
  socket.on('auth', async ({ token } = {}, cb) => {
    try {
      const user = token ? await store.identify(token) : null;
      socket.data.user = user;
      socket.data.profile = user ? await store.getProfile(user.uid) : null;
      if (user && socket.data.profile && user.avatarUrl && socket.data.profile.avatar_url !== user.avatarUrl) {
        store.touchAvatar(user.uid, user.avatarUrl).catch(() => {});
        socket.data.profile.avatar_url = user.avatarUrl;
      }
      const me = mePayload(socket);
      if (me.profile) me.rank = await store.rank(user.uid).catch(() => null);
      reply(cb, me);
    } catch (e) { console.error('auth', e.message); socket.data.user = null; socket.data.profile = null; reply(cb, { ...mePayload(socket), error: 'Gagal memeriksa akun' }); }
  });
  socket.on('username_check', async ({ username } = {}, cb) => {
    try { const u = validateUsername(username); reply(cb, { ok: true, available: await store.usernameAvailable(u) }); }
    catch (e) { reply(cb, { ok: false, error: e instanceof StoreError ? e.message : 'Gagal memeriksa' }); }
  });
  socket.on('profile_save', async ({ username } = {}, cb) => {
    const user = socket.data.user;
    if (!user) return reply(cb, { error: 'Masuk dulu dengan akun Google' });
    try {
      socket.data.profile = socket.data.profile
        ? await store.renameProfile(user.uid, username)
        : await store.createProfile(user.uid, username, user.avatarUrl);
      lbCache = null;
      const me = mePayload(socket);
      me.rank = await store.rank(user.uid).catch(() => null);
      reply(cb, me);
    } catch (e) {
      if (e instanceof StoreError) return reply(cb, { error: e.message, code: e.code });
      console.error('profile_save', e.message); reply(cb, { error: 'Gagal menyimpan profil' });
    }
  });
  socket.on('set_title', async ({ key } = {}, cb) => {
    const user = socket.data.user;
    if (!user || !socket.data.profile) return reply(cb, { error: 'Masuk dulu untuk memakai gelar' });
    try {
      const prof = await store.getProfile(user.uid);
      if (key && !prof?.progress?.done?.[key]) return reply(cb, { error: 'Gelar ini belum terbuka' });
      await store.setTitle(user.uid, key || null);
      socket.data.profile = await store.getProfile(user.uid);
      lbCache = null;
      // perbarui gelar di room yang sedang diikuti
      const room = rooms.get(socket.data.code), p = room && G.player(room.game, socket.data.playerId);
      if (p) { p.title = pub(socket.data.profile).title; sync(room); }
      reply(cb, mePayload(socket));
    } catch (e) { console.error('set_title', e.message); reply(cb, { error: 'Gagal memakai gelar' }); }
  });
  socket.on('my_missions', async (_ = {}, cb) => {
    const user = socket.data.user;
    if (!user || !socket.data.profile) return reply(cb, { error: 'Belum masuk' });
    try { const prof = await store.getProfile(user.uid); reply(cb, { missions: MISSIONS.view(prof?.progress), title: prof?.title || null }); }
    catch (e) { reply(cb, { error: 'Gagal memuat misi' }); }
  });
  socket.on('my_stats', async (_ = {}, cb) => {
    const user = socket.data.user;
    if (!user || !socket.data.profile) return reply(cb, { error: 'Belum masuk' });
    try { reply(cb, { profile: pub(await store.getProfile(user.uid)), rank: await store.rank(user.uid), recent: await store.recent(user.uid) }); }
    catch (e) { reply(cb, { error: 'Gagal memuat statistik' }); }
  });

  // ---- Daftar room publik ----
  socket.on('rooms_subscribe', (_ = {}, cb) => { socket.join('browser'); reply(cb, publicRooms()); });
  socket.on('rooms_unsubscribe', () => socket.leave('browser'));

  socket.on('create_room', ({ name, visibility } = {}, cb) => {
    name = displayName(name);
    if (!name) return reply(cb, { error: 'Nama wajib diisi' });
    const code = makeCode();
    const room = { code, game: G.createGame(), hostId: null, visibility: visibility === 'private' ? 'private' : 'public', createdAt: Date.now() };
    const p = newPlayer(name);
    room.game.players.push(p); room.hostId = p.id;
    rooms.set(code, room);
    attach(room, p);
    reply(cb, { code, playerId: p.id });
    afterChange(room);
    broadcastRooms();
  });

  // Ronde latihan: room privat + 2 bot, langsung mulai, dengan panduan di layar
  socket.on('create_practice', ({ name } = {}, cb) => {
    name = displayName(name) || 'Tamu Misterius';
    const code = makeCode();
    const room = { code, game: G.createGame(), hostId: null, visibility: 'private', tutorial: true, createdAt: Date.now() };
    const p = newPlayer(name);
    room.game.players.push(p); room.hostId = p.id;
    const names = G.BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    for (const style of ['waspada', 'nekat']) room.game.players.push({ id: nanoid(10), name: names.pop(), bot: true, botStyle: style, connected: true, socketId: null, alive: true, cards: [], charId: null });
    rooms.set(code, room);
    attach(room, p);
    G.startGame(room.game);
    reply(cb, { code, playerId: p.id });
    afterChange(room);
  });

  socket.on('set_visibility', ({ visibility } = {}, cb) => {
    const { room, p } = ctx();
    if (!room || !p) return reply(cb, { error: 'Tidak berada di room' });
    if (p.id !== room.hostId) return reply(cb, { error: 'Hanya host' });
    room.visibility = visibility === 'private' ? 'private' : 'public';
    reply(cb, { ok: true });
    afterChange(room); broadcastRooms();
  });

  socket.on('join_room', ({ code, name, playerId } = {}, cb) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return reply(cb, { error: 'Room tidak ditemukan' });
    const g = room.game;
    const uid = socket.data.user?.uid;
    const existing = (playerId && G.player(g, playerId)) || (uid && g.players.find(p => p.uid === uid));
    if (existing) { // reconnect
      attach(room, existing);
      migrateHost(room);
      if (G.currentPlayer(g)?.id === existing.id) room.turnKey = null; // kembalikan waktu giliran penuh
      reply(cb, { code, playerId: existing.id });
      return afterChange(room);
    }
    name = displayName(name);
    if (!name) return reply(cb, { error: 'Nama wajib diisi' });
    if (g.phase !== 'LOBBY') return reply(cb, { error: 'Permainan sedang berlangsung' });
    if (g.players.length >= G.MAX_PLAYERS) return reply(cb, { error: 'Room penuh (maks 8)' });
    if (g.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return reply(cb, { error: 'Nama sudah dipakai di room ini' });
    const p = newPlayer(name);
    g.players.push(p);
    attach(room, p);
    reply(cb, { code, playerId: p.id });
    afterChange(room);
  });

  const action = (fn) => (payload = {}, cb) => {
    const { room, p } = ctx();
    if (!room || !p) return reply(cb, { error: 'Tidak berada di room' });
    try { fn(room, p, payload); reply(cb, { ok: true }); afterChange(room); }
    catch (e) { reply(cb, { error: e.message }); }
  };

  socket.on('add_bot', action((room, p, { style } = {}) => {
    const g = room.game;
    if (p.id !== room.hostId) throw new Error('Hanya host yang bisa menambah bot');
    if (g.phase !== 'LOBBY') throw new Error('Bot hanya bisa ditambah di lobby');
    if (g.players.length >= G.MAX_PLAYERS) throw new Error('Room penuh (maks 8)');
    const used = new Set(g.players.map(x => x.name.toLowerCase()));
    const names = G.BOT_NAMES.filter(n => !used.has(n.toLowerCase()));
    const styles = Object.keys(G.BOT_STYLES);
    g.players.push({ id: nanoid(10), name: names[Math.floor(Math.random() * names.length)] || `Bot ${g.players.length + 1}`, bot: true,
      botStyle: styles.includes(style) ? style : styles[Math.floor(Math.random() * styles.length)], connected: true, socketId: null, alive: true, cards: [], charId: null });
  }));
  socket.on('remove_bot', action((room, p, { id } = {}) => {
    const g = room.game;
    if (p.id !== room.hostId) throw new Error('Hanya host');
    if (g.phase !== 'LOBBY') throw new Error('Bot hanya bisa dikeluarkan di lobby');
    const b = G.player(g, id);
    if (!b || !b.bot) throw new Error('Bukan bot');
    g.players = g.players.filter(x => x.id !== id);
  }));
  socket.on('start_game', action((room, p) => {
    if (p.id !== room.hostId) throw new Error('Hanya host yang bisa memulai');
    G.startGame(room.game);
  }));
  socket.on('roll', action((room, p) => G.roll(room.game, p.id)));
  socket.on('accuse', action((room, p, { target, charId } = {}) => G.accuse(room.game, p.id, target, charId)));
  socket.on('set_rules', action((room, p, rules = {}) => {
    if (p.id !== room.hostId) throw new Error('Hanya host yang bisa mengubah aturan');
    if (room.game.phase !== 'LOBBY') throw new Error('Aturan hanya bisa diubah di lobby');
    const r = room.game.rules || (room.game.rules = { accuse: true, midnight: true });
    for (const k of ['accuse', 'midnight']) if (typeof rules[k] === 'boolean') r[k] = rules[k];
  }));
  socket.on('order_roll', action((room, p) => G.orderRoll(room.game, p.id)));
  socket.on('move', action((room, p, { charId, to, spot }) => G.move(room.game, p.id, charId, to, spot)));
  socket.on('kill', action((room, p, { targetId }) => G.kill(room.game, p.id, targetId)));
  socket.on('draw', action((room, p) => G.draw(room.game, p.id)));
  socket.on('rematch', action((room, p) => { // pesta lagi dengan pemain yang sama, langsung lempar dadu urutan
    if (p.id !== room.hostId) throw new Error('Hanya host');
    if (room.game.phase !== 'GAME_OVER') throw new Error('Game belum selesai');
    const stay = room.game.players.filter(x => x.connected || x.bot);
    if (stay.length < G.MIN_PLAYERS) throw new Error(`Pemain tinggal ${stay.length}. Kembali ke lobby untuk menambah pemain atau bot.`);
    room.game.players = stay;
    G.resetToLobby(room.game);
    room.awarded = false; room.botOrder = {}; room.turnKey = null;
    G.startGame(room.game);
  }));
  socket.on('play_again', action((room, p) => {
    if (p.id !== room.hostId) throw new Error('Hanya host');
    if (room.game.phase !== 'GAME_OVER') throw new Error('Game belum selesai');
    room.game.players = room.game.players.filter(x => x.connected || x.bot);
    room.botOrder = {};
    G.resetToLobby(room.game);
    room.awarded = false;
  }));
  socket.on('react', ({ k } = {}) => {
    const { room, p } = ctx();
    if (!room || !p || !REACTIONS.includes(k) || room.game.phase === 'LOBBY') return;
    const now = Date.now();
    if (now - (p.lastReact || 0) < 1200) return; // anti-spam
    p.lastReact = now;
    io.to(room.code).emit('reaction', { pid: p.id, k });
  });
  socket.on('leave', () => {
    const { room, p } = ctx();
    if (!room || !p) return;
    socket.leave(room.code); socket.data.code = null; socket.data.playerId = null;
    if (room.game.phase === 'LOBBY') return removePlayer(room, p.id);
    if (['PLAYING', 'ORDER'].includes(room.game.phase)) G.forfeit(room.game, p.id); // keluar di tengah permainan = menyerah
    p.connected = false; p.socketId = null; migrateHost(room); afterChange(room); checkEmpty(room);
  });

  socket.on('disconnect', () => {
    const { room, p } = ctx();
    if (!room || !p || p.socketId !== socket.id) return;
    p.connected = false; p.socketId = null;
    migrateHost(room);
    if (room.game.phase === 'LOBBY') {
      p.graceTimer = setTimeout(() => { if (!p.connected && room.game.phase === 'LOBBY') removePlayer(room, p.id); }, LOBBY_GRACE_MS);
    } else if (G.currentPlayer(room.game)?.id === p.id) {
      room.turnKey = null; // percepat giliran pemain yang offline
    }
    afterChange(room);
    checkEmpty(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Pesta Topeng berjalan di http://localhost:${PORT}`));
module.exports = { server, rooms };
