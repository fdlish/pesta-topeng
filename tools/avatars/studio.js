// Studio foto profil: merender 25 topeng 3D bergaya mainan di atas latar batik.
// Dipakai sekali saat membuat aset (lihat tools/avatars/render.py), hasilnya disimpan di public/avatars/*.webp.
// Bentuk topeng digambar sebagai path SVG dalam kotak 100×100 (y ke bawah).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';

const SIZE = 512, K = 0.024; // 1 satuan path = K satuan dunia
const P = { nila: '#1F2A52', ink: '#141B38', kunyit: '#F2C14E', cabai: '#C8322A', kertas: '#F6EEDC' };

// ------------------------------------------------------------ bentuk ---
const EYES = 'M43 45 Q29 33 17 47 Q30 55 43 45 Z M83 47 Q71 33 57 45 Q70 55 83 47 Z';
const S = {
  domino: 'M3 42 C8 20 36 14 50 30 C64 14 92 20 97 42 C99 62 85 76 68 73 C60 72 55 63 50 63 C45 63 40 72 32 73 C15 76 1 62 3 42 Z ' + EYES,
  oval: 'M50 3 C79 3 93 26 93 51 C93 79 74 98 50 98 C26 98 7 79 7 51 C7 26 21 3 50 3 Z ' + EYES + ' M35 77 Q50 85 65 77 Q50 81 35 77 Z',
  cat: 'M3 46 C3 30 8 20 14 6 L32 24 C40 21 60 21 68 24 L86 6 C92 20 97 30 97 46 C98 64 84 77 67 74 C59 73 55 64 50 64 C45 64 41 73 33 74 C16 77 2 64 3 46 Z ' + EYES,
  fox: 'M10 4 L36 24 C45 21 55 21 64 24 L90 4 C96 26 96 44 88 58 C80 72 62 84 50 98 C38 84 20 72 12 58 C4 44 4 26 10 4 Z ' + EYES,
  owl: 'M2 30 L20 10 C34 18 42 22 50 32 C58 22 66 18 80 10 L98 30 C99 56 88 76 66 78 C58 78 54 70 50 70 C46 70 42 78 34 78 C12 76 1 56 2 30 Z M14 48 A16 16 0 1 0 46 48 A16 16 0 1 0 14 48 Z M54 48 A16 16 0 1 0 86 48 A16 16 0 1 0 54 48 Z',
  ogre: 'M50 6 C76 6 94 22 94 46 C94 64 90 76 82 88 C72 98 28 98 18 88 C10 76 6 64 6 46 C6 22 24 6 50 6 Z ' + EYES + ' M28 74 C36 82 64 82 72 74 C64 88 36 88 28 74 Z',
  bird: 'M2 40 C6 22 30 14 50 24 C70 14 94 22 98 40 C99 58 86 68 70 66 C62 65 57 60 50 60 C43 60 38 65 30 66 C14 68 1 58 2 40 Z ' + EYES,
  bat: 'M50 26 C58 18 70 18 76 24 C84 14 94 12 100 8 C98 26 96 40 88 50 C92 58 90 66 84 68 C80 76 72 78 64 74 C58 72 54 64 50 64 C46 64 42 72 36 74 C28 78 20 76 16 68 C10 66 8 58 12 50 C4 40 2 26 0 8 C6 12 16 14 24 24 C30 18 42 18 50 26 Z ' + EYES,
  heart: 'M50 30 C60 12 92 10 97 36 C100 56 86 74 68 72 C60 71 55 62 50 62 C45 62 40 71 32 72 C14 74 0 56 3 36 C8 10 40 12 50 30 Z ' + EYES,
};
// hiasan pipih (ditempel di permukaan topeng)
const D = {
  rimEyes: 'M13 47 Q29 27 47 45 Q30 60 13 47 Z M18 47 Q30 52 42 45 Q29 36 18 47 Z M53 45 Q71 27 87 47 Q70 60 53 45 Z M58 45 Q70 52 82 47 Q71 36 58 45 Z',
  brows: 'M14 30 Q30 20 44 32 Q30 26 14 30 Z M86 30 Q70 20 56 32 Q70 26 86 30 Z',
  mustache: 'M50 66 C44 62 34 62 28 68 C24 72 18 70 18 64 C16 74 28 78 36 72 C42 68 47 69 50 70 C53 69 58 68 64 72 C72 78 84 74 82 64 C82 70 76 72 72 68 C66 62 56 62 50 66 Z',
  cheeks: 'M14 62 A6 4 0 1 0 26 62 A6 4 0 1 0 14 62 Z M74 62 A6 4 0 1 0 86 62 A6 4 0 1 0 74 62 Z',
  forehead: 'M50 10 L56 22 L50 30 L44 22 Z',
  flameBrow: 'M10 34 C18 18 30 26 34 14 C38 26 44 22 46 34 C36 30 22 30 10 34 Z M90 34 C82 18 70 26 66 14 C62 26 56 22 54 34 C64 30 78 30 90 34 Z',
  stripes: 'M4 44 L20 40 L18 44 L5 48 Z M96 44 L80 40 L82 44 L95 48 Z M8 56 L22 52 L22 56 L9 60 Z M92 56 L78 52 L78 56 L91 60 Z',
  tear: 'M30 56 Q27 64 30 70 Q33 64 30 56 Z',
  thirdEye: 'M38 22 Q50 10 62 22 Q50 30 38 22 Z',
};

