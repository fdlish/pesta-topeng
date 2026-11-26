import { Board3D, setReducedMotion } from './board3d.js';
import * as A from './audio.js';
import { initPortraits, getPortrait, warmAll } from './portraits.js';
import * as Auth from './auth.js';
import * as Home from './home.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

const socket = io({ autoConnect: false });
const store = {
  get() { try { return JSON.parse(localStorage.getItem('pestaTopeng') || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.setItem('pestaTopeng', JSON.stringify({ ...store.get(), ...v })); } catch {} },
  clearRoom() { const s = store.get(); delete s.code; delete s.playerId; try { localStorage.setItem('pestaTopeng', JSON.stringify(s)); } catch {} },
};

let META, board = null, state = null, priv = {}, me = null, clockOffset = 0, selected = null, killSel = null, showId = false, overlayClosed = false;
let seenEventId = null, prevTurnId = null, prevPlayerCount = 0, turnStartAt = 0, lastTick = -1, introPending = false;
const fxQueue = [];

const SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICON = {
  dice: SVG + '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>',
  card: SVG + '<rect x="6" y="3" width="13" height="18" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2"/></svg>',
  crown: SVG + '<path d="M2 18h20l-2-11-5 5-3-7-3 7-5-5z"/></svg>',
};
const MASK_SVG = '<svg class="mask-svg" viewBox="0 0 64 40" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M2 7C10 1 22 2 32 10C42 2 54 1 62 7C64 22 56 34 44 34C38 34 35 27 32 27C29 27 26 34 20 34C8 34 0 22 2 7ZM12 17C14 13 21 13 25 17C21 21 15 21 12 17ZM39 17C43 13 50 13 52 17C49 21 43 21 39 17Z"/></svg>';
function btnWithIcon(cls, icon, text) { const b = el('button', cls); b.innerHTML = icon; b.append(el('span', null, text)); return b; }
const DIE_LABEL = { papua: 'PAPUA', sulawesi: 'SULAWESI', jawa: 'JAWA', sumatera: 'SUMATERA', kalimantan: 'KALIMANTAN', hitam: 'HITAM' };

// ---------- util ----------
function toast(msg, kind) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : '');
  if (kind === 'error') A.sfx.error();
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2800);
}
function emit(ev, data) {
  return new Promise(res => socket.emit(ev, data, r => { if (r && r.error) toast(r.error, 'error'); res(r || {}); }));
}
let shown = null;
function show(id) {
  if (shown !== id) { shown = id; Home.subscribeRooms(id === 'home'); }
  for (const s of document.querySelectorAll('.screen')) {
    const on = s.id === id;
    if (on && s.classList.contains('hidden')) { s.classList.remove('hidden'); s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
    else if (!on) s.classList.add('hidden');
  }
}
const ch = id => META.characters.find(c => c.id === id);
const pname = id => (state && state.players.find(p => p.id === id) || {}).name || '?';
const hue = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
function initialAvatar(name, cls = 'p-avatar') {
  const a = el('span', cls, (name || '?').trim().slice(0, 1).toUpperCase());
  a.style.setProperty('--h', hue(name || '?')); a.setAttribute('aria-hidden', 'true');
  return a;
}

// ---------- audio: buka pada interaksi pertama + tombol ----------
const unlock = () => { if (A.unlock()) for (const ev of ['pointerdown', 'touchend', 'keydown']) document.removeEventListener(ev, unlock, true); };
for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, unlock, true);
document.addEventListener('click', e => { if (e.target.closest('button:not(.roll):not(#identityBtn)')) A.sfx.click(); });
function syncAudioBtns() {
  for (const [id, on] of [['#musicBtn', A.isMusicOn()], ['#sfxBtn', A.isSfxOn()]]) { const b = $(id); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('off', !on); }
  const dm = document.getElementById('drawerMusicState'); if (dm) dm.textContent = A.isMusicOn() ? 'Nyala' : 'Mati';
  const dv = document.getElementById('drawerVoiceState'); if (dv) dv.textContent = A.isVoiceOn() ? 'Nyala' : 'Mati';
}
$('#musicBtn').onclick = () => { A.setMusic(!A.isMusicOn()); syncAudioBtns(); toast(A.isMusicOn() ? 'Musik latar menyala' : 'Musik latar dimatikan'); };
$('#sfxBtn').onclick = () => { A.setSfx(!A.isSfxOn()); syncAudioBtns(); toast(A.isSfxOn() ? 'Efek suara menyala' : 'Efek suara dimatikan'); };
syncAudioBtns();

// ---------- home ----------
function buildCast() { // barisan 20 tamu di layar awal (foto dirender bertahap)
  const track = $('#castTrack');
  const items = META.characters.map(c => {
    const it = el('figure', 'cast-item');
    const face = el('span', 'cast-face'); face.setAttribute('aria-hidden', 'true');
    const img = el('img'); img.alt = ''; img.dataset.id = c.id; img.decoding = 'async';
    face.append(img);
    it.append(face, el('figcaption', null, c.name));
    return it;
  });
  track.replaceChildren(...items, ...items.map(n => { const k = n.cloneNode(true); k.setAttribute('aria-hidden', 'true'); return k; }));
  warmAll(id => { for (const im of track.querySelectorAll(`img[data-id="${id}"]`)) { im.onload = () => im.classList.add('ready'); im.src = getPortrait(id); } });
}

// ---------- lobby ----------
$('#shareBtn').onclick = async () => {
  const link = `${location.origin}/?room=${state.code}`;
  try { if (navigator.share) await navigator.share({ title: 'Pesta Topeng', text: `${me ? me.name + ' mengundangmu' : 'Kamu diundang'} ke Pesta Topeng. Kode room: ${state.code}`, url: link }); else { await navigator.clipboard.writeText(link); toast('Link undangan disalin!'); } }
  catch { toast(link); }
};
$('#startBtn').onclick = () => emit('start_game');
function goHome() { socket.emit('leave'); store.clearRoom(); state = null; history.replaceState(null, '', '/'); $('#overlay').classList.add('hidden'); stopConfetti(); show('home'); }
$('#leaveBtn').onclick = goHome;
$('#homeBtn').onclick = () => { goHome(); Home.selectTab(Home.acct.profile ? 'rank' : 'play'); };
function onJoined(r) { store.set({ code: r.code, playerId: r.playerId }); Home.clearReward(); }
$('#againBtn').onclick = () => { $('#againBtn').disabled = true; emit('rematch').then(r => { $('#againBtn').disabled = false; if (r && r.error) toast(r.error); }); };
$('#toLobbyBtn').onclick = () => emit('play_again');
$('#closeOverlay').onclick = () => { overlayClosed = true; $('#overlay').classList.add('hidden'); stopConfetti(); };
$('#identityBtn').onclick = () => {
  showId = !showId;
  if (showId) A.sfx.card();
  renderGame();
  // buka kartu → kamera menyorot karaktermu di papan
  if (showId && me && me.alive && priv.charId && board) { board.spotlightMine(priv.charId); setTimeout(() => A.sfx.land && A.sfx.land(), 350); }
};

// ---------- socket ----------
// ---------- akun ----------
let authToken = null, sentToken;
async function sendAuth(fresh) {
  sentToken = authToken;
  const r = await new Promise(res => socket.emit('auth', { token: authToken }, res));
  if (r) Home.applyMe(r, { fresh });
  if (r && r.error) toast(r.error, 'error');
}
function onAuthToken(token, event) {
  authToken = token;
  if (socket.connected && token !== sentToken) sendAuth(event === 'SIGNED_IN');
}
socket.on('reward', r => { Home.setReward(r); if (state && state.phase === 'GAME_OVER') render(); });

