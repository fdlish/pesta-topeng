// Logika murni game "Pesta Topeng" — tanpa socket, mudah dites.
'use strict';
const LAYOUT = require('./layout');
const SCORING = require('./scoring');

// Papan = 5 pulau besar Indonesia. Warna: Sumatera merah, Kalimantan hijau, Jawa biru, Sulawesi kuning, Papua putih (salju Puncak Jaya).
const ROOMS = ['sumatera', 'kalimantan', 'jawa', 'sulawesi', 'papua'];
const ROOM_LABEL = { papua: 'Papua', sulawesi: 'Sulawesi', jawa: 'Jawa', sumatera: 'Sumatera', kalimantan: 'Kalimantan' };
const ROOM_COLOR_NAME = { papua: 'putih', sulawesi: 'kuning', jawa: 'biru', sumatera: 'merah', kalimantan: 'hijau' };
// Tata letak papan:  [Sumatera][Kalimantan] / [   Jawa   ] / [Sulawesi][Papua]
// Jawa di tengah terhubung ke semua pulau.
const ADJ = {
  sumatera: ['kalimantan', 'jawa'],
  kalimantan: ['sumatera', 'jawa'],
  sulawesi: ['papua', 'jawa'],
  papua: ['sulawesi', 'jawa'],
  jawa: ['sumatera', 'kalimantan', 'sulawesi', 'papua'],
};
// Dadu 7 sisi (prisma segi lima): 5 sisi pulau + 2 ujung hitam → hitam 2/7 (±29%), tiap pulau 1/7 (±14%)
const DIE = ['papua', 'sulawesi', 'jawa', 'sumatera', 'kalimantan', 'hitam', 'hitam'];

const CHARACTERS = [ // 20 tamu = 20 profesi. bio = satir fiksi ala birokrasi (untuk hiburan, tanpa tokoh nyata)
  ['koki', 'Koki', '🧑‍🍳', 'Memasak untuk program makan bergizi; porsinya menyusut tiap kali lewat meja rapat.'],
  ['polisi', 'Polisi', '👮', 'Siaga 24 jam, apalagi kalau laporannya sudah viral duluan.'],
  ['dokter', 'Dokter', '🧑‍⚕️', 'Siap melayani semua pasien BPJS. Antreannya dibawa santai saja, sampai tahun depan.'],
  ['damkar', 'Pemadam', '🧑‍🚒', 'Instansi paling responsif: urusan sarang tawon, kucing di pohon, sampai cincin nyangkut, beres.'],
  ['petani', 'Petani', '🧑‍🌾', 'Pahlawan pangan; panen rayanya selalu kompak dengan datangnya beras impor.'],
  ['pilot', 'Pilot', '🧑‍✈️', 'Selalu terbang tepat waktu, asal "tepat waktu" berarti delay dua jam.'],
  ['pedangdut', 'Pedangdut', '🎤', 'Laris diundang kampanye lima tahun sekali; janji di panggung ikut bergoyang, lalu hilang bersama soundsystem.'],
  ['pelukis', 'Pelukis', '🧑‍🎨', 'Karyanya dipajang di kantor dinas; honornya masih "dalam proses".'],
  ['pesulap', 'Pesulap', '🎩', 'Ahli menghilangkan sesuatu tanpa jejak. Kartu, maksudnya. Bukan anggaran.'],
  ['koboi', 'Peternak', '🤠', 'Sapinya gemuk dan sehat, harga dagingnya tetap tidak masuk akal.'],
  ['tukang', 'Tukang', '👷', 'Bangun jalan mulus menjelang pemilu, berlubang lagi setelah pelantikan.'],
  ['guru', 'Guru Honorer', '📚', 'Mencerdaskan kehidupan bangsa sejak subuh. Gajinya cair tiga bulan sekali, jumlahnya cukup buat beli kapur.'],
  ['detektif', 'Detektif', '🕵️', 'Mampu memecahkan kasus apa pun, kecuali yang "sebaiknya" tidak dipecahkan.'],
  ['dalang', 'Dalang', '🎎', 'Piawai memainkan wayang di depan layar, konon juga di balik layar.'],
  ['profesor', 'Profesor', '🎓', 'Gelarnya berderet; sebagian jurnalnya terbit asal biaya publikasi sudah ditransfer.'],
  ['atlet', 'Atlet', '🏅', 'Rajin latihan, tapi dana untuk kompetisi bergengsi tak kunjung turun. Bonus baru cair setelah juara pakai uang sendiri.'],
  ['dj', 'DJ', '🎧', 'Bikin pesta makin ramai; yang bikin pusing justru izin keramaian rangkap lima.'],
  ['perawat', 'Perawat', '🩺', 'Kerja tiga shift, tunjangannya masih menunggu tanda tangan pejabat yang sedang studi banding.'],
  ['ilmuwan', 'Ilmuwan', '🧪', 'Risetnya canggih, dana penelitiannya kalah dari anggaran seminar di hotel bintang lima.'],
  ['kurir', 'Kurir', '📦', 'Paket sampai dalam sehari, surat ke kantor dinas butuh disposisi tujuh meja.'],
].map(([id, name, emoji, bio]) => ({ id, name, emoji, bio }));
const CHAR = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