const svgLoader = new SVGLoader();
const shapeCache = new Map();
function shapes(d) {
  if (shapeCache.has(d)) return shapeCache.get(d);
  const data = svgLoader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  const out = data.paths.flatMap(p => SVGLoader.createShapes(p));
  shapeCache.set(d, out); return out;
}
// permukaan melengkung seperti wajah: z turun ke tepi
const CURVE = 0.16;
const surfZ = (x, y = 0) => -CURVE * (x * x) - 0.05 * (y * y);
function extrude(d, { depth = 0.1, bevel = 0.035, curve = true } = {}) {
  let g = new THREE.ExtrudeGeometry(shapes(d), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5, curveSegments: 28 });
  g.translate(-50, -50, 0); g.scale(K, -K, -1); // y ke atas; balik z supaya sisi depan di z≈+bevel
  g.translate(0, 0, -bevel);
  if (!curve) { g.computeVertexNormals(); return g; }
  g.computeVertexNormals();
  g = new TessellateModifier(0.07, 8).modify(g); // segitiga kecil agar lengkungan halus
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), nz = n.getZ(i);
    p.setZ(i, p.getZ(i) + surfZ(x, y));
    // normal permukaan dihitung langsung dari rumus lengkungan → tanpa garis sambungan
    if (Math.abs(nz) > 0.98) { v.set(2 * CURVE * x, 0.1 * y, 1).normalize().multiplyScalar(Math.sign(nz)); n.setXYZ(i, v.x, v.y, v.z); }
  }
  return g;
}
const W = (x, y) => new THREE.Vector3((x - 50) * K, -(y - 50) * K, 0);
const onSurf = (x, y, lift = 0) => { const v = W(x, y); v.z = surfZ(v.x, v.y) + lift; return v; };