socket.on('connect', async () => {
  $('#conn').classList.add('hidden');
  await sendAuth(false);
  if (shown === 'home' || !shown) Home.subscribeRooms(true);
  const s = store.get();
  if (s.code && s.playerId) {
    const r = await new Promise(res => socket.emit('join_room', { code: s.code, playerId: s.playerId }, res));
    if (r.error) { store.clearRoom(); show('home'); }
  }
});
socket.on('disconnect', () => $('#conn').classList.remove('hidden'));
socket.on('connect_error', () => $('#conn').classList.remove('hidden'));
socket.on('state', s => {
  const prev = state;
  const prevPhase = prev && prev.phase;
  state = s; clockOffset = s.serverNow - Date.now();
  if (s.tutorial && (!prev || prev.code !== s.code)) coachSeen = new Set();
  if (!prev || prev.code !== s.code) loadNotes();
  me = s.players.find(p => p.id === store.get().playerId) || null;
  if (s.phase !== 'PLAYING' || s.step !== 'MOVE') selected = null;
  if (s.step !== 'BLACK') killSel = null;
  if (prevPhase !== 'GAME_OVER' && s.phase === 'GAME_OVER') { overlayClosed = false; celebrated = false; }
  if (s.phase === 'ORDER' && prevPhase === 'GAME_OVER') { stopConfetti(); Home.clearReward(); overlayClosed = false; prevTurnId = null; seenEventId = s.lastEvent ? s.lastEvent.id : seenEventId; fxQueue.length = 0; }
  if (s.phase === 'ORDER' && (prevPhase === 'LOBBY' || prevPhase === 'GAME_OVER')) { showId = false; introPending = true; A.sfx.start(); orderSeen = {}; orderDoneShown = false; orderFinishing = false; clearTimeout(orderHideT); orderHideT = null; A.preloadVoice(voAll()); setTimeout(() => A.say('order', { ttl: 8000 }), 900); notes = {}; saveNotes(); }
  if (s.phase === 'ORDER' && prev && prev.phase === 'ORDER' && s.order && prev.order && s.order.round > prev.order.round) A.say('tie', { prio: 2 });
  if (s.phase === 'PLAYING' && prevPhase !== 'PLAYING') {
    showId = false;
    if (prevPhase === 'LOBBY') { introPending = true; A.sfx.start(); A.preloadVoice(voAll()); setTimeout(() => { banner('PESTA DIMULAI', 'Temukan topeng lawan!'); A.say('start'); }, 50); }
    if (prevPhase === 'ORDER') showOrderDone();
  }
  if (s.phase === 'LOBBY' && prevPhase === 'GAME_OVER') { stopConfetti(); Home.clearReward(); }
  if (s.phase === 'PLAYING' && prevPhase !== 'PLAYING') Home.clearReward();
  // pemain baru bergabung di lobby
  if (s.phase === 'LOBBY' && prev && s.players.length > prevPlayerCount) A.sfx.join();
  prevPlayerCount = s.players.length;
  // giliran berganti
  if (s.turnEndsAt && (!prev || prev.turnEndsAt !== s.turnEndsAt)) turnStartAt = Date.now() + clockOffset;
  if (s.phase === 'PLAYING' && s.turnPlayerId !== prevTurnId) {
    if (me && s.turnPlayerId === me.id && prevTurnId !== null) setTimeout(() => { if (state.turnPlayerId === me.id) { banner('GILIRANMU', 'Lempar dadu!'); A.sfx.turn(); A.say('turn', { prio: 0, ttl: 6000 }); vibrate([40, 60, 40]); } }, 700);
    prevTurnId = s.turnPlayerId;
  }
  // event dramatis (buka topeng / kartu) — antrikan, tampilkan setelah dadu berhenti
  if (s.lastEvent && s.lastEvent.id !== seenEventId) {
    if (seenEventId !== null && ['eliminated', 'killed', 'left'].includes(s.lastEvent.type)) fxQueue.push(s.lastEvent);
    if (seenEventId !== null && s.lastEvent.type === 'forfeit' && s.lastEvent.by !== me?.id) { toast(`${pname(s.lastEvent.by)} keluar dari pesta`); A.sfx.poof && A.sfx.poof(); A.say('forfeit', { ttl: 8000 }); }
    seenEventId = s.lastEvent.id;
  }
  const aliveN = s.players.filter(p => p.alive).length;
  if (s.phase === 'PLAYING' && prev && prev.phase === 'PLAYING' && aliveN === 2 && prev.players.filter(p => p.alive).length > 2) A.say('last_two', { ttl: 15000 });
  A.setIntensity(s.phase === 'PLAYING' && aliveN <= 2 ? 1 : 0);
  render();
  processFx();
});
socket.on('private', p => { priv = p; if (state) render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !socket.connected) socket.connect(); });
setTimeout(() => { if (!socket.connected) $('#conn').classList.remove('hidden'); }, 3000);