const MIN_PLAYERS = Number(process.env.MIN_PLAYERS || 3);
const MAX_PLAYERS = 8;
const MAX_CARDS = 3;

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createGame() {
  return { phase: 'LOBBY', players: [], figures: {}, spots: {}, deck: [], turnIdx: 0, step: null, die: null, log: [], winnerId: null, seq: 0, rollId: 0, lastEvent: null, eventId: 0 };
}

function event(g, type, charId, extra = {}) {
  g.lastEvent = { id: ++g.eventId, type, charId, ...extra };
}

function log(g, text) {
  g.log.push({ n: ++g.seq, text });
  if (g.log.length > 60) g.log.shift();
}

const charLabel = id => `${CHAR[id].emoji} ${CHAR[id].name}`;
const player = (g, pid) => g.players.find(p => p.id === pid);
const alivePlayers = g => g.players.filter(p => p.alive);
const currentPlayer = g => (g.phase === 'PLAYING' ? g.players[g.turnIdx] : null);

function startGame(g, rng = Math.random) {
  if (g.phase !== 'LOBBY') throw new Error('Game sudah berjalan');
  if (g.players.length < MIN_PLAYERS) throw new Error(`Minimal ${MIN_PLAYERS} pemain`);
  const ids = shuffle(CHARACTERS.map(c => c.id), rng);
  g.players = shuffle(g.players, rng); // urutan giliran acak
  g.players.forEach(p => { p.charId = ids.pop(); p.alive = true; p.cards = []; p.outAt = null; p.unmasks = 0; p.unmasksH = 0; p.forfeit = false; });
  g.outSeq = 0; g.standings = null;
  g.deck = ids; // sisa = tamu tak bersalah
  g.figures = {}; g.spots = {};
  shuffle(CHARACTERS.map(c => c.id), rng).forEach((id, i) => {
    const room = ROOMS[i % ROOMS.length];
    g.figures[id] = room;
    g.spots[id] = LAYOUT.findSpot(room, othersIn(g, room, id), null, rng); // tersebar lega
  });
  g.turnIdx = 0; g.step = null; g.die = null; g.winnerId = null; g.log = []; g.lastEvent = null; g.moves = [];
  // fase ORDER: semua pemain melempar 2 dadu angka (1–6); total tertinggi jalan duluan, seri = lempar ulang
  g.phase = 'ORDER';
  g.order = { round: 1, pending: g.players.map(p => p.id), scores: {}, last: {}, tied: [], done: null };
  log(g, 'Pesta dimulai! Lempar 2 dadu untuk menentukan urutan giliran.');
}

const othersIn = (g, room, except) => Object.keys(g.figures).filter(id => id !== except && g.figures[id] === room && g.spots[id]).map(id => g.spots[id]);

function legalMoves(g, color) {
  const moves = [];
  for (const [id, room] of Object.entries(g.figures)) {
    if (room === color) ADJ[room].forEach(to => moves.push({ charId: id, from: room, to }));
    else if (ADJ[room].includes(color)) moves.push({ charId: id, from: room, to: color });
  }
  return moves;
}

function blackOptions(g, p) {
  const myRoom = g.figures[p.charId];
  const killTargets = Object.keys(g.figures).filter(id => id !== p.charId && g.figures[id] === myRoom);
  const canDraw = p.cards.length < MAX_CARDS && g.deck.length > 0;
  return { killTargets, canDraw, alone: killTargets.length === 0 };
}