// ------------------------------------------------------------ bahan ---
const M = {
  lacquer: (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, ...o }),
  matte: (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }),
  metal: (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 1, roughness: 0.24, clearcoat: 0.6, ...o }),
  gem: (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0.1, clearcoat: 1, flatShading: true, emissive: c, emissiveIntensity: 0.12, ...o }),
  glow: c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }),
};
function paintTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ------------------------------------------------------------ latar ---
function kawung(g, w, h, s, color) {
  g.fillStyle = color;
  for (let y = -s; y < h + s; y += s) for (let x = -s; x < w + s; x += s)
    for (let k = 0; k < 4; k++) { g.save(); g.translate(x + ((y / s) % 2 ? s / 2 : 0), y); g.rotate(k * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.ellipse(0, -s * 0.26, s * 0.13, s * 0.24, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
}
const BG = {
  plain: (g, w, h, c) => {},
  kawung: (g, w, h, c) => kawung(g, w, h, 96, c.motif),
  parang: (g, w, h, c) => {
    g.strokeStyle = c.motif; g.lineWidth = 14; g.lineCap = 'round';
    for (let i = -h; i < w + h; i += 70) { g.beginPath(); for (let t = 0; t <= h + 40; t += 8) { const x = i + t + Math.sin(t / 22) * 16; g.lineTo(x, h - t); } g.stroke(); }
  },
  mega: (g, w, h, c) => {
    g.strokeStyle = c.motif; g.lineWidth = 7;
    for (const [x, y, r] of [[80, 120, 90], [420, 90, 80], [260, 430, 110], [470, 400, 70], [60, 420, 60]])
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x, y, r - k * 20, Math.PI * 0.9, Math.PI * 2.4); g.stroke(); }
  },
  ceplok: (g, w, h, c) => {
    g.fillStyle = c.motif;
    for (let y = 32; y < h; y += 64) for (let x = 32 + ((y / 64) % 2) * 32; x < w; x += 64) {
      g.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 7 : 18, a = (k / 16) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill();
    }
  },
  truntum: (g, w, h, c) => {
    g.fillStyle = c.motif;
    for (let y = 24; y < h; y += 48) for (let x = 24 + ((y / 48) % 2) * 24; x < w; x += 48)
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 0, Math.PI * 2); g.fill(); }
  },
  rays: (g, w, h, c) => {
    g.fillStyle = c.motif; const cx = w / 2, cy = h * 0.46;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, b = a + Math.PI / 24; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); g.lineTo(cx + Math.cos(b) * w, cy + Math.sin(b) * w); g.fill(); }
  },
  waves: (g, w, h, c) => {
    g.strokeStyle = c.motif; g.lineWidth = 8;
    for (let y = 20; y < h + 40; y += 44) for (let x = 0; x < w + 60; x += 60) { g.beginPath(); g.arc(x + ((y / 44) % 2) * 30, y, 26, Math.PI, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x + ((y / 44) % 2) * 30, y, 14, Math.PI, Math.PI * 2); g.stroke(); }
  },
  stars: (g, w, h, c) => {
    g.fillStyle = c.motif;
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 3.5; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  },
  gunungan: (g, w, h, c) => {
    g.fillStyle = c.motif;
    g.beginPath(); g.moveTo(w / 2, 20); g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.9, h * 0.8, w * 0.8, h * 0.98); g.lineTo(w * 0.2, h * 0.98); g.bezierCurveTo(w * 0.1, h * 0.8, w * 0.05, h * 0.45, w / 2, 20); g.fill();
    g.strokeStyle = c.bg2; g.lineWidth = 6;
    for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(w / 2, 60 + k * 50); g.quadraticCurveTo(w / 2 - 80, 40 + k * 50, w / 2 - 120, 70 + k * 50); g.moveTo(w / 2, 60 + k * 50); g.quadraticCurveTo(w / 2 + 80, 40 + k * 50, w / 2 + 120, 70 + k * 50); g.stroke(); }
  },
};
function background(kind, c) {
  return paintTex(SIZE, SIZE, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h / 2, w * 0.75);
    gr.addColorStop(0, c.bg1); gr.addColorStop(1, c.bg2);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    BG[kind](g, w, h, c);
    const v = g.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}

