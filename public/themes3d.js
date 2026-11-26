// Nuansa tiap pulau: ilustrasi lantai (canvas) + dekorasi 3D bergaya mainan.
// Warna dasar tetap mengikuti warna pulau (Sumatera merah, Kalimantan hijau, Jawa biru, Sulawesi kuning, Papua putih)
// agar kode warna permainan tetap jelas.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ================= ilustrasi lantai =================
// g: konteks canvas, w/h: ukuran px, u: px per satuan dunia
export const THEMES = {
  // Prinsip: lantai = latar tenang. Warna dasar rata + tekstur halus berkontras rendah,
  // ciri khas pulau hanya tipis & di pinggir, supaya bidak di atasnya tetap paling menonjol.

  // SUMATERA — tanah merah perkebunan: alur tanam samar + jalan kebun tipis
  sumatera(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#c9473a'); grad.addColorStop(1, '#b43c33');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    grain(g, w, h, 'rgba(255,210,180,.05)', 'rgba(70,15,8,.06)');
    g.strokeStyle = 'rgba(110,25,18,.12)'; g.lineWidth = 0.025 * u;
    for (let y = 0.5 * u; y < h; y += 0.7 * u) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 12) g.lineTo(x, y + Math.sin(x / (1.4 * u)) * 0.05 * u); g.stroke(); }
    g.strokeStyle = 'rgba(240,190,150,.14)'; g.lineWidth = 0.07 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-10, h * 0.86); g.bezierCurveTo(w * 0.3, h * 0.74, w * 0.6, h * 0.98, w + 10, h * 0.8); g.stroke();
  },

  // KALIMANTAN — hijau hutan dengan bayangan kanopi lembut + sungai tipis di sisi kiri
  kalimantan(g, w, h, u) {
    g.fillStyle = '#2b8752'; g.fillRect(0, 0, w, h);
    softBlobs(g, w, h, u, ['rgba(20,70,40,.10)', 'rgba(120,200,140,.07)'], 26);
    g.lineCap = 'round';
    const river = () => { g.beginPath(); g.moveTo(w * 0.08, -10); g.bezierCurveTo(w * 0.02, h * 0.35, w * 0.16, h * 0.6, w * 0.06, h + 10); };
    g.strokeStyle = 'rgba(80,150,165,.35)'; g.lineWidth = 0.14 * u; river(); g.stroke();
    g.strokeStyle = 'rgba(220,250,255,.12)'; g.lineWidth = 0.02 * u; river(); g.stroke();
  },

  // JAWA — batik kawung biru indigo, nada-ke-nada (tanpa garis krem terang)
  jawa(g, w, h, u) {
    g.fillStyle = '#24498c'; g.fillRect(0, 0, w, h);
    const step = 0.7 * u;
    g.fillStyle = 'rgba(120,160,230,.10)';
    for (let y = 0, row = 0; y < h + step; y += step, row++) for (let x = (row % 2) * step / 2; x < w + step; x += step) {
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2;
        g.beginPath(); g.ellipse(x + Math.cos(a) * step * 0.27, y + Math.sin(a) * step * 0.27, step * 0.21, step * 0.12, a, 0, Math.PI * 2); g.fill();
      }
    }
  },

  // SULAWESI — pasir keemasan rata + garis pantai toska tipis di tepi bawah
  sulawesi(g, w, h, u) {
    g.fillStyle = '#e1b448'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 'rgba(255,240,200,.06)', 'rgba(140,90,20,.06)');
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w, y = Math.random() * h * 0.8, r = R(0.2, 0.45) * u;
      g.strokeStyle = 'rgba(150,95,25,.08)'; g.lineWidth = 0.014 * u; g.beginPath(); g.arc(x, y, r, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    }
    const shore = y0 => { g.beginPath(); g.moveTo(-10, h + 10); g.lineTo(-10, y0); for (let x = 0; x <= w + 10; x += 12) g.lineTo(x, y0 + Math.sin(x / (1.1 * u)) * 0.05 * u); g.lineTo(w + 10, h + 10); g.closePath(); };
    g.fillStyle = 'rgba(70,175,180,.35)'; shore(h * 0.9); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.02 * u; shore(h * 0.9); g.stroke();
  },

  // PAPUA — salju dataran tinggi: putih kebiruan dengan bayangan lereng yang sangat halus
  papua(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#eef4f8'); grad.addColorStop(1, '#dde8f0');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    softBlobs(g, w, h, u, ['rgba(140,170,195,.10)'], 8);
  },
};

function grain(g, w, h, light, dark) { // butiran halus, hanya terasa dari dekat
  const n = Math.round(w * h / 900);
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? light : dark; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}
function softBlobs(g, w, h, u, cols, n) { // bercak gradasi lebar tanpa tepi tegas
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = R(0.5, 1.2) * u, c = cols[i % cols.length];
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

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
