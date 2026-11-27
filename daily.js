// Tantangan harian: 3 tantangan (mudah, sedang, sulit) yang berganti setiap hari pukul 00.00 WIB.
// Semua pemain mendapat tantangan yang sama hari itu. Selesai = bonus poin, langsung masuk ke pesta saat itu.
// Hanya pesta yang dihitung (≥2 manusia) yang memajukan progres, sama seperti misi.
'use strict';

const REWARD = { mudah: 15, sedang: 30, sulit: 60 };

// add(x) = berapa progres yang ditambahkan satu pesta. x = konteks pesta (lihat server.awardRoom)
const POOL = [
  // mudah
  { key: 'main2', tier: 'mudah', text: 'Selesaikan 2 pesta', goal: 2, add: () => 1 },
  { key: 'bongkar1', tier: 'mudah', text: 'Bongkar 1 topeng lawan', goal: 1, add: x => x.unmasks },
  { key: 'rahasia1', tier: 'mudah', text: 'Selesaikan 1 misi rahasia', goal: 1, add: x => (x.secretDone ? 1 : 0) },
  { key: 'kartu2', tier: 'mudah', text: 'Buka 2 kartu tamu', goal: 2, add: x => x.cards },
  { key: 'geser6', tier: 'mudah', text: 'Geser tamu milik orang lain 6 kali', goal: 6, add: x => x.otherMoves },
  // sedang
  { key: 'menang1', tier: 'sedang', text: 'Menangkan 1 pesta', goal: 1, add: x => (x.won ? 1 : 0) },
  { key: 'tiga2', tier: 'sedang', text: 'Masuk 3 besar di 2 pesta', goal: 2, add: x => (x.placement <= 3 ? 1 : 0) },
  { key: 'bongkar3', tier: 'sedang', text: 'Bongkar 3 topeng lawan', goal: 3, add: x => x.unmasks },
  { key: 'tuduh1', tier: 'sedang', text: 'Menuduh dengan tepat 1 kali', goal: 1, add: x => x.accuseHits },
  { key: 'main4', tier: 'sedang', text: 'Selesaikan 4 pesta', goal: 4, add: () => 1 },
  { key: 'malam1', tier: 'sedang', text: 'Masih bertahan saat tengah malam tiba', goal: 1, add: x => (x.atMidnight ? 1 : 0) },
  // sulit
  { key: 'menang2', tier: 'sulit', text: 'Menangkan 2 pesta', goal: 2, add: x => (x.won ? 1 : 0) },
  { key: 'sapu2', tier: 'sulit', text: 'Bongkar 2 topeng dalam satu pesta', goal: 1, add: x => (x.unmasks >= 2 ? 1 : 0) },
  { key: 'bersih', tier: 'sulit', text: 'Menang tanpa membuka satu kartu pun', goal: 1, add: x => (x.won && x.cards === 0 ? 1 : 0) },
  { key: 'rahasia3', tier: 'sulit', text: 'Selesaikan 3 misi rahasia', goal: 3, add: x => (x.secretDone ? 1 : 0) },
  { key: 'ramai', tier: 'sulit', text: 'Menang di pesta 6 pemain atau lebih', goal: 1, add: x => (x.won && x.players >= 6 ? 1 : 0) },
];
const BY_KEY = Object.fromEntries(POOL.map(d => [d.key, d]));

// tanggal WIB (UTC+7) sebagai 'YYYY-MM-DD'
const today = (now = Date.now()) => new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
// sisa milidetik sampai pergantian hari WIB
const msLeft = (now = Date.now()) => 86400e3 - ((now + 7 * 3600e3) % 86400e3);

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function pickFor(date) {
  return ['mudah', 'sedang', 'sulit'].map((tier, i) => {
    const opts = POOL.filter(d => d.tier === tier);
    return opts[hash(`${date}:${i}`) % opts.length];
  });
}

function state(progress, date = today()) {
  const d = progress && progress.daily;
  return d && d.date === date ? { date, n: { ...(d.n || {}) }, done: { ...(d.done || {}) } } : { date, n: {}, done: {} };
}

// Terapkan satu pesta → { daily, completed: [{key,text,tier,pts}], bonus }
function apply(progress, x, now = Date.now()) {
  const date = today(now), d = state(progress, date), completed = [];
  for (const c of pickFor(date)) {
    if (d.done[c.key]) continue;
    d.n[c.key] = Math.min(c.goal, (d.n[c.key] || 0) + (Number(c.add(x)) || 0));
    if (d.n[c.key] >= c.goal) { d.done[c.key] = 1; completed.push({ key: c.key, text: c.text, tier: c.tier, pts: REWARD[c.tier] }); }
  }
  return { daily: d, completed, bonus: completed.reduce((s, c) => s + c.pts, 0) };
}

function view(progress, now = Date.now()) {
  const date = today(now), d = state(progress, date);
  return {
    date, resetsIn: msLeft(now),
    list: pickFor(date).map(c => ({ key: c.key, tier: c.tier, text: c.text, goal: c.goal, now: d.n[c.key] || 0, done: !!d.done[c.key], pts: REWARD[c.tier] })),
  };
}

module.exports = { POOL, BY_KEY, REWARD, today, msLeft, pickFor, apply, view };