// ------------------------------------------------------------ hiasan 3D ---
function gem(grp, x, y, r, color, lift = 0.03, detail = 1) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), M.gem(color)); m.position.copy(onSurf(x, y, lift)); m.scale.z = 0.7; m.castShadow = true; grp.add(m); return m; }
function spike(grp, x, y, len, ang, mat, r = 0.06, lift = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 20), mat); const base = onSurf(x, y, lift);
  m.position.set(base.x + Math.sin(-ang) * len / 2, base.y + Math.cos(ang) * len / 2, base.z - 0.04); m.rotation.z = ang; m.castShadow = true; grp.add(m); return m;
}
function tube(grp, pts, r, mat) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z = 0]) => { const v = onSurf(x, y); v.z += z; return v; }));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, r, 12), mat); m.castShadow = true; grp.add(m);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat); cap.position.copy(c.getPoint(1)); grp.add(cap);
  return m;
}
function layer(grp, d, mat, lift = 0.03, opts = {}) { const m = new THREE.Mesh(extrude(d, { depth: 0.02, bevel: 0.012, ...opts }), mat); m.position.z = lift; m.castShadow = true; grp.add(m); return m; }
function base(grp, shape, mat) { const m = new THREE.Mesh(extrude(S[shape]), mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; }
function halo(grp, r, mat, y = 0.25, z = -0.5) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 16, 80), mat); m.position.set(0, y, z); grp.add(m); return m; }
function glowEyes(grp, color, y = 47) { for (const x of [30, 70]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), M.glow(color)); const v = onSurf(x, y, -0.15); m.position.copy(v); m.scale.set(1.3, 0.6, 0.3); grp.add(m); } }
function flame(grp, x, y, h, color, ang = 0) {
  const d = 'M50 100 C20 90 18 62 34 44 C34 58 42 60 44 52 C40 34 52 16 50 0 C64 18 70 34 62 52 C66 56 72 50 70 40 C86 60 80 92 50 100 Z';
  const g = extrude(d, { depth: 0.05, bevel: 0.02, curve: false }); g.scale(h / (100 * K), h / (100 * K), 1);
  const m = new THREE.Mesh(g, M.lacquer(color, { emissive: color, emissiveIntensity: 0.45 }));
  const p = onSurf(x, y, -0.05); m.position.set(p.x, p.y + h * 0.5, p.z - 0.05); m.rotation.z = ang; grp.add(m); return m;
}

