// Nuansa tiap benua: ilustrasi lantai (canvas) + dekorasi 3D bergaya mainan.
// Warna dasar tetap mengikuti warna benua (Asia hijau, Afrika kuning, Eropa biru, Amerika merah, Antartika putih)
// agar kode warna permainan tetap jelas.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ================= ilustrasi lantai =================
// g: konteks canvas, w/h: ukuran px, u: px per satuan dunia
export const THEMES = {
  // ASIA — sawah terasering hijau + rumpun bambu
  asia(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#3f9c5c'); grad.addColorStop(1, '#2a7a45');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const bands = 11, greens = ['#4aa866', '#3b9257', '#57b672', '#348a50'];
    for (let i = bands; i >= 0; i--) {
      const y0 = (i / bands) * h * 1.05 - h * 0.04, amp = R(0.12, 0.22) * u, per = R(1.4, 2.2) * u, ph = R(0, 6);
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) g.lineTo(x, y0 + Math.sin(x / per + ph) * amp + Math.sin(x / (per * 0.37) + ph) * amp * 0.25);
      g.lineTo(w, h); g.closePath(); g.fillStyle = greens[i % greens.length]; g.fill();
      g.strokeStyle = 'rgba(214,245,220,.55)'; g.lineWidth = 0.035 * u; g.stroke(); // pematang berair
    }
    for (let i = 0; i < 900; i++) { // baris padi
      const x = Math.random() * w, y = Math.random() * h;
      g.strokeStyle = `rgba(${30 + Math.random() * 40},${90 + Math.random() * 40},50,.45)`; g.lineWidth = 0.012 * u;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-0.02, 0.02) * u, y - 0.06 * u); g.stroke();
    }
    for (const [cx, cy] of [[0.07, 0.25], [0.93, 0.6]]) bambooPatch(g, cx * w, cy * h, u);
  },

  // AFRIKA — sabana keemasan dengan pohon akasia & rumput
  afrika(g, w, h, u) {
    const grad = g.createRadialGradient(w * 0.5, h * 0.45, 0.2 * u, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, '#f0c45a'); grad.addColorStop(1, '#c88f2c');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // riak pasir
      const x = Math.random() * w, y = Math.random() * h, r = R(0.15, 0.4) * u;
      g.strokeStyle = 'rgba(150,95,25,.22)'; g.lineWidth = 0.018 * u;
      g.beginPath(); g.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    for (let i = 0; i < 380; i++) { // rumput kering
      const x = Math.random() * w, y = Math.random() * h, s = R(0.04, 0.08) * u;
      g.strokeStyle = `rgba(${120 + Math.random() * 40},${100 + Math.random() * 30},30,.6)`; g.lineWidth = 0.012 * u;
      for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * s, y - Math.cos(a) * s); g.stroke(); }
    }
    for (const [x, y, s] of [[0.1, 0.3, 1], [0.86, 0.22, 0.8], [0.62, 0.72, 0.9], [0.3, 0.68, 0.7]]) acaciaSilhouette(g, x * w, y * h, s * u);
  },

  // EROPA — jalan batu bulat (cobblestone) kota tua bernuansa biru
  eropa(g, w, h, u) {
    g.fillStyle = '#18315e'; g.fillRect(0, 0, w, h);                     // nat/mortar
    const rnd = seeded(11), rowH = 0.15 * u;
    for (let y = 0, row = 0; y < h + rowH; y += rowH, row++) {
      let x = -(row % 2) * 0.08 * u;
      while (x < w) {
        const sw = (0.12 + rnd() * 0.09) * u, l = 40 + rnd() * 18;
        const gx = x + 0.012 * u, gy = y + 0.012 * u + (rnd() - 0.5) * 0.01 * u;
        const grd = g.createLinearGradient(gx, gy, gx, gy + rowH);
        grd.addColorStop(0, `hsl(${212 + rnd() * 12}, ${30 + rnd() * 18}%, ${l + 8}%)`);
        grd.addColorStop(1, `hsl(${214 + rnd() * 10}, ${34 + rnd() * 14}%, ${l - 6}%)`);
        g.fillStyle = grd; g.beginPath(); g.roundRect(gx, gy, sw - 0.024 * u, rowH - 0.026 * u, 0.04 * u); g.fill();
        x += sw;
      }
    }
  },

  // AMERIKA — lapisan batu ngarai merah (canyon) + kaktus
  amerika(g, w, h, u) {
    const reds = ['#c2413a', '#d35a3e', '#a8352f', '#e07a52', '#b84a33', '#cf6a48', '#963029'];
    const bands = 14;
    for (let i = 0; i <= bands; i++) {
      const y0 = (i / bands) * h, amp = R(0.04, 0.1) * u, per = R(0.8, 1.6) * u, ph = R(0, 6);
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) g.lineTo(x, y0 + Math.sin(x / per + ph) * amp + Math.sin(x / (per * 0.3)) * amp * 0.3);
      g.lineTo(w, h); g.closePath(); g.fillStyle = reds[i % reds.length]; g.fill();
    }
    for (let i = 0; i < 160; i++) { // retakan batu
      const x = Math.random() * w, y = Math.random() * h;
      g.strokeStyle = 'rgba(70,18,12,.25)'; g.lineWidth = 0.012 * u; g.beginPath(); g.moveTo(x, y);
      let px = x, py = y; for (let k = 0; k < 4; k++) { px += R(-0.08, 0.08) * u; py += R(0.02, 0.08) * u; g.lineTo(px, py); } g.stroke();
    }
    for (let i = 0; i < 2200; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,210,170,.12)' : 'rgba(60,10,5,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (const [x, y, s] of [[0.08, 0.7, 1], [0.9, 0.35, 0.8], [0.55, 0.15, 0.6]]) cactusSilhouette(g, x * w, y * h, s * u);
  },

  // ANTARTIKA — bongkahan es retak, salju berkilau, jejak penguin
  antartika(g, w, h, u) {
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#f6fafd'); grad.addColorStop(1, '#d6e6f2');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { // bayangan biru es
      const x = Math.random() * w, y = Math.random() * h, r = R(0.4, 1.1) * u;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(150,195,225,.28)'); rg.addColorStop(1, 'rgba(150,195,225,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const crack = (x, y, len, ang, depth) => { // retakan bercabang
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < len; i++) { ang += R(-0.5, 0.5); x += Math.cos(ang) * 0.12 * u; y += Math.sin(ang) * 0.12 * u; g.lineTo(x, y); if (depth < 2 && Math.random() < 0.15) { g.stroke(); crack(x, y, len / 2, ang + R(-1.2, 1.2), depth + 1); g.beginPath(); g.moveTo(x, y); } }
      g.stroke();
    };
    g.strokeStyle = 'rgba(110,160,200,.55)'; g.lineWidth = 0.02 * u; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) crack(Math.random() * w, Math.random() * h, 14, Math.random() * 6, 0);
    for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; const s = R(1, 3); g.fillRect(Math.random() * w, Math.random() * h, s, s); }
    // jejak kaki penguin melengkung
    let px = w * 0.15, py = h * 0.85, a = -0.6;
    for (let i = 0; i < 18; i++) {
      a += 0.05; px += Math.cos(a) * 0.17 * u; py += Math.sin(a) * 0.17 * u;
      g.save(); g.translate(px + (i % 2 ? 0.05 : -0.05) * u, py); g.rotate(a + Math.PI / 2); g.fillStyle = 'rgba(90,130,170,.45)';
      for (const t of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(t) * 0.06 * u, -Math.cos(t) * 0.06 * u); g.lineWidth = 0.012 * u; g.strokeStyle = g.fillStyle; g.stroke(); }
      g.restore();
    }
  },
};

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
  windmill(g) { // kincir angin Eropa
    add(g, new THREE.CylinderGeometry(0.17, 0.26, 0.75, 16), mat('#f1ebdd'), [0, 0.375, 0]);
    add(g, new THREE.ConeGeometry(0.22, 0.25, 16), mat('#b23a3a'), [0, 0.87, 0]);
    add(g, new THREE.BoxGeometry(0.1, 0.16, 0.02), mat('#5a3a22'), [0, 0.1, 0.25]);
    const hub = new THREE.Group(); hub.position.set(0, 0.66, 0.22); hub.rotation.z = 0.35; g.add(hub);
    add(hub, new THREE.SphereGeometry(0.04, 12, 8), mat('#5a3a22'));
    for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.rotation.z = i * Math.PI / 2; hub.add(b); add(b, new THREE.BoxGeometry(0.11, 0.46, 0.015), mat('#efe6d0'), [0, 0.26, 0]); add(b, new THREE.BoxGeometry(0.015, 0.46, 0.02), mat('#5a3a22'), [-0.05, 0.26, 0]); }
  },
  bamboo(g) { // rumpun bambu Asia
    for (let i = 0; i < 6; i++) {
      const x = R(-0.22, 0.22), z = R(-0.22, 0.22), hgt = R(0.7, 1.1);
      add(g, new THREE.CylinderGeometry(0.035, 0.04, hgt, 10), mat('#6fae45'), [x, hgt / 2, z], [R(-0.08, 0.08), 0, R(-0.08, 0.08)]);
      for (let k = 1; k < 4; k++) add(g, new THREE.TorusGeometry(0.038, 0.009, 6, 14), mat('#477d2d'), [x, hgt * k / 4, z], [Math.PI / 2, 0, 0]);
      for (let k = 0; k < 3; k++) add(g, new THREE.SphereGeometry(0.08, 8, 6), mat('#4c9a3a'), [x + R(-0.08, 0.08), hgt + R(-0.05, 0.05), z + R(-0.08, 0.08)], [0, R(0, 3), 0], [1.4, 0.3, 0.6]);
    }
  },
  acacia(g) { // pohon akasia Afrika
    add(g, new THREE.CylinderGeometry(0.04, 0.07, 0.7, 8), mat('#6b4a2b'), [0, 0.35, 0], [0, 0, 0.1]);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.025, 0.035, 0.35, 8), mat('#6b4a2b'), [s * 0.12, 0.75, 0], [0, 0, -s * 0.7]);
    add(g, new THREE.SphereGeometry(0.5, 20, 10), mat('#7d8a31', { flatShading: true }), [0, 0.92, 0], [0, 0, 0], [1, 0.22, 0.85]);
    add(g, new THREE.SphereGeometry(0.34, 16, 8), mat('#93a13a', { flatShading: true }), [-0.08, 1.0, 0.04], [0, 0, 0], [1, 0.22, 0.85]);
  },
  cactus(g) { // kaktus saguaro Amerika
    const c = mat('#4f8a3c');
    add(g, new THREE.CapsuleGeometry(0.085, 0.6, 6, 14), c, [0, 0.39, 0]);
    add(g, new THREE.CapsuleGeometry(0.055, 0.14, 6, 12), c, [0.15, 0.38, 0], [0, 0, Math.PI / 2]);
    add(g, new THREE.CapsuleGeometry(0.055, 0.22, 6, 12), c, [0.22, 0.52, 0]);
    add(g, new THREE.CapsuleGeometry(0.05, 0.1, 6, 12), c, [-0.13, 0.5, 0], [0, 0, Math.PI / 2]);
    add(g, new THREE.CapsuleGeometry(0.05, 0.16, 6, 12), c, [-0.19, 0.62, 0]);
    add(g, new THREE.SphereGeometry(0.035, 10, 8), mat('#ff6fa0'), [0, 0.82, 0]);
    add(g, new THREE.SphereGeometry(0.2, 12, 8), mat('#b66a3c', { flatShading: true }), [0, 0, 0], [0, 0, 0], [1.4, 0.35, 1.2]);
  },
  penguins(g) { // dua penguin Antartika
    for (const [x, z, s, ry] of [[0, 0, 1, 0.3], [0.28, 0.12, 0.8, -0.4]]) {
      const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); p.rotation.y = ry; g.add(p);
      add(p, new THREE.CapsuleGeometry(0.11, 0.16, 6, 16), mat('#1c2026', { roughness: 0.4 }), [0, 0.22, 0]);
      add(p, new THREE.SphereGeometry(0.1, 16, 12), mat('#f7f7f2'), [0, 0.2, 0.05], [0, 0, 0], [0.9, 1.3, 0.7]);
      add(p, new THREE.SphereGeometry(0.085, 16, 12), mat('#1c2026', { roughness: 0.4 }), [0, 0.44, 0]);
      add(p, new THREE.ConeGeometry(0.025, 0.07, 8), mat('#f39c2b'), [0, 0.43, 0.09], [Math.PI / 2, 0, 0]);
      for (const sx of [-1, 1]) {
        add(p, new THREE.SphereGeometry(0.016, 8, 6), mat('#ffffff'), [sx * 0.035, 0.465, 0.07]);
        add(p, new THREE.SphereGeometry(0.035, 8, 6), mat('#f39c2b'), [sx * 0.05, 0.02, 0.04], [0, 0, 0], [1, 0.35, 1.5]);
        add(p, new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), mat('#1c2026'), [sx * 0.12, 0.24, 0], [0, 0, sx * 0.3]);
      }
    }
  },
};
