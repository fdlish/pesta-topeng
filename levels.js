// Level 1–100 dari total poin sepanjang masa (poin pesta + bonus tantangan harian).
// Poin kumulatif untuk mencapai level L: 15·(L−1) + 2·(L−1)^1.8
// Contoh: Lv 10 ≈ 240 poin (±8 pesta), Lv 50 ≈ 2.900 poin (±100 pesta), Lv 100 ≈ 9.300 poin (±300 pesta).
'use strict';
const MAX = 100;
const need = L => (L <= 1 ? 0 : Math.round(15 * (L - 1) + 2 * Math.pow(L - 1, 1.8)));
const TABLE = Array.from({ length: MAX + 1 }, (_, L) => need(L));
function levelOf(points) {
  const p = Math.max(0, Number(points) || 0);
  let L = 1; while (L < MAX && p >= TABLE[L + 1]) L++;
  const from = TABLE[L], to = L < MAX ? TABLE[L + 1] : null;
  return { level: L, from, to, into: p - from, span: to ? to - from : null };
}
module.exports = { MAX, need, levelOf, TABLE };