// ------------------------------------------------------------ 25 desain ---
const gold = () => M.metal('#e9b949'), silver = () => M.metal('#d4dbe3', { roughness: 0.2 }), bronze = () => M.metal('#b9783f', { roughness: 0.35 });
export const DESIGNS = {
  // --- level
  kertas: { bg: ['plain', { bg1: '#2a3870', bg2: '#141B38', motif: '' }], build: g => { base(g, 'domino', M.matte(P.kertas)); } },
  batik: { bg: ['kawung', { bg1: '#2a3870', bg2: '#141B38', motif: 'rgba(242,193,78,.10)' }], build: g => {
    const tex = paintTex(256, 256, (c, w, h) => { c.fillStyle = '#f2e4c4'; c.fillRect(0, 0, w, h); kawung(c, w, h, 46, 'rgba(160,60,40,.55)'); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(0.04, 0.04);
    base(g, 'domino', M.lacquer('#ffffff', { map: tex, roughness: 0.5, clearcoat: 0.4 }));
  } },
  kucing: { bg: ['truntum', { bg1: '#2f4a7a', bg2: '#16223f', motif: 'rgba(246,238,220,.09)' }], build: g => {
    base(g, 'cat', M.lacquer('#f08a3a')); layer(g, D.stripes, M.lacquer('#7a3410')); gem(g, 50, 60, 0.07, '#ff7aa8', 0.02, 0);
    for (const x of [22, 78]) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 3), M.lacquer('#ffc1a1')); m.position.copy(onSurf(x, 20, 0.02)); m.rotation.z = x < 50 ? 0.5 : -0.5; g.add(m); }
  } },
  rubah: { bg: ['parang', { bg1: '#3b2a5a', bg2: '#1a1430', motif: 'rgba(240,138,58,.12)' }], build: g => {
    base(g, 'fox', M.lacquer('#f6f1e6')); layer(g, 'M10 4 L30 22 L18 30 Z M90 4 L70 22 L82 30 Z M40 62 C46 70 54 70 60 62 C58 80 50 96 50 98 C50 96 42 80 40 62 Z', M.lacquer(P.cabai));
    layer(g, D.rimEyes, M.lacquer('#1a1a22'), 0.035); gem(g, 50, 93, 0.06, '#1a1a22', 0.02, 0);
  } },
  hantu: { bg: ['stars', { bg1: '#20305e', bg2: '#0c1228', motif: 'rgba(246,238,220,.5)' }], build: g => {
    base(g, 'owl', M.lacquer('#8a5a34', { roughness: 0.45 }));
    const ring = 'M8 48 A22 22 0 1 0 52 48 A22 22 0 1 0 8 48 Z M14 48 A16 16 0 1 1 46 48 A16 16 0 1 1 14 48 Z M48 48 A22 22 0 1 0 92 48 A22 22 0 1 0 48 48 Z M54 48 A16 16 0 1 1 86 48 A16 16 0 1 1 54 48 Z';
    layer(g, ring, M.lacquer('#e9d6a8'), 0.03); spike(g, 50, 62, 0.22, Math.PI, M.lacquer(P.kunyit), 0.07, 0.05);
  } },
  panji: { bg: ['kawung', { bg1: '#7a2f2a', bg2: '#3a1210', motif: 'rgba(246,238,220,.08)' }], build: g => {
    base(g, 'oval', M.lacquer('#fbf7ee')); layer(g, D.brows, M.lacquer('#1a1a22')); layer(g, D.cheeks, M.lacquer('#f2a3a0', { roughness: 0.6 }));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), M.lacquer('#fbf7ee')); nose.position.copy(onSurf(50, 60, 0.02)); nose.scale.set(0.8, 1.4, 0.8); g.add(nose);
  } },
  klana: { bg: ['parang', { bg1: '#2a2a2a', bg2: '#0d0d0d', motif: 'rgba(200,50,42,.22)' }], build: g => {
    base(g, 'oval', M.lacquer('#c42f24')); layer(g, D.brows, M.lacquer('#111')); layer(g, D.mustache, M.lacquer('#111'), 0.035); layer(g, D.rimEyes, gold(), 0.03);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), M.lacquer('#c42f24')); nose.position.copy(onSurf(50, 58, 0.03)); nose.scale.set(0.9, 1.3, 0.9); g.add(nose);
  } },
  kumbang: { bg: ['ceplok', { bg1: '#1f4a36', bg2: '#0c2018', motif: 'rgba(170,230,120,.10)' }], build: g => {
    base(g, 'heart', M.metal('#2fa86a', { roughness: 0.2, iridescence: 1, iridescenceIOR: 1.6 }));
    tube(g, [[40, 26], [34, 10, 0.1], [24, 2, 0.2]], 0.025, M.metal('#123a26')); tube(g, [[60, 26], [66, 10, 0.1], [76, 2, 0.2]], 0.025, M.metal('#123a26'));
    layer(g, D.rimEyes, M.metal('#123a26'), 0.03);
  } },
  nila: { bg: ['stars', { bg1: '#26346a', bg2: '#0b1028', motif: 'rgba(242,193,78,.55)' }], build: g => {
    base(g, 'domino', M.lacquer('#26346a')); layer(g, D.rimEyes, gold(), 0.03); gem(g, 50, 40, 0.08, '#f6d77a', 0.03);
    for (const [x, y] of [[8, 40], [92, 40]]) gem(g, x, y, 0.05, '#f6d77a', 0.02, 0);
  } },
  raksasa: { bg: ['truntum', { bg1: '#4a6b2a', bg2: '#1c2a10', motif: 'rgba(246,238,220,.08)' }], build: g => {
    base(g, 'ogre', M.lacquer('#4f9a52')); layer(g, D.brows, M.lacquer('#173d1c'));
    for (const x of [36, 64]) spike(g, x, 80, 0.2, 0, M.lacquer('#fbf7ee'), 0.05, 0.04);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), M.lacquer('#3e8a44')); nose.position.copy(onSurf(50, 60, 0.04)); nose.scale.set(1.2, 0.9, 0.9); g.add(nose);
    for (const x of [18, 82]) spike(g, x, 14, 0.26, x < 50 ? 0.5 : -0.5, M.lacquer('#e9d6a8'), 0.07);
  } },
  elang: { bg: ['rays', { bg1: '#7a4a1a', bg2: '#2e1a08', motif: 'rgba(242,193,78,.08)' }], build: g => {
    base(g, 'bird', M.lacquer('#5a3a22')); layer(g, D.rimEyes, M.lacquer('#fbf7ee'), 0.03);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 24), M.lacquer(P.kunyit)); beak.position.copy(onSurf(50, 64, 0.12)); beak.rotation.x = Math.PI / 2.2; beak.rotation.z = Math.PI; g.add(beak);
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; spike(g, 50 + a * 22, 24, 0.36 + (3 - Math.abs(i - 3)) * 0.06, a * 0.8, M.lacquer(i % 2 ? '#fbf7ee' : P.cabai), 0.05); }
  } },
  naga: { bg: ['mega', { bg1: '#1d5a52', bg2: '#0a2421', motif: 'rgba(160,240,220,.12)' }], build: g => {
    base(g, 'domino', M.lacquer('#3fae8f', { roughness: 0.15 })); layer(g, D.flameBrow, gold(), 0.03);
    tube(g, [[30, 26], [22, 8, 0.1], [10, 0, 0.2], [4, -6, 0.2]], 0.035, gold()); tube(g, [[70, 26], [78, 8, 0.1], [90, 0, 0.2], [96, -6, 0.2]], 0.035, gold());
    gem(g, 50, 40, 0.07, '#ff5a4a');
  } },
  bulan: { bg: ['stars', { bg1: '#3a4670', bg2: '#10152c', motif: 'rgba(255,255,255,.6)' }], build: g => {
    base(g, 'domino', silver()); layer(g, D.rimEyes, M.lacquer('#1a2140'), 0.03);
    const moon = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 20, 60, Math.PI * 1.25), M.metal('#f6e7a8'));
    moon.position.set(0.05, 1.12, -0.1); moon.rotation.z = Math.PI * 0.62; moon.scale.set(1, 1, 0.6); g.add(moon);
    gem(g, 50, 40, 0.06, '#9cc4ff');
  } },
  singa: { bg: ['rays', { bg1: '#a3461a', bg2: '#3a1406', motif: 'rgba(255,200,90,.10)' }], build: g => {
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const m = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 16), M.lacquer(i % 2 ? '#d8641c' : '#7a2c0c')); m.position.set(Math.cos(a) * 1.12, Math.sin(a) * 1.12, -0.3); m.rotation.z = a - Math.PI / 2; g.add(m); }
    base(g, 'oval', M.lacquer('#f2a63a')); layer(g, D.brows, M.lacquer('#6a2a08')); layer(g, D.mustache, M.lacquer('#6a2a08'), 0.035);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), M.lacquer('#3a1a08')); nose.position.copy(onSurf(50, 60, 0.04)); nose.scale.set(1.2, 0.8, 0.8); g.add(nose);
  } },
  penari: { bg: ['ceplok', { bg1: '#8a2240', bg2: '#33091a', motif: 'rgba(242,193,78,.12)' }], build: g => {
    base(g, 'oval', M.lacquer('#fbf7ee')); layer(g, D.brows, M.lacquer('#1a1a22')); layer(g, D.cheeks, M.lacquer('#f2a3a0'));
    for (let i = 0; i < 7; i++) { const a = -1.1 + i * 0.367; spike(g, 50 + Math.sin(a) * 40, 10 + (1 - Math.cos(a)) * 26, 0.3 + (3 - Math.abs(i - 3)) * 0.07, a * 0.9, gold(), 0.07); }
    layer(g, 'M8 22 C30 6 70 6 92 22 L90 28 C70 14 30 14 10 28 Z', gold(), 0.04); gem(g, 50, 14, 0.07, P.cabai);
  } },
  kelelawar: { bg: ['plain', { bg1: '#3b2a5a', bg2: '#0a0714', motif: '' }], build: g => {
    base(g, 'bat', M.lacquer('#1b1b22', { roughness: 0.18 })); layer(g, D.rimEyes, M.metal('#8a5cf0'), 0.03);
    for (const x of [44, 56]) spike(g, x, 66, 0.12, Math.PI, M.lacquer('#fbf7ee'), 0.03, 0.02);
    halo(g, 1.15, M.metal('#6a4ab0'), 0.1, -0.6);
  } },
  rusa: { bg: ['truntum', { bg1: '#5a3a1a', bg2: '#1e1206', motif: 'rgba(242,193,78,.10)' }], build: g => {
    base(g, 'fox', M.lacquer('#b77a45')); layer(g, D.rimEyes, gold(), 0.03); layer(g, D.forehead, M.lacquer('#fbf7ee'), 0.03);
    const ant = s => [[50 + s * 18, 22], [50 + s * 26, 8, 0.1], [50 + s * 34, -2, 0.2], [50 + s * 44, -10, 0.25]];
    for (const s of [-1, 1]) { tube(g, ant(s), 0.035, gold()); tube(g, [[50 + s * 27, 7], [50 + s * 20, -6, 0.15]], 0.028, gold()); tube(g, [[50 + s * 35, -2], [50 + s * 33, -14, 0.2]], 0.025, gold()); }
  } },
  laut: { bg: ['waves', { bg1: '#1a6a7a', bg2: '#08262e', motif: 'rgba(200,250,255,.12)' }], build: g => {
    base(g, 'domino', M.lacquer('#2bb3b0', { iridescence: 0.6 })); layer(g, D.rimEyes, M.lacquer('#f3f0ff', { iridescence: 1 }), 0.03);
    for (let i = 0; i < 9; i++) { const x = 14 + i * 9, y = 26 - Math.sin((i / 8) * Math.PI) * 14; const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), M.lacquer('#fffaf0', { iridescence: 1, roughness: 0.1 })); p.position.copy(onSurf(x, y, 0.03)); g.add(p); }
    gem(g, 50, 40, 0.09, '#5fe0ff');
  } },
  api: { bg: ['rays', { bg1: '#5a1206', bg2: '#140302', motif: 'rgba(255,120,40,.10)' }], build: g => {
    for (const [x, h, a] of [[26, 0.55, 0.3], [40, 0.75, 0.1], [50, 0.9, 0], [60, 0.75, -0.1], [74, 0.55, -0.3]]) flame(g, x, 26, h, x === 50 ? '#ffd23f' : '#ff6a1a', a);
    base(g, 'domino', M.lacquer('#15161b', { roughness: 0.15 })); layer(g, D.flameBrow, M.lacquer('#ff6a1a', { emissive: '#ff4a0a', emissiveIntensity: 0.6 }), 0.03);
    glowEyes(g, '#ffb030'); gem(g, 50, 40, 0.08, '#ff2a2a');
  } },
  agung: { bg: ['rays', { bg1: '#f2c14e', bg2: '#6a3a08', motif: 'rgba(255,250,220,.22)' }], build: g => {
    halo(g, 1.25, gold(), 0.2, -0.55); halo(g, 1.05, M.metal('#fff0b0'), 0.2, -0.5);
    base(g, 'oval', gold()); layer(g, D.rimEyes, M.lacquer(P.cabai), 0.03); layer(g, D.brows, M.metal('#8a5a10'), 0.03);
    for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; spike(g, 50 + Math.sin(a) * 42, 8 + (1 - Math.cos(a)) * 28, 0.32 + (4 - Math.abs(i - 4)) * 0.06, a * 0.9, gold(), 0.07); }
    gem(g, 50, 16, 0.1, '#ff2a2a'); for (const x of [26, 74]) gem(g, x, 70, 0.06, '#3fd0a0'); gem(g, 50, 84, 0.06, '#5f8bff');
  } },
  // --- misi khusus
  dalang: { bg: ['gunungan', { bg1: '#3a1a0a', bg2: '#140802', motif: 'rgba(242,193,78,.25)' }], build: g => {
    base(g, 'oval', M.lacquer('#1b1b22')); layer(g, D.rimEyes, gold(), 0.03); layer(g, D.mustache, gold(), 0.035); layer(g, D.brows, gold(), 0.03);
    gem(g, 50, 26, 0.08, P.kunyit);
  } },
  bayangan: { bg: ['plain', { bg1: '#1a1430', bg2: '#030206', motif: '' }], build: g => {
    base(g, 'domino', M.lacquer('#0d0d12', { roughness: 0.1 })); glowEyes(g, '#b07aff');
    layer(g, D.tear, M.lacquer('#b07aff', { emissive: '#8a4aff', emissiveIntensity: 0.8 }), 0.03);
  } },
  emasmurni: { bg: ['kawung', { bg1: '#c8322a', bg2: '#4a0d08', motif: 'rgba(242,193,78,.14)' }], build: g => {
    base(g, 'domino', M.metal('#f2c14e', { roughness: 0.12 })); layer(g, D.rimEyes, M.metal('#fff2b8'), 0.03);
    gem(g, 50, 40, 0.09, '#ffffff'); for (const [x, y] of [[10, 40], [90, 40], [30, 66], [70, 66]]) gem(g, x, y, 0.05, '#fff2b8', 0.02, 0);
  } },
  peramal: { bg: ['mega', { bg1: '#2a1a5a', bg2: '#0a0620', motif: 'rgba(180,140,255,.14)' }], build: g => {
    base(g, 'domino', M.lacquer('#4b2f7a')); layer(g, D.rimEyes, silver(), 0.03); layer(g, D.thirdEye, silver(), 0.03);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), M.glow('#7af0ff')); eye.position.copy(onSurf(50, 22, 0.04)); eye.scale.set(1.2, 0.7, 0.5); g.add(eye);
    for (const x of [8, 92]) tube(g, [[x, 60], [x + (x < 50 ? -4 : 4), 78, 0.05], [x, 92, 0.1]], 0.02, silver());
    for (const x of [6, 94]) gem(g, x + (x < 50 ? 2 : -2), 94, 0.06, '#7af0ff', 0.1);
  } },
  kolektor: { bg: ['ceplok', { bg1: '#1F2A52', bg2: '#0a0f24', motif: 'rgba(242,193,78,.12)' }], build: g => {
    base(g, 'heart', M.lacquer('#f6eedc'));
    const cols = ['#ff4a4a', '#ffb02a', '#3fd06a', '#3f8bff', '#b05aff', '#ff5ab0'];
    let i = 0; for (const [x, y] of [[12, 34], [22, 26], [78, 26], [88, 34], [10, 50], [90, 50], [18, 62], [82, 62], [30, 68], [70, 68], [50, 40], [50, 52]]) gem(g, x, y, 0.055, cols[i++ % cols.length], 0.03, 0);
    layer(g, D.rimEyes, gold(), 0.03);
  } },
};

