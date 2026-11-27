// Beranda: akun, tab Main / Peringkat / Profil, daftar room publik, dialog username,
// dan kotak hadiah poin di layar akhir.
import * as Auth from './auth.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const reduced = () => document.body.classList.contains('reduce-motion');
const hue = str => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const fmt = n => Number(n || 0).toLocaleString('id-ID');
const SVG = '<svg class="ic sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const IC = {
  copy: SVG + '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  edit: SVG + '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  out: SVG + '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
  users: SVG + '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
  crown: SVG + '<path d="M2 18h20l-2-11-5 5-3-7-3 7-5-5z"/></svg>',
  check: SVG + '<path d="M20 6 9 17l-5-5"/></svg>',
  x: SVG + '<path d="M18 6 6 18M6 6l12 12"/></svg>',
  refresh: SVG + '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
};

let D; // dependensi dari app.js: { socket, emit, toast, sfx, onJoined }
let CONFIG = null;
export const acct = { mode: 'local', signedIn: false, needsUsername: false, profile: null, rank: null, suggestion: '' };
let visibility = 'public', rooms = [], lb = null, lbLoading = false, activeTab = 'play', afterName = null;

// ---------------------------------------------------------------- avatar ---
export function avatar(name, url, cls = 'p-avatar', frame = null) {
  if (frame && frame !== 'polos') cls += ` framed fr-${frame}`;
  const fallback = () => { const a = el('span', cls, (name || '?').trim().slice(0, 1).toUpperCase()); a.style.setProperty('--h', hue(name || '?')); a.setAttribute('aria-hidden', 'true'); return a; };
  if (!url) return fallback();
  const im = el('img', cls + ' photo'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.decoding = 'async'; im.src = url;
  im.onerror = () => im.replaceWith(fallback());
  return im;
}
// Lencana gelar dari misi (warna sesuai tingkat kesulitan)
export function titleBadge(t, small) {
  if (!t) return null;
  const b = el('span', `title-badge tb-${t.tier}` + (small ? ' sm' : ''), t.title);
  b.title = `Gelar ${({ mudah: 'mudah', sedang: 'sedang', sulit: 'sulit', legendaris: 'legendaris' })[t.tier] || ''}`;
  return b;
}
export function levelBadge(lv, small) {
  const n = typeof lv === 'object' && lv ? lv.level : lv;
  if (!n) return null;
  const b = el('span', 'lv-badge' + (small ? ' sm' : '') + (n >= 100 ? ' max' : n >= 50 ? ' hi' : ''), `Lv ${n}`);
  b.title = `Level ${n}`; return b;
}
export function tierBadge(t, small) {
  if (!t) return el('span');
  const b = el('span', 'tier' + (small ? ' sm' : ''), t.name); b.style.setProperty('--tc', t.color);
  return b;
}
const nextTier = pts => CONFIG?.scoring.tiers.find(t => t.min > pts) || null;

// ----------------------------------------------------------------- setup ---
export function initHome(config, deps) {
  CONFIG = config; D = deps;
  acct.mode = config.mode;
  if (config.mode !== 'supabase') {
    $('#googleBtnText').textContent = 'Buat akun di perangkat ini';
    $('#googleBtn').querySelector('.g-logo').classList.add('hidden');
    $('#googleBtn').classList.replace('google', 'primary');
    $('#localNote').classList.remove('hidden');
  }
  $('#googleBtn').onclick = signIn;
  setupTabs();
  setupSeg();
  setupNameDialog();
  setupPlayerModal();
  renderRules();
  $('#createBtn').onclick = createRoom;
  $('#practiceBtn').onclick = startPractice;
  $('#joinBtn').onclick = () => joinRoom($('#codeInput').value.trim().toUpperCase());
  $('#codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); $('#homeErr').textContent = ''; });
  $('#codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
  $('#nameInput').addEventListener('input', () => { $('#homeErr').textContent = ''; });
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) $('#codeInput').value = urlRoom.toUpperCase().slice(0, 4);
  try { $('#nameInput').value = JSON.parse(localStorage.getItem('pestaTopeng') || '{}').name || ''; } catch {}
  D.socket.on('rooms', list => { rooms = list; renderRooms(); });
  D.socket.on('me', me => applyMe({ ...me, rank: acct.rank }));
  renderAccount();
  renderRooms();
  refreshDaily();
  $('#dailyStrip').onclick = () => { if (acct.profile) { selectTab('me'); setTimeout(() => document.querySelector('.daily')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); } else signIn(); };
}

async function signIn() {
  const b = $('#googleBtn'); b.disabled = true; b.classList.add('loading');
  try { await Auth.signIn(); }
  catch (e) { D.toast(e.message || 'Gagal masuk', 'error'); }
  finally { setTimeout(() => { b.disabled = false; b.classList.remove('loading'); }, 1500); }
}

// Dipanggil setiap server membalas 'auth' / 'profile_save'.
export function applyMe(me, opts = {}) {
  const wasSigned = acct.signedIn;
  Object.assign(acct, { signedIn: !!me.signedIn, needsUsername: !!me.needsUsername, profile: me.profile || null, rank: me.rank ?? acct.rank, suggestion: me.suggestion || '' });
  if (!acct.signedIn) acct.rank = null;
  renderAccount();
  refreshDaily();
  if (activeTab === 'me') renderProfile();
  if (activeTab === 'rank' && lb) renderLeaderboard();
  if (acct.needsUsername && (opts.fresh || !wasSigned) && !$('#game').offsetParent) openNameDialog();
}

function renderAccount() {
  const area = $('#accountArea'); area.replaceChildren();
  const p = acct.profile;
  $('#authCard').classList.toggle('hidden', acct.signedIn);
  // baris "Kepada Yth." pada undangan: isi sendiri (tamu) atau nama akun
  $('#nameInput').classList.toggle('hidden', !!p);
  $('#invUser').classList.toggle('hidden', !p);
  if (p) $('#invUser').textContent = p.username;
  $('#tab-me').classList.toggle('dim', !p);
  if (!acct.signedIn) {
    const b = el('button', 'btn small signin-mini');
    b.innerHTML = '<svg class="ic sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>';
    b.append(el('span', null, 'Masuk'));
    b.onclick = signIn; area.append(b); return;
  }
  if (!p) {
    const b = el('button', 'btn small signin-mini attention', 'Pilih username');
    b.onclick = () => openNameDialog(); area.append(b); return;
  }
  const chip = el('button', 'me-chip');
  chip.setAttribute('aria-label', `Profil ${p.username}, ${fmt(p.points)} poin`);
  chip.append(avatar(p.username, p.avatarUrl, 'p-avatar sm', p.cos?.frame));
  const t = el('span', 'me-text');
  t.append(el('b', null, p.username), el('small', null, `Lv ${p.level?.level || 1} · ${fmt(p.points)} poin`));
  chip.append(t);
  chip.onclick = () => selectTab('me');
  area.append(chip);
}

// ------------------------------------------------------------------ tabs ---
function setupTabs() {
  const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
  tabs.forEach((t, i) => {
    t.onclick = () => selectTab(t.id.slice(4));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); selectTab(n.id.slice(4));
    });
  });
  addEventListener('resize', moveInk);
  requestAnimationFrame(moveInk);
}
function moveInk() {
  const t = document.querySelector('.tabs [aria-selected=true]'); const ink = $('.tab-ink');
  if (!t || !ink || !t.offsetWidth) return;
  ink.style.width = t.offsetWidth + 'px'; ink.style.transform = `translateX(${t.offsetLeft}px)`;
}
export function selectTab(name) {
  activeTab = name;
  for (const t of document.querySelectorAll('.tabs [role=tab]')) {
    const on = t.id === 'tab-' + name;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).classList.toggle('hidden', !on);
  }
  moveInk();
  if (name === 'rank') loadLeaderboard();
  if (name === 'me') renderProfile(true);
}