// ---------- render ----------
// ---------- lempar 2 dadu: urutan giliran ----------
let voTimerKey = null;
const VO_BASE = ['order', 'tie', 'order_done', 'start', 'turn', 'black', 'unmask', 'guest', 'card', 'forfeit', 'last_two', 'timer', 'you_out', 'gameover', 'win', 'i-sumatera', 'i-kalimantan', 'i-jawa', 'i-sulawesi', 'i-papua'];
const voAll = () => VO_BASE.concat((META ? META.characters : []).map(c => `c-${c.id}`));
let orderSeen = {}, orderDoneShown = false, orderHideT = null, myOrderRolling = false, orderFinishing = false;
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
function dieFace(n) {
  const d = el('span', 'pip-die'); d.dataset.n = n;
  d.innerHTML = '<svg viewBox="0 0 30 30" aria-hidden="true"><rect x="1" y="1" width="28" height="28" rx="7"/>' + (PIPS[n] || []).map(([x, y]) => `<circle cx="${7.5 + x * 7.5}" cy="${7.5 + y * 7.5}" r="2.7"/>`).join('') + '</svg>';
  return d;
}
function tumble(wrap, final, onDone) { // animasi dadu berputar lalu berhenti di angka dari server
  wrap.classList.add('rolling');
  let n = 0;
  const iv = setInterval(() => { wrap.replaceChildren(dieFace(1 + Math.floor(Math.random() * 6)), dieFace(1 + Math.floor(Math.random() * 6))); if (++n % 2) A.sfx.diceShake && A.sfx.diceShake(); }, 90);
  setTimeout(() => { clearInterval(iv); wrap.classList.remove('rolling'); wrap.replaceChildren(dieFace(final[0]), dieFace(final[1])); A.sfx.dice && A.sfx.dice(); onDone && onDone(); }, document.body.classList.contains('reduce-motion') ? 150 : 750);
}
function renderOrder() {
  const panel = $('#orderPanel'), s = state;
  const finishing = orderFinishing && s && s.phase !== 'ORDER'; // lemparan terakhir masuk, server sudah PLAYING
  if (!s || !s.order || (s.phase !== 'ORDER' && !finishing && !orderHideT)) { if (!orderHideT) panel.classList.add('hidden'); return; }
  if (s.phase !== 'ORDER' && !finishing) return; // daftar akhir sedang tampil
  if (finishing && panel.classList.contains('done')) return;
  panel.classList.remove('hidden'); panel.classList.remove('done');
  const o = s.order, domIdx = id => [...$('#opList').children].findIndex(li => li.dataset.id === id);
  let alive = s.players.filter(p => p.alive);
  if (finishing) alive = alive.filter(p => o.last[p.id]).sort((a, b) => domIdx(a.id) - domIdx(b.id)); // jangan lompat urutan dulu
  $('#opKicker').textContent = o.round > 1 ? `Lempar ulang, ronde ${o.round}` : 'Urutan giliran';
  $('#opTitle').textContent = o.round > 1 ? 'Seri! Lempar lagi' : 'Siapa jalan duluan?';
  $('#opSub').textContent = o.round > 1 ? 'Hanya pemain yang seri yang melempar ulang.' : 'Semua pemain melempar 2 dadu. Total tertinggi jalan pertama.';
  const list = $('#opList'); const rows = new Map([...list.children].map(li => [li.dataset.id, li]));
  list.replaceChildren(...alive.map(p => {
    const li = rows.get(p.id) || el('li'); li.dataset.id = p.id; li.className = 'op-row' + (p.id === me.id ? ' me' : '') + (o.pending.includes(p.id) ? ' waiting' : '');
    const last = o.last[p.id], key = last ? `${p.id}:${last.round}` : null;
    if (!li.firstChild) {
      const who = el('span', 'op-who'); who.append(Home.avatar(p.name, p.avatarUrl, 'p-avatar sm'), el('b', null, p.name + (p.id === me.id ? ' (kamu)' : '')));
      li.append(who, el('span', 'op-dice'), el('span', 'op-total'));
    }
    const dice = li.querySelector('.op-dice'), tot = li.querySelector('.op-total');
    if (o.pending.includes(p.id)) {
      if (!dice.classList.contains('rolling')) { dice.replaceChildren(el('span', 'op-wait', p.id === me.id ? 'giliranmu' : 'menunggu…')); tot.textContent = ''; }
    } else if (last && orderSeen[p.id] !== key) {
      orderSeen[p.id] = key;
      tumble(dice, last.dice, () => { tot.textContent = last.total; tot.classList.add('pop'); });
    } else if (last && !dice.classList.contains('rolling') && !dice.querySelector('.pip-die')) {
      dice.replaceChildren(dieFace(last.dice[0]), dieFace(last.dice[1])); tot.textContent = last.total;
    }
    if (o.tied && o.tied.includes(p.id) && o.pending.includes(p.id)) li.classList.add('tied');
    return li;
  }));
}
function showOrderDone() {
  const s = state, o = s.order; if (!o || !o.done || orderDoneShown) return;
  orderDoneShown = true; orderFinishing = true; // render() berikutnya memutar dadu lemparan terakhir
  const panel = $('#orderPanel'), list = $('#opList');
  const show = () => {
    orderFinishing = false;
    panel.classList.remove('hidden'); panel.classList.add('done');
    $('#opKicker').textContent = 'Urutan giliran'; $('#opTitle').textContent = `${pname(o.done[0].id)} jalan duluan!`; $('#opSub').textContent = 'Giliran berjalan sesuai urutan ini.';
    list.replaceChildren(...o.done.map(d => {
      const li = el('li', 'op-row final' + (d.id === me.id ? ' me' : ''));
      const who = el('span', 'op-who'); who.append(el('span', `place p${Math.min(d.pos, 4)}`, String(d.pos)), el('b', null, pname(d.id) + (d.id === me.id ? ' (kamu)' : '')));
      li.append(who, el('span', 'op-total', d.scores.join(' → ')));
      return li;
    }));
    A.sfx.turn && A.sfx.turn(); A.say('order_done', { prio: 2 });
    clearTimeout(orderHideT);
    orderHideT = setTimeout(() => { orderHideT = null; panel.classList.add('hidden'); banner('PESTA DIMULAI', `${pname(o.done[0].id)} jalan duluan`); A.say('start', { ttl: 6000 }); }, 2800);
  };
  // tunggu animasi dadu terakhir selesai
  setTimeout(show, document.body.classList.contains('reduce-motion') ? 200 : 900);
}

function render() {
  if (!state || !me) return show('home');
  if (state.phase === 'LOBBY') { renderLobby(); show('lobby'); }
  else {
    show('game');
    if (!board) { try { initBoard(); } catch (e) { console.error(e); toast('Browser ini tidak mendukung WebGL/3D.', 'error'); } }
    if (board) { board.myId = me.id; board.update(state, {}); if (introPending) { introPending = false; board.intro(); } }
    renderGame();
    renderOrder();
    renderCoach();
  }
  const over = state.phase === 'GAME_OVER';
  const busy = board && (board.rolling || fxBusy);
  const showOver = over && !overlayClosed && !busy;
  $('#overlay').classList.toggle('hidden', !showOver);
  if (over && busy) setTimeout(render, 900);
  if (showOver) renderOverlay();
}

function playerItem(p, opts = {}) {
  const li = el('li', (p.alive ? '' : 'dead') + (p.id === me.id ? ' self' : ''));
  const left = el('span', 'pname');
  const av = Home.avatar(p.name, p.avatarUrl); if (p.bot) av.classList.add('bot'); left.append(av);
  const nm = el('span', 'pn-wrap');
  const line = el('span', 'pn-line');
  line.append(el('span', 'pn', p.name));
  if (p.id === state.hostId) { const t = el('span', 'host-ic'); t.innerHTML = ICON.crown; t.title = 'Host'; t.append(el('span', 'sr-only', 'host')); line.append(t); }
  if (p.id === me.id) line.append(el('span', 'you', 'kamu'));
  nm.append(line);
  // baris kedua: identitas akun, tamu, atau offline (bukan tumpukan badge)
  const sub = el('small', 'pid');
  if (p.bot) sub.textContent = `bot · ${p.bot}`;
  else if (!p.connected) { sub.classList.add('off'); sub.textContent = 'offline'; }
  else if (p.guest) sub.textContent = 'tamu · tanpa poin';
  else if (p.publicId) sub.textContent = '#' + p.publicId + (p.tier && p.tier.min > 0 && !opts.game ? ' · ' + p.tier.name : '');
  if (sub.textContent) nm.append(sub);
  left.append(nm);
  li.append(left);
  const right = el('span', 'pmeta');
  if (opts.game) {
    if (p.revealed) { const c = ch(p.revealed); right.append(el('span', 'revealed', c.name)); }
    if (p.cards.length) right.append(el('span', 'cards', `${p.cards.length}/3 kartu`));
    if (p.id === state.turnPlayerId) li.classList.add('turn');
  }
  if (opts.removable && p.bot) {
    const x = el('button', 'icon-btn sm kick'); x.type = 'button'; x.setAttribute('aria-label', `Keluarkan ${p.name}`); x.title = 'Keluarkan bot';
    x.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    x.onclick = () => { A.sfx.click && A.sfx.click(); emit('remove_bot', { id: p.id }); };
    right.append(x);
  }
  li.append(right);
  return li;
}

function renderLobby() {
  $('#lobbyCode').textContent = state.code;
  if (location.search !== `?room=${state.code}`) history.replaceState(null, '', `/?room=${state.code}`);
  $('#lobbyCount').textContent = `${state.players.length}/${META.maxPlayers}`;
  const ul = $('#lobbyPlayers');
  const known = new Set([...ul.children].map(li => li.dataset.id));
  const isHost = me.id === state.hostId, enough = state.players.length >= META.minPlayers;
  ul.replaceChildren(...state.players.map(p => { const li = playerItem(p, { removable: isHost }); li.dataset.id = p.id; if (!known.has(p.id)) li.classList.add('pop'); return li; }));
  for (let i = state.players.length; i < Math.max(META.minPlayers, state.players.length); i++) ul.append(el('li', 'slot', 'Kursi kosong'));
  renderBotRow(isHost);
  const humans = state.players.filter(p => !p.bot).length, bots = state.players.length - humans;
  renderVisRow(isHost);
  $('#startBtn').classList.toggle('hidden', !isHost);
  $('#startBtn').disabled = !enough;
  $('#lobbyHint').textContent = !enough
    ? (isHost ? `Butuh minimal ${META.minPlayers} pemain. Bagikan kode, atau isi kursi kosong dengan bot.` : `Butuh minimal ${META.minPlayers} pemain. Ajak teman lewat kode di atas!`)
    : bots && humans < 2 ? 'Main lawan bot dihitung latihan: seru, tapi tanpa poin.'
    : bots ? 'Ada bot di meja: poin hanya dihitung antar-manusia.'
    : isHost ? 'Bisa mulai kapan saja. Room menampung sampai 8 pemain.' : `Menunggu ${pname(state.hostId)} memulai…`;
}

