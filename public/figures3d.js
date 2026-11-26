// Bidak chibi 3D: 20 profesi bergaya "vinyl toy" — kepala besar, mata besar mengilap, rambut, seragam.
// Semua dibuat dari primitif three.js; material dibagi-pakai (cache) agar hemat GPU.
// Setiap tamu memegang topeng pesta bertangkai di tangan kiri (tema "Pesta Topeng").
import * as THREE from 'three';

const HY = 0.86, HR = 0.25;          // tinggi & jari-jari kepala
const HEAD_SCALE = [1, 0.96, 0.94];
const SKIN = ['#f3cfae', '#e2b08a', '#c68b60', '#9a6542'];
const HAIR = { black: '#1d1a19', dark: '#3b2619', brown: '#6b4428', light: '#a9773f', grey: '#c9c4bd' };

// seragam per profesi: badan, celana, aksen, gaya rambut, warna rambut, topi, atribut
export const PROFESSIONS = {
  koki:     { body: '#f6f3ec', pants: '#2c2c32', trim: '#d6343f', hair: 'short', hairC: 'dark', hat: 'chef', extra: ['buttons', 'scarf'] },
  polisi:   { body: '#25406e', pants: '#1c2a45', trim: '#e2b64c', hair: 'short', hairC: 'black', hat: 'police', extra: ['shirtTie:#25406e:#14213b', 'badge'] },
  dokter:   { body: '#f4f6f7', pants: '#33475b', trim: '#4b8fb8', hair: 'side', hairC: 'brown', hat: 'doctor', extra: ['shirtTie:#bcd8ee:#2d3e50', 'stetho'] },
  damkar:   { body: '#c9372c', pants: '#2a2a2e', trim: '#f2c94c', hair: 'short', hairC: 'dark', hat: 'fire', extra: ['stripes'] },
  petani:   { body: '#3f6fb0', pants: '#3f6fb0', trim: '#e9d8b4', hair: 'short', hairC: 'black', hat: 'caping', extra: ['overalls'] },
  pilot:    { body: '#1f2b4a', pants: '#1f2b4a', trim: '#e2b64c', hair: 'side', hairC: 'light', hat: 'pilot', extra: ['shirtTie:#ffffff:#1f2b4a', 'wings'] },
  astronot: { body: '#eef1f4', pants: '#d9dee4', trim: '#e0663f', hair: 'short', hairC: 'brown', hat: 'astro', extra: ['patch'] },
  pelukis:  { body: '#8b4a7a', pants: '#3a2f3f', trim: '#f2c14e', hair: 'bun', hairC: 'brown', hat: 'beret', extra: ['scarf', 'brush'] },
  pesulap:  { body: '#18181f', pants: '#18181f', trim: '#b3262e', hair: 'side', hairC: 'black', hat: 'tophat', extra: ['shirtBow:#ffffff:#b3262e', 'wand'] },
  koboi:    { body: '#9a6a3f', pants: '#3e5f8a', trim: '#c0392b', hair: 'short', hairC: 'brown', hat: 'cowboy', extra: ['scarf', 'beard'] },
  tukang:   { body: '#6b7280', pants: '#3b4a63', trim: '#f08a24', hair: 'short', hairC: 'black', hat: 'hardhat', extra: ['vest'] },
  kapten:   { body: '#f7f7f4', pants: '#f7f7f4', trim: '#d8b24c', hair: 'short', hairC: 'grey', hat: 'captain', extra: ['buttons', 'beard'] },
  detektif: { body: '#8a7556', pants: '#4a3e30', trim: '#3b2f22', hair: 'side', hairC: 'dark', hat: 'fedora', extra: ['shirtTie:#efe7d6:#7a2e2e', 'magnifier'] },
  dalang:   { body: '#2b2320', pants: '#6b4a2b', trim: '#d8b24c', hair: 'short', hairC: 'black', hat: 'blangkon', extra: ['buttons'] },
  profesor: { body: '#2b2b33', pants: '#2b2b33', trim: '#d8b24c', hair: 'side', hairC: 'grey', hat: 'mortar', extra: ['glasses', 'shirtTie:#ffffff:#7a2e2e'] },
  atlet:    { body: '#d23a32', pants: '#1f2b4a', trim: '#ffffff', hair: 'pony', hairC: 'dark', hat: 'headband', extra: ['medal'] },
  dj:       { body: '#43277a', pants: '#22222a', trim: '#22d3ee', hair: 'short', hairC: 'black', hat: 'headphones', extra: [] },
  perawat:  { body: '#f3b7c4', pants: '#f3b7c4', trim: '#d6343f', hair: 'long', hairC: 'dark', hat: 'nurse', extra: [] },
  ilmuwan:  { body: '#f4f5f8', pants: '#3a4a5e', trim: '#3fa7c9', hair: 'long', hairC: 'light', hat: 'goggles', extra: ['shirtTie:#cfe7f2:null', 'tube'] },
  kurir:    { body: '#2f9a5c', pants: '#2b2f36', trim: '#1b2a20', hair: 'short', hairC: 'dark', hat: 'courier', extra: ['parcel'] },
};

