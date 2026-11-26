// Tes akun (mode lokal), room publik/privat, poin & papan peringkat.
// Menjalankan server sendiri di port acak dengan file data sementara.
const os = require('os'), path = require('path'), fs = require('fs');
const tmp = path.join(os.tmpdir(), `pt-store-${Date.now()}.json`);
process.env.LOCAL_STORE_FILE = tmp;
process.env.PORT = process.env.PORT || '4123';
delete process.env.SUPABASE_URL;
const { server } = require('../server');
const { io } = require('socket.io-client');
const URL = `http://localhost:${process.env.PORT}`;
const call = (s, ev, d) => new Promise(r => s.emit(ev, d, r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) fails++; };
const token = () => 'local_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

async function connect() { const s = io(URL, { forceNew: true }); await new Promise(r => s.on('connect', r)); return s; }
function play(b) {
  const act = () => {
    const st = b.state; if (!st || st.phase !== 'PLAYING' || st.turnPlayerId !== b.id) return;
    const key = `${st.step}:${st.log.at(-1)?.n}`; if (b.last === key) return; b.last = key;
    setTimeout(async () => {
      let r;
      if (st.step === 'ROLL') r = await call(b.s, 'roll');
      else if (st.step === 'MOVE') { const m = st.legalMoves[0]; r = await call(b.s, 'move', { charId: m.charId, to: m.to }); }
      else if (st.step === 'BLACK') { if (!b.priv.killTargets) { b.last = null; return; } r = await call(b.s, 'kill', { targetId: b.priv.killTargets[0] }); }
      if (r && r.error) b.last = null;
    }, 3);
  };
  b.s.on('state', st => { b.state = st; act(); });
  b.s.on('private', p => { b.priv = p; act(); });
  b.s.on('reward', r => { b.reward = r; });
}