const BOT_PICK = [
  ['nekat', 'Nekat', 'Gampang curiga, cepat buka topeng'],
  ['licik', 'Licik', 'Pandai menyamar, suka buka kartu'],
  ['waspada', 'Waspada', 'Selalu cari keramaian'],
];
function renderBotRow(isHost) {
  const row = $('#botRow'), full = state.players.length >= META.maxPlayers;
  const k = `${isHost}:${full}`;
  if (row.dataset.k === k) return;
  row.dataset.k = k; row.replaceChildren();
  row.classList.toggle('hidden', !isHost || full);
  if (!isHost || full) return;
  row.append(el('p', 'bot-row-title', 'Kursi kosong? Isi dengan bot'));
  const grid = el('div', 'bot-grid');
  for (const [id, label, desc] of BOT_PICK) {
    const b = el('button', 'bot-pick'); b.type = 'button';
    b.append(el('b', null, label), el('small', null, desc));
    b.onclick = () => { b.disabled = true; A.sfx.click && A.sfx.click(); emit('add_bot', { style: id }).then(r => { b.disabled = false; if (r && r.error) toast(r.error); }); };
    grid.append(b);
  }
  row.append(grid);
}

function renderVisRow(isHost) {
  const row = $('#visRow'), pub = state.visibility === 'public';
  if (row.dataset.k === `${isHost}:${pub}`) return;
  row.dataset.k = `${isHost}:${pub}`;
  row.replaceChildren();
  const badge = el('span', 'vis-badge ' + (pub ? 'pub' : 'priv'), pub ? 'Terbuka: tampil di daftar Gabung' : 'Pakai kode: hanya yang punya kode bisa masuk');
  row.append(badge);
  if (isHost) {
    const b = el('button', 'link-btn', pub ? 'Ubah ke pakai kode' : 'Ubah ke terbuka');
    b.onclick = () => emit('set_visibility', { visibility: pub ? 'private' : 'public' }).then(r => r.ok && toast(pub ? 'Pesta sekarang khusus yang punya kode' : 'Pesta sekarang tampil di daftar Gabung'));
    row.append(b);
  }
}

// ---------- 3D board ----------
function initBoard() {
  board = window.__board = new Board3D($('#board3d'), META, {
    onFigure(id, room) {
      const s = state; if (!s) return;
      const myTurn = s.turnPlayerId === me.id && s.phase === 'PLAYING' && !board.rolling;
      const c = ch(id);
      if (myTurn && s.step === 'MOVE' && s.legalMoves.some(m => m.charId === id)) { selected = selected === id ? null : id; A.sfx.pick(); return renderGame(); }
      if (myTurn && s.step === 'BLACK' && (priv.killTargets || []).includes(id)) {
        if (killSel === id) { killSel = null; emit('kill', { targetId: id }); } else { killSel = id; A.sfx.pick(); vibrate(20); renderGame(); }
        return;
      }
      const guessBy = Object.keys(notes).find(pid => notes[pid] === id && state.players.some(p => p.id === pid && p.alive));
      board.peekFigure(id, guessBy ? `tebakanmu: ${pname(guessBy)}` : null); A.sfx.hover && A.sfx.hover(); // label profesi muncul di atas bidak
    },
    onDragStart(id) { A.sfx.pick(); vibrate(15); if (selected !== id) { selected = id; renderGame(); } },
    onDrop(id, room, spot) { A.sfx.land(); vibrate(25); emit('move', { charId: id, to: room, spot }); selected = null; renderGame(); },
    onCinematicStart(ev) {
      A.sfx.swoosh(1.4);
      toast(`${pname(ev.by)} memindahkan ${ch(ev.charId).name}: ${META.roomLabel[ev.from]} → ${META.roomLabel[ev.to]}`);
    },
    onCinematicLand() { A.sfx.land(); },
    onDragCancel(id, room) { if (room) toast(`${ch(id).name} tidak bisa ke ${META.roomLabel[room]}. Lepaskan di pulau berbingkai hijau.`, 'error'); },
    onRoom(room) {
      if (!selected || !state) return;
      if (state.legalMoves.some(m => m.charId === selected && m.to === room)) { A.sfx.land(); emit('move', { charId: selected, to: room }); selected = null; renderGame(); }
      else toast('Tamu itu tidak bisa pindah ke pulau tersebut.', 'error');
    },
    onDiceTap() { rollDice(); },
    onHover() { A.sfx.hover(); },
    onRollStart() { $('#rollBanner').classList.add('hidden'); A.sfx.diceShake(); renderGame(); },
    onDiceBounce(strength) { A.sfx.dice(strength); },
    onRollEnd() {
      const b = $('#rollBanner'), d = state && state.die;
      if (d) { b.textContent = DIE_LABEL[d]; b.className = `roll-banner die-${d}`; clearTimeout(b.t); b.t = setTimeout(() => b.classList.add('hidden'), 1700); }
      if (d === 'hitam') { vibrate([30, 40, 30]); board.panic(); }
      if (d) A.say(d === 'hitam' ? 'black' : `i-${d}`, { prio: d === 'hitam' ? 1 : 0, ttl: 2500 });
      renderGame(); processFx();
    },
  });
}
function rollDice() {
  if (!state || state.turnPlayerId !== me.id || state.step !== 'ROLL' || (board && board.rolling)) return;
  vibrate(20); emit('roll');
}
$('#camBtn').onclick = () => board && board.resetCamera();
$('#logBtn').onclick = () => $('#drawer').classList.toggle('hidden');
// ---------- keluar dari pesta ----------
let exitFocus = null;
function openExit() {
  const s = state;
  const playing = s && ['PLAYING', 'ORDER'].includes(s.phase) && me && me.alive;
  $('#exitTitle').textContent = playing ? 'Keluar dari pesta?' : 'Kembali ke beranda?';
  $('#exitText').textContent = playing
    ? 'Kamu dianggap menyerah: posisimu jadi paling bawah dan tidak dapat poin. Karaktermu tetap di papan sebagai tamu biasa, identitasnya tidak dibuka.'
    : 'Kamu keluar dari room ini dan kembali ke beranda.';
  $('#exitConfirm').textContent = playing ? 'Ya, menyerah & keluar' : 'Ya, keluar';
  $('#exitCancel').textContent = playing ? 'Lanjut main' : 'Batal';
  $('#drawer').classList.add('hidden');
  exitFocus = document.activeElement;
  $('#exitDialog').classList.remove('hidden');
  setTimeout(() => $('#exitCancel').focus(), 30);
}
function closeExit() { $('#exitDialog').classList.add('hidden'); if (exitFocus && exitFocus.focus) exitFocus.focus(); }
$('#exitBtn').onclick = openExit;
$('#drawerExit').onclick = openExit;
$('#exitCancel').onclick = closeExit;
$('#exitConfirm').onclick = () => { closeExit(); Home.selectTab('play'); goHome(); toast('Kamu keluar dari pesta'); };
$('#exitDialog').addEventListener('keydown', e => {
  if (e.key === 'Escape') closeExit();
  if (e.key === 'Tab') { const a = $('#exitConfirm'), b = $('#exitCancel'); if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); } }
});
$('#exitDialog').addEventListener('click', e => { if (e.target.id === 'exitDialog') closeExit(); });
$('#drawerMusic').onclick = () => $('#musicBtn').click();
$('#drawerVoice').onclick = () => { A.setVoice(!A.isVoiceOn()); syncAudioBtns(); toast(A.isVoiceOn() ? 'Narator menyala' : 'Narator dimatikan'); if (A.isVoiceOn()) A.preloadVoice(voAll()); };
$('#drawerClose').onclick = () => $('#drawer').classList.add('hidden');

