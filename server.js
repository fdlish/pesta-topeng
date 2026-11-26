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
const { createStore, pub, withRanks, StoreError, validateUsername } = require('./store');

const store = createStore();
console.log(`[store] mode: ${store.mode}`);

const TURN_MS = Number(process.env.TURN_MS || 45000);      // batas waktu per giliran
const OFFLINE_TURN_MS = Number(process.env.OFFLINE_TURN_MS || 8000); // giliran pemain offline
const LOBBY_GRACE_MS = 30000;   // pemain offline di lobby dihapus setelah ini
const EMPTY_ROOM_MS = 10 * 60000;

const app = express();
app.use('/vo', express.static('public/vo', { maxAge: '7d' }));
app.use(express.static('public'));
app.use('/vendor/fonts', express.static('node_modules/@fontsource', { maxAge: '30d' }));
app.use('/vendor/three', express.static('node_modules/three', { maxAge: '7d' }));
app.use('/vendor/supabase', express.static('node_modules/@supabase/supabase-js/dist/umd', { maxAge: '7d' }));
app.get('/health', (_, res) => res.send('ok'));
app.get('/config', (_, res) => res.json({ ...store.clientConfig(), scoring: { rules: SCORING.RULES, tiers: SCORING.TIERS, table: SCORING.table(G.MIN_PLAYERS, G.MAX_PLAYERS) } }));

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
    res.json({ profile: pub(p), rank: await store.rank(p.user_id), recent: await store.recent(p.user_id) });
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
    .filter(r => r.visibility === 'public' && r.game.players.some(p => p.connected))
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
    .filter(s => s.p && s.p.uid);
  if (!ranked.length) return;
  try {
    await store.awardMatch(room.code, n, ranked.map(s => ({ uid: s.p.uid, placement: s.placement, points: s.points, unmasks: s.unmasks })));
    lbCache = null;
    for (const s of ranked) {
      const prof = await store.getProfile(s.p.uid);
      const total = Number(prof?.points) || 0;
      const reward = {
        placement: s.placement, points: s.points, total,
        tierBefore: SCORING.tierOf(total - s.points), tierAfter: SCORING.tierOf(total),
        rank: await store.rank(s.p.uid).catch(() => null),
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
  const extra = Object.fromEntries(g.players.map(p => [p.id, { publicId: p.publicId || null, avatarUrl: p.avatarUrl || null, tier: p.uid ? p.tier : null, guest: !p.uid }]));
  view.players = view.players.map(p => ({ ...p, ...extra[p.id] }));
  const pub = { ...view, code: room.code, hostId: room.hostId, visibility: room.visibility, turnEndsAt: room.turnEndsAt, serverNow: Date.now() };
  io.to(room.code).emit('state', pub);
  if (room.visibility === 'public') broadcastRooms();
  for (const p of g.players) if (p.connected && p.socketId) io.to(p.socketId).emit('private', G.privateView(g, p));
}

function scheduleTurn(room) {
  clearTimeout(room.turnTimer);
  room.turnTimer = null; room.turnEndsAt = null;
  const cp = G.currentPlayer(room.game);
  if (!cp) return;
  const ms = cp.connected ? TURN_MS : OFFLINE_TURN_MS;
  room.turnEndsAt = Date.now() + ms;
  room.turnTimer = setTimeout(() => {
    try { G.autoAct(room.game); } catch (e) { console.error('autoAct', e.message); }
    afterChange(room);
  }, ms);
}

// Setiap perubahan state lewat sini: atur ulang timer jika giliran/step berubah, lalu sync.
const ORDER_MS = Number(process.env.ORDER_MS) || 15000;
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
    const key = `O:${g.order.round}`;
    if (key !== room.turnKey) { room.turnKey = key; scheduleOrder(room); }
    return sync(room);
  }
  const key = g.phase === 'PLAYING' ? `${g.turnIdx}:${g.step}:${g.seq}` : null;
  if (key !== room.turnKey) { room.turnKey = key; key ? scheduleTurn(room) : (clearTimeout(room.turnTimer), room.turnEndsAt = null); }
  sync(room);
  if (g.phase === 'GAME_OVER') awardRoom(room);
}

function migrateHost(room) {
  const host = G.player(room.game, room.hostId);
  if (host && host.connected) return;
  const next = room.game.players.find(p => p.connected);
  if (next) room.hostId = next.id;
}

function removePlayer(room, pid) {
  const g = room.game;
  g.players = g.players.filter(p => p.id !== pid);
  migrateHost(room);
  if (g.players.length === 0) { clearTimeout(room.turnTimer); rooms.delete(room.code); broadcastRooms(); return; }
  afterChange(room);
}

function checkEmpty(room) {
  clearTimeout(room.emptyTimer);
  if (room.game.players.some(p => p.connected)) return;
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
    if (prof) Object.assign(p, { name: prof.username, uid: socket.data.user.uid, publicId: prof.public_id, avatarUrl: prof.avatar_url || null, tier: SCORING.tierOf(Number(prof.points) || 0) });
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

  socket.on('start_game', action((room, p) => {
    if (p.id !== room.hostId) throw new Error('Hanya host yang bisa memulai');
    G.startGame(room.game);
  }));
  socket.on('roll', action((room, p) => G.roll(room.game, p.id)));
  socket.on('order_roll', action((room, p) => G.orderRoll(room.game, p.id)));
  socket.on('move', action((room, p, { charId, to, spot }) => G.move(room.game, p.id, charId, to, spot)));
  socket.on('kill', action((room, p, { targetId }) => G.kill(room.game, p.id, targetId)));
  socket.on('draw', action((room, p) => G.draw(room.game, p.id)));
  socket.on('play_again', action((room, p) => {
    if (p.id !== room.hostId) throw new Error('Hanya host');
    if (room.game.phase !== 'GAME_OVER') throw new Error('Game belum selesai');
    room.game.players = room.game.players.filter(x => x.connected);
    G.resetToLobby(room.game);
    room.awarded = false;
  }));
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
