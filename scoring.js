// Sistem poin & tingkat (tier) Pesta Topeng.
//
// Poin satu pertandingan (N = jumlah pemain, P = posisi juara 1..N):
//   Hadir             +5
//   Bertahan          +10 untuk setiap pemain yang tersingkir lebih dulu darimu  (N − P)
//   Juara 1           +25 bonus
//   Bongkar topeng    +10 untuk setiap lawan yang kamu singkirkan
//
// Contoh 8 pemain: juara 1 = 100, juara 2 = 65, 3 = 55, 4 = 45, 5 = 35, 6 = 25, 7 = 15, 8 = 5.
// Contoh 3 pemain: juara 1 = 50, juara 2 = 15, juara 3 = 5.
// Room ramai lebih bernilai, posisi selalu lebih penting dari kebetulan, dan bermain
// agresif (membongkar topeng lawan) diberi hadiah tanpa mengalahkan nilai bertahan.
'use strict';

const RULES = { attend: 5, perOutlasted: 10, winBonus: 25, perUnmask: 10 };

function breakdown(placement, n, unmasks = 0) {
  const parts = [{ key: 'attend', label: 'Hadir di pesta', pts: RULES.attend }];
  const outlasted = Math.max(0, n - placement);
  if (outlasted) parts.push({ key: 'outlasted', label: `Bertahan melewati ${outlasted} pemain`, pts: outlasted * RULES.perOutlasted });
  if (placement === 1) parts.push({ key: 'win', label: 'Bonus juara 1', pts: RULES.winBonus });
  if (unmasks) parts.push({ key: 'unmask', label: `Membongkar ${unmasks} topeng lawan`, pts: unmasks * RULES.perUnmask });
  return parts;
}

const points = (placement, n, unmasks = 0) => breakdown(placement, n, unmasks).reduce((s, p) => s + p.pts, 0);

// Tingkat berdasarkan total poin sepanjang masa.
const TIERS = [
  { id: 'pendatang', name: 'Pendatang Baru', min: 0, color: '#9aa3ad' },
  { id: 'perunggu', name: 'Perunggu', min: 150, color: '#c08457' },
  { id: 'perak', name: 'Perak', min: 500, color: '#c9d1d9' },
  { id: 'emas', name: 'Emas', min: 1200, color: '#e8c15a' },
  { id: 'platina', name: 'Platina', min: 2500, color: '#7fd1c7' },
  { id: 'berlian', name: 'Berlian', min: 5000, color: '#8fb8ff' },
  { id: 'legenda', name: 'Legenda Topeng', min: 10000, color: '#ff8fb1' },
];

function tierOf(total) {
  let t = TIERS[0];
  for (const x of TIERS) if (total >= x.min) t = x;
  return t;
}

// Tabel poin untuk ditampilkan di UI (N 3..8).
function table(minN = 3, maxN = 8) {
  const rows = [];
  for (let n = minN; n <= maxN; n++) rows.push({ n, pts: Array.from({ length: n }, (_, i) => points(i + 1, n)) });
  return rows;
}

module.exports = { RULES, TIERS, points, breakdown, tierOf, table };