// ---------- material bersama ----------
const cache = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!cache.has(key)) {
    const M = o.basic ? THREE.MeshBasicMaterial : THREE.MeshPhysicalMaterial;
    const { basic, ...rest } = o;
    cache.set(key, new M(basic ? { color, ...rest } : { color, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5, ...rest }));
  }
  return cache.get(key);
}
const metal = c => mat(c, { metalness: 0.85, roughness: 0.3, clearcoat: 0 });
const gloss = c => mat(c, { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });

// ---------- geometri bersama ----------
const gcache = new Map();
const G = (key, make) => { if (!gcache.has(key)) gcache.set(key, make()); return gcache.get(key); };
const sph = (r, tl = Math.PI) => G(`s${r}:${tl}`, () => new THREE.SphereGeometry(r, 32, 20, 0, Math.PI * 2, 0, tl));
const cyl = (a, b, h, seg = 32, open = false, ts = 0, tl = Math.PI * 2) => G(`c${a}:${b}:${h}:${seg}:${open}:${ts}:${tl}`, () => new THREE.CylinderGeometry(a, b, h, seg, 1, open, ts, tl));
const cap = (r, l) => G(`p${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 8, 20));
const tor = (r, t, arc = Math.PI * 2) => G(`t${r}:${t}:${arc}`, () => new THREE.TorusGeometry(r, t, 10, 40, arc));
const box = (w, h, d) => G(`b${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cone = (r, h, seg = 32, open = false) => G(`k${r}:${h}:${seg}:${open}`, () => new THREE.ConeGeometry(r, h, seg, 1, open));

function add(g, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos); m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  g.add(m); return m;
}
// titik di permukaan depan kepala (memperhitungkan skala elipsoid)
const faceZ = (x, y) => Math.sqrt(Math.max(0, HR * HR - x * x - (y / HEAD_SCALE[1]) ** 2)) * HEAD_SCALE[2];

// ---------- bagian tubuh ----------
function buildBody(g, p, skin) {
  add(g, cyl(0.26, 0.28, 0.06), metal('#c9a14a'), [0, 0.03, 0]);                    // alas kuningan
  add(g, tor(0.265, 0.018), mat(p.trim), [0, 0.065, 0], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) {
    add(g, sph(0.07), gloss('#24242a'), [s * 0.075, 0.1, 0.03], [0, 0, 0], [1, 0.6, 1.4]);  // sepatu
    add(g, cap(0.062, 0.07), mat(p.pants), [s * 0.075, 0.19, 0]);                           // kaki
  }
  const torso = add(g, cap(0.165, 0.15), mat(p.body), [0, 0.39, 0], [0, 0, 0], [1.05, 1, 0.86]);
  for (const s of [-1, 1]) {
    add(g, cap(0.056, 0.15), mat(p.body), [s * 0.195, 0.42, 0.01], [0, 0, s * 0.28]);         // lengan
    add(g, sph(0.052), mat(skin, { roughness: 0.6 }), [s * 0.235, 0.29, 0.03]);               // tangan
  }
  add(g, cyl(0.065, 0.07, 0.07), mat(skin, { roughness: 0.6 }), [0, 0.62, 0]);             // leher
  return torso;
}

function buildHead(g, p, skin, hairCol) {
  const skinM = mat(skin, { roughness: 0.6, sheen: 0.4, sheenColor: '#ffb4a0' });
  add(g, sph(HR), skinM, [0, HY, 0], [0, 0, 0], HEAD_SCALE);
  for (const s of [-1, 1]) add(g, sph(0.05), skinM, [s * 0.245, HY - 0.01, 0], [0, 0, 0], [0.5, 1, 0.8]);       // telinga
  // mata besar: sklera, iris, pupil, kilau
  for (const s of [-1, 1]) {
    const x = s * 0.088, y = 0.01, z = faceZ(x, y);
    add(g, sph(0.058), mat('#ffffff', { roughness: 0.2, clearcoat: 1 }), [x, HY + y, z - 0.03], [0, 0, 0], [1, 1.18, 0.55]);
    add(g, sph(0.04), gloss('#4a2f1f'), [x, HY + y - 0.004, z - 0.008], [0, 0, 0], [1, 1.12, 0.45]);
    add(g, sph(0.022), gloss('#0b0b0d'), [x, HY + y - 0.004, z + 0.004], [0, 0, 0], [1, 1.1, 0.4]);
    add(g, sph(0.012), mat('#ffffff', { basic: true }), [x + 0.014, HY + y + 0.02, z + 0.012]);
    add(g, cap(0.011, 0.045), mat(HAIR[hairCol]), [x, HY + 0.088, faceZ(x, 0.088) + 0.004], [0, 0, Math.PI / 2 + s * 0.18]); // alis
    add(g, G('cheek', () => new THREE.CircleGeometry(0.035, 20)), mat('#ff8a8a', { basic: true, transparent: true, opacity: 0.28, depthWrite: false }),
      [s * 0.145, HY - 0.05, faceZ(0.145, -0.05) + 0.003], [0, s * 0.62, 0]);                // pipi merona
  }
  add(g, sph(0.026), mat(new THREE.Color(skin).offsetHSL(0, 0.05, -0.06).getStyle(), { roughness: 0.6 }), [0, HY - 0.035, faceZ(0, -0.035) - 0.004]); // hidung
  add(g, tor(0.048, 0.0105, Math.PI), mat('#7a2e2e'), [0, HY - 0.078, faceZ(0, -0.085) - 0.004], [0.15, 0, Math.PI]);      // senyum
}

function buildHair(g, p, hairCol, covered) {
  const hm = mat(HAIR[hairCol], { roughness: 0.7 });
  const s = [1.03, 0.99, 0.97];
  if (!covered) add(g, sph(HR + 0.012, Math.PI * 0.46), hm, [0, HY, -0.01], [-0.38, 0, 0], s);  // tempurung rambut
  else add(g, sph(HR + 0.01, Math.PI * 0.62), hm, [0, HY, -0.02], [-0.95, 0, 0], s);            // sisa rambut di bawah topi (belakang)
  const fz = faceZ(0, 0.15);
  if (p.hair === 'side') {
    for (const [x, sc] of [[-0.11, 1], [-0.02, 1.1], [0.08, 0.9]]) add(g, sph(0.075), hm, [x, HY + 0.15, fz - 0.04], [0, 0, -0.5], [1.4 * sc, 0.55, 0.8]);
  } else if (!covered || p.hair !== 'short') {
    for (const x of [-0.1, 0, 0.1]) add(g, sph(0.065), hm, [x, HY + 0.155, fz - 0.045], [0, 0, 0], [1.2, 0.6, 0.8]);
  }
  for (const sx of [-1, 1]) add(g, cap(0.028, 0.06), hm, [sx * 0.235, HY + 0.04, -0.02]);         // cambang
  if (p.hair === 'bun') add(g, sph(0.085), hm, [0, HY + 0.2, -0.17]);
  if (p.hair === 'pony') { add(g, sph(0.05), hm, [0, HY + 0.08, -0.25]); add(g, cap(0.05, 0.16), hm, [0, HY - 0.06, -0.27], [0.35, 0, 0]); }
  if (p.hair === 'long') add(g, cap(0.2, 0.12), hm, [0, HY - 0.1, -0.1], [0, 0, 0], [1.15, 1, 0.6]);
}

// ---------- topi (koordinat absolut, kepala di HY) ----------
const HATS = {
  chef: (g) => { add(g, cyl(0.2, 0.19, 0.2), mat('#ffffff'), [0, HY + 0.27, -0.01]); add(g, sph(0.25), mat('#ffffff'), [0, HY + 0.42, -0.01], [0, 0, 0], [1, 0.62, 1]); },
  police: (g, p) => {
    add(g, cyl(0.28, 0.245, 0.12), mat(p.body), [0, HY + 0.2, -0.01]);
    add(g, cyl(0.25, 0.25, 0.055), mat('#15161b'), [0, HY + 0.14, -0.01]);
    add(g, box(0.3, 0.02, 0.15), gloss('#101114'), [0, HY + 0.12, 0.22], [0.32, 0, 0]);
    add(g, cyl(0.035, 0.035, 0.012, 6), metal(p.trim), [0, HY + 0.2, 0.27], [Math.PI / 2, 0, 0]);
  },
  doctor: (g) => {
    add(g, tor(0.25, 0.012), mat('#2f3a45'), [0, HY + 0.11, -0.01], [Math.PI / 2 - 0.3, 0, 0], [1, 0.94, 1]);
    add(g, cyl(0.07, 0.07, 0.014), metal('#e3e9ee'), [0.06, HY + 0.18, faceZ(0.06, 0.18) + 0.03], [Math.PI / 2 - 0.5, 0, 0]);
  },
  fire: (g, p) => {
    add(g, sph(0.285, Math.PI / 2), gloss('#c9372c'), [0, HY + 0.04, -0.01]);
    add(g, cyl(0.34, 0.36, 0.03), gloss('#a92d24'), [0, HY + 0.05, -0.03], [0, 0, 0], [1, 1, 1.05]);
    add(g, box(0.07, 0.12, 0.02), metal(p.trim), [0, HY + 0.2, 0.24], [-0.4, 0, 0]);
  },
  caping: (g) => {
    add(g, cone(0.5, 0.22, 40, true), mat('#dcb86f', { roughness: 0.85, clearcoat: 0, side: THREE.DoubleSide }), [0, HY + 0.27, 0]);
    add(g, tor(0.2, 0.012), mat('#8a6a33'), [0, HY + 0.2, 0], [Math.PI / 2, 0, 0]);
  },
  pilot: (g, p) => {
    add(g, cyl(0.28, 0.245, 0.11), mat('#ffffff'), [0, HY + 0.2, -0.01]);
    add(g, cyl(0.25, 0.25, 0.06), mat(p.body), [0, HY + 0.14, -0.01]);
    add(g, box(0.3, 0.02, 0.15), gloss('#101114'), [0, HY + 0.12, 0.22], [0.32, 0, 0]);
    add(g, box(0.14, 0.025, 0.01), metal(p.trim), [0, HY + 0.17, 0.25]);
  },
  astro: (g) => {
    add(g, sph(0.34), mat('#d4ecff', { transparent: true, opacity: 0.22, roughness: 0.03, clearcoat: 1, depthWrite: false }), [0, HY + 0.01, 0]);
    add(g, tor(0.22, 0.05), mat('#f2f4f6'), [0, 0.64, 0], [Math.PI / 2, 0, 0]);
    add(g, box(0.28, 0.3, 0.13), mat('#e9edf1'), [0, 0.42, -0.2]);
  },
  beret: (g) => { add(g, sph(0.28), mat('#7b1e3a', { roughness: 0.9, clearcoat: 0 }), [0.05, HY + 0.17, -0.02], [0, 0, -0.25], [1, 0.32, 1]); add(g, cyl(0.015, 0.015, 0.05, 8), mat('#7b1e3a'), [0.08, HY + 0.26, -0.02]); },
  tophat: (g, p) => {
    add(g, cyl(0.17, 0.165, 0.34), gloss('#111116'), [0, HY + 0.37, -0.01]);
    add(g, cyl(0.31, 0.31, 0.02), gloss('#111116'), [0, HY + 0.2, -0.01]);
    add(g, cyl(0.173, 0.173, 0.06), mat(p.trim), [0, HY + 0.24, -0.01]);
  },
  cowboy: (g) => {
    add(g, cyl(0.16, 0.2, 0.19), mat('#6b4426'), [0, HY + 0.29, -0.01]);
    add(g, cyl(0.4, 0.4, 0.025), mat('#6b4426'), [0, HY + 0.18, -0.01], [0, 0, 0], [1, 1, 0.85]);
    add(g, cyl(0.2, 0.2, 0.04), mat('#2b1a0d'), [0, HY + 0.21, -0.01]);
  },
  hardhat: (g, p) => {
    add(g, sph(0.28, Math.PI / 2), gloss('#f5c518'), [0, HY + 0.06, -0.01]);
    add(g, cyl(0.31, 0.32, 0.025), gloss('#f5c518'), [0, HY + 0.07, 0.03]);
    add(g, box(0.06, 0.05, 0.5), gloss('#f5c518'), [0, HY + 0.31, 0]);
  },
  captain: (g, p) => {
    add(g, cyl(0.29, 0.25, 0.11), mat('#ffffff'), [0, HY + 0.2, -0.01]);
    add(g, cyl(0.25, 0.25, 0.06), mat('#15161b'), [0, HY + 0.14, -0.01]);
    add(g, box(0.3, 0.02, 0.15), gloss('#101114'), [0, HY + 0.12, 0.22], [0.32, 0, 0]);
    add(g, tor(0.03, 0.01), metal(p.trim), [0, HY + 0.2, 0.27]);
  },
  fedora: (g) => {
    add(g, cyl(0.16, 0.2, 0.18), mat('#5e5141'), [0, HY + 0.29, -0.01]);
    add(g, cyl(0.36, 0.36, 0.02), mat('#5e5141'), [0, HY + 0.19, -0.01]);
    add(g, cyl(0.2, 0.2, 0.045), mat('#2a221a'), [0, HY + 0.22, -0.01]);
  },
  blangkon: (g, p) => {
    const batik = mat('#5a3a1e', { roughness: 0.8, clearcoat: 0 });
    add(g, cyl(0.262, 0.258, 0.13), batik, [0, HY + 0.13, -0.01]);
    add(g, sph(0.262, Math.PI / 2), batik, [0, HY + 0.19, -0.01], [0, 0, 0], [1, 0.45, 1]);
    add(g, sph(0.1), mat('#3a2412'), [0, HY + 0.09, -0.26]);
    add(g, tor(0.262, 0.014), metal(p.trim), [0, HY + 0.08, -0.01], [Math.PI / 2, 0, 0]);
  },
  mortar: (g, p) => {
    add(g, cyl(0.24, 0.245, 0.1), mat('#17171c'), [0, HY + 0.17, -0.01]);
    add(g, box(0.56, 0.03, 0.56), gloss('#17171c'), [0, HY + 0.235, -0.01], [0, Math.PI / 4, 0]);
    add(g, cyl(0.008, 0.008, 0.2, 6), mat(p.trim), [0.27, HY + 0.13, 0.08]);
    add(g, cyl(0.025, 0.015, 0.06, 8), mat(p.trim), [0.27, HY + 0.02, 0.08]);
  },
  headband: (g) => add(g, tor(0.247, 0.035), mat('#ffffff'), [0, HY + 0.11, -0.01], [Math.PI / 2 - 0.12, 0, 0], [1, 0.95, 1]),
  headphones: (g, p) => {
    add(g, tor(0.28, 0.035, Math.PI), gloss('#1b1b22'), [0, HY + 0.02, 0]);
    for (const s of [-1, 1]) {
      add(g, cyl(0.09, 0.09, 0.07), gloss('#1b1b22'), [s * 0.27, HY, 0], [0, 0, Math.PI / 2]);
      add(g, cyl(0.06, 0.06, 0.072), mat(p.trim, { emissive: p.trim, emissiveIntensity: 0.7 }), [s * 0.29, HY, 0], [0, 0, Math.PI / 2]);
    }
  },
  nurse: (g, p) => {
    add(g, box(0.3, 0.12, 0.13), mat('#ffffff'), [0, HY + 0.26, 0.02], [-0.25, 0, 0]);
    add(g, box(0.08, 0.025, 0.01), mat(p.trim), [0, HY + 0.27, 0.09], [-0.25, 0, 0]);
    add(g, box(0.025, 0.08, 0.01), mat(p.trim), [0, HY + 0.27, 0.09], [-0.25, 0, 0]);
  },
  goggles: (g, p) => {
    add(g, tor(0.252, 0.02), mat('#2a2f36'), [0, HY + 0.13, -0.01], [Math.PI / 2 - 0.25, 0, 0], [1, 0.95, 1]);
    for (const x of [-0.09, 0.09]) add(g, cyl(0.07, 0.07, 0.06), mat(p.trim, { transparent: true, opacity: 0.8, roughness: 0.05, clearcoat: 1 }), [x, HY + 0.17, faceZ(x, 0.17) + 0.02], [Math.PI / 2 - 0.6, 0, 0]);
  },
  courier: (g, p) => {
    add(g, sph(0.29, Math.PI * 0.5), gloss(p.body), [0, HY + 0.05, -0.01]);                           // helm terbuka
    for (const sx of [-1, 1]) add(g, box(0.05, 0.16, 0.2), gloss(p.body), [sx * 0.26, HY - 0.02, -0.04]); // pelindung pipi
    add(g, cyl(0.3, 0.3, 0.08, 32, true, -Math.PI * 0.32, Math.PI * 0.64), mat('#1d2530', { transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }), [0, HY + 0.25, 0.02], [-0.25, 0, 0]); // visor terangkat
  },
};
const COVERED = new Set(['chef', 'police', 'fire', 'caping', 'pilot', 'tophat', 'cowboy', 'hardhat', 'captain', 'fedora', 'blangkon', 'mortar', 'nurse', 'courier', 'beret']);

// ---------- detail seragam & properti ----------
function extras(g, p, list, skin, hairCol) {
  const front = (y) => 0.142 - Math.abs(y - 0.4) * 0.12;
  for (const e of list) {
    const [kind, a, b] = e.split(':');
    if (kind === 'shirtTie' || kind === 'shirtBow') {
      add(g, box(0.11, 0.2, 0.02), mat(a), [0, 0.5, front(0.5)], [-0.12, 0, 0]);
      if (kind === 'shirtTie' && b !== 'null') { add(g, cone(0.03, 0.17, 4), mat(b), [0, 0.47, front(0.47) + 0.014], [Math.PI - 0.12, Math.PI / 4, 0], [1, 1, 0.35]); add(g, sph(0.024), mat(b), [0, 0.565, front(0.565) + 0.016], [0, 0, 0], [1.2, 1, 0.6]); }
      if (kind === 'shirtBow') for (const s of [-1, 1]) add(g, cone(0.035, 0.06, 12), mat(b), [s * 0.03, 0.58, front(0.58) + 0.015], [0, 0, s * Math.PI / 2]);
    }
    if (kind === 'buttons') for (const y of [0.32, 0.4, 0.48]) for (const x of [-0.045, 0.045]) add(g, sph(0.014), metal(p.trim), [x, y, front(y) + 0.005]);
    if (kind === 'scarf') add(g, tor(0.085, 0.032), mat(p.trim), [0, 0.6, 0.01], [Math.PI / 2 - 0.2, 0, 0]);
    if (kind === 'badge') add(g, cyl(0.025, 0.025, 0.01, 6), metal(p.trim), [-0.07, 0.5, front(0.5) + 0.002], [Math.PI / 2 - 0.12, 0, 0]);
    if (kind === 'stetho') { add(g, tor(0.11, 0.012, Math.PI * 1.25), mat('#2b3440'), [0, 0.56, 0.06], [-0.5, 0, Math.PI * 1.13]); add(g, cyl(0.026, 0.026, 0.015), metal('#cfd6db'), [0.06, 0.43, front(0.43) + 0.01], [Math.PI / 2 - 0.15, 0, 0]); }
    if (kind === 'stripes') for (const y of [0.3, 0.42]) add(g, tor(0.168 - Math.abs(y - 0.39) * 0.05, 0.016), mat(p.trim, { emissive: p.trim, emissiveIntensity: 0.2 }), [0, y, 0], [Math.PI / 2, 0, 0], [1.05, 0.86, 1]);
    if (kind === 'overalls') { for (const s of [-1, 1]) add(g, box(0.035, 0.24, 0.02), mat('#2f5a96'), [s * 0.07, 0.5, front(0.5)], [-0.12, 0, 0]); add(g, box(0.16, 0.12, 0.02), mat('#2f5a96'), [0, 0.38, front(0.38) + 0.005]); add(g, box(0.12, 0.15, 0.02), mat('#e9d8b4'), [0, 0.52, front(0.52) - 0.004], [-0.12, 0, 0]); }
    if (kind === 'vest') { add(g, cap(0.168, 0.14), mat(p.trim), [0, 0.4, 0], [0, 0, 0], [1.08, 0.92, 0.89]); for (const y of [0.33, 0.43]) add(g, tor(0.17, 0.014), mat('#e9eef2', { emissive: '#ffffff', emissiveIntensity: 0.25 }), [0, y, 0], [Math.PI / 2, 0, 0], [1.1, 0.9, 1]); }
    if (kind === 'wings') add(g, box(0.1, 0.02, 0.01), metal(p.trim), [-0.07, 0.52, front(0.52) + 0.01]);
    if (kind === 'patch') add(g, box(0.07, 0.05, 0.01), mat(p.trim), [-0.075, 0.5, front(0.5) + 0.005]);
    if (kind === 'medal') { add(g, tor(0.1, 0.009, Math.PI), mat('#2f63b8'), [0, 0.53, 0.1], [0.35, 0, Math.PI]); add(g, cyl(0.04, 0.04, 0.015), metal('#e2b64c'), [0, 0.42, front(0.42) + 0.02], [Math.PI / 2 - 0.15, 0, 0]); }
    if (kind === 'glasses') for (const s of [-1, 1]) add(g, tor(0.062, 0.008), mat('#1d1a19'), [s * 0.088, HY + 0.008, faceZ(s * 0.088, 0) + 0.012]);
    if (kind === 'beard') {
      const bm = mat(HAIR[hairCol], { roughness: 0.85 });
      add(g, sph(0.19, Math.PI * 0.5), bm, [0, HY - 0.115, 0.04], [Math.PI, 0, 0], [1.05, 0.5, 1]);            // janggut di bawah mulut
      for (const sx of [-1, 1]) add(g, cap(0.016, 0.04), bm, [sx * 0.032, HY - 0.056, faceZ(0.03, -0.056) + 0.002], [0, 0, Math.PI / 2 - sx * 0.35]); // kumis tipis
    }
    if (kind === 'parcel') { add(g, box(0.28, 0.28, 0.2), mat('#b88a4f', { roughness: 0.85, clearcoat: 0 }), [0, 0.42, -0.22]); add(g, box(0.29, 0.03, 0.21), mat('#8a6334'), [0, 0.46, -0.22]); }
    // properti di tangan kanan (x ≈ +0.235, y ≈ 0.29)
    if (kind === 'brush') { add(g, cyl(0.01, 0.014, 0.3, 8), mat('#6b4a2b'), [0.25, 0.4, 0.06], [0.2, 0, -0.35]); add(g, cone(0.02, 0.05, 10), mat('#e04f5f'), [0.3, 0.55, 0.09], [0.2, 0, -0.35]); }
    if (kind === 'wand') { add(g, cyl(0.013, 0.013, 0.32, 8), gloss('#111116'), [0.26, 0.4, 0.06], [0.2, 0, -0.3]); add(g, cyl(0.014, 0.014, 0.05, 8), mat('#ffffff'), [0.31, 0.55, 0.09], [0.2, 0, -0.3]); }
    if (kind === 'magnifier') { add(g, cyl(0.012, 0.012, 0.12, 8), mat('#3b2414'), [0.25, 0.34, 0.06], [0, 0, -0.3]); add(g, tor(0.06, 0.012), metal('#c9a14a'), [0.28, 0.45, 0.07], [0, 0.3, 0]); add(g, G('lens', () => new THREE.CircleGeometry(0.055, 20)), mat('#cfe8ff', { transparent: true, opacity: 0.35, roughness: 0 }), [0.28, 0.45, 0.07], [0, 0.3, 0]); }
    if (kind === 'tube') { add(g, cyl(0.035, 0.035, 0.14, 12), mat('#c9f2d8', { transparent: true, opacity: 0.6, roughness: 0.05 }), [0.25, 0.38, 0.07]); add(g, cyl(0.032, 0.032, 0.07, 12), mat('#3ecf7a', { emissive: '#3ecf7a', emissiveIntensity: 0.4 }), [0.25, 0.35, 0.07]); }
  }
}

function maskGeometry() { // siluet topeng karnaval dengan lubang mata
  const k = 0.075, sh = new THREE.Shape();
  sh.moveTo(-1 * k, 0.35 * k);
  sh.bezierCurveTo(-0.6 * k, 0.55 * k, -0.2 * k, 0.45 * k, 0, 0.25 * k);
  sh.bezierCurveTo(0.2 * k, 0.45 * k, 0.6 * k, 0.55 * k, 1 * k, 0.35 * k);
  sh.bezierCurveTo(1.05 * k, -0.1 * k, 0.75 * k, -0.5 * k, 0.35 * k, -0.45 * k);
  sh.bezierCurveTo(0.15 * k, -0.42 * k, 0.08 * k, -0.2 * k, 0, -0.2 * k);
  sh.bezierCurveTo(-0.08 * k, -0.2 * k, -0.15 * k, -0.42 * k, -0.35 * k, -0.45 * k);
  sh.bezierCurveTo(-0.75 * k, -0.5 * k, -1.05 * k, -0.1 * k, -1 * k, 0.35 * k);
  for (const sx of [-1, 1]) { const h = new THREE.Path(); h.absellipse(sx * 0.45 * k, 0.03 * k, 0.24 * k, 0.13 * k, 0, Math.PI * 2, false, sx * -0.15); sh.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
  geo.center();
  return geo;
}

// topeng pesta bertangkai di tangan kiri
function partyMask(g) {
  add(g, cyl(0.009, 0.009, 0.3, 8), metal('#c9a14a'), [-0.25, 0.41, 0.07], [0, 0, 0.12]);
  const m = new THREE.Group(); m.position.set(-0.27, 0.58, 0.08); m.rotation.set(0, 0.45, 0.15);
  add(m, G('maskShape', maskGeometry), gloss('#15161b'), [0, 0, 0]);
  add(m, sph(0.013), metal('#e2b64c'), [0, 0.022, 0.012]);
  for (const sx of [-1, 1]) add(m, sph(0.008), metal('#e2b64c'), [sx * 0.07, 0.026, 0.008]);
  g.add(m);
}

export function buildFigure(c, i) {
  const p = PROFESSIONS[c.id] || PROFESSIONS.koki;
  const skin = SKIN[i % SKIN.length];
  const inner = new THREE.Group();
  const torso = buildBody(inner, p, skin);
  buildHead(inner, p, skin, p.hairC);
  if (p.hat !== 'astro') buildHair(inner, p, p.hairC, COVERED.has(p.hat));
  else buildHair(inner, p, p.hairC, false);
  if (HATS[p.hat]) HATS[p.hat](inner, p);
  extras(inner, p, p.extra, skin, p.hairC);
  partyMask(inner);
  // badan dibuat material sendiri agar bisa menyala saat dipilih (tanpa mempengaruhi bidak lain)
  torso.material = torso.material.clone(); torso.material.emissive = new THREE.Color('#ffffff'); torso.material.emissiveIntensity = 0;
  const pickables = [];
  inner.traverse(o => { if (o.isMesh) { o.userData.charId = c.id; pickables.push(o); } });
  return { inner, body: torso, pickables };
}

export function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px Inter, system-ui, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 36);
  g.fillStyle = 'rgba(11,14,19,.88)'; g.strokeStyle = 'rgba(201,161,74,.9)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 24); g.fill(); g.stroke();
  g.fillStyle = '#f3ead7'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  // ukuran tetap di layar agar nama selalu terbaca
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.16, 0.04, 1); s.renderOrder = 6; s.visible = false;
  return s;
}
