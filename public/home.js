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
export function avatar(name, url, cls = 'p-avatar') {
  const fallback = () => { const a = el('span', cls, (name || '?').trim().slice(0, 1).toUpperCase()); a.style.setProperty('--h', hue(name || '?')); a.setAttribute('aria-hidden', 'true'); return a; };
  if (!url) return fallback();
  const im = el('img', cls + ' photo'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.decoding = 'async'; im.src = url;
  im.onerror = () => im.replaceWith(fallback());
  return im;
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
  $('#guestToggle').onclick = () => {
    const open = $('#guestBox').classList.toggle('hidden') === false;
    $('#guestToggle').setAttribute('aria-expanded', String(open));
    if (open) $('#nameInput').focus();
  };
  setupTabs();
  setupSeg();
  setupNameDialog();
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
  if (activeTab === 'me') renderProfile();
  if (activeTab === 'rank' && lb) renderLeaderboard();
  if (acct.needsUsername && (opts.fresh || !wasSigned) && !$('#game').offsetParent) openNameDialog();
}

function renderAccount() {
  const area = $('#accountArea'); area.replaceChildren();
  const p = acct.profile;
  $('#authCard').classList.toggle('hidden', acct.signedIn);
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
  chip.append(avatar(p.username, p.avatarUrl, 'p-avatar sm'));
  const t = el('span', 'me-text');
  t.append(el('b', null, p.username), el('small', null, `#${p.publicId} · ${fmt(p.points)} poin`));
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
      ? 'Tampil di daftar room publik.'
      : 'Tidak tampil di daftar, masuk hanya dengan kode.';
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
    $('#homeErr').textContent = 'Masuk dengan Google, atau isi nama tamu dulu.';
    D.sfx.error();
    if ($('#guestBox').classList.contains('hidden')) $('#guestToggle').click(); else $('#nameInput').focus();
    $('#authCard').classList.remove('nudge'); void $('#authCard').offsetWidth; $('#authCard').classList.add('nudge');
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
    li.append(el('b', null, 'Belum ada room publik'), el('span', null, 'Buat room publik, pemain lain akan melihatnya di sini.'));
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
    const av = el('div', 'pod-av'); av.append(avatar(r.username, r.avatarUrl, 'p-avatar lg'));
    if (place === 1) { const c = el('span', 'pod-crown'); c.innerHTML = IC.crown; av.append(c); }
    d.append(av, el('b', 'pod-name', r.username), el('span', 'pod-pts', `${fmt(r.points)} poin`));
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
  li.append(avatar(r.username, r.avatarUrl, 'p-avatar sm'));
  const who = el('span', 'lb-who'); who.append(el('b', null, r.username + (mine ? ' (kamu)' : '')));
  const sub = el('small'); sub.append(`#${r.publicId} · ${r.wins} menang · `, tierBadge(r.tier, true)); who.append(sub);
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
  top.append(avatar(p.username, p.avatarUrl, 'p-avatar xl'));
  const who = el('div', 'pc-who');
  who.append(el('h2', null, p.username));
  const idb = el('button', 'id-pill'); idb.setAttribute('aria-label', `Salin ID ${p.publicId}`);
  idb.append(el('span', null, '#' + p.publicId)); idb.insertAdjacentHTML('beforeend', IC.copy);
  idb.onclick = async () => { try { await navigator.clipboard.writeText(p.publicId); D.toast('ID disalin'); } catch { D.toast('ID kamu: ' + p.publicId); } };
  who.append(idb, tierBadge(p.tier));
  top.append(who); card.append(top);
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
  const act = el('div', 'pc-actions');
  const eb = el('button', 'btn'); eb.innerHTML = IC.edit; eb.append(el('span', null, 'Ubah nama')); eb.onclick = () => openNameDialog(true);
  const ob = el('button', 'btn ghost'); ob.innerHTML = IC.out; ob.append(el('span', null, 'Keluar')); ob.onclick = async () => { await Auth.signOut(); stats = null; D.toast('Kamu sudah keluar'); };
  act.append(eb, ob); card.append(act);
  v.append(card);
  if (fetchStats) {
    const r = await new Promise(res => D.socket.emit('my_stats', {}, res));
    if (r && !r.error) { stats = r; acct.rank = r.rank; acct.profile = r.profile; renderAccount(); if (activeTab === 'me') renderProfile(false); }
  }
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
export function setReward(r) { reward = r; lb = null; if (r && r.rank) acct.rank = r.rank; }
export function clearReward() { reward = null; }
export function renderReward(state, meId) {
  const box = $('#rewardBox');
  const mine = state.standings && state.standings.find(s => s.id === meId);
  const meP = state.players.find(p => p.id === meId);
  if (!mine || !meP) return box.classList.add('hidden');
  box.classList.remove('hidden');
  const key = JSON.stringify([mine.placement, !!reward, reward?.total, meP.guest]);
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
    if (reward.tierAfter && reward.tierBefore && reward.tierAfter.id !== reward.tierBefore.id) {
      const up = el('div', 'tier-up'); up.append(el('span', null, 'Naik tingkat!'), tierBadge(reward.tierAfter)); box.append(up);
      D.sfx.win && setTimeout(() => D.sfx.win(), 600);
    }
  }
  box.append(foot);
}
function countUp(node, to, prefix = '') {
  if (reduced() || to <= 0) { node.textContent = prefix + to; return; }
  const t0 = performance.now(), dur = 900;
  const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); node.textContent = prefix + Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