// tombol "Kurangi animasi" (pilihan pemain, disimpan di perangkat)
const rmToggle = $('#reduceMotion');
const applyRM = on => { document.body.classList.toggle('reduce-motion', on); setReducedMotion(on); };
try { rmToggle.checked = localStorage.getItem('pt-reduce-motion') === '1'; } catch {}
applyRM(rmToggle.checked);
rmToggle.addEventListener('change', () => { try { localStorage.setItem('pt-reduce-motion', rmToggle.checked ? '1' : '0'); } catch {} applyRM(rmToggle.checked); });

// ---------- catatan tersangka (privat, di perangkat ini) ----------
let notes = {};
const notesKey = () => `pt-notes:${state && state.code}`;
function loadNotes() { try { notes = JSON.parse(sessionStorage.getItem(notesKey()) || '{}') || {}; } catch { notes = {}; } }
function saveNotes() { try { sessionStorage.setItem(notesKey(), JSON.stringify(notes)); } catch {} }
function openNote(pid) {
  const p = state.players.find(x => x.id === pid); if (!p) return;
  const sheet = $('#noteSheet'), grid = $('#noteGrid');
  $('#noteTitle').textContent = `Menurutmu, ${p.name} itu siapa?`;
  const onBoard = Object.keys(state.figures).filter(id => id !== priv.charId);
  grid.replaceChildren(...META.characters.filter(c => onBoard.includes(c.id)).map(c => {
    const b = el('button', 'note-opt' + (notes[pid] === c.id ? ' on' : '')); b.type = 'button';
    const taken = Object.keys(notes).find(x => x !== pid && notes[x] === c.id);
    const im = el('img'); im.src = getPortrait(c.id); im.alt = ''; b.append(im, el('span', null, c.name));
    if (taken) b.append(el('small', null, pname(taken)));
    b.onclick = () => { notes[pid] = notes[pid] === c.id ? undefined : c.id; if (!notes[pid]) delete notes[pid]; if (taken && notes[pid]) delete notes[taken]; saveNotes(); A.sfx.pick && A.sfx.pick(); closeNote(); renderGame(); };
    return b;
  }));
  $('#noteClear').classList.toggle('hidden', !notes[pid]);
  $('#noteClear').onclick = () => { delete notes[pid]; saveNotes(); closeNote(); renderGame(); };
  sheet.classList.remove('hidden'); A.sfx.click && A.sfx.click();
}
function closeNote() { $('#noteSheet').classList.add('hidden'); }
$('#noteClose').onclick = closeNote;
$('#noteSheet').addEventListener('click', e => { if (e.target.id === 'noteSheet') closeNote(); });

