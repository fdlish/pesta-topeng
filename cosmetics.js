// Kosmetik yang dibuka lewat misi/gelar. Tidak mengubah aturan main.
//  - frame : bingkai foto profil (terlihat semua orang di lobby, peringkat, profil)
//  - dice  : corak dadu, tampil di papan semua pemain saat KAMU yang melempar
//  - cloth : taplak meja, hanya untuk tampilanmu sendiri
// Warna sisi dadu (kode pulau) tidak pernah diubah agar permainan tetap terbaca.
'use strict';

const ITEMS = [
  // ---- bingkai
  { kind: 'frame', key: 'polos', name: 'Polos', unlock: null },
  { kind: 'frame', key: 'undangan', name: 'Pita Undangan', unlock: 'debut' },
  { kind: 'frame', key: 'melati', name: 'Untaian Melati', unlock: 'rahasia1' },
  { kind: 'frame', key: 'parang', name: 'Parang Hijau', unlock: 'main25' },
  { kind: 'frame', key: 'mega', name: 'Mega Mendung', unlock: 'bongkar15' },
  { kind: 'frame', key: 'cabai', name: 'Cabai Rawit', unlock: 'main50' },
  { kind: 'frame', key: 'malam', name: 'Tengah Malam', unlock: 'malam' },
  { kind: 'frame', key: 'emas', name: 'Prada Emas', unlock: 'main100' },
  // ---- dadu
  { kind: 'dice', key: 'klasik', name: 'Klasik', unlock: null },
  { kind: 'dice', key: 'cabai', name: 'Pinggir Cabai', unlock: 'bongkar1' },
  { kind: 'dice', key: 'perak', name: 'Perak', unlock: 'menang1' },
  { kind: 'dice', key: 'nila', name: 'Nila Malam', unlock: 'rahasia10' },
  { kind: 'dice', key: 'giok', name: 'Giok', unlock: 'peramal' },
  { kind: 'dice', key: 'emas', name: 'Emas', unlock: 'menang25' },
  { kind: 'dice', key: 'dalang', name: 'Dalang', unlock: 'menang50' },
  // ---- taplak
  { kind: 'cloth', key: 'nila', name: 'Kawung Nila', unlock: null },
  { kind: 'cloth', key: 'sogan', name: 'Sogan Cokelat', unlock: 'kartu5' },
  { kind: 'cloth', key: 'hijau', name: 'Parang Hijau', unlock: 'menang10' },
  { kind: 'cloth', key: 'marun', name: 'Marun Pesta', unlock: 'sapu' },
  { kind: 'cloth', key: 'hitam', name: 'Hitam Prada', unlock: 'kolektor' },
];
const KINDS = ['frame', 'dice', 'cloth'];
const DEFAULT = { frame: 'polos', dice: 'klasik', cloth: 'nila' };
const find = (kind, key) => ITEMS.find(i => i.kind === kind && i.key === key);
const owned = (item, done) => !!item && (!item.unlock || !!(done && done[item.unlock]));

// Kosmetik yang benar-benar dipakai (yang terkunci dikembalikan ke bawaan)
function resolve(profile) {
  const eq = (profile && profile.cosmetics) || {}, done = profile && profile.progress && profile.progress.done;
  const out = {};
  for (const k of KINDS) out[k] = owned(find(k, eq[k]), done) ? eq[k] : DEFAULT[k];
  return out;
}
function view(profile) {
  const done = profile && profile.progress && profile.progress.done, cur = resolve(profile);
  return ITEMS.map(i => ({ ...i, owned: owned(i, done), on: cur[i.kind] === i.key }));
}
const catalog = () => ITEMS;

module.exports = { ITEMS, KINDS, DEFAULT, find, owned, resolve, view, catalog };