function assertTurn(g, pid, step) {
  const cp = currentPlayer(g);
  if (!cp || cp.id !== pid) throw new Error('Bukan giliranmu');
  if (g.step !== step) throw new Error('Aksi tidak valid sekarang');
  return cp;
}

function eliminate(g, p, how, by = null) {
  p.alive = false;
  p.outAt = ++g.outSeq; // urutan tersingkir → menentukan juara 2..8
  if (by) { const k = player(g, by); if (k) { k.unmasks = (k.unmasks || 0) + 1; if (!p.bot) k.unmasksH = (k.unmasksH || 0) + 1; } }
  const room = g.figures[p.charId] || null; // pulau tempat topeng terbuka
  delete g.figures[p.charId]; delete g.spots[p.charId];
  event(g, 'eliminated', p.charId, { victim: p.id, by, self: !by, room });
  log(g, `${how} ${p.name} ternyata adalah ${charLabel(p.charId)} — tersingkir!`);
}

function checkWin(g) {
  const alive = alivePlayers(g);
  if (alive.length <= 1) {
    g.phase = 'GAME_OVER'; g.step = null;
    g.winnerId = alive[0] ? alive[0].id : null;
    g.standings = standings(g);
    log(g, alive[0] ? `🏆 ${alive[0].name} (${charLabel(alive[0].charId)}) menang!` : 'Tidak ada pemenang.');
    return true;
  }
  return false;
}

// Juara 1 = yang bertahan; sisanya diurutkan dari yang paling akhir tersingkir.
function standings(g) {
  const n = g.players.length;
  const tier = p => (p.alive ? 0 : p.forfeit ? 2 : 1); // yang keluar/menyerah selalu di bawah
  const order = [...g.players].sort((a, b) => tier(a) - tier(b) || (b.outAt || 0) - (a.outAt || 0));
  // Ada bot? Poin dihitung antar-manusia saja (bot tidak bisa dipakai menimbun poin);
  // main sendirian melawan bot = latihan, tanpa poin.
  const withBots = g.players.some(p => p.bot);
  const humans = order.filter(p => !p.bot);
  return order.map((p, i) => {
    const placement = i + 1;
    const unmasks = p.unmasks || 0;
    if (p.bot) return { id: p.id, placement, unmasks, bot: true, points: 0, breakdown: [] };
    if (p.forfeit) return { id: p.id, placement, unmasks, forfeit: true, points: 0, breakdown: [{ key: 'forfeit', label: 'Keluar sebelum pesta selesai', pts: 0 }] };
    if (withBots) {
      if (humans.length < 2) return { id: p.id, placement, unmasks, practice: true, points: 0, breakdown: [{ key: 'practice', label: 'Main lawan bot: latihan, tanpa poin', pts: 0 }] };
      const hp = humans.indexOf(p) + 1, hn = humans.length, hu = p.unmasksH || 0;
      return { id: p.id, placement, unmasks, points: SCORING.points(hp, hn, hu), breakdown: [...SCORING.breakdown(hp, hn, hu), { key: 'bots', label: 'Bot tidak dihitung dalam poin', pts: 0 }] };
    }
    return { id: p.id, placement, unmasks, points: SCORING.points(placement, n, unmasks), breakdown: SCORING.breakdown(placement, n, unmasks) };
  });
}

// ---------- lempar 2 dadu untuk urutan giliran ----------
function orderRoll(g, pid, rng = Math.random) {
  if (g.phase !== 'ORDER') throw new Error('Bukan waktunya melempar dadu urutan');
  const o = g.order;
  if (!o.pending.includes(pid)) throw new Error('Kamu sudah melempar, tunggu pemain lain');
  const dice = [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  const total = dice[0] + dice[1];
  (o.scores[pid] = o.scores[pid] || []).push(total);
  o.last[pid] = { dice, total, round: o.round };
  o.pending = o.pending.filter(x => x !== pid);
  event(g, 'orderRoll', null, { by: pid, dice, total, round: o.round });
  if (!o.pending.length) resolveOrder(g);
}
function orderAutoRoll(g, onlyIds = null, rng = Math.random) {
  if (g.phase !== 'ORDER') return;
  for (const id of [...g.order.pending]) if (!onlyIds || onlyIds.includes(id)) { if (g.phase !== 'ORDER') break; orderRoll(g, id, rng); }
}
const lexDesc = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; } return 0; };
function resolveOrder(g) {
  const o = g.order;
  const ids = g.players.filter(p => p.alive).map(p => p.id);
  const groups = {};
  for (const id of ids) (groups[o.scores[id].join(',')] = groups[o.scores[id].join(',')] || []).push(id);
  const tied = Object.values(groups).filter(a => a.length > 1).flat();
  if (tied.length) { // seri → hanya yang seri melempar ulang
    o.round++; o.pending = tied; o.tied = tied;
    log(g, `Seri! ${tied.map(id => player(g, id).name).join(', ')} lempar ulang.`);
    return;
  }
  const sorted = [...ids].sort((a, b) => lexDesc(o.scores[a], o.scores[b]));
  g.players = [...sorted.map(id => player(g, id)), ...g.players.filter(p => !sorted.includes(p.id))];
  o.done = sorted.map((id, i) => ({ id, pos: i + 1, total: o.scores[id][o.scores[id].length - 1], scores: o.scores[id] }));
  o.tied = [];
  g.phase = 'PLAYING'; g.turnIdx = 0; g.step = 'ROLL'; g.die = null;
  log(g, `Urutan giliran: ${sorted.map((id, i) => `${i + 1}. ${player(g, id).name} (${o.scores[id].join('→')})`).join(', ')}.`);
  log(g, `${player(g, sorted[0]).name} jalan duluan.`);
}

