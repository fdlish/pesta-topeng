// Misi akun & gelar. Setiap misi yang selesai membuka satu gelar yang bisa dipakai di profil.
// Dua jenis:
//  - kumulatif: penghitung yang terus bertambah antar pesta (main, menang, bongkar, ...)
//  - prestasi: dicapai dalam SATU pesta (diperiksa saat pesta selesai)
// Progres hanya dihitung di pesta dengan minimal 2 manusia (sama seperti poin).
'use strict';

const TIERS = {
  mudah: { label: 'Mudah', order: 0 },
  sedang: { label: 'Sedang', order: 1 },
  sulit: { label: 'Sulit', order: 2 },
  legendaris: { label: 'Legendaris', order: 3 },
};

// c = penghitung kumulatif setelah pesta ini; x = konteks pesta ini (untuk prestasi)
const MISSIONS = [
  // ------------------------------------------------------------ mudah --
  { key: 'debut', tier: 'mudah', title: 'Tamu Baru', desc: 'Selesaikan pesta pertamamu.', counter: 'games', goal: 1 },
  { key: 'menang1', tier: 'mudah', title: 'Pemenang Perdana', desc: 'Menangkan 1 pesta.', counter: 'wins', goal: 1 },
  { key: 'bongkar1', tier: 'mudah', title: 'Si Penyelidik', desc: 'Bongkar topeng 1 pemain lawan.', counter: 'unmasks', goal: 1 },
  { key: 'rahasia1', tier: 'mudah', title: 'Agen Rahasia', desc: 'Selesaikan 1 misi rahasia pesta.', counter: 'secret', goal: 1 },
  { key: 'kartu5', tier: 'mudah', title: 'Pengantar Pulang', desc: 'Buka 5 kartu tamu (total).', counter: 'cards', goal: 5 },
  // ------------------------------------------------------------ sedang --
  { key: 'main25', tier: 'sedang', title: 'Tamu Setia', desc: 'Selesaikan 25 pesta.', counter: 'games', goal: 25 },
  { key: 'menang10', tier: 'sedang', title: 'Langganan Juara', desc: 'Menangkan 10 pesta.', counter: 'wins', goal: 10 },
  { key: 'bongkar15', tier: 'sedang', title: 'Pemburu Topeng', desc: 'Bongkar topeng 15 pemain lawan (total).', counter: 'unmasks', goal: 15 },
  { key: 'rahasia10', tier: 'sedang', title: 'Mata-Mata', desc: 'Selesaikan 10 misi rahasia pesta.', counter: 'secret', goal: 10 },
  { key: 'jitu', tier: 'sedang', title: 'Detektif Jitu', desc: 'Menuduh dengan tepat dalam satu pesta.', feat: x => x.accuseHits >= 1 },
  { key: 'licin', tier: 'sedang', title: 'Si Licin', desc: 'Menang tanpa sekali pun menggeser tamumu sendiri.', feat: x => x.won && x.selfMoves === 0 },
  // ------------------------------------------------------------- sulit --
  { key: 'main50', tier: 'sulit', title: 'Penghuni Pesta', desc: 'Selesaikan 50 pesta.', counter: 'games', goal: 50 },
  { key: 'menang25', tier: 'sulit', title: 'Penguasa Pesta', desc: 'Menangkan 25 pesta.', counter: 'wins', goal: 25 },
  { key: 'peramal', tier: 'sulit', title: 'Peramal', desc: 'Menuduh dengan tepat 10 kali (total).', counter: 'accuseHits', goal: 10 },
  { key: 'tanduk', tier: 'sulit', title: 'Nyawa Sembilan', desc: 'Menang walau tamumu sempat sendirian 3 giliran.', feat: x => x.won && x.aloneTurns >= 3 },
  { key: 'sapu', tier: 'sulit', title: 'Penyapu Bersih', desc: 'Bongkar 3 topeng lawan dalam satu pesta.', feat: x => x.unmasks >= 3 },
  { key: 'malam', tier: 'sulit', title: 'Penguasa Malam', desc: 'Menang melewati tengah malam di pesta 6 pemain atau lebih.', feat: x => x.won && x.midnight && x.players >= 6 },
  // -------------------------------------------------------- legendaris --
  { key: 'main100', tier: 'legendaris', title: 'Legenda Pesta', desc: 'Selesaikan 100 pesta.', counter: 'games', goal: 100 },
  { key: 'menang50', tier: 'legendaris', title: 'Dalang Agung', desc: 'Menangkan 50 pesta.', counter: 'wins', goal: 50 },
  { key: 'rahasia50', tier: 'legendaris', title: 'Bayangan', desc: 'Selesaikan 50 misi rahasia pesta.', counter: 'secret', goal: 50 },
  { key: 'emas', tier: 'legendaris', title: 'Topeng Emas', desc: 'Menang di pesta penuh 8 pemain tanpa sekali pun membuka kartu.', feat: x => x.won && x.players >= 8 && x.cards === 0 },
  { key: 'kolektor', tier: 'legendaris', title: 'Kolektor Gelar', desc: 'Buka 15 gelar lain.', special: 'collector', goal: 15 },
];
const BY_KEY = Object.fromEntries(MISSIONS.map(m => [m.key, m]));
const COUNTERS = ['games', 'wins', 'unmasks', 'secret', 'cards', 'accuseHits'];