// ------------------------------------------------- publik / privat (seg) ---
function setupSeg() {
  const btns = [...document.querySelectorAll('.seg-btn')];
  const pick = b => {
    visibility = b.dataset.vis;
    btns.forEach(x => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    $('.seg').dataset.vis = visibility;
    $('#visHelp').textContent = visibility === 'public'
      ? 'Tampil di daftar pesta terbuka.'
      : 'Tidak tampil di daftar. Tamu masuk dengan kode.';
  };
  btns.forEach((b, i) => {
    b.onclick = () => pick(b);
    b.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); const n = btns[(i + 1) % 2]; n.focus(); pick(n); } });
  });
  pick(btns[0]);
}

// ------------------------------------------------------ buat / gabung room --
function identity() {
  if (acct.profile) return { ok: true };
  if (acct.signedIn && acct.needsUsername) { openNameDialog(); return { ok: false, dialog: true }; }
  const name = $('#nameInput').value.trim();
  if (!name) {
    $('#homeErr').textContent = 'Tulis namamu di baris "Kepada Yth." dulu, atau masuk dengan akun.';
    D.sfx.error();
    $('#nameInput').focus();
    const n = $('#nameInput'); n.classList.remove('nudge'); void n.offsetWidth; n.classList.add('nudge');
    return { ok: false };
  }
  try { const s = JSON.parse(localStorage.getItem('pestaTopeng') || '{}'); localStorage.setItem('pestaTopeng', JSON.stringify({ ...s, name })); } catch {}
  return { ok: true, name };
}
async function createRoom() {
  const id = identity(); if (!id.ok) { afterName = id.dialog ? createRoom : null; return; }
  const b = $('#createBtn'); b.disabled = true;
  const r = await D.emit('create_room', { name: id.name, visibility });
  b.disabled = false;
  if (r.code) D.onJoined(r);
}
// Latihan lawan bot: tidak perlu akun/nama, langsung masuk pesta dengan panduan
async function startPractice() {
  const b = $('#practiceBtn'); b.disabled = true;
  let name = '';
  try { name = acct.profile ? acct.profile.username : ($('#nameInput').value.trim() || JSON.parse(localStorage.getItem('pestaTopeng') || '{}').name || ''); } catch {}
  const r = await D.emit('create_practice', { name: name || 'Tamu Misterius' });
  b.disabled = false;
  if (r.code) D.onJoined(r); else if (r.error) $('#homeErr').textContent = r.error;
}
export async function joinRoom(code) {
  if (!/^[A-Z]{4}$/.test(code)) { $('#homeErr').textContent = 'Kode room terdiri dari 4 huruf.'; D.sfx.error(); return $('#codeInput').focus(); }
  const id = identity(); if (!id.ok) { afterName = id.dialog ? () => joinRoom(code) : null; return; }
  const r = await D.emit('join_room', { code, name: id.name });
  if (r.error) $('#homeErr').textContent = r.error;
  if (r.code) D.onJoined(r);
}

// --------------------------------------------------------- daftar room ---
export function subscribeRooms(on) {
  if (!D.socket.connected) return;
  if (on) D.socket.emit('rooms_subscribe', {}, list => { rooms = list || []; renderRooms(); });
  else D.socket.emit('rooms_unsubscribe');
}
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : `${Math.round(m / 60)} jam lalu`;
}
function renderRooms() {
  const ul = $('#roomList');
  const known = new Set([...ul.children].map(li => li.dataset.code));
  const open = rooms.filter(r => r.phase === 'LOBBY').length;
  $('#roomsStatus').textContent = `${open} room publik terbuka`;
  if (!rooms.length) {
    const li = el('li', 'room-empty');
    li.innerHTML = '<svg class="ic big" viewBox="0 0 64 40" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M2 7C10 1 22 2 32 10C42 2 54 1 62 7C64 22 56 34 44 34C38 34 35 27 32 27C29 27 26 34 20 34C8 34 0 22 2 7ZM12 17C14 13 21 13 25 17C21 21 15 21 12 17ZM39 17C43 13 50 13 52 17C49 21 43 21 39 17Z"/></svg>';
    li.append(el('b', null, 'Belum ada pesta terbuka'), el('span', null, 'Buka pesta baru dengan pilihan Terbuka, nanti tamu lain bisa mampir dari sini.'));
    return ul.replaceChildren(li);
  }
  ul.replaceChildren(...rooms.map(r => {
    const li = el('li', 'room-card' + (r.phase !== 'LOBBY' ? ' playing' : '') + (known.has(r.code) ? '' : ' pop'));
    li.dataset.code = r.code;
    const stack = el('div', 'rc-stack');
    r.avatars.slice(0, 4).forEach(a => stack.append(avatar(a.name, a.avatarUrl, 'p-avatar xs')));
    if (r.players > 4) stack.append(el('span', 'p-avatar xs more', '+' + (r.players - 4)));
    const body = el('div', 'rc-body');
    body.append(el('b', 'rc-title', `Room ${r.host}`));
    body.append(el('span', 'rc-meta', `${r.code}${r.hostPublicId ? ' · #' + r.hostPublicId : ''} · ${ago(r.createdAt)}`));
    const cap = el('div', 'rc-cap'); const bar = el('span', 'rc-bar'); const fill = el('i'); fill.style.width = `${(r.players / r.max) * 100}%`; bar.append(fill);
    cap.append(bar, el('span', null, `${r.players}/${r.max}`)); body.append(cap);
    li.append(stack, body);
    if (r.phase === 'LOBBY' && r.players < r.max) {
      const b = el('button', 'btn small join', 'Gabung'); b.setAttribute('aria-label', `Gabung room ${r.host}, ${r.players} dari ${r.max} pemain`);
      b.onclick = () => joinRoom(r.code); li.append(b);
    } else li.append(el('span', 'tag rc-state', r.phase === 'LOBBY' ? 'Penuh' : 'Sedang main'));
    return li;
  }));
}