// Pemain keluar di tengah permainan = menyerah. Karakternya tetap di papan sebagai tamu biasa
// (identitasnya tidak dibuka), posisinya paling bawah, dan tidak mendapat poin.
function forfeit(g, pid) {
  const p = player(g, pid);
  if (!p || !['PLAYING', 'ORDER'].includes(g.phase) || !p.alive) return false;
  const wasTurn = currentPlayer(g)?.id === pid;
  p.alive = false; p.forfeit = true; p.outAt = ++g.outSeq;
  event(g, 'forfeit', null, { by: pid });
  log(g, `${p.name} keluar dari pesta (menyerah).`);
  if (g.phase === 'ORDER') {
    g.order.pending = g.order.pending.filter(x => x !== pid);
    if (!checkWin(g) && !g.order.pending.length) resolveOrder(g);
    return true;
  }
  if (wasTurn) nextTurn(g); else checkWin(g);
  return true;
}

function nextTurn(g) {
  if (checkWin(g)) return;
  let i = g.turnIdx;
  do { i = (i + 1) % g.players.length; } while (!g.players[i].alive);
  g.turnIdx = i; g.step = 'ROLL'; g.die = null;
}

function roll(g, pid, rng = Math.random) {
  const p = assertTurn(g, pid, 'ROLL');
  g.die = DIE[Math.floor(rng() * DIE.length)];
  g.rollId++;
  if (g.die !== 'hitam') {
    log(g, `${p.name} melempar dadu: ${ROOM_LABEL[g.die].toUpperCase()} (${ROOM_COLOR_NAME[g.die]}).`);
    if (legalMoves(g, g.die).length === 0) { log(g, 'Tidak ada gerakan yang mungkin, giliran dilewati.'); return nextTurn(g); }
    g.step = 'MOVE';
    return;
  }
  log(g, `${p.name} melempar dadu: HITAM!`);
  if (blackOptions(g, p).alone) {
    eliminate(g, p, 'Sendirian di pulaunya, topeng terbuka:');
    return nextTurn(g);
  }
  g.step = 'BLACK';
}

// spot (opsional) = titik pilihan pemain di dalam pulau tujuan; server menjepit & menghindari tabrakan
function move(g, pid, charId, to, spot) {
  const p = assertTurn(g, pid, 'MOVE');
  const ok = legalMoves(g, g.die).some(m => m.charId === charId && m.to === to);
  if (!ok) throw new Error('Gerakan tidak sah');
  const from = g.figures[charId];
  const fromCount = Object.values(g.figures).filter(r => r === from).length;
  const toCount = Object.values(g.figures).filter(r => r === to).length;
  (g.moves = g.moves || []).push({ by: p.id, charId, from, to, fromCount, toCount });
  g.figures[charId] = to;
  g.spots[charId] = LAYOUT.findSpot(to, othersIn(g, to, charId), spot && typeof spot === 'object' ? { x: Number(spot.x), z: Number(spot.z) } : null);
  event(g, 'move', charId, { from, to, by: p.id });
  log(g, `${p.name} memindahkan ${charLabel(charId)}: ${ROOM_LABEL[from]} → ${ROOM_LABEL[to]}.`);
  nextTurn(g);
}

