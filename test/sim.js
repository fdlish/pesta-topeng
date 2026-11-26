// Simulasi: N bot memainkan game penuh lewat socket, termasuk 1 bot disconnect & reconnect.
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3999';
const N = Number(process.env.N || 5);
const call = (s, ev, d) => new Promise(r => s.emit(ev, d, r));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function bot(name, code, opts = {}) {
  const s = io(URL, { forceNew: true });
  const b = { s, name, state: null, priv: {}, id: null };
  s.on('state', st => { b.state = st; act(b); });
  s.on('private', p => { b.priv = p; act(b); });
  await new Promise(r => s.on('connect', r));
  const r = code ? await call(s, 'join_room', { code, name }) : await call(s, 'create_room', { name });
  if (r.error) throw new Error(r.error);
  b.id = r.playerId; b.code = r.code;
  return b;
}
function act(b) {
  const st = b.state; if (!st || st.phase !== 'PLAYING' || st.turnPlayerId !== b.id || b.paused) return;
  const key = `${st.step}:${st.log.at(-1)?.n}`; if (b.last === key) return; b.last = key;
  setTimeout(async () => {
    let r;
    if (st.step === 'ROLL') r = await call(b.s, 'roll');
    else if (st.step === 'MOVE') { const m = st.legalMoves[Math.floor(Math.random()*st.legalMoves.length)]; r = await call(b.s, 'move', { charId: m.charId, to: m.to }); }
    else if (st.step === 'BLACK') {
      if (!b.priv.killTargets) { b.last = null; return; }
      if (b.priv.canDraw && Math.random() < .5) r = await call(b.s, 'draw');
      else r = await call(b.s, 'kill', { targetId: b.priv.killTargets[0] });
    }
    if (r && r.error) { console.log('ERR', b.name, st.step, r.error); b.last = null; }
  }, 5);
}

(async () => {
  const host = await bot('Host', null);
  const bots = [host];
  for (let i = 1; i < N; i++) bots.push(await bot('Bot' + i, host.code));
  // tes validasi: nama duplikat & join saat main
  const dup = io(URL, { forceNew: true }); await new Promise(r => dup.on('connect', r));
  console.log('dup name ->', (await call(dup, 'join_room', { code: host.code, name: 'bot1' })).error);
  const notHost = await call(bots[1].s, 'start_game'); console.log('non-host start ->', notHost.error);
  await call(host.s, 'start_game');
  console.log('late join ->', (await call(dup, 'join_room', { code: host.code, name: 'Telat' })).error);
  // cek tidak ada kebocoran identitas di state publik
  await sleep(100);
  const pub = JSON.stringify(host.state.players);
  console.log('leak check (revealed null for alive):', host.state.players.filter(p => p.alive).every(p => p.revealed === null));
  // tes cheat: aksi di luar giliran
  const other = bots.find(b => b.id !== host.state.turnPlayerId);
  console.log('out-of-turn roll ->', (await call(other.s, 'roll')).error);

  // disconnect + reconnect bot terakhir
  const victim = bots[N - 1];
  await sleep(200);
  victim.paused = true; victim.s.disconnect();
  await sleep(1500);
  const conn = host.state.players.find(p => p.id === victim.id).connected;
  console.log('victim shown offline:', conn === false);
  const s2 = io(URL, { forceNew: true }); await new Promise(r => s2.on('connect', r));
  victim.s = s2; victim.paused = false; victim.last = null;
  s2.on('state', st => { victim.state = st; act(victim); });
  s2.on('private', p => { victim.priv = p; act(victim); });
  const rr = await call(s2, 'join_room', { code: host.code, playerId: victim.id });
  console.log('reconnect ->', rr.error || 'ok', '| char kembali:', !!(await new Promise(r => setTimeout(() => r(victim.priv.charId), 200))));

  const t0 = Date.now();
  while (host.state.phase !== 'GAME_OVER' && Date.now() - t0 < 60000) await sleep(100);
  const st = host.state;
  console.log('phase:', st.phase, '| winner:', st.players.find(p => p.id === st.winnerId)?.name, '| log entries:', st.log.length);
  console.log(st.log.slice(-6).map(l => '  ' + l.text).join('\n'));
  console.log('all revealed at end:', st.players.every(p => p.revealed));
  const again = await call(host.s, 'play_again'); console.log('play again ->', again.error || 'ok', host.state && (await sleep(100), host.state.phase), 'players', host.state.players.length);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