(async () => {
  const cfg = await (await fetch(URL + '/config')).json();
  ok(cfg.mode === 'local' && cfg.scoring.table.length === 6, 'config: mode lokal + tabel poin');

  // --- akun ---
  const users = [];
  for (const name of ['Rara', 'Bimo', 'Sekar']) {
    const s = await connect(); const tk = token();
    const me = await call(s, 'auth', { token: tk });
    ok(me.signedIn && me.needsUsername, `${name}: masuk, perlu username`);
    const saved = await call(s, 'profile_save', { username: name });
    ok(/^[A-Z0-9]{5}$/.test(saved.profile?.publicId || ''), `${name}: ID unik ${saved.profile?.publicId}`);
    users.push({ s, tk, name, priv: {}, profile: saved.profile });
  }
  const ids = new Set(users.map(u => u.profile.publicId));
  ok(ids.size === 3, 'ID publik tidak ada yang sama');
  const x = await connect(); await call(x, 'auth', { token: token() });
  ok((await call(x, 'profile_save', { username: 'rara' })).code === 'username_taken', 'username sama (beda huruf besar) ditolak');
  ok((await call(x, 'profile_save', { username: 'a b' })).code === 'username_invalid', 'username tidak valid ditolak');
  ok((await call(x, 'username_check', { username: 'Bebas_1' })).available === true, 'cek ketersediaan username');
  const anon = await connect();
  ok((await call(anon, 'profile_save', { username: 'Hantu' })).error, 'tanpa login tidak bisa buat profil');
  const forged = await call(anon, 'auth', { token: 'bukan-token' });
  ok(!forged.signedIn, 'token palsu ditolak');

  // --- room publik / privat ---
  const watcher = await connect();
  let listed = []; watcher.on('rooms', l => { listed = l; });
  listed = await call(watcher, 'rooms_subscribe', {});
  const [rara, bimo, sekar] = users;
  const pubRoom = await call(rara.s, 'create_room', { name: 'diabaikan', visibility: 'public' });
  rara.id = pubRoom.playerId;
  const privRoom = await call(x, 'create_room', { name: 'Rahasia', visibility: 'private' });
  await sleep(400);
  ok(listed.some(r => r.code === pubRoom.code && r.host === 'Rara'), 'room publik muncul di lobby (host = username)');
  ok(!listed.some(r => r.code === privRoom.code), 'room privat TIDAK muncul di lobby');
  const viaCode = await connect();
  ok(!(await call(viaCode, 'join_room', { code: privRoom.code, name: 'Tamu' })).error, 'room privat bisa dimasuki dengan kode');

  for (const u of [bimo, sekar]) { const r = await call(u.s, 'join_room', { code: pubRoom.code, name: 'x' }); u.id = r.playerId; }
  const dupTab = await connect(); await call(dupTab, 'auth', { token: bimo.tk });
  const again = await call(dupTab, 'join_room', { code: pubRoom.code, name: 'x' });
  ok(again.playerId === bimo.id, 'akun sama di tab lain = sambung ulang, bukan pemain ganda');
  bimo.s = dupTab;
  const guest = { s: await connect(), name: 'Tamu1', priv: {} };
  guest.id = (await call(guest.s, 'join_room', { code: pubRoom.code, name: 'Tamu1' })).playerId;
  await sleep(400);
  const r0 = listed.find(r => r.code === pubRoom.code);
  ok(r0 && r0.players === 4, `jumlah pemain di daftar room = ${r0?.players}`);

  [rara, bimo, sekar, guest].forEach(play);
  await call(rara.s, 'set_visibility', { visibility: 'public' }); // memicu sync state
  await sleep(150);
  const st0 = rara.state;
  ok(st0.players.find(p => p.id === rara.id).publicId === rara.profile.publicId, 'state membawa ID publik pemain');
  ok(st0.players.find(p => p.id === guest.id).guest === true, 'tamu ditandai guest');
  await call(rara.s, 'start_game');
  await sleep(400);
  ok(['PLAYING', 'GAME_OVER'].includes(listed.find(r => r.code === pubRoom.code)?.phase), 'daftar room menunjukkan "sedang main"');

  const t0 = Date.now();
  while (rara.state.phase !== 'GAME_OVER' && Date.now() - t0 < 60000) await sleep(50);
  ok(rara.state.phase === 'GAME_OVER', 'game selesai');
  await sleep(800);
  const stand = rara.state.standings;
  ok(stand && stand.length === 4 && stand.map(s => s.placement).join() === '1,2,3,4', 'klasemen juara 1..4');
  ok(stand[0].id === rara.state.winnerId, 'juara 1 = pemenang');
  console.log('  klasemen:', stand.map(s => `${rara.state.players.find(p => p.id === s.id).name}#${s.placement}=${s.points}`).join('  '));
  for (const u of [rara, bimo, sekar]) {
    const s = stand.find(v => v.id === u.id);
    ok(u.reward && u.reward.points === s.points && u.reward.total === s.points, `${u.name}: reward ${u.reward?.points} poin, total ${u.reward?.total}, peringkat ${u.reward?.rank}`);
  }
  ok(!guest.reward, 'tamu tidak mendapat poin tersimpan');

  const lb = await (await fetch(URL + '/api/leaderboard')).json();
  ok(lb.rows.length === 3 && lb.rows[0].points >= lb.rows[1].points, 'papan peringkat terurut');
  const winnerName = rara.state.players.find(p => p.id === rara.state.winnerId).name;
  ok(winnerName === 'Tamu1' || lb.rows[0].username === winnerName, `peringkat 1 = ${lb.rows[0].username}`);
  const pp = await (await fetch(URL + '/api/player/' + rara.profile.publicId)).json();
  ok(pp.profile.games === 1 && pp.recent.length === 1, 'profil publik + riwayat pertandingan');
  const stats = await call(rara.s, 'my_stats', {});
  ok(stats.rank >= 1, `statistik saya: peringkat ${stats.rank}`);

  // main lagi tidak memberi poin ganda
  await call(rara.s, 'play_again', {});
  await sleep(300);
  const lb2 = await (await fetch(URL + '/api/player/' + rara.profile.publicId)).json();
  ok(lb2.profile.games === 1, 'tidak ada poin ganda');

  await sleep(400);
  const saved = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  ok(Object.keys(saved.profiles).length === 3, 'data lokal tersimpan ke file');
  console.log(fails ? `\n${fails} GAGAL` : '\nSEMUA LULUS');
  fs.rmSync(tmp, { force: true });
  server.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