function kill(g, pid, targetId) {
  const p = assertTurn(g, pid, 'BLACK');
  if (!blackOptions(g, p).killTargets.includes(targetId)) throw new Error('Target harus satu pulau dengan karaktermu');
  const room = g.figures[targetId];
  const victim = g.players.find(x => x.alive && x.charId === targetId);
  if (victim) eliminate(g, victim, `${p.name} membuka topeng di ${ROOM_LABEL[room]}!`, p.id);
  else { delete g.figures[targetId]; delete g.spots[targetId]; event(g, 'killed', targetId, { by: p.id, room }); log(g, `${p.name} membuka topeng ${charLabel(targetId)} di ${ROOM_LABEL[room]} — hanya tamu biasa.`); }
  nextTurn(g);
}

function draw(g, pid) {
  const p = assertTurn(g, pid, 'BLACK');
  if (!blackOptions(g, p).canDraw) throw new Error('Tidak bisa mengambil kartu');
  const id = g.deck.pop();
  p.cards.push(id);
  const wasOnBoard = id in g.figures;
  const room = g.figures[id] || null;
  delete g.figures[id]; delete g.spots[id];
  event(g, 'left', id, { by: p.id, room });
  log(g, `${p.name} membuka kartu: ${charLabel(id)} ${wasOnBoard ? 'pulang dari pesta' : '(sudah tidak di pesta)'}.`);
  nextTurn(g);
}

// Dipakai saat waktu giliran habis / pemain offline.
function autoAct(g, rng = Math.random) {
  const p = currentPlayer(g);
  if (!p) return;
  if (g.step === 'ROLL') return roll(g, p.id, rng);
  if (g.step === 'MOVE') {
    const ms = legalMoves(g, g.die);
    const m = ms[Math.floor(rng() * ms.length)];
    return move(g, p.id, m.charId, m.to);
  }
  if (g.step === 'BLACK') {
    const o = blackOptions(g, p);
    if (o.canDraw) return draw(g, p.id);
    return kill(g, p.id, o.killTargets[Math.floor(rng() * o.killTargets.length)]);
  }
}


// ---------- bot ----------
// Tiga kepribadian. kill = ambang peluang untuk membuka topeng (makin kecil makin nekat),
// selfMove = penalti menggeser bidak sendiri (makin besar makin pandai menyamar), safe = bobot menjaga bidak tidak sendirian.
const BOT_STYLES = {
  nekat: { label: 'Nekat', kill: 0.24, selfMove: 0.4, safe: 1.0, attack: 1.6 },
  licik: { label: 'Licik', kill: 0.5, selfMove: 1.8, safe: 1.1, attack: 1.0 },
  waspada: { label: 'Waspada', kill: 0.4, selfMove: 0.8, safe: 2.0, attack: 0.8 },
};
const BOT_NAMES = ['Pak Bambang', 'Bu Tejo', 'Mas Dimas', 'Mbak Sri', 'Om Jarwo', 'Tante Lina', 'Bang Ucok', 'Kang Asep', 'Cik Mei', 'Daeng Rudi', 'Uda Rizal', 'Bli Komang', 'Kak Ros', 'Opung Tiur'];

