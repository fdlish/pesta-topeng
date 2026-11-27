// Kosmetik yang dibuka lewat misi/gelar. Tidak mengubah aturan main.
//  - frame : bingkai foto profil (terlihat semua orang di lobby, peringkat, profil)
//  - dice  : corak dadu, tampil di papan semua pemain saat KAMU yang melempar
//  - cloth : taplak meja, hanya untuk tampilanmu sendiri
//  - avatar: foto profil topeng (20 dibuka per level 1–100, 5 dari misi khusus)
//  - plate : corak bar nama di dalam permainan (dibuka per level / misi khusus)
// unlock: null = bawaan, 'kunci_misi', atau { level: n }
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
  // ---- foto profil (bawaan: foto Google / inisial)
  { kind: 'avatar', key: 'asli', name: 'Foto akun', unlock: null },
  ...[['kertas', 'Topeng Kertas', 1], ['batik', 'Batik Kawung', 2], ['kucing', 'Kucing Pasar', 4], ['rubah', 'Rubah Senja', 6],
    ['hantu', 'Burung Hantu', 8], ['panji', 'Wajah Putih', 10], ['klana', 'Merah Berkumis', 13], ['kumbang', 'Kumbang Hijau', 16],
    ['nila', 'Nila Malam', 20], ['raksasa', 'Raksasa Ramah', 25], ['elang', 'Elang Bukit', 30], ['naga', 'Naga Giok', 35],
    ['bulan', 'Perak Bulan', 40], ['singa', 'Singa Api', 45], ['penari', 'Penari Mahkota', 50], ['kelelawar', 'Kelelawar', 60],
    ['rusa', 'Rusa Emas', 70], ['laut', 'Ratu Laut', 80], ['api', 'Raja Api', 90], ['agung', 'Topeng Agung', 100]]
    .map(([key, name, level]) => ({ kind: 'avatar', key, name, unlock: { level } })),
  { kind: 'avatar', key: 'dalang', name: 'Dalang', unlock: 'menang50', special: true },
  { kind: 'avatar', key: 'bayangan', name: 'Bayangan', unlock: 'rahasia50', special: true },
  { kind: 'avatar', key: 'emasmurni', name: 'Emas Murni', unlock: 'emas', special: true },
  { kind: 'avatar', key: 'peramal', name: 'Mata Ketiga', unlock: 'peramal', special: true },
  { kind: 'avatar', key: 'kolektor', name: 'Kolektor', unlock: 'kolektor', special: true },
  // ---- bar nama di dalam permainan
  { kind: 'plate', key: 'polos', name: 'Polos', unlock: null },
  ...[['kawung', 'Kawung', 3], ['pita', 'Pita Kunyit', 7], ['sogan', 'Sogan', 12], ['parang', 'Parang', 18], ['mega', 'Mega Mendung', 24],
    ['songket', 'Songket', 32], ['malam', 'Langit Malam', 42], ['giok', 'Giok', 55], ['prada', 'Prada Hitam', 70], ['bara', 'Bara Api', 85], ['agung', 'Emas Agung', 100]]
    .map(([key, name, level]) => ({ kind: 'plate', key, name, unlock: { level } })),
  { kind: 'plate', key: 'juara', name: 'Juara', unlock: 'menang10', special: true },
  { kind: 'plate', key: 'mata', name: 'Mata-Mata', unlock: 'rahasia10', special: true },
  { kind: 'plate', key: 'sapu', name: 'Penyapu', unlock: 'sapu', special: true },
];
const KINDS = ['frame', 'dice', 'cloth', 'avatar', 'plate'];
const DEFAULT = { frame: 'polos', dice: 'klasik', cloth: 'nila', avatar: 'asli', plate: 'polos' };
const find = (kind, key) => ITEMS.find(i => i.kind === kind && i.key === key);
const LEVELS = require('./levels');
const levelOfProfile = p => LEVELS.levelOf(p && p.points).level;
const owned = (item, done, level = 1) => !!item && (!item.unlock || (typeof item.unlock === 'object' ? level >= item.unlock.level : !!(done && done[item.unlock])));

// Kosmetik yang benar-benar dipakai (yang terkunci dikembalikan ke bawaan)
function resolve(profile) {
  const eq = (profile && profile.cosmetics) || {}, done = profile && profile.progress && profile.progress.done, lv = levelOfProfile(profile);
  const out = {};
  for (const k of KINDS) out[k] = owned(find(k, eq[k]), done, lv) ? eq[k] : DEFAULT[k];
  return out;
}
function view(profile) {
  const done = profile && profile.progress && profile.progress.done, cur = resolve(profile), lv = levelOfProfile(profile);
  return ITEMS.map(i => ({ ...i, owned: owned(i, done, lv), on: cur[i.kind] === i.key }));
}
// foto profil yang tampil: topeng pilihan, atau foto akun bila 'asli'
const avatarUrl = (profile, cos) => (cos.avatar && cos.avatar !== 'asli' ? `/avatars/${cos.avatar}.webp` : (profile && profile.avatar_url) || null);
// item yang baru terbuka karena naik level dari lvA ke lvB
const unlockedByLevel = (lvA, lvB) => ITEMS.filter(i => i.unlock && typeof i.unlock === 'object' && i.unlock.level > lvA && i.unlock.level <= lvB);
const catalog = () => ITEMS;

module.exports = { ITEMS, KINDS, DEFAULT, find, owned, resolve, view, catalog, avatarUrl, unlockedByLevel, levelOfProfile };