function normalize(progress) {
  const p = progress && typeof progress === 'object' ? progress : {};
  const c = { ...(p.c || {}) };
  for (const k of COUNTERS) c[k] = Number(c[k]) || 0;
  return { c, done: { ...(p.done || {}) } };
}

// Terapkan hasil satu pesta → { progress, unlocked: [misi baru] }
// base: angka dari profil lama (games/wins/unmasks) agar pemain lama tidak mulai dari nol.
function apply(progress, x, base = {}) {
  const pr = normalize(progress);
  if (!pr.c._seeded) { // pertama kali: lanjutkan dari statistik profil yang sudah ada
    pr.c.games = Math.max(pr.c.games, Number(base.games) || 0);
    pr.c.wins = Math.max(pr.c.wins, Number(base.wins) || 0);
    pr.c.unmasks = Math.max(pr.c.unmasks, Number(base.unmasks) || 0);
    pr.c._seeded = 1;
  }
  pr.c.games += 1;
  pr.c.wins += x.won ? 1 : 0;
  pr.c.unmasks += x.unmasks || 0;
  pr.c.secret += x.secretDone ? 1 : 0;
  pr.c.cards += x.cards || 0;
  pr.c.accuseHits += x.accuseHits || 0;
  const unlocked = [];
  const now = new Date().toISOString();
  const tick = m => { if (!pr.done[m.key]) { pr.done[m.key] = now; unlocked.push(m.key); } };
  for (const m of MISSIONS) {
    if (m.counter && pr.c[m.counter] >= m.goal) tick(m);
    else if (m.feat && m.feat(x)) tick(m);
  }
  const col = BY_KEY.kolektor;
  if (Object.keys(pr.done).filter(k => k !== 'kolektor').length >= col.goal) tick(col);
  return { progress: pr, unlocked };
}

// Ringkasan untuk ditampilkan (profil sendiri): status + progres tiap misi
function view(progress) {
  const pr = normalize(progress);
  const doneCount = Object.keys(pr.done).filter(k => k !== 'kolektor').length;
  return MISSIONS.map(m => ({
    key: m.key, tier: m.tier, title: m.title, desc: m.desc,
    done: !!pr.done[m.key], at: pr.done[m.key] || null,
    now: m.counter ? Math.min(pr.c[m.counter], m.goal) : m.special ? Math.min(doneCount, m.goal) : null,
    goal: m.goal || null,
  }));
}
const titleOf = key => (BY_KEY[key] ? { key, title: BY_KEY[key].title, tier: BY_KEY[key].tier } : null);
const catalog = () => ({ tiers: TIERS, missions: MISSIONS.map(({ key, tier, title, desc, goal }) => ({ key, tier, title, desc, goal: goal || null })) });

module.exports = { MISSIONS, TIERS, BY_KEY, apply, view, titleOf, catalog, normalize };