// Perkiraan "bau pemain" tiap bidak dari cara orang lain menggesernya.
function botSuspicion(g, bot) {
  const s = {};
  for (const id of Object.keys(g.figures)) if (id !== bot.charId) s[id] = 1;
  for (const m of g.moves || []) {
    if (m.by === bot.id || !(m.charId in s)) continue;
    if (m.fromCount <= 2) s[m.charId] += 0.7;   // diselamatkan dari pulau sepi
    if (m.toCount >= 2) s[m.charId] += 0.35;    // dibawa ke tempat ramai
    if (m.toCount === 0) s[m.charId] -= 0.5;    // malah dibuang sendirian → kemungkinan bukan miliknya
  }
  for (const id in s) s[id] = Math.max(0.2, s[id]);
  return s;
}
function botOdds(g, bot) { // peluang tiap bidak adalah milik lawan yang masih hidup
  const s = botSuspicion(g, bot), ids = Object.keys(s);
  const k = alivePlayers(g).filter(p => p.id !== bot.id).length;
  const mean = ids.reduce((a, id) => a + s[id], 0) / (ids.length || 1);
  const base = ids.length ? k / ids.length : 0;
  const odds = {};
  for (const id of ids) odds[id] = Math.min(0.95, base * s[id] / mean);
  return odds;
}
function botAct(g, rng = Math.random) {
  const p = currentPlayer(g);
  if (!p) return;
  const st = BOT_STYLES[p.botStyle] || BOT_STYLES.licik;
  if (g.step === 'ROLL') return roll(g, p.id, rng);
  const odds = botOdds(g, p);
  if (g.step === 'MOVE') {
    let best = null, bestScore = -Infinity;
    for (const m of legalMoves(g, g.die)) {
      const fig = { ...g.figures, [m.charId]: m.to };
      const count = r => Object.values(fig).filter(x => x === r).length;
      const myRoom = fig[p.charId], company = count(myRoom) - 1;
      let sc = company === 0 ? -6 * st.safe : Math.min(company, 3) * 0.9 * st.safe;
      if (m.charId === p.charId) sc -= st.selfMove;
      for (const r of ROOMS) { // pulau dengan satu bidak = bidak itu rawan terbongkar
        if (r === myRoom) continue;
        const ids = Object.keys(fig).filter(id => fig[id] === r);
        if (ids.length === 1) sc += 1.6 * st.attack * (odds[ids[0]] || 0);
      }
      const targets = Object.keys(fig).filter(id => id !== p.charId && fig[id] === myRoom);
      if (targets.length) sc += 0.8 * st.attack * Math.max(...targets.map(id => odds[id] || 0));
      sc += rng() * 0.7; // sedikit acak agar tidak mudah ditebak
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    return move(g, p.id, best.charId, best.to);
  }
  if (g.step === 'BLACK') {
    const o = blackOptions(g, p);
    const target = o.killTargets.slice().sort((a, b) => (odds[b] || 0) - (odds[a] || 0))[0];
    const endgame = alivePlayers(g).length === 2;
    const thr = st.kill * (endgame ? 0.75 : 1);
    if (target && (!o.canDraw || (odds[target] || 0) >= thr)) return kill(g, p.id, target);
    if (o.canDraw) return draw(g, p.id);
    return kill(g, p.id, target);
  }
}

function resetToLobby(g) {
  g.standings = null; g.outSeq = 0; g.order = null;
  g.phase = 'LOBBY'; g.figures = {}; g.spots = {}; g.deck = []; g.step = null; g.die = null; g.winnerId = null; g.log = [];
  g.players.forEach(p => { p.charId = null; p.alive = true; p.cards = []; p.outAt = null; p.unmasks = 0; p.unmasksH = 0; p.forfeit = false; });
}

function publicView(g) {
  const cp = currentPlayer(g);
  const over = g.phase === 'GAME_OVER';
  return {
    phase: g.phase,
    players: g.players.map(p => ({
      id: p.id, name: p.name, connected: p.connected, alive: p.alive, cards: p.cards,
      revealed: ((!p.alive && !p.forfeit) || over) ? p.charId : null,
      forfeit: !!p.forfeit,
      bot: p.bot ? (BOT_STYLES[p.botStyle] || {}).label || 'Bot' : null,
    })),
    figures: g.figures,
    spots: g.spots,
    deckCount: g.deck.length,
    turnPlayerId: cp ? cp.id : null,
    step: g.step,
    die: g.die,
    rollId: g.rollId,
    lastEvent: g.lastEvent,
    legalMoves: g.step === 'MOVE' ? legalMoves(g, g.die) : [],
    log: g.log,
    winnerId: g.winnerId,
    standings: g.phase === 'GAME_OVER' ? g.standings : null,
    order: g.order ? { round: g.order.round, pending: g.order.pending, last: g.order.last, tied: g.order.tied, done: g.order.done } : null,
  };
}

function privateView(g, p) {
  const v = { charId: p.charId };
  const cp = currentPlayer(g);
  if (cp && cp.id === p.id && g.step === 'BLACK') Object.assign(v, blackOptions(g, p));
  return v;
}

module.exports = {
  ROOMS, ROOM_LABEL, ROOM_COLOR_NAME, ADJ, DIE, CHARACTERS, MIN_PLAYERS, MAX_PLAYERS,
  createGame, startGame, roll, move, kill, draw, autoAct, resetToLobby, legalMoves, blackOptions,
  publicView, privateView, currentPlayer, player, standings, forfeit, orderRoll, orderAutoRoll, botAct, BOT_STYLES, BOT_NAMES,
};