// ---------------------------------------------------------- peringkat ---
async function loadLeaderboard(force) {
  if (lbLoading || (!force && lb && Date.now() - lb.fetched < 20000)) return renderLeaderboard();
  lbLoading = true;
  if (!lb) renderLbSkeleton();
  try {
    const r = await fetch('/api/leaderboard');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Gagal memuat');
    lb = { rows: j.rows, fetched: Date.now() };
    renderLeaderboard(true);
  } catch (e) {
    const ol = $('#lbList');
    const li = el('li', 'lb-error'); li.append(el('span', null, 'Papan peringkat belum bisa dimuat.'));
    const b = el('button', 'btn small'); b.innerHTML = IC.refresh; b.append(el('span', null, 'Coba lagi')); b.onclick = () => loadLeaderboard(true);
    li.append(b); ol.replaceChildren(li); $('#podium').replaceChildren();
  } finally { lbLoading = false; }
}
function renderLbSkeleton() {
  $('#podium').replaceChildren(...[2, 1, 3].map(n => { const d = el('div', `pod pod-${n} skel`); d.append(el('span', 'p-avatar lg sk'), el('span', 'sk-line'), el('div', 'pod-block')); return d; }));
  $('#lbList').replaceChildren(...Array.from({ length: 5 }, () => { const li = el('li', 'lb-row skel'); li.append(el('span', 'sk-line short'), el('span', 'sk-line')); return li; }));
}
function renderLeaderboard(animate) {
  if (!lb) return;
  const rows = lb.rows, myId = acct.profile?.publicId;
  const pod = $('#podium');
  if (!rows.length) {
    pod.replaceChildren();
    const li = el('li', 'room-empty'); li.append(el('b', null, 'Papan masih kosong'), el('span', null, 'Selesaikan satu pesta dengan akun untuk jadi nama pertama di sini.'));
    $('#lbList').replaceChildren(li); $('#lbMe').classList.add('hidden'); return;
  }
  pod.replaceChildren(...[1, 0, 2].map(i => rows[i]).map((r, k) => {
    const place = [2, 1, 3][k];
    const d = el('div', `pod pod-${place}` + (r ? '' : ' empty') + (r && r.publicId === myId ? ' me' : '') + (animate && !reduced() ? ' rise' : ''));
    d.style.setProperty('--i', k);
    if (!r) {
      const av = el('div', 'pod-av'); av.append(el('span', 'p-avatar lg seat', '?'));
      d.append(av, el('b', 'pod-name muted', 'Kursi kosong'), el('span', 'pod-pts', '—'), el('div', 'pod-block', String(place)));
      return d;
    }
    const av = el('div', 'pod-av'); av.append(avatar(r.username, r.avatarUrl, 'p-avatar lg', r.cos?.frame));
    if (place === 1) { const c = el('span', 'pod-crown'); c.innerHTML = IC.crown; av.append(c); }
    d.append(av, el('b', 'pod-name', r.username));
    if (r.title) d.append(titleBadge(r.title, true));
    d.append(el('span', 'pod-pts', `${fmt(r.points)} poin`));
    if (r.publicId !== myId) { d.classList.add('clickable'); d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', `Lihat profil ${r.username}`); d.onclick = () => openPlayer(r.publicId); d.onkeydown = e => { if (e.key === 'Enter') openPlayer(r.publicId); }; }
    const blk = el('div', 'pod-block'); blk.append(el('span', 'pod-rank', String(place))); d.append(blk);
    d.title = `#${r.publicId} · ${r.wins} menang dari ${r.games} pesta`;
    return d;
  }));
  $('#lbList').replaceChildren(...rows.slice(3).map(r => lbRow(r, r.publicId === myId)));
  const me = $('#lbMe');
  // baris "kamu" hanya disematkan kalau kamu belum terlihat di podium/daftar
  const mineRow = rows.find(r => r.publicId === myId);
  if (mineRow) acct.rank = mineRow.rank;
  if (acct.profile && !mineRow) {
    if (acct.profile.games > 0) me.replaceChildren(lbRow({ ...acct.profile, rank: acct.rank ?? '–' }, true, 'div'));
    else { const n = el('div', 'lb-row me hint'); n.append(el('span', 'lb-rank', '–'), avatar(acct.profile.username, acct.profile.avatarUrl, 'p-avatar sm'), el('span', 'lb-who', 'Selesaikan 1 pesta untuk masuk papan peringkat.')); me.replaceChildren(n); }
    me.classList.remove('hidden');
  } else me.classList.add('hidden');
}
function lbRow(r, mine, tag = 'li') {
  const li = el(tag, 'lb-row' + (mine ? ' me' : ''));
  li.append(el('span', 'lb-rank', '#' + r.rank));
  li.append(avatar(r.username, r.avatarUrl, 'p-avatar sm', r.cos?.frame));
  const who = el('span', 'lb-who'); who.append(el('b', null, r.username + (mine ? ' (kamu)' : '')));
  const sub = el('small'); sub.append(`#${r.publicId} · ${r.wins} menang · `, tierBadge(r.tier, true)); who.append(sub);
  if (r.title) who.append(titleBadge(r.title, true));
  if (r.publicId && !mine) { li.classList.add('clickable'); li.tabIndex = 0; li.setAttribute('role', 'button'); li.setAttribute('aria-label', `Lihat profil ${r.username}`); li.onclick = () => openPlayer(r.publicId); li.onkeydown = e => { if (e.key === 'Enter') openPlayer(r.publicId); }; }
  li.append(who, el('span', 'lb-pts', fmt(r.points)));
  return li;
}
function renderRules() {
  const S = CONFIG.scoring, R = S.rules;
  $('#pointRules').replaceChildren(...[
    [`+${R.attend}`, 'hadir & menyelesaikan pesta'],
    [`+${R.perOutlasted}`, 'untuk setiap pemain yang tersingkir lebih dulu darimu'],
    [`+${R.winBonus}`, 'bonus juara 1 (topeng terakhir)'],
    [`+${R.perUnmask}`, 'untuk setiap lawan yang kamu bongkar topengnya'],
  ].map(([p, t]) => { const li = el('li'); li.append(el('b', null, p), el('span', null, t)); return li; }));
  const tbl = $('#pointTable');
  const head = el('tr'); head.append(el('th', null, 'Pemain'), ...Array.from({ length: 8 }, (_, i) => el('th', null, `#${i + 1}`)));
  const cap = el('caption', null, 'Poin per posisi (tanpa bonus bongkar topeng)');
  tbl.replaceChildren(cap, head, ...S.table.map(row => { const tr = el('tr'); tr.append(el('th', null, String(row.n))); for (let i = 0; i < 8; i++) tr.append(el('td', null, row.pts[i] != null ? String(row.pts[i]) : '–')); return tr; }));
  $('#tierList').replaceChildren(...S.tiers.map(t => { const li = el('li'); li.append(tierBadge(t), el('span', null, `${fmt(t.min)}+ poin`)); return li; }));
}

// ------------------------------------------------------------- profil ---
let stats = null;
async function renderProfile(fetchStats) {
  const v = $('#profileView'); v.replaceChildren();
  if (!acct.signedIn || !acct.profile) {
    const box = el('div', 'room-empty profile-empty');
    box.innerHTML = '<svg class="ic big" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
    box.append(el('b', null, acct.signedIn ? 'Satu langkah lagi' : 'Belum masuk'), el('span', null, acct.signedIn ? 'Pilih username untuk mendapatkan ID unik dan mulai mengumpulkan poin.' : 'Masuk dengan Google untuk menyimpan poin, kemenangan, dan peringkatmu.'));
    const b = el('button', 'btn primary', acct.signedIn ? 'Pilih username' : (acct.mode === 'supabase' ? 'Masuk dengan Google' : 'Buat akun (mode lokal)'));
    b.onclick = acct.signedIn ? () => openNameDialog() : signIn; box.append(b);
    return v.append(box);
  }
  const p = acct.profile;
  const card = el('div', 'profile-card');
  const top = el('div', 'pc-top');
  top.append(avatar(p.username, p.avatarUrl, 'p-avatar xl', p.cos?.frame));
  const who = el('div', 'pc-who');
  who.append(el('h2', null, p.username));
  const idb = el('button', 'id-pill'); idb.setAttribute('aria-label', `Salin ID ${p.publicId}`);
  idb.append(el('span', null, '#' + p.publicId)); idb.insertAdjacentHTML('beforeend', IC.copy);
  idb.onclick = async () => { try { await navigator.clipboard.writeText(p.publicId); D.toast('ID disalin'); } catch { D.toast('ID kamu: ' + p.publicId); } };
  who.append(idb, levelBadge(p.level), tierBadge(p.tier));
  if (p.title) who.append(titleBadge(p.title));
  top.append(who); card.append(top);
  // progres level
  if (p.level) {
    const L = p.level, lp = el('div', 'lv-prog');
    const head = el('div', 'lv-head'); head.append(el('b', null, `Level ${L.level}`), el('small', null, L.to ? `${fmt(L.to - p.points)} poin lagi ke Level ${L.level + 1}` : 'Level tertinggi!'));
    const bar = el('div', 'tp-bar lv-bar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(L.span || 1)); bar.setAttribute('aria-valuenow', String(L.span ? L.into : 1)); bar.setAttribute('aria-label', `Menuju level ${L.level + 1}`);
    const fill = el('i'); fill.style.setProperty('--w', `${L.span ? Math.min(100, (L.into / L.span) * 100) : 100}%`); fill.style.setProperty('--tc', 'var(--kunyit)'); bar.append(fill);
    lp.append(head, bar);
    const nx = (CONFIG.cosmetics || []).filter(i => i.unlock && typeof i.unlock === 'object' && i.unlock.level > L.level).sort((a, b) => a.unlock.level - b.unlock.level)[0];
    if (nx) lp.append(el('small', 'lv-next', `Hadiah berikutnya di Level ${nx.unlock.level}: ${nx.name} (${COS_KIND[nx.kind][0].toLowerCase()})`));
    card.append(lp);
  }
  // progres tier
  const nt = nextTier(p.points);
  const prog = el('div', 'tier-prog');
  if (nt) {
    const span = nt.min - p.tier.min, done = p.points - p.tier.min;
    const bar = el('div', 'tp-bar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(span)); bar.setAttribute('aria-valuenow', String(done)); bar.setAttribute('aria-label', `Menuju ${nt.name}`);
    const fill = el('i'); fill.style.setProperty('--w', `${Math.min(100, (done / span) * 100)}%`); fill.style.setProperty('--tc', nt.color); bar.append(fill);
    prog.append(bar, el('small', null, `${fmt(nt.min - p.points)} poin lagi menuju ${nt.name}`));
  } else prog.append(el('small', null, 'Tingkat tertinggi tercapai. Kamu legenda!'));
  card.append(prog);
  const grid = el('div', 'stat-grid');
  const wr = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  [['Poin', fmt(p.points)], ['Peringkat', acct.rank && p.games ? '#' + acct.rank : '–'], ['Pesta', fmt(p.games)], ['Menang', `${fmt(p.wins)}`], ['Rasio menang', `${wr}%`], ['Topeng dibongkar', fmt(p.unmasks)]]
    .forEach(([k, val]) => { const s = el('div', 'stat'); s.append(el('b', null, val), el('span', null, k)); grid.append(s); });
  card.append(grid);
  const recentWrap = el('div', 'recent');
  recentWrap.append(el('h3', null, 'Pesta terakhir'));
  const ul = el('ul', 'recent-list');
  const list = stats?.recent || [];
  if (!list.length) ul.append(el('li', 'muted', 'Belum ada pesta. Ayo main!'));
  list.forEach(m => {
    const li = el('li');
    li.append(el('span', `place p${Math.min(m.placement, 4)}`, '#' + m.placement), el('span', null, `dari ${m.players} pemain` + (m.unmasks ? ` · ${m.unmasks} topeng dibongkar` : '')), el('b', null, `+${m.points}`));
    ul.append(li);
  });
  recentWrap.append(ul); card.append(recentWrap);
  card.append(dailySection(), cosmeticSection(), missionSection());
  const act = el('div', 'pc-actions');
  const eb = el('button', 'btn'); eb.innerHTML = IC.edit; eb.append(el('span', null, 'Ubah nama')); eb.onclick = () => openNameDialog(true);
  const ob = el('button', 'btn ghost'); ob.innerHTML = IC.out; ob.append(el('span', null, 'Keluar')); ob.onclick = async () => { await Auth.signOut(); stats = null; D.toast('Kamu sudah keluar'); };
  act.append(eb, ob); card.append(act);
  v.append(card);
  if (fetchStats) {
    const [r, m] = await Promise.all([new Promise(res => D.socket.emit('my_stats', {}, res)), new Promise(res => D.socket.emit('my_missions', {}, res))]);
    if (m && !m.error) { myMissions = m; daily = m.daily; renderDailyStrip(); }
    if (r && !r.error) { stats = r; acct.rank = r.rank; acct.profile = r.profile; renderAccount(); if (activeTab === 'me') renderProfile(false); }
  }
}

// ------------------------------------------------- tantangan harian ---
let daily = null, dailyT = null;
async function refreshDaily() {
  clearTimeout(dailyT);
  try {
    if (acct.profile && D.socket.connected) {
      const m = await new Promise(res => D.socket.emit('my_missions', {}, res));
      if (m && !m.error) { myMissions = m; daily = m.daily; }
    } else daily = await (await fetch('/api/daily')).json();
  } catch {}
  renderDailyStrip();
  if (daily) dailyT = setTimeout(refreshDaily, Math.min(daily.resetsIn + 2000, 6 * 3600e3)); // ganti hari otomatis
}
const leftText = ms => { const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3); return h ? `${h} jam ${m} mnt` : `${m} mnt`; };
function renderDailyStrip() {
  const b = $('#dailyStrip');
  if (!daily) return b.classList.add('hidden');
  b.classList.remove('hidden'); b.replaceChildren();
  const done = daily.list.filter(c => c.done).length, got = daily.list.filter(c => c.done).reduce((s, c) => s + c.pts, 0);
  const total = daily.list.reduce((s, c) => s + c.pts, 0);
  const dots = el('span', 'ds-dots');
  daily.list.forEach(c => { const d = el('i', `ds-dot tt-${c.tier}` + (c.done ? ' on' : '')); d.title = c.text; dots.append(d); });
  const t = el('span', 'ds-text');
  t.append(el('b', null, 'Tantangan hari ini'), el('small', null, acct.profile ? (done === 3 ? `Semua selesai, +${got} poin. Ganti dalam ${leftText(daily.resetsIn)}` : `${done}/3 selesai · bonus sampai +${total} poin`) : `Masuk untuk ikut, bonus sampai +${total} poin`));
  b.append(dots, t, el('span', 'ds-go', acct.profile ? 'Lihat' : 'Masuk'));
  b.setAttribute('aria-label', `Tantangan hari ini, ${done} dari 3 selesai`);
}
function dailySection() {
  const wrap = el('section', 'daily');
  const head = el('div', 'ms-head');
  head.append(el('h3', null, 'Tantangan hari ini'), el('span', 'muted', daily ? `ganti dalam ${leftText(daily.resetsIn)}` : 'Memuat…'));
  wrap.append(head);
  if (!daily) return wrap;
  const ul = el('ul', 'dl-list');
  for (const c of daily.list) {
    const li = el('li', `dl-item tt-${c.tier}` + (c.done ? ' done' : ''));
    const main = el('div', 'ms-main');
    main.append(el('span', 'dl-tier', TIER_LABEL[c.tier]), el('span', 'dl-text', c.text));
    const bar = el('div', 'ms-bar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(c.goal)); bar.setAttribute('aria-valuenow', String(c.now)); bar.setAttribute('aria-label', c.text);
    const fill = el('i'); fill.style.width = `${Math.min(100, (c.now / c.goal) * 100)}%`; bar.append(fill);
    const pr = el('div', 'ms-prog'); pr.append(bar, el('small', null, `${c.now}/${c.goal}`)); main.append(pr);
    li.append(main, el('span', 'dl-pts', c.done ? 'Selesai' : `+${c.pts}`));
    ul.append(li);
  }
  wrap.append(ul, el('p', 'ms-note', 'Berganti setiap pukul 00.00 WIB. Bonus poin langsung masuk saat pesta selesai.'));
  return wrap;
}

// ------------------------------------------------------------ hiasan ---
const COS_KIND = { avatar: ['Foto profil', 'Topeng koleksi untuk foto profilmu. Terbuka setiap naik level, sebagian dari misi khusus.'], plate: ['Bar nama', 'Corak namamu di deretan pemain saat bermain. Semua pemain melihatnya.'], frame: ['Bingkai foto', 'Terlihat semua orang di lobby, peringkat, dan profilmu.'], dice: ['Corak dadu', 'Tampil di papan semua pemain saat giliranmu.'], cloth: ['Taplak meja', 'Hanya untuk tampilan papanmu sendiri.'] };
const DICE_SW = { klasik: ['#efe5d0', '#17181d', '#F2C14E'], cabai: ['#C8322A', '#17181d', '#F2C14E'], perak: ['#c9cfd6', '#22262e', '#eef2f6'], nila: ['#26346a', '#0d1124', '#F2C14E'], giok: ['#3f9a7a', '#10261e', '#e9f5ee'], emas: ['#e2b54a', '#2a2110', '#f6d77a'], dalang: ['#17181d', '#2a0d0d', '#C8322A'] };
const CLOTH_SW = { nila: '#18224a', sogan: '#3b2415', hijau: '#173f2c', marun: '#3e1220', hitam: '#111114' };
export function plateChip(key, name) {
  const c = el('span', 'chip plate-prev' + (key && key !== 'polos' ? ` np np-${key}` : ''));
  c.append(el('span', 'chip-name', name || 'Nama'));
  return c;
}
function cosPreview(it) {
  if (it.kind === 'avatar') return it.key === 'asli' ? avatar(acct.profile?.username, acct.profile?.photoUrl, 'p-avatar lg') : (() => { const im = el('img', 'p-avatar lg'); im.src = `/avatars/${it.key}.webp`; im.alt = ''; im.loading = 'lazy'; return im; })();
  if (it.kind === 'plate') return plateChip(it.key, acct.profile?.username);
  if (it.kind === 'frame') return avatar(acct.profile?.username, acct.profile?.avatarUrl, 'p-avatar lg', it.key);
  if (it.kind === 'dice') { const [t, b, m] = DICE_SW[it.key] || DICE_SW.klasik; const d = el('span', 'cos-die'); d.style.setProperty('--t', t); d.style.setProperty('--b', b); d.style.setProperty('--m', m); d.append(el('i')); return d; }
  const c = el('span', 'cos-cloth'); c.style.setProperty('--c', CLOTH_SW[it.key] || CLOTH_SW.nila); return c;
}
function cosmeticSection() {
  const wrap = el('section', 'cosmetics');
  const head = el('div', 'ms-head');
  const list = myMissions?.cosmetics;
  head.append(el('h3', null, 'Hiasan'), el('span', 'muted', list ? `${list.filter(i => i.owned).length} dari ${list.length} terbuka` : 'Memuat…'));
  wrap.append(head, el('p', 'ms-note', 'Hiasan terbuka bersama gelar. Tidak mengubah aturan main.'));
  if (!list) return wrap;
  const titleName = k => (CONFIG.missions?.missions || []).find(m => m.key === k)?.title || k;
  const need = it => (it.unlock && typeof it.unlock === 'object' ? `Level ${it.unlock.level}` : `Gelar ${titleName(it.unlock)}`);
  for (const kind of ['avatar', 'plate', 'frame', 'dice', 'cloth']) {
    const g = el('div', 'cos-group');
    g.append(el('h4', null, COS_KIND[kind][0]), el('p', 'cos-help', COS_KIND[kind][1]));
    const row = el('div', 'cos-row' + (kind === 'plate' ? ' plates' : ''));
    for (const it of list.filter(i => i.kind === kind)) {
      const b = el('button', 'cos-item' + (it.on ? ' on' : '') + (it.owned ? '' : ' locked') + (it.special ? ' special' : ''));
      b.type = 'button'; b.setAttribute('aria-pressed', String(it.on));
      if (it.special) b.append(el('span', 'cos-flag', 'Misi khusus'));
      b.append(cosPreview(it), el('span', 'cos-name', it.name), el('small', 'cos-sub', it.on ? 'Dipakai' : it.owned ? 'Pakai' : need(it)));
      b.setAttribute('aria-label', `${COS_KIND[kind][0]} ${it.name}` + (it.owned ? '' : `, terkunci, buka di ${need(it)}`));
      b.onclick = () => it.owned ? (it.on || setCosmetic(kind, it.key)) : D.toast(it.unlock && typeof it.unlock === 'object' ? `${it.name} terbuka di Level ${it.unlock.level}. Levelmu sekarang ${acct.profile?.level?.level || 1}.` : `Selesaikan misi "${titleName(it.unlock)}" untuk membuka ${it.name}.`);
      row.append(b);
    }
    g.append(row); wrap.append(g);
  }
  return wrap;
}
async function setCosmetic(kind, key) {
  const r = await new Promise(res => D.socket.emit('set_cosmetic', { kind, key }, res));
  if (!r || r.error) return D.toast(r?.error || 'Gagal memakai hiasan');
  if (myMissions) myMissions.cosmetics = r.cosmetics;
  applyMe(r); lb = null;
  D.onCosmetics && D.onCosmetics();
  D.toast('Hiasan dipakai');
}

// ------------------------------------------------------- misi & gelar ---
let myMissions = null;
const TIER_ORDER = ['mudah', 'sedang', 'sulit', 'legendaris'];
const TIER_LABEL = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit', legendaris: 'Legendaris' };
function missionSection() {
  const wrap = el('section', 'missions');
  const list = myMissions?.missions;
  const doneN = list ? list.filter(m => m.done).length : 0;
  const head = el('div', 'ms-head');
  head.append(el('h3', null, 'Gelar & misi'), el('span', 'muted', list ? `${doneN} dari ${list.length} terbuka` : 'Memuat…'));
  wrap.append(head);
  wrap.append(el('p', 'ms-note', 'Selesaikan misi untuk membuka gelar, lalu pakai satu gelar agar terlihat di lobby, papan peringkat, dan profilmu. Hanya pesta dengan minimal 2 manusia yang dihitung.'));
  if (!list) return wrap;
  const cur = myMissions.title;
  for (const tier of TIER_ORDER) {
    const g = el('div', `ms-tier tt-${tier}`);
    g.append(el('h4', null, TIER_LABEL[tier]));
    const ul = el('ul', 'ms-list');
    for (const m of list.filter(x => x.tier === tier)) {
      const li = el('li', 'ms-item' + (m.done ? ' done' : ''));
      const main = el('div', 'ms-main');
      main.append(titleBadge({ title: m.title, tier: m.tier }, true), el('span', 'ms-desc', m.desc));
      if (!m.done && m.goal) {
        const bar = el('div', 'ms-bar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(m.goal)); bar.setAttribute('aria-valuenow', String(m.now || 0)); bar.setAttribute('aria-label', m.title);
        const fill = el('i'); fill.style.width = `${Math.min(100, ((m.now || 0) / m.goal) * 100)}%`; bar.append(fill);
        main.append(el('div', 'ms-prog', null)); main.lastChild.append(bar, el('small', null, `${m.now || 0}/${m.goal}`));
      }
      li.append(main);
      if (m.done) {
        const on = cur === m.key;
        const b = el('button', 'btn small ms-use' + (on ? ' on' : ''), on ? 'Dipakai' : 'Pakai');
        b.setAttribute('aria-pressed', String(on));
        b.onclick = () => setTitle(on ? null : m.key);
        li.append(b);
      } else li.append(el('span', 'ms-lock', 'Terkunci'));
      ul.append(li);
    }
    g.append(ul); wrap.append(g);
  }
  return wrap;
}
async function setTitle(key) {
  const r = await new Promise(res => D.socket.emit('set_title', { key }, res));
  if (!r || r.error) return D.toast(r?.error || 'Gagal memakai gelar');
  applyMe(r); if (myMissions) myMissions.title = key;
  lb = null;
  D.toast(key ? `Gelar dipakai: ${r.profile.title?.title}` : 'Gelar dilepas');
  if (activeTab === 'me') renderProfile(false);
}

// -------------------------------------------- profil pemain lain (popup) ---
export async function openPlayer(publicId) {
  const dlg = $('#playerModal'), body = $('#playerBody');
  body.replaceChildren(el('p', 'muted center', 'Memuat profil…'));
  dlg.classList.remove('hidden'); $('#playerClose').focus();
  let r = null;
  try { r = await (await fetch(`/api/player/${encodeURIComponent(publicId)}`)).json(); } catch {}
  if (!r || !r.profile) { body.replaceChildren(el('p', 'muted center', 'Profil tidak ditemukan.')); return; }
  const p = r.profile;
  const top = el('div', 'pc-top');
  top.append(avatar(p.username, p.avatarUrl, 'p-avatar xl', p.cos?.frame));
  const who = el('div', 'pc-who'); who.append(el('h2', null, p.username), el('span', 'id-pill static', '#' + p.publicId), levelBadge(p.level), tierBadge(p.tier));
  if (p.title) who.append(titleBadge(p.title));
  top.append(who);
  const grid = el('div', 'stat-grid');
  const wr = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  [['Poin', fmt(p.points)], ['Peringkat', r.rank && p.games ? '#' + r.rank : '–'], ['Pesta', fmt(p.games)], ['Menang', fmt(p.wins)], ['Rasio menang', `${wr}%`], ['Gelar', String(p.titles || 0)]]
    .forEach(([k, v]) => { const s = el('div', 'stat'); s.append(el('b', null, v), el('span', null, k)); grid.append(s); });
  const coll = el('div', 'pl-titles');
  coll.append(el('h3', null, 'Koleksi gelar'));
  const cat = CONFIG.missions?.missions || [];
  const unlocked = cat.filter(m => (r.unlocked || []).includes(m.key)).sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
  const row = el('div', 'pl-title-row');
  if (unlocked.length) unlocked.forEach(m => row.append(titleBadge(m, true))); else row.append(el('span', 'muted', 'Belum ada gelar.'));
  coll.append(row);
  body.replaceChildren(top, grid, coll);
}
export function setupPlayerModal() {
  const dlg = $('#playerModal');
  const close = () => dlg.classList.add('hidden');
  $('#playerClose').onclick = close;
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// ------------------------------------------------------ dialog username ---
let checkT = null, checkSeq = 0, renaming = false;
function setupNameDialog() {
  const input = $('#usernameInput');
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\s/g, '_');
    clearTimeout(checkT); const v = input.value.trim();
    const local = /^[A-Za-z0-9_]{3,16}$/.test(v);
    if (!v) return setUState('', '3–16 karakter: huruf, angka, atau garis bawah (_).');
    if (!local) return setUState('bad', v.length < 3 ? 'Minimal 3 karakter.' : 'Hanya huruf, angka, dan _ tanpa spasi.');
    if (renaming && acct.profile && v.toLowerCase() === acct.profile.username.toLowerCase()) return setUState('ok', 'Ini username kamu sekarang.');
    setUState('checking', 'Memeriksa ketersediaan…');
    const seq = ++checkSeq;
    checkT = setTimeout(() => D.socket.emit('username_check', { username: v }, r => {
      if (seq !== checkSeq) return;
      if (!r || !r.ok) return setUState('bad', r?.error || 'Gagal memeriksa');
      setUState(r.available ? 'ok' : 'bad', r.available ? `@${v} tersedia!` : `@${v} sudah dipakai. Coba variasi lain.`);
    }), 350);
  });
  $('#nameForm').addEventListener('submit', async e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) { setUState('bad', 'Username 3–16 karakter: huruf, angka, atau _.'); D.sfx.error(); return input.focus(); }
    const b = $('#usernameSave'); b.disabled = true; b.classList.add('loading');
    const first = !acct.profile;
    const r = await new Promise(res => D.socket.emit('profile_save', { username: v }, res));
    b.disabled = false; b.classList.remove('loading');
    if (!r || r.error) { setUState('bad', r?.error || 'Gagal menyimpan'); D.sfx.error(); return input.focus(); }
    applyMe(r);
    lb = null;
    if (first) revealId(r.profile);
    else { closeNameDialog(); D.toast('Username diperbarui'); }
  });
  $('#usernameCancel').onclick = () => { afterName = null; closeNameDialog(); };
  $('#irDone').onclick = () => { closeNameDialog(); const f = afterName; afterName = null; if (f) f(); };
  $('#nameDialog').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeNameDialog();
    if (e.key === 'Tab') { // jebak fokus di dalam dialog
      const f = [...$('#nameDialog').querySelectorAll('button:not(.hidden), input')].filter(x => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
}
function setUState(st, msg) {
  const s = $('#usernameState'); s.className = 'input-state ' + st;
  s.innerHTML = st === 'ok' ? IC.check : st === 'bad' ? IC.x : st === 'checking' ? '<span class="spin"></span>' : '';
  const m = $('#usernameMsg'); m.textContent = msg; m.className = 'help ' + (st === 'bad' ? 'bad' : st === 'ok' ? 'good' : '');
  $('#usernameInput').setAttribute('aria-invalid', String(st === 'bad'));
}
let lastFocus = null;
export function openNameDialog(rename = false) {
  renaming = !!rename && !!acct.profile;
  lastFocus = document.activeElement;
  $('#nameForm').classList.remove('hidden'); $('#idReveal').classList.add('hidden');
  $('#ndTitle').textContent = renaming ? 'Ubah username' : 'Pilih username';
  $('#ndSub').textContent = renaming ? `ID kamu tetap #${acct.profile.publicId}.` : 'Nama ini tampil di room dan papan peringkat. Kamu juga akan mendapat ID unik 5 karakter.';
  $('#usernameSave').textContent = renaming ? 'Simpan' : 'Simpan & dapatkan ID';
  const av = $('#ndAvatar'); av.replaceChildren(avatar(acct.profile?.username || acct.suggestion || '?', acct.profile?.avatarUrl, 'p-avatar xl'));
  const input = $('#usernameInput');
  input.value = renaming ? acct.profile.username : (acct.suggestion || '');
  setUState('', '3–16 karakter: huruf, angka, atau garis bawah (_).');
  $('#nameDialog').classList.remove('hidden');
  setTimeout(() => { input.focus(); input.select(); if (input.value) input.dispatchEvent(new Event('input')); }, 60);
}
function closeNameDialog() {
  $('#nameDialog').classList.add('hidden');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function revealId(p) {
  $('#nameForm').classList.add('hidden');
  const box = $('#idReveal'); box.classList.remove('hidden');
  $('#irName').textContent = `Halo, ${p.username}!`;
  const code = $('#irCode'); code.setAttribute('aria-label', `ID ${p.publicId.split('').join(' ')}`);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const cells = p.publicId.split('').map(() => el('span', 'ir-cell', '·'));
  code.replaceChildren(el('span', 'ir-hash', '#'), ...cells);
  D.sfx.start && D.sfx.start();
  if (reduced()) { cells.forEach((c, i) => { c.textContent = p.publicId[i]; c.classList.add('set'); }); $('#irDone').focus(); return; }
  const t0 = performance.now();
  const tick = t => {
    let doneAll = true;
    cells.forEach((c, i) => {
      const stop = 450 + i * 220;
      if (t - t0 < stop) { c.textContent = A[Math.floor(Math.random() * A.length)]; doneAll = false; }
      else if (!c.classList.contains('set')) { c.textContent = p.publicId[i]; c.classList.add('set'); D.sfx.land && D.sfx.land(); }
    });
    if (!doneAll) requestAnimationFrame(tick); else $('#irDone').focus();
  };
  requestAnimationFrame(tick);
}

// ------------------------------------------------- hadiah di layar akhir ---
let reward = null;
export function setReward(r) { reward = r; lb = null; if (r && r.rank) acct.rank = r.rank; if (r && r.missions) refreshDaily(); }
export function clearReward() { reward = null; }
export function getReward() { return reward; }
export function renderReward(state, meId) {
  const box = $('#rewardBox');
  const mine = state.standings && state.standings.find(s => s.id === meId);
  const meP = state.players.find(p => p.id === meId);
  if (!mine || !meP) return box.classList.add('hidden');
  box.classList.remove('hidden');
  const key = JSON.stringify([mine.placement, !!reward, reward?.total, meP.guest, !!reward?.missions, mine.points]);
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.replaceChildren();
  const head = el('div', 'rw-head');
  head.append(el('span', `place big p${Math.min(mine.placement, 4)}`, `Juara ${mine.placement}`));
  if (mine.practice) { // lawan bot sendirian: tidak ada poin untuk dipamerkan
    head.append(el('span', 'rw-practice', 'Ronde latihan'));
    box.append(head, el('p', 'rw-note', mine.placement === 1 ? 'Para bot sudah kamu kalahkan. Ajak teman untuk main berpoin!' : 'Lawan bot tidak menambah poin. Coba lagi, atau ajak teman untuk main berpoin.'));
    return;
  }
  const pts = el('b', 'rw-pts', '+0'); head.append(pts);
  box.append(head);
  const ul = el('ul', 'rw-lines');
  mine.breakdown.forEach(b => { const li = el('li'); li.append(el('span', null, b.label), el('b', null, `+${b.pts}`)); ul.append(li); });
  box.append(ul);
  countUp(pts, mine.points, '+');
  const foot = el('div', 'rw-foot');
  if (meP.guest) {
    foot.append(el('span', null, 'Kamu main sebagai tamu, poin ini tidak disimpan.'));
    if (!acct.signedIn) { const b = el('button', 'btn small', acct.mode === 'supabase' ? 'Masuk dengan Google' : 'Buat akun'); b.onclick = signIn; foot.append(b); }
  } else if (!reward) foot.append(el('span', 'muted', 'Menyimpan poin…'));
  else if (reward.error) foot.append(el('span', 'bad', reward.error));
  else {
    foot.append(el('span', null, `Total ${fmt(reward.total)} poin`), el('span', null, reward.rank ? `Peringkat #${reward.rank}` : ''));
    if (reward.level && reward.levelBefore && reward.level.level > reward.levelBefore) {
      const up = el('div', 'tier-up lv-up'); up.append(el('span', null, 'Naik level!'), levelBadge(reward.level));
      box.append(up);
      for (const it of reward.newItems || []) {
        const u = el('div', 'rw-unlock rw-item');
        if (it.kind === 'avatar') { const im = el('img', 'p-avatar sm'); im.src = `/avatars/${it.key}.webp`; im.alt = ''; u.append(im); }
        else if (it.kind === 'plate') u.append(plateChip(it.key, it.name));
        u.append(el('span', null, `${COS_KIND[it.kind][0]} baru: ${it.name}`));
        const b = el('button', 'link-btn', 'Pakai'); b.onclick = () => { setCosmetic(it.kind, it.key); b.remove(); }; u.append(b);
        box.append(u);
      }
      D.sfx.win && setTimeout(() => D.sfx.win(), 500);
    }
    if (reward.tierAfter && reward.tierBefore && reward.tierAfter.id !== reward.tierBefore.id) {
      const up = el('div', 'tier-up'); up.append(el('span', null, 'Naik tingkat!'), tierBadge(reward.tierAfter)); box.append(up);
      D.sfx.win && setTimeout(() => D.sfx.win(), 600);
    }
  }
  box.append(foot);
  const ms = reward && reward.missions;
  if (ms && !meP.guest) {
    const m = el('div', 'rw-missions');
    if (ms.secret) m.append(el('p', 'rw-secret ' + (ms.secret.done ? 'ok' : 'no'), (ms.secret.done ? 'Misi rahasia selesai: ' : 'Misi rahasia gagal: ') + ms.secret.text));
    for (const c of ms.daily || []) m.append(el('p', 'rw-secret ok', `Tantangan harian selesai: ${c.text} (+${c.pts})`));
    for (const t of ms.unlocked || []) {
      const u = el('div', 'rw-unlock'); u.append(el('span', null, 'Gelar baru terbuka!'), titleBadge(t));
      const b = el('button', 'link-btn', 'Pakai sekarang'); b.onclick = () => { setTitle(t.key); b.remove(); }; u.append(b);
      m.append(u);
      const cos = (CONFIG.cosmetics || []).filter(c => c.unlock === t.key);
      if (cos.length) m.append(el('p', 'rw-cos', `Hiasan baru: ${cos.map(c => `${c.name} (${COS_KIND[c.kind][0].toLowerCase()})`).join(', ')}. Pasang di Profil.`));
    }
    if ((ms.unlocked || []).length) D.sfx.win && setTimeout(() => D.sfx.win(), 900);
    if (m.childNodes.length) box.append(m);
  }
}
function countUp(node, to, prefix = '') {
  if (reduced() || to <= 0) { node.textContent = prefix + to; return; }
  const t0 = performance.now(), dur = 900;
  const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); node.textContent = prefix + Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