// ------------------------------------------------------------ render ---
let renderer = null, envTex = null;
function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}
export function render(key, { tilt = -0.28 } = {}) {
  setup();
  const d = DESIGNS[key];
  const sc = new THREE.Scene(); sc.environment = envTex; sc.environmentIntensity = 0.65;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50); cam.position.set(0, 0.05, 7); cam.lookAt(0, 0.05, 0);
  // latar: bidang di belakang, menerima bayangan topeng
  const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ map: background(d.bg[0], d.bg[1]), roughness: 1 }));
  bgPlane.position.z = -1.6; bgPlane.receiveShadow = true; sc.add(bgPlane);
  sc.add(new THREE.HemisphereLight('#fff6e8', '#20243a', 0.9));
  const key_ = new THREE.DirectionalLight('#ffe6c4', 2.6); key_.position.set(2.5, 3, 5); key_.castShadow = true;
  key_.shadow.mapSize.set(1024, 1024); key_.shadow.camera.left = key_.shadow.camera.bottom = -3; key_.shadow.camera.right = key_.shadow.camera.top = 3; key_.shadow.radius = 8; key_.shadow.bias = -0.0005; key_.shadow.normalBias = 0.03;
  sc.add(key_);
  const rim = new THREE.DirectionalLight('#9cc4ff', 1.4); rim.position.set(-3, 2, -1); sc.add(rim);
  const grp = new THREE.Group(); d.build(grp);
  grp.rotation.set(0.08, tilt, 0.04); grp.position.y = -0.05; grp.scale.setScalar(1.05);
  grp.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
  sc.add(grp);
  renderer.render(sc, cam);
  const url = renderer.domElement.toDataURL('image/webp', 0.9);
  sc.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const m = o.material; m.map && m.map.dispose(); m.dispose(); } });
  return url;
}
export const KEYS = Object.keys(DESIGNS);