// ---------- panduan ronde latihan ----------
// Muncul satu per satu sesuai situasi, masing-masing sekali per ronde latihan.
const COACH = [
  ['order', s => s.phase === 'ORDER', 'Semua pemain melempar 2 dadu. Total tertinggi jalan duluan. Ketuk <b>Lempar 2 Dadu</b>.'],
  ['identity', s => s.phase === 'PLAYING' && !showId, 'Kamu diam-diam adalah salah satu dari 20 tamu di papan. Ketuk <b>kartu topeng</b> di bawah untuk melihat siapa kamu. Rahasiakan!'],
  ['watch', s => s.phase === 'PLAYING' && s.turnPlayerId !== me.id, 'Giliran lawan. Perhatikan tamu mana yang mereka geser. Ketuk <b>nama lawan</b> di atas untuk mencatat tebakanmu.'],
  ['roll', s => s.phase === 'PLAYING' && s.turnPlayerId === me.id && s.step === 'ROLL', 'Giliranmu! Lempar dadu. Dadu menunjuk <b>pulau</b> (5 sisi) atau <b>hitam</b> (2 sisi).'],
  ['move', s => s.phase === 'PLAYING' && s.turnPlayerId === me.id && s.step === 'MOVE', 'Geser <b>satu tamu mana saja</b> masuk ke / keluar dari pulau di dadu. Jaga tamumu agar tidak sendirian, tapi jangan terlalu sering menggesernya: lawan memperhatikan.'],
  ['black', s => s.phase === 'PLAYING' && s.turnPlayerId === me.id && s.step === 'BLACK', 'Dadu hitam! Ketuk tamu yang <b>sepulau dengan tamumu</b> untuk membuka topengnya, atau <b>buka kartu</b> untuk memulangkan tamu yang pasti tak bersalah.'],
  ['alone', s => s.phase === 'PLAYING' && priv.charId && s.figures[priv.charId] && Object.values(s.figures).filter(r => r === s.figures[priv.charId]).length === 1, 'Awas, tamumu <b>sendirian</b> di pulaunya! Kalau kamu dapat dadu hitam sekarang, topengmu langsung terbuka.'],
];
let coachSeen = new Set(), coachCur = null;
function renderCoach() {
  const box = $('#coach'), s = state;
  if (!s || !s.tutorial || !['ORDER', 'PLAYING'].includes(s.phase) || !me || !me.alive) { box.classList.add('hidden'); coachCur = null; return; }
  if (coachCur && COACH.find(c => c[0] === coachCur)[1](s)) return; // langkah saat ini masih relevan
  const next = COACH.find(([k, when]) => !coachSeen.has(k) && when(s));
  if (!next) { box.classList.add('hidden'); coachCur = null; return; }
  coachCur = next[0]; coachSeen.add(next[0]);
  $('#coachText').innerHTML = next[2];
  box.classList.remove('hidden'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
}
$('#coachOk').onclick = () => { $('#coach').classList.add('hidden'); coachCur = null; renderCoach(); };

// ---------- reaksi cepat ----------
const REACT = { curiga: ['🤨', 'Curiga…'], waduh: ['😱', 'Waduh!'], sstt: ['🤫', 'Sstt…'], wkwk: ['😂', 'Wkwk'], bukan: ['🙅', 'Bukan aku!'], mantap: ['👏', 'Mantap'] };
(() => {
  const tray = $('#reactTray'), btn = $('#reactBtn');
  for (const [k, [emo, label]] of Object.entries(REACT)) {
    const b = el('button', 'react-opt'); b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.append(el('span', 'ro-emo', emo), el('span', 'ro-label', label));
    b.onclick = () => { socket.emit('react', { k }); closeTray(); };
    tray.append(b);
  }
  const closeTray = () => { tray.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = e => { e.stopPropagation(); const open = tray.classList.toggle('hidden') === false; btn.setAttribute('aria-expanded', String(open)); A.sfx.click && A.sfx.click(); };
  document.addEventListener('pointerdown', e => { if (!tray.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closeTray(); });
})();
socket.on('reaction', ({ pid, k }) => {
  if (!state || !REACT[k]) return;
  const p = state.players.find(x => x.id === pid); if (!p) return;
  const layer = $('#reactLayer'), chipEl = document.querySelector(`#playerStrip .chip[data-id="${pid}"]`);
  const b = el('div', 'react-bubble' + (pid === me?.id ? ' mine' : ''));
  b.append(el('span', 'rb-emo', REACT[k][0]), el('span', 'rb-text', REACT[k][1]), el('span', 'rb-who', p.name));
  const lr = layer.getBoundingClientRect();
  let x = lr.width / 2;
  if (chipEl) { const cr = chipEl.getBoundingClientRect(); x = Math.min(lr.width - 90, Math.max(90, cr.left + cr.width / 2 - lr.left)); }
  b.style.left = `${x}px`;
  layer.append(b);
  A.sfx.hover && A.sfx.hover();
  if (chipEl) { chipEl.classList.remove('reacting'); void chipEl.offsetWidth; chipEl.classList.add('reacting'); }
  setTimeout(() => b.remove(), 2600);
  while (layer.children.length > 4) layer.firstChild.remove();
});

function chip(p, reuse) {
  // elemen chip dipakai ulang agar ketukan tidak hilang saat state berganti di tengah sentuhan
  const c = reuse || el('div', 'chip');
  if (reuse) { c.className = 'chip'; c.replaceChildren(); c.onclick = null; c.onkeydown = null; c.removeAttribute('role'); c.removeAttribute('tabindex'); c.removeAttribute('aria-label'); }
  c.dataset.id = p.id;
  const canNote = p.id !== me.id && p.alive && !p.revealed && ['PLAYING', 'ORDER'].includes(state.phase);
  if (canNote) { c.classList.add('notable'); c.tabIndex = 0; c.setAttribute('role', 'button'); c.setAttribute('aria-label', `Catat tebakan untuk ${p.name}`); c.onclick = () => openNote(p.id); c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(p.id); } }; }
  if (p.id === state.turnPlayerId) c.classList.add('turn');
  if (!p.alive) c.classList.add('dead');
  if (p.revealed) { const im = el('img', 'chip-av'); im.src = getPortrait(p.revealed); im.alt = ch(p.revealed).name; c.append(im); }
  else if (p.avatarUrl) c.append(Home.avatar(p.name, p.avatarUrl, 'chip-av initial'));
  else c.append(initialAvatar(p.name, 'chip-av initial'));
  c.append(el('span', 'chip-name', p.name + (p.id === me.id ? ' (kamu)' : '')));
  const g = canNote && notes[p.id] && state.figures[notes[p.id]] ? notes[p.id] : null;
  if (g) { const gi = el('span', 'chip-guess'); const im = el('img'); im.src = getPortrait(g); im.alt = ''; gi.append(im, el('span', 'cg-q', '?')); gi.title = `Tebakanmu: ${ch(g).name}`; c.append(gi); }
  if (p.forfeit) c.append(el('span', 'chip-off', 'keluar'));
  else if (!p.connected) c.append(el('span', 'chip-off', 'offline'));
  if (p.cards.length) { const cc = el('span', 'chip-cards'); cc.innerHTML = ICON.card; cc.append(String(p.cards.length)); cc.title = `${p.cards.length} kartu`; c.append(cc); }
  return c;
}

function renderGame() {
  const s = state; if (!s || !me) return;
  const rolling = board && board.rolling;
  const myTurn = s.turnPlayerId === me.id && s.phase === 'PLAYING';
  const ti = $('#turnInfo'); ti.replaceChildren();
  if (s.phase === 'GAME_OVER') ti.textContent = `Selesai — ${s.winnerId ? pname(s.winnerId) + ' menang!' : 'tanpa pemenang'}`;
  else if (s.phase === 'ORDER') { ti.append(el('b', null, 'Urutan giliran')); ti.classList.remove('mine'); }
  else { ti.append(el('b', null, myTurn ? 'Giliranmu!' : `Giliran ${pname(s.turnPlayerId)}`)); ti.classList.toggle('mine', myTurn); }
  const strip = $('#playerStrip'), oldChips = new Map([...strip.children].map(x => [x.dataset.id, x]));
  const chips = s.players.map(p => chip(p, oldChips.get(p.id)));
  if (chips.length !== strip.children.length || chips.some((x, i) => strip.children[i] !== x)) strip.replaceChildren(...chips);

  const myChar = priv.charId && ch(priv.charId);
  const idBtn = $('#identityBtn');
  idBtn.setAttribute('aria-pressed', String(showId));
  idBtn.classList.toggle('dead', !me.alive);
  const open = myChar && (showId || !me.alive);
  idBtn.classList.toggle('open', !!open);
  const av = $('#idAvatar');
  if (open) { const src = getPortrait(myChar.id); if (av.getAttribute('src') !== src) av.src = src; av.alt = `Foto ${myChar.name}`; }
  $('#idName').textContent = open ? myChar.name.toUpperCase() + (me.alive ? '' : ' · TERSINGKIR') : '';
  $('#identityText').textContent = !myChar ? '…' : open ? myChar.bio : 'Ketuk untuk lihat identitasmu';
  $('#idHint').textContent = !myChar ? '' : !me.alive ? 'Topengmu sudah terbuka.' : showId ? 'Karaktermu disorot cahaya emas "INI KAMU" di papan · ketuk untuk sembunyikan' : 'Jaga layarmu dari intipan!';

  const moves = s.legalMoves || [];
  const ui = {
    movable: myTurn && s.step === 'MOVE' ? [...new Set(moves.map(m => m.charId))] : [],
    dests: selected ? moves.filter(m => m.charId === selected).map(m => m.to) : [],
    targets: myTurn && s.step === 'BLACK' ? (priv.killTargets || []) : [],
    selected, killSel,
    mine: showId && me.alive ? priv.charId : null,
    canRoll: myTurn && s.step === 'ROLL' && me.alive,
  };
  if (board) board.setUI(ui);

  const ap = $('#actionPanel'); ap.replaceChildren();
  ap.classList.toggle('mine', myTurn && !rolling && s.phase === 'PLAYING');
  const msg = el('div', 'action-msg');
  if (s.phase === 'ORDER') {
    const mine = s.order.pending.includes(me.id);
    ap.classList.toggle('mine', mine);
    msg.textContent = mine ? 'Lempar 2 dadu untuk menentukan urutan giliran.' : 'Menunggu pemain lain melempar dadu…';
    if (mine) {
      const b = btnWithIcon('btn primary roll', ICON.dice, 'Lempar 2 Dadu');
      b.disabled = myOrderRolling;
      b.onclick = () => { myOrderRolling = true; b.disabled = true; const w = $(`#opList li[data-id="${me.id}"] .op-dice`); if (w) { w.classList.add('rolling'); w.replaceChildren(dieFace(1), dieFace(1)); } emit('order_roll').then(() => { myOrderRolling = false; }); };
      ap.append(b);
    }
  }
  else if (s.phase === 'GAME_OVER') msg.textContent = 'Permainan selesai.';
  else if (rolling) msg.textContent = 'Dadu sedang bergulir…';
  else if (!me.alive) msg.textContent = 'Kamu tersingkir. Tetap tonton, tapi jangan bocorkan identitas siapa pun!';
  else if (!myTurn) msg.textContent = s.step === 'ROLL' ? `${pname(s.turnPlayerId)} akan melempar dadu…` : s.step === 'MOVE' ? `${pname(s.turnPlayerId)} sedang memindahkan tamu…` : `${pname(s.turnPlayerId)} dapat HITAM dan sedang memutuskan…`;
  else if (s.step === 'ROLL') {
    msg.textContent = 'Lempar dadu: ketuk tombol atau dadu di meja.';
    const b = btnWithIcon('btn primary roll', ICON.dice, 'Lempar Dadu'); b.onclick = () => { b.disabled = true; rollDice(); }; ap.append(b);
  } else if (s.step === 'MOVE') {
    msg.textContent = selected
      ? `Geser ${ch(selected).name} ke pulau berbingkai hijau (atau ketuk pulaunya).`
      : `${DIE_LABEL[s.die]}: pindahkan satu tamu MASUK ke / KELUAR dari ${META.roomLabel[s.die]}. Tahan bidak bercincin emas, lalu geser.`;
  } else if (s.step === 'BLACK') {
    msg.textContent = killSel ? `Ketuk ${ch(killSel).name} sekali lagi untuk membuka topengnya.` : 'HITAM! Ketuk bidak bercincin merah (satu pulau denganmu) untuk membuka topengnya' + (priv.canDraw ? ', atau buka kartu tamu biasa.' : '. Kamu wajib membuka topeng seseorang.');
    if (priv.canDraw) { const b = btnWithIcon('btn', ICON.card, `Buka kartu tamu (${me.cards.length}/3)`); b.onclick = () => emit('draw'); ap.append(b); }
  }
  ap.prepend(msg);

  $('#gamePlayers').replaceChildren(...s.players.map(p => playerItem(p, { game: true })));
  $('#log').replaceChildren(...[...s.log].reverse().slice(0, 40).map(l => el('li', null, l.text)));
}

// ---------- momen dramatis ----------
function banner(title, sub) {
  const b = el('div', 'banner');
  b.append(el('div', 'banner-title', title)); if (sub) b.append(el('div', 'banner-sub', sub));
  $('#fx').append(b);
  afterPaint(() => { setTimeout(() => b.classList.add('out'), 1500); setTimeout(() => b.remove(), 1900); });
}
// jalankan setelah elemen benar-benar tergambar (aman walau perangkat sedang sibuk)
const afterPaint = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
let fxBusy = false;
function processFx() {
  if (fxBusy || !fxQueue.length || (board && board.rolling)) return;
  const ev = fxQueue.shift(); fxBusy = true;
  const done = () => { fxBusy = false; processFx(); if (state && state.phase === 'GAME_OVER') render(); };
  showReveal(ev, done);
}
function showReveal(ev, done) {
  const c = ch(ev.charId); if (!c) return done();
  const victim = ev.victim && state.players.find(p => p.id === ev.victim);
  const isMe = victim && victim.id === me.id;
  const card = el('div', 'reveal ' + ev.type);
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Pengungkapan');
  const inner = el('div', 'reveal-inner');
  const back = el('div', 'reveal-face back'); back.innerHTML = MASK_SVG;
  const front = el('div', 'reveal-face front');
  const pic = el('div', 'rv-portrait'); const im = el('img'); im.src = getPortrait(c.id); im.alt = `Foto ${c.name}`; pic.append(im);
  let kicker, title, line;
  if (ev.type === 'eliminated') {
    kicker = ev.self ? 'Sendirian!' : 'Topeng terbuka!';
    title = isMe ? 'Kamu tersingkir' : `${victim ? victim.name : '?'} tersingkir`;
    line = ev.self ? `Ketahuan sendirian. Ternyata dia adalah` : `${pname(ev.by)} membuka topeng. Ternyata dia adalah`;
    if (isMe) { A.sfx.lose(); vibrate([80, 60, 160]); } else { A.sfx.unmask(); vibrate(60); }
    A.say(['unmask', isMe ? 'you_out' : `c-${c.id}`], { prio: 2, ttl: 8000 });
    board && board.shake(0.16, 0.6);
  } else if (ev.type === 'killed') {
    kicker = 'Hanya tamu biasa'; title = 'Salah sasaran!'; line = `${pname(ev.by)} membuka topeng. Ternyata hanya`; A.sfx.poof(); A.say(['guest', `c-${c.id}`], { prio: 2, ttl: 8000 }); board && board.shake(0.06, 0.35);
  } else {
    kicker = 'Kartu dibuka'; title = `${pname(ev.by)} membuka kartu`; line = 'Tamu ini disuruh pulang dari pesta:'; A.sfx.card(); A.say(['card', `c-${c.id}`], { prio: 2, ttl: 8000 });
  }
  front.append(el('p', 'rv-kicker', kicker), pic, el('h3', 'rv-title', title), el('p', 'rv-line', line), el('p', 'rv-role', c.name.toUpperCase()));
  if (ev.room && META.roomLabel[ev.room]) { // pulau tempat topeng dibuka / tamu pulang
    const place = el('p', 'rv-place');
    place.append(el('span', null, ev.type === 'left' ? 'Pulang dari' : 'Di pulau'), el('b', `rv-room die-${ev.room}`, META.roomLabel[ev.room].toUpperCase()));
    front.append(place);
  }
  if (ev.type === 'eliminated') front.append(el('p', 'rv-bio', c.bio));
  front.append(el('p', 'rv-hint', 'Ketuk untuk lanjut'));
  inner.append(back, front); card.append(inner);
  $('#fx').append(card);
  afterPaint(() => { card.classList.add('show'); setTimeout(() => card.classList.add('flip'), ev.type === 'eliminated' && !document.body.classList.contains('reduce-motion') ? 900 : 380); });
  let closed = false;
  const close = () => { if (closed) return; closed = true; card.classList.add('out'); setTimeout(() => { card.remove(); done(); }, 280); };
  card.addEventListener('click', close);
  afterPaint(() => setTimeout(close, ev.type === 'eliminated' ? 4700 : 3000));
}

// ---------- layar akhir + konfeti ----------
let celebrated = false, confettiRAF = null;
function renderOverlay() {
  const s = state, w = s.players.find(p => p.id === s.winnerId);
  const wc = w && ch(w.revealed);
  $('#winAvatar').src = wc ? getPortrait(wc.id) : ''; $('#winAvatar').alt = wc ? `Foto ${wc.name}` : '';
  $('#winnerText').textContent = w ? (w.id === me.id ? 'Kamu menang!' : `${w.name} menang!`) : 'Tidak ada pemenang';
  $('#winnerSub').textContent = wc ? `Bertahan sampai akhir sebagai ${wc.name.toUpperCase()}.` : '';
  const order = s.standings || s.players.map((p, i) => ({ id: p.id, placement: i + 1, points: null }));
  $('#revealList').replaceChildren(...order.map(st => {
    const p = s.players.find(x => x.id === st.id); if (!p) return el('li');
    const li = el('li', (p.id === s.winnerId ? 'turn' : '') + (p.id === me.id ? ' mine' : ''));
    const c = ch(p.revealed);
    const who = el('span', 'pname');
    who.append(el('span', `place p${Math.min(st.placement, 4)}`, String(st.placement)));
    if (c) { const im = el('img', 'mini-avatar'); im.src = getPortrait(c.id); im.alt = `Foto ${c.name}`; who.append(im); }
    const nm = el('span', 'pn-wrap'); nm.append(el('span', 'pn', p.name), el('small', 'pid', c ? c.name : '?')); who.append(nm);
    li.append(who);
    if (p.bot) li.append(el('span', 'tag bot-tag', 'bot'));
    else if (st.practice) li.append(el('span', 'tag', 'latihan'));
    else if (st.points != null) li.append(el('span', 'st-pts' + (p.guest ? ' guest' : ''), `+${st.points}`));
    return li;
  }));
  renderRecap(s);
  Home.renderReward(s, me.id);
  const host = me.id === s.hostId;
  $('#againBtn').classList.toggle('hidden', !host); $('#toLobbyBtn').classList.toggle('hidden', !host);
  $('#waitHost').classList.toggle('hidden', host); $('#waitHost').textContent = `Menunggu ${pname(s.hostId)} memulai pesta berikutnya…`;
  if (!celebrated) { celebrated = true; A.sfx.win(); A.say(w && w.id === me.id ? ['gameover', 'win'] : ['gameover'], { prio: 2, ttl: 12000 }); if (w && w.id === me.id) vibrate([60, 40, 60, 40, 200]); startConfetti(); }
}
// ---------- rekap: gelar & momen pesta ----------
function renderRecap(s) {
  const r = s.recap, byId = id => s.players.find(p => p.id === id);
  const charName = id => (ch(id) || {}).name || '?';
  const room = id => (META.roomLabel[id] || '');
  const aw = $('#recapAwards'), mo = $('#recapMoments');
  aw.classList.toggle('hidden', !r || !r.awards.length);
  mo.classList.toggle('hidden', !r || !r.timeline.length);
  if (!r) return;
  aw.querySelector('.award-grid').replaceChildren(...r.awards.map(a => {
    const p = byId(a.playerId); if (!p) return el('span');
    const card = el('article', `award aw-${a.key}` + (p.id === me.id ? ' mine' : ''));
    const head = el('div', 'aw-head');
    if (p.revealed) { const im = el('img', 'aw-face'); im.src = getPortrait(p.revealed); im.alt = ''; head.append(im); }
    const t = el('div'); t.append(el('p', 'aw-title', a.title), el('p', 'aw-who', p.id === me.id ? `${p.name} (kamu)` : p.name)); head.append(t);
    card.append(head, el('p', 'aw-text', a.text));
    return card;
  }));
  mo.querySelector('.moments').replaceChildren(...r.timeline.map(t => {
    const li = el('li'), v = byId(t.victim), b = t.by && byId(t.by);
    li.append(el('span', 'm-turn', t.turn ? `Giliran ${t.turn}` : 'Awal'));
    const txt = el('span', 'm-text');
    if (t.type === 'forfeit') txt.append(el('b', null, v ? v.name : '?'), ' meninggalkan pesta lebih awal.');
    else if (b) txt.append(el('b', null, b.name), ' membongkar ', el('b', null, v ? v.name : '?'), ` — ternyata ${charName(t.charId)}, di ${room(t.room)}.`);
    else txt.append(el('b', null, v ? v.name : '?'), ` ketahuan sendirian di ${room(t.room)} — ternyata ${charName(t.charId)}.`);
    li.append(txt);
    return li;
  }));
  mo.querySelector('.recap-foot').textContent = [r.turns ? `${r.turns} giliran` : '', r.minutes ? `±${r.minutes} menit` : ''].filter(Boolean).join(' · ');
}
function resultText(s) {
  const w = s.players.find(p => p.id === s.winnerId), lines = [`Pesta Topeng — ${w ? `${w.name} menang sebagai ${(ch(w.revealed) || {}).name}` : 'tanpa pemenang'}!`];
  (s.standings || []).forEach(st => { const p = s.players.find(x => x.id === st.id); if (p) lines.push(`${st.placement}. ${p.name} — ${(ch(p.revealed) || {}).name || '?'}`); });
  (s.recap?.awards || []).forEach(a => { const p = s.players.find(x => x.id === a.playerId); if (p) lines.push(`🏅 ${a.title}: ${p.name}`); });
  return lines.join('\n');
}
$('#shareResultBtn').onclick = async () => {
  const text = resultText(state), url = location.origin;
  try { if (navigator.share) await navigator.share({ title: 'Hasil Pesta Topeng', text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Hasil pesta disalin!'); } } catch {}
};
function startConfetti() {
  if (document.body.classList.contains('reduce-motion')) return;
  const cv = $('#confetti'), g = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
  fit();
  const colors = ['#e6c36f', '#c9a14a', '#ef4444', '#2f63b8', '#2f8f57', '#f3ead7', '#d9a62e'];
  const P = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height, w: 6 + Math.random() * 8, h: 10 + Math.random() * 10, vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, r: Math.random() * 6, vr: -0.1 + Math.random() * 0.2, c: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const loop = t => {
    g.clearRect(0, 0, cv.width, cv.height);
    const fade = Math.max(0, 1 - (t - t0 - 4500) / 1500);
    for (const p of P) {
      p.y += p.vy * devicePixelRatio; p.x += (p.vx + Math.sin((t / 600) + p.r) * 0.8) * devicePixelRatio; p.r += p.vr;
      if (p.y > cv.height + 20 && fade > 0.9) { p.y = -20; p.x = Math.random() * cv.width; }
      g.save(); g.globalAlpha = fade; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
      g.fillRect(-p.w / 2 * devicePixelRatio, -p.h / 2 * devicePixelRatio, p.w * devicePixelRatio, p.h * Math.abs(Math.cos(p.r * 2)) * devicePixelRatio); g.restore();
    }
    confettiRAF = fade > 0 ? requestAnimationFrame(loop) : null;
  };
  cancelAnimationFrame(confettiRAF); confettiRAF = requestAnimationFrame(loop);
}
function stopConfetti() { cancelAnimationFrame(confettiRAF); confettiRAF = null; const cv = $('#confetti'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }

// ---------- timer cincin ----------
const RING = 2 * Math.PI * 15.5;
setInterval(() => {
  const t = $('#timer');
  if (!state || !['PLAYING', 'ORDER'].includes(state.phase) || !state.turnEndsAt) { t.classList.add('hidden'); return; }
  t.classList.remove('hidden');
  const nowS = Date.now() + clockOffset;
  const left = Math.max(0, state.turnEndsAt - nowS), total = Math.max(1000, state.turnEndsAt - turnStartAt);
  const sec = Math.ceil(left / 1000);
  $('#timerNum').textContent = sec;
  $('#timerRing').style.strokeDasharray = `${RING}`;
  $('#timerRing').style.strokeDashoffset = `${RING * (1 - Math.min(1, left / total))}`;
  t.classList.toggle('urgent', sec <= 10);
  t.setAttribute('aria-label', `Sisa waktu ${sec} detik`);
  if (me && state.turnPlayerId === me.id && sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; A.sfx.tick(sec <= 3); }
  if (me && state.phase === 'PLAYING' && state.turnPlayerId === me.id && sec === 10 && voTimerKey !== state.turnEndsAt) { voTimerKey = state.turnEndsAt; A.say('timer', { prio: 0 }); }
}, 200);

// ---------- boot ----------
const fontsReady = Promise.race([
  Promise.all(['400 64px Shrikhand', '800 64px "Plus Jakarta Sans"', '500 16px "Plus Jakarta Sans"', '600 16px "Plus Jakarta Sans"'].map(f => document.fonts.load(f).catch(() => null))),
  new Promise(r => setTimeout(r, 2500)),
]);
Promise.all([fetch('/meta').then(r => r.json()), fetch('/config').then(r => r.json()), fontsReady]).then(async ([m, config]) => {
  META = m; initPortraits(META.characters);
  try { buildCast(); } catch (e) { console.warn('cast', e); }
  Home.initHome(config, { socket, emit, toast, sfx: A.sfx, onJoined });
  await Auth.initAuth(config, onAuthToken);
  authToken = await Auth.currentToken();
  socket.connect();
}).catch(e => { console.error(e); $('#conn').classList.remove('hidden'); });

// pengujian otomatis: ?debug membuka akses ke efek (tidak dipakai saat bermain)
if (new URLSearchParams(location.search).has('debug')) window.__audio = A, window.__home = Home; window.__fx = { showReveal: (ev, cb) => showReveal(ev, cb || (() => {})), banner, startConfetti,
  showWin() { state = { ...state, phase: 'GAME_OVER', winnerId: me.id, players: state.players.map((p, i) => ({ ...p, alive: p.id === me.id, revealed: p.revealed || priv.charId && (p.id === me.id ? priv.charId : META.characters[i + 3].id) })) }; overlayClosed = false; celebrated = false; render(); } };
