// Logika murni game "Pesta Topeng" — tanpa socket, mudah dites.
'use strict';
const LAYOUT = require('./layout');
const SCORING = require('./scoring');

// Papan = 5 benua. Warna: Asia hijau, Afrika kuning, Eropa biru, Amerika merah, Antartika putih.
const ROOMS = ['amerika', 'antartika', 'eropa', 'afrika', 'asia'];
const ROOM_LABEL = { asia: 'Asia', afrika: 'Afrika', eropa: 'Eropa', amerika: 'Amerika', antartika: 'Antartika' };
const ROOM_COLOR_NAME = { asia: 'hijau', afrika: 'kuning', eropa: 'biru', amerika: 'merah', antartika: 'putih' };
// Tata letak papan:  [Amerika][Antartika] / [   Eropa   ] / [Afrika][Asia]
// Eropa di tengah terhubung ke semua benua.
const ADJ = {
  amerika: ['antartika', 'eropa'],
  antartika: ['amerika', 'eropa'],
  afrika: ['asia', 'eropa'],
  asia: ['afrika', 'eropa'],
  eropa: ['amerika', 'antartika', 'afrika', 'asia'],
};
// Dadu 7 sisi (prisma segi lima): 5 sisi benua + 2 ujung hitam → hitam 2/7 (±29%), tiap benua 1/7 (±14%)
const DIE = ['asia', 'afrika', 'eropa', 'amerika', 'antartika', 'hitam', 'hitam'];

const CHARACTERS = [ // 20 tamu = 20 profesi. bio = deskripsi satir (fiksi, untuk hiburan)
  ['koki', 'Koki', '🧑‍🍳', 'Memasak untuk program makan bergizi; porsinya menyusut tiap kali lewat meja rapat.'],
  ['polisi', 'Polisi', '👮', 'Siaga 24 jam, apalagi kalau laporannya sudah viral duluan.'],
  ['dokter', 'Dokter', '🧑‍⚕️', 'Siap melayani semua pasien. Antreannya dibawa santai saja, sampai tahun depan.'],
  ['damkar', 'Pemadam', '🧑‍🚒', 'Datang paling cepat, lalu ditugasi urus sarang tawon, kucing di pohon, dan cincin nyangkut.'],
  ['petani', 'Petani', '🧑‍🌾', 'Pahlawan pangan; panen rayanya selalu kompak dengan datangnya beras impor.'],
  ['pilot', 'Pilot', '🧑‍✈️', 'Selalu terbang tepat waktu, asal "tepat waktu" berarti delay dua jam.'],
  ['astronot', 'Astronot', '🧑‍🚀', 'Siap meluncur ke luar angkasa, menunggu anggarannya meluncur lebih dulu.'],
  ['pelukis', 'Pelukis', '🧑‍🎨', 'Karyanya dipajang di kantor dinas; honornya masih "dalam proses".'],
  ['pesulap', 'Pesulap', '🎩', 'Ahli menghilangkan sesuatu tanpa jejak. Kartu, maksudnya. Bukan anggaran.'],
  ['koboi', 'Peternak', '🤠', 'Sapinya gemuk dan sehat, harga dagingnya tetap tidak masuk akal.'],
  ['tukang', 'Tukang', '👷', 'Bangun jalan mulus menjelang pemilu, berlubang lagi setelah pelantikan.'],
  ['kapten', 'Kapten Kapal', '⚓', 'Mengarungi samudra luas, juga lautan dokumen izin bongkar muat.'],
  ['detektif', 'Detektif', '🕵️', 'Mampu memecahkan kasus apa pun, kecuali yang "sebaiknya" tidak dipecahkan.'],
  ['dalang', 'Dalang', '🎎', 'Piawai memainkan wayang di depan layar, konon juga di balik layar.'],
  ['profesor', 'Profesor', '🎓', 'Gelarnya berderet; sebagian jurnalnya terbit asal biaya publikasi sudah ditransfer.'],
  ['atlet', 'Atlet', '🏅', 'Manusia rajin olahraga, tapi terhalang dana untuk ikut kompetisi bergengsi. Bonus baru cair setelah juara pakai uang sendiri.'],
  ['dj', 'DJ', '🎧', 'Bikin pesta makin ramai; yang bikin pusing justru izin keramaiannya.'],
  ['perawat', 'Perawat', '🩺', 'Kerja tiga shift, statusnya masih honorer sejak zaman kaset.'],
  ['ilmuwan', 'Ilmuwan', '🧪', 'Risetnya canggih, dana penelitiannya kalah dari anggaran seminar.'],
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
  g.players.forEach(p => { p.charId = ids.pop(); p.alive = true; p.cards = []; p.outAt = null; p.unmasks = 0; });
  g.outSeq = 0; g.standings = null;
  g.deck = ids; // sisa = tamu tak bersalah
  g.figures = {}; g.spots = {};
  shuffle(CHARACTERS.map(c => c.id), rng).forEach((id, i) => {
    const room = ROOMS[i % ROOMS.length];
    g.figures[id] = room;
    g.spots[id] = LAYOUT.findSpot(room, othersIn(g, room, id), null, rng); // tersebar lega
  });
  g.phase = 'PLAYING';
  g.turnIdx = 0; g.step = 'ROLL'; g.die = null; g.winnerId = null; g.log = []; g.lastEvent = null;
  log(g, `Pesta dimulai! ${g.players[0].name} jalan duluan.`);
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
  if (by) { const k = player(g, by); if (k) k.unmasks = (k.unmasks || 0) + 1; }
  delete g.figures[p.charId]; delete g.spots[p.charId];
  event(g, 'eliminated', p.charId, { victim: p.id, by, self: !by });
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
  const order = [...g.players].sort((a, b) => (a.alive ? -1 : b.alive ? 1 : (b.outAt || 0) - (a.outAt || 0)));
  return order.map((p, i) => {
    const placement = i + 1;
    const unmasks = p.unmasks || 0;
    return { id: p.id, placement, unmasks, points: SCORING.points(placement, n, unmasks), breakdown: SCORING.breakdown(placement, n, unmasks) };
  });
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
    eliminate(g, p, 'Sendirian di benuanya, topeng terbuka:');
    return nextTurn(g);
  }
  g.step = 'BLACK';
}

