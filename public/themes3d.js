// Nuansa tiap pulau: ilustrasi lantai (canvas) + dekorasi 3D bergaya mainan.
// Warna dasar tetap mengikuti warna pulau (Sumatera merah, Kalimantan hijau, Jawa biru, Sulawesi kuning, Papua putih)
// agar kode warna permainan tetap jelas.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ================= ilustrasi lantai =================
// g: konteks canvas, w/h: ukuran px, u: px per satuan dunia
export const THEMES = {
  // SUMATERA — tanah merah perkebunan: baris pohon sawit + jalan kebun berkelok
  sumatera(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#cc4a3c'); grad.addColorStop(1, '#a8352f');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,200,160,.10)' : 'rgba(70,15,8,.14)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(120,30,20,.35)'; g.lineWidth = 0.03 * u; // alur tanam
    for (let y = 0.35 * u; y < h; y += 0.55 * u) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 10) g.lineTo(x, y + Math.sin(x / (1.3 * u)) * 0.06 * u); g.stroke(); }
    g.strokeStyle = 'rgba(240,190,150,.35)'; g.lineWidth = 0.09 * u; g.lineCap = 'round'; // jalan kebun
    g.beginPath(); g.moveTo(-10, h * 0.78); g.bezierCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.95, w + 10, h * 0.62); g.stroke();
    for (let y = 0.35 * u, r = 0; y < h; y += 0.55 * u, r++) for (let x = (r % 2 ? 0.45 : 0.18) * u; x < w; x += 0.62 * u) if (Math.random() < 0.55) palmCrown(g, x, y, u * R(0.8, 1.05));
  },

  // KALIMANTAN — kanopi hutan hujan tropis + sungai besar berkelok
  kalimantan(g, w, h, u) {
    g.fillStyle = '#25784a'; g.fillRect(0, 0, w, h);
    const greens = ['#2f8f57', '#3a9c5f', '#24804a', '#47a86a', '#1f6e40'];
    for (let i = 0; i < 520; i++) { // gumpalan kanopi
      const x = Math.random() * w, y = Math.random() * h, r = R(0.12, 0.3) * u;
      g.fillStyle = 'rgba(10,40,20,.25)'; g.beginPath(); g.arc(x + r * 0.25, y + r * 0.25, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = greens[i % greens.length]; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190,240,170,.18)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); g.fill();
    }
    g.lineCap = 'round'; // sungai
    const river = () => { g.beginPath(); g.moveTo(w * 0.12, -10); g.bezierCurveTo(w * 0.05, h * 0.4, w * 0.55, h * 0.35, w * 0.45, h * 0.7); g.bezierCurveTo(w * 0.4, h * 0.9, w * 0.7, h * 0.95, w * 0.78, h + 10); };
    g.strokeStyle = '#7a5b33'; g.lineWidth = 0.34 * u; river(); g.stroke();
    g.strokeStyle = '#4f9aa6'; g.lineWidth = 0.24 * u; river(); g.stroke();
    g.strokeStyle = 'rgba(220,250,255,.35)'; g.lineWidth = 0.03 * u; g.setLineDash([0.12 * u, 0.2 * u]); river(); g.stroke(); g.setLineDash([]);
  },

  // JAWA — kain batik kawung biru indigo
  jawa(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#244c92'); grad.addColorStop(1, '#1b3a74');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const step = 0.5 * u;
    for (let y = 0, row = 0; y < h + step; y += step, row++) for (let x = (row % 2) * step / 2; x < w + step; x += step) {
      g.save(); g.translate(x, y);
      for (let k = 0; k < 4; k++) { // empat kelopak kawung
        g.save(); g.rotate(Math.PI / 4 + k * Math.PI / 2); g.translate(step * 0.27, 0);
        g.fillStyle = '#3c6cc0'; g.strokeStyle = 'rgba(243,234,215,.55)'; g.lineWidth = 0.018 * u;
        g.beginPath(); g.ellipse(0, 0, step * 0.22, step * 0.13, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = 'rgba(243,234,215,.5)'; g.beginPath(); g.arc(step * 0.04, 0, step * 0.03, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.fillStyle = 'rgba(243,234,215,.7)'; g.beginPath(); g.arc(0, 0, step * 0.04, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  },

  // SULAWESI — pantai pasir keemasan, laut dangkal toska & karang
  sulawesi(g, w, h, u) {
    const grad = g.createRadialGradient(w * 0.45, h * 0.4, 0.2 * u, w * 0.5, h * 0.5, w * 0.7);
    grad.addColorStop(0, '#f0c75e'); grad.addColorStop(1, '#cf9a30');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) { // riak pasir
      const x = Math.random() * w, y = Math.random() * h * 0.8, r = R(0.15, 0.4) * u;
      g.strokeStyle = 'rgba(150,95,25,.2)'; g.lineWidth = 0.016 * u; g.beginPath(); g.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    const shore = y0 => { g.beginPath(); g.moveTo(-10, h + 10); g.lineTo(-10, y0); for (let x = 0; x <= w + 10; x += 10) g.lineTo(x, y0 + Math.sin(x / (0.9 * u)) * 0.08 * u); g.lineTo(w + 10, h + 10); g.closePath(); };
    g.fillStyle = 'rgba(74,190,190,.55)'; shore(h * 0.8); g.fill();     // laut dangkal
    g.fillStyle = 'rgba(40,150,170,.55)'; shore(h * 0.9); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.03 * u; shore(h * 0.8); g.stroke(); // buih
    for (let i = 0; i < 26; i++) { g.fillStyle = ['#ff8a7a', '#f6b26b', '#e06c9f'][i % 3]; g.globalAlpha = 0.55; g.beginPath(); g.arc(Math.random() * w, h * R(0.84, 0.98), R(0.03, 0.06) * u, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  },

  // PAPUA — dataran tinggi bersalju Puncak Jaya: salju berkilau + punggung batu
  papua(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#f6fafd'); grad.addColorStop(1, '#d9e6ef');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) { // bayangan lereng
      const x = Math.random() * w, y = Math.random() * h, r = R(0.4, 1.1) * u;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(140,170,195,.28)'); rg.addColorStop(1, 'rgba(140,170,195,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 7; i++) { // punggung batu yang menyembul dari salju
      const x = Math.random() * w, y = Math.random() * h, len = R(0.5, 1.2) * u, a = R(-0.6, 0.6);
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(110,118,128,.55)'; g.beginPath(); g.moveTo(-len / 2, 0);
      for (let k = 0; k <= 8; k++) g.lineTo(-len / 2 + (k / 8) * len, -R(0.02, 0.09) * u);
      g.lineTo(len / 2, 0.03 * u); g.closePath(); g.fill(); g.restore();
    }
    for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; const sz = R(1, 3); g.fillRect(Math.random() * w, Math.random() * h, sz, sz); }
  },
};

function palmCrown(g, x, y, u) { // tajuk sawit dilihat dari atas
  g.fillStyle = 'rgba(60,15,8,.3)'; g.beginPath(); g.arc(x + 0.05 * u, y + 0.04 * u, 0.17 * u, 0, Math.PI * 2); g.fill();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + R(-0.1, 0.1);
    g.strokeStyle = k % 2 ? '#3f7d3a' : '#4f9447'; g.lineWidth = 0.035 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 0.1 * u, y + Math.sin(a) * 0.1 * u, x + Math.cos(a + 0.2) * 0.18 * u, y + Math.sin(a + 0.2) * 0.18 * u); g.stroke();
  }
  g.fillStyle = '#6b4a2b'; g.beginPath(); g.arc(x, y, 0.025 * u, 0, Math.PI * 2); g.fill();
}
function bambooPatch(g, cx, cy, u) {
  for (let i = 0; i < 6; i++) {
    const x = cx + R(-0.25, 0.25) * u, y = cy + R(-0.3, 0.3) * u;
    g.fillStyle = 'rgba(20,70,35,.25)'; g.beginPath(); g.ellipse(x + 0.03 * u, y + 0.02 * u, 0.06 * u, 0.04 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6fb04a'; g.beginPath(); g.arc(x, y, 0.04 * u, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3e7a2c'; g.lineWidth = 0.01 * u; g.stroke();
    for (let k = 0; k < 4; k++) { const a = R(0, Math.PI * 2); g.fillStyle = '#4c9a3a'; g.beginPath(); g.ellipse(x + Math.cos(a) * 0.08 * u, y + Math.sin(a) * 0.08 * u, 0.07 * u, 0.02 * u, a, 0, Math.PI * 2); g.fill(); }
  }
}
function acaciaSilhouette(g, x, y, u) {
  g.fillStyle = 'rgba(90,60,20,.25)'; g.beginPath(); g.ellipse(x + 0.12 * u, y + 0.08 * u, 0.42 * u, 0.12 * u, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6f7b2c'; g.beginPath(); g.ellipse(x, y, 0.38 * u, 0.16 * u, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8a9636'; g.beginPath(); g.ellipse(x - 0.06 * u, y - 0.04 * u, 0.26 * u, 0.09 * u, 0, 0, Math.PI * 2); g.fill();
}
function cactusSilhouette(g, x, y, u) {
  g.fillStyle = 'rgba(60,15,10,.3)'; g.beginPath(); g.ellipse(x + 0.05 * u, y + 0.03 * u, 0.1 * u, 0.05 * u, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4f8a3c'; g.beginPath(); g.arc(x, y, 0.07 * u, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 0.1 * u, y + s * 0.03 * u, 0.04 * u, 0, Math.PI * 2); g.fill(); }
}

// ================= dekorasi 3D (gaya mainan) =================
const cache = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })); return cache.get(k); };
function add(g, geo, m, p = [0, 0, 0], r = [0, 0, 0], s) { const x = new THREE.Mesh(geo, m); x.position.set(...p); x.rotation.set(...r); if (s) x.scale.set(...s); x.castShadow = true; g.add(x); return x; }

export const DECOR = {
  sawit(g) { // pohon kelapa sawit Sumatera
    for (const [x, z, sc] of [[0, 0, 1], [0.32, 0.18, 0.8]]) {
      const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(sc); g.add(t);
      add(t, new THREE.CylinderGeometry(0.06, 0.09, 0.8, 10), mat('#6b4a2b', { flatShading: true }), [0, 0.4, 0]);
      for (let k = 0; k < 9; k++) {
        const f = new THREE.Group(); f.position.y = 0.8; f.rotation.y = k * Math.PI * 2 / 9; t.add(f);
        add(f, new THREE.BoxGeometry(0.06, 0.012, 0.42), mat(k % 2 ? '#3f7d3a' : '#4f9447'), [0, 0.03, 0.2], [0.45, 0, 0]);
      }
      add(t, new THREE.SphereGeometry(0.07, 10, 8), mat('#c2552f'), [0, 0.78, 0]);
    }
  },
  hutan(g) { // pohon hutan hujan Kalimantan
    for (const [x, z, hgt, r] of [[0, 0, 1.0, 0.3], [0.3, 0.15, 0.75, 0.24], [-0.22, 0.2, 0.6, 0.2]]) {
      add(g, new THREE.CylinderGeometry(0.04, 0.06, hgt, 8), mat('#5b3d24'), [x, hgt / 2, z]);
      add(g, new THREE.SphereGeometry(r, 14, 10), mat('#2f8f57', { flatShading: true }), [x, hgt + r * 0.4, z], [0, 0, 0], [1, 0.75, 1]);
      add(g, new THREE.SphereGeometry(r * 0.7, 12, 8), mat('#47a86a', { flatShading: true }), [x - r * 0.3, hgt + r * 0.7, z + r * 0.2], [0, 0, 0], [1, 0.7, 1]);
    }
  },
  candi(g) { // candi bertingkat dengan stupa (gaya Borobudur)
    const stone = mat('#8d8a82', { flatShading: true }), dark = mat('#6f6c66', { flatShading: true });
    let y = 0;
    [[0.9, 0.12], [0.72, 0.12], [0.55, 0.12]].forEach(([s, hgt], i) => { add(g, new THREE.BoxGeometry(s, hgt, s), i % 2 ? dark : stone, [0, y + hgt / 2, 0]); y += hgt; });
    for (const r of [0.2, 0.13]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; add(g, new THREE.SphereGeometry(0.045, 10, 8), stone, [Math.cos(a) * r, y + 0.03, Math.sin(a) * r], [0, 0, 0], [1, 1.2, 1]); }
    add(g, new THREE.SphereGeometry(0.11, 14, 10), stone, [0, y + 0.08, 0], [0, 0, 0], [1, 1.15, 1]);
    add(g, new THREE.ConeGeometry(0.03, 0.16, 8), stone, [0, y + 0.26, 0]);
  },
  pinisi(g) { // kapal pinisi Bugis
    const wood = mat('#7a4a28'), sail = mat('#f4eedd', { side: THREE.DoubleSide });
    add(g, new THREE.CapsuleGeometry(0.13, 0.62, 6, 12), wood, [0, 0.13, 0], [0, 0, Math.PI / 2], [1, 0.75, 1]);
    add(g, new THREE.BoxGeometry(0.78, 0.04, 0.2), mat('#9a6a3a'), [0, 0.24, 0]);
    for (const [x, hgt] of [[-0.16, 0.7], [0.16, 0.6]]) {
      add(g, new THREE.CylinderGeometry(0.012, 0.015, hgt, 6), wood, [x, 0.24 + hgt / 2, 0]);
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.28, 0); sh.lineTo(0, hgt * 0.82); sh.closePath();
      add(g, new THREE.ShapeGeometry(sh), sail, [x + 0.01, 0.3, 0]);
    }
    add(g, new THREE.ConeGeometry(0.02, 0.4, 6), wood, [0.5, 0.3, 0], [0, 0, -1.2]); // cucur haluan
  },
  puncak(g) { // pegunungan bersalju Puncak Jaya
    const rock = mat('#6f747c', { flatShading: true }), snow = mat('#f7fbff', { flatShading: true, roughness: 0.35 });
    for (const [x, z, r, hgt] of [[0, 0, 0.42, 0.85], [0.4, 0.15, 0.3, 0.6], [-0.34, 0.18, 0.26, 0.5]]) {
      add(g, new THREE.ConeGeometry(r, hgt, 6, 1), rock, [x, hgt / 2, z], [0, R(0, 3), 0]);
      add(g, new THREE.ConeGeometry(r * 0.48, hgt * 0.42, 6, 1), snow, [x, hgt - hgt * 0.21 + 0.005, z], [0, R(0, 3), 0]);
    }
  },
};