// spot (opsional) = titik pilihan pemain di dalam benua tujuan; server menjepit & menghindari tabrakan
function move(g, pid, charId, to, spot) {
  const p = assertTurn(g, pid, 'MOVE');
  const ok = legalMoves(g, g.die).some(m => m.charId === charId && m.to === to);
  if (!ok) throw new Error('Gerakan tidak sah');
  const from = g.figures[charId];
  g.figures[charId] = to;
  g.spots[charId] = LAYOUT.findSpot(to, othersIn(g, to, charId), spot && typeof spot === 'object' ? { x: Number(spot.x), z: Number(spot.z) } : null);
  event(g, 'move', charId, { from, to, by: p.id });
  log(g, `${p.name} memindahkan ${charLabel(charId)}: ${ROOM_LABEL[from]} → ${ROOM_LABEL[to]}.`);
  nextTurn(g);
}

function kill(g, pid, targetId) {
  const p = assertTurn(g, pid, 'BLACK');
  if (!blackOptions(g, p).killTargets.includes(targetId)) throw new Error('Target harus satu benua dengan karaktermu');
  const room = g.figures[targetId];
  const victim = g.players.find(x => x.alive && x.charId === targetId);
  if (victim) eliminate(g, victim, `${p.name} membuka topeng di ${ROOM_LABEL[room]}!`, p.id);
  else { delete g.figures[targetId]; delete g.spots[targetId]; event(g, 'killed', targetId, { by: p.id }); log(g, `${p.name} membuka topeng ${charLabel(targetId)} di ${ROOM_LABEL[room]} — hanya tamu biasa.`); }
  nextTurn(g);
}

function draw(g, pid) {
  const p = assertTurn(g, pid, 'BLACK');
  if (!blackOptions(g, p).canDraw) throw new Error('Tidak bisa mengambil kartu');
  const id = g.deck.pop();
  p.cards.push(id);
  const wasOnBoard = id in g.figures;
  delete g.figures[id]; delete g.spots[id];
  event(g, 'left', id, { by: p.id });
  log(g, `${p.name} mengambil kartu: ${charLabel(id)} ${wasOnBoard ? 'pulang dari pesta' : '(sudah tidak di pesta)'}.`);
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

function resetToLobby(g) {
  g.standings = null; g.outSeq = 0;
  g.phase = 'LOBBY'; g.figures = {}; g.spots = {}; g.deck = []; g.step = null; g.die = null; g.winnerId = null; g.log = [];
  g.players.forEach(p => { p.charId = null; p.alive = true; p.cards = []; p.outAt = null; p.unmasks = 0; });
}

function publicView(g) {
  const cp = currentPlayer(g);
  const over = g.phase === 'GAME_OVER';
  return {
    phase: g.phase,
    players: g.players.map(p => ({
      id: p.id, name: p.name, connected: p.connected, alive: p.alive, cards: p.cards,
      revealed: (!p.alive || over) ? p.charId : null,
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
  publicView, privateView, currentPlayer, player, standings,
};
