// Papan 3D Pesta Topeng — "atlas antik di meja permainan".
// Pulau = pulau felt di atas lautan, dihubungkan jembatan kayu; miniatur landmark kuningan; lampu meja hangat.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFigure, nameTag } from './figures3d.js';
import { THEMES, DECOR } from './themes3d.js';
import { getPortrait } from './portraits.js';

// ---------- palet ----------
const FELT = { papua: '#e4ecf2', sulawesi: '#d9a62e', jawa: '#2f63b8', sumatera: '#c2413a', kalimantan: '#2f8f57' };
const INK_ON = { papua: '#1d2633', sulawesi: '#3b2a08' }; // teks tinta gelap di felt terang (kontras)
const CREAM = '#f3ead7', INK = '#1d2633', BRASS = '#c9a14a';
const FIG_COLORS = ['#b23a48', '#2e6f95', '#3d8b5e', '#c98a2b', '#6a4c93', '#d1603d', '#1f7a7a', '#8f2d56', '#4a6fa5', '#9a7b2f',
  '#2b2d42', '#c44536', '#3c6e71', '#7d5a50', '#5b8e7d', '#a23e48', '#356089', '#7b6d8d', '#b5838d', '#4f772d'];

// ---------- tata letak (dari server: /meta.layout, sumber yang sama dengan posisi bidak) ----------
let GAP, CW, CD, AD, CX, CZ, SEA_W, SEA_D, LAYOUT, BRIDGES, PROPS, DIE_REST;
function initLayout(L) {
  ({ GAP, CW, CD, AD, CX, CZ, SEA_W, SEA_D, BRIDGES, PROPS } = L);
  LAYOUT = L.ROOMS;
  DIE_REST = new THREE.Vector3(3.6, 0.45, SEA_D / 2 + 1.35);
}

const SEA_Y = 0.02, FLOOR_Y = 0.32, FIG_S = 1.42;
const DIE_SIDES = ['papua', 'sulawesi', 'jawa', 'sumatera', 'kalimantan']; // urutan panel sisi prisma (searah sudut θ)
// Animasi selalu aktif di semua perangkat. Sebelumnya mengikuti setelan sistem "kurangi gerakan",
// yang sering menyala di laptop/iPhone sehingga animasi tidak jalan. Sekarang dimatikan hanya lewat
// tombol "Kurangi animasi" di dalam game.
let REDUCED = (() => { try { return localStorage.getItem('pt-reduce-motion') === '1'; } catch { return false; } })();
export function setReducedMotion(v) { REDUCED = !!v; }
const SERIF = '"Playfair Display", Georgia, serif';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, light, dark) { // tekstur serat felt / kayu halus
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? light : dark;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
}
function spaced(g, text, x, y, spacing) { // teks dengan letter-spacing (fallback manual)
  if ('letterSpacing' in g) { g.letterSpacing = `${spacing}px`; g.fillText(text, x + spacing / 2, y); g.letterSpacing = '0px'; return; }
  const chars = [...text], widths = chars.map(c => g.measureText(c).width + spacing);
  let cx = x - widths.reduce((a, b) => a + b, 0) / 2;
  g.save(); g.textAlign = 'left';
  chars.forEach((c, i) => { g.fillText(c, cx, y); cx += widths[i]; });
  g.restore();
}
function drawMask(g, cx, cy, s, fill) { // topeng karnaval sederhana (tanpa emoji)
  g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = fill;
  g.beginPath();
  g.moveTo(-1, -0.35); g.bezierCurveTo(-0.6, -0.55, -0.2, -0.45, 0, -0.25); g.bezierCurveTo(0.2, -0.45, 0.6, -0.55, 1, -0.35);
  g.bezierCurveTo(1.05, 0.1, 0.75, 0.5, 0.35, 0.45); g.bezierCurveTo(0.15, 0.42, 0.08, 0.2, 0, 0.2);
  g.bezierCurveTo(-0.08, 0.2, -0.15, 0.42, -0.35, 0.45); g.bezierCurveTo(-0.75, 0.5, -1.05, 0.1, -1, -0.35); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * 0.45, -0.05, 0.24, 0.13, k * 0.15, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

export class Board3D {
  constructor(container, meta, handlers) {
    this.meta = meta; this.h = handlers; this.container = container;
    initLayout(meta.layout);
    this.figures = new Map(); this.tweens = [];
    this.state = null; this.ui = {};
    this.lastRollId = null; this.rolling = false; this.pending = null; this.lastEventId = null;
    this.lastT = performance.now(); this.elapsed = 0; this.waveAcc = 0;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    container.append(r.domElement);

    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#07090c');
    s.fog = new THREE.Fog('#07090c', 26, 48);
    const pmrem = new THREE.PMREMGenerator(r);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.setupInput(r.domElement); // sebelum OrbitControls agar bisa "merebut" sentuhan pada bidak
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, minPolarAngle: 0.12, maxPolarAngle: 1.1, minDistance: 8, maxDistance: 40 });

    // lampu: satu lampu meja hangat yang menyorot papan + isi dingin yang tipis
    s.add(new THREE.HemisphereLight('#9fb4d8', '#20140a', 0.35));
    const lamp = new THREE.SpotLight('#ffe3b3', 3.2, 0, 0.78, 0.6, 0);
    lamp.position.set(-2.5, 17, 7); lamp.target.position.set(0, 0, 0.6);
    lamp.castShadow = true; lamp.shadow.mapSize.set(1536, 1536); lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02;
    lamp.shadow.camera.near = 8; lamp.shadow.camera.far = 30;
    s.add(lamp, lamp.target);
    const rim = new THREE.DirectionalLight('#86a8ff', 0.35); rim.position.set(6, 6, -12); s.add(rim);

    this.shared = {
      brass: new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.85, roughness: 0.32 }),
      walnut: new THREE.MeshStandardMaterial({ color: '#4a2d1c', roughness: 0.6 }),
      bulb: new THREE.MeshBasicMaterial({ color: '#ffd58a' }),
    };

    this.buildTable(); this.buildBoard(); this.buildDie(); this.buildFigures();

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize(true);
    r.setAnimationLoop(() => this.frame());
  }

  // ================= scene =================
  buildTable() {
    const felt = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#123524'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 26000, 'rgba(255,255,255,.035)', 'rgba(0,0,0,.08)');
    });
    felt.wrapS = felt.wrapT = THREE.RepeatWrapping; felt.repeat.set(10, 10);
    const table = new THREE.Mesh(new THREE.CircleGeometry(19, 96), new THREE.MeshStandardMaterial({ map: felt, roughness: 1 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.55; table.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(19, 0.45, 16, 120), this.shared.walnut);
    edge.rotation.x = Math.PI / 2; edge.position.y = -0.5;
    this.scene.add(table, edge);
  }

  buildBoard() {
    // bingkai kayu walnut dengan lis kuningan
    const wood = canvasTex(1024, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#5b3622'); grad.addColorStop(1, '#3d2416');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 12},4,${0.18 + Math.random() * 0.25})`;
        g.lineWidth = 0.6 + Math.random() * 2.2; g.beginPath();
        const y = Math.random() * h; g.moveTo(0, y);
        for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x / 90 + i) * 4 + Math.sin(x / 23 + i * 3) * 1.2);
        g.stroke();
      }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    const frameMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.42, metalness: 0 });
    const FW = 0.55, FH = 0.62, OW = SEA_W + FW * 2, OD = SEA_D + FW * 2;
    const base = new THREE.Mesh(new RoundedBoxGeometry(OW, 0.35, OD, 3, 0.12), frameMat);
    base.position.y = -0.35; base.receiveShadow = true; base.castShadow = true; this.scene.add(base);
    for (const [w, d, x, z] of [[OW, FW, 0, -(SEA_D + FW) / 2], [OW, FW, 0, (SEA_D + FW) / 2], [FW, SEA_D, -(SEA_W + FW) / 2, 0], [FW, SEA_D, (SEA_W + FW) / 2, 0]]) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, FH, d, 3, 0.1), frameMat);
      m.position.set(x, -0.2 + FH / 2, z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    }
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(SEA_W + 0.1, 0.03, SEA_D + 0.1), this.shared.brass);
    inlay.position.y = SEA_Y - 0.03; this.scene.add(inlay);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // tutup sudut kuningan
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.12, 24), this.shared.brass);
      cap.position.set(sx * (SEA_W / 2 + FW / 2), FH - 0.15, sz * (SEA_D / 2 + FW / 2)); cap.castShadow = true; this.scene.add(cap);
    }

    // laut: kertas peta biru tua dengan garis lintang/bujur kuningan
    const seaTex = canvasTex(1024, Math.round(1024 * SEA_D / SEA_W), (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.75);
      grad.addColorStop(0, '#16465a'); grad.addColorStop(1, '#0a2533');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 18000, 'rgba(255,255,255,.025)', 'rgba(0,0,0,.06)');
      g.strokeStyle = 'rgba(214,180,110,.22)'; g.lineWidth = 1.5;
      for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(0, i * h / 12); g.lineTo(w, i * h / 12); g.stroke(); }
      for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * w / 10, 0); g.lineTo(i * w / 10, h); g.stroke(); }
      g.strokeStyle = 'rgba(214,180,110,.5)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
      g.lineWidth = 1; g.strokeRect(20, 20, w - 40, h - 40);
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(SEA_W, SEA_D), new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.35, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; sea.receiveShadow = true; this.scene.add(sea);
    this.waveTex = canvasTex(256, 256, (g, w, h) => { // riak ombak transparan, bergeser pelan
      g.strokeStyle = 'rgba(190,225,235,.22)'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 7 + Math.random() * 7;
        g.beginPath(); g.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        g.beginPath(); g.arc(x + r * 1.5, y, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
    });
    this.waveTex.wrapS = this.waveTex.wrapT = THREE.RepeatWrapping; this.waveTex.repeat.set(SEA_W / 2.2, SEA_D / 2.2);
    const waves = new THREE.Mesh(new THREE.PlaneGeometry(SEA_W, SEA_D), new THREE.MeshBasicMaterial({ map: this.waveTex, transparent: true, depthWrite: false }));
    waves.rotation.x = -Math.PI / 2; waves.position.y = SEA_Y + 0.005; this.scene.add(waves);
    this.buildCompass(-SEA_W / 2 + 0.55, SEA_D / 2 - 0.55);

    // pulau pulau
    this.roomMeshes = {};
    const coastMat = new THREE.MeshStandardMaterial({ color: '#cbb48a', roughness: 0.9 });
    for (const [room, L] of Object.entries(LAYOUT)) {
      const coast = new THREE.Mesh(new RoundedBoxGeometry(L.w + 0.26, FLOOR_Y - 0.06, L.d + 0.26, 3, 0.12), coastMat);
      coast.position.set(L.x, (FLOOR_Y - 0.06) / 2, L.z); coast.castShadow = true; coast.receiveShadow = true; this.scene.add(coast);

      const col = new THREE.Color(FELT[room]);
      const tex = this.feltTexture(room, L);
      const feltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: col, emissiveIntensity: 0 });
      const floor = new THREE.Mesh(new RoundedBoxGeometry(L.w, 0.1, L.d, 2, 0.04), feltMat);
      floor.position.set(L.x, FLOOR_Y - 0.05, L.z); floor.receiveShadow = true; floor.userData.room = room;
      this.scene.add(floor);
      // lis kuningan tipis di tepi pulau — menyala saat jadi tujuan
      const rimMat = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.8, roughness: 0.3, emissive: '#ffcf6e', emissiveIntensity: 0 });
      const rimShape = new THREE.Shape(); const hw = L.w / 2 + 0.13, hd = L.d / 2 + 0.13;
      rimShape.moveTo(-hw, -hd); rimShape.lineTo(hw, -hd); rimShape.lineTo(hw, hd); rimShape.lineTo(-hw, hd); rimShape.lineTo(-hw, -hd);
      const hole = new THREE.Path(); const iw = L.w / 2 - 0.03, id = L.d / 2 - 0.03;
      hole.moveTo(-iw, -id); hole.lineTo(-iw, id); hole.lineTo(iw, id); hole.lineTo(iw, -id); hole.lineTo(-iw, -id);
      rimShape.holes.push(hole);
      const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimShape, { depth: 0.1, bevelEnabled: false }), rimMat);
      rim.rotation.x = -Math.PI / 2; rim.position.set(L.x, FLOOR_Y - 0.05, L.z); this.scene.add(rim);

      // bayangan gelap untuk pulau yang tidak terlibat dalam langkah saat ini
      // (lantai diredupkan lewat warna material; tidak ada objek tambahan yang menutupi pulau lain)
      this.roomMeshes[room] = { floorMat: feltMat, rimMat, floor, shadeOp: 0 };
      for (const pr of PROPS[room]) {
        if (DECOR[pr.kind]) { const g = new THREE.Group(); DECOR[pr.kind](g); g.position.set(L.x + pr.dx, FLOOR_Y, L.z + pr.dz); this.scene.add(g); }
        else this.buildLandmark(pr.kind, L.x + pr.dx, L.z + pr.dz);
      }

    }
    this.bridges = BRIDGES.map(b => this.buildBridge(b));
  }

  feltTexture(room, L) {
    // ilustrasi khas pulau + pita perkamen berisi nama pulau (kontras tinggi di atas gambar apa pun)
    const W = Math.min(2048, Math.round(218 * L.w)), H = Math.round(W * L.d / L.w), k = W / L.w / 218, u = W / L.w;
    return canvasTex(W, H, (g, w, h) => {
      THEMES[room](g, w, h, u);
      const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.65);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.16)');
      g.fillStyle = vig; g.fillRect(0, 0, w, h);
      const ink = room === 'papua' ? 'rgba(40,70,100,.5)' : 'rgba(255,246,225,.6)';
      g.strokeStyle = ink; g.lineWidth = 3 * k; const m = 26 * k; g.strokeRect(m, m, w - m * 2, h - m * 2);
      g.lineWidth = 1.2 * k; const m2 = m + 10 * k; g.strokeRect(m2, m2, w - m2 * 2, h - m2 * 2);
      // nama pulau besar di tengah wilayah — semi-transparan (seperti cap/watermark peta),
      // diberi garis tepi tipis agar tetap terbaca di atas ilustrasi apa pun
      const label = this.meta.roomLabel[room].toUpperCase();
      const light = room === 'papua';
      let fs = h * 0.4, sp = fs * 0.12;
      const fit = () => { g.font = `700 ${fs}px ${SERIF}`; return g.measureText(label).width + label.length * sp; };
      while (fit() > w * 0.78 && fs > 40) { fs -= 4; sp = fs * 0.12; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save();
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, fs * 0.05);
      g.strokeStyle = light ? 'rgba(255,255,255,.4)' : 'rgba(10,14,22,.2)';
      if ('letterSpacing' in g) g.letterSpacing = `${sp}px`;
      g.strokeText(label, w / 2 + sp / 2, h / 2);
      g.fillStyle = light ? 'rgba(30,52,80,.22)' : 'rgba(255,248,232,.26)';
      g.fillText(label, w / 2 + sp / 2, h / 2);
      g.restore();
    });
  }

  buildCompass(x, z) {
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.translate(w / 2, h / 2);
      g.strokeStyle = 'rgba(214,180,110,.85)'; g.fillStyle = 'rgba(214,180,110,.85)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, 0, 88, 0, Math.PI * 2); g.lineWidth = 1; g.stroke();
      for (let i = 0; i < 8; i++) {
        const long = i % 2 === 0, a = i * Math.PI / 4, r = long ? 96 : 58;
        g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -r); g.lineTo(9, 0); g.lineTo(-9, 0); g.closePath();
        g.globalAlpha = long ? 0.95 : 0.6; g.fill(); g.restore();
      }
      g.globalAlpha = 1; g.font = `700 30px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('U', 0, -116 + 6);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, SEA_Y + 0.008, z); this.scene.add(m);
  }

  buildLandmark(kind, px, pz) {
    const g = new THREE.Group(), M = this.shared.brass;
    const add = (geo, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, M); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
    if (kind === 'monas') { // Monumen Nasional, Jakarta
      add(new THREE.BoxGeometry(0.62, 0.1, 0.62), 0, 0.05, 0);
      add(new THREE.BoxGeometry(0.4, 0.14, 0.4), 0, 0.17, 0);
      add(new THREE.CylinderGeometry(0.05, 0.11, 0.95, 4), 0, 0.715, 0, Math.PI / 4);
      add(new THREE.CylinderGeometry(0.1, 0.05, 0.08, 12), 0, 1.22, 0);
      add(new THREE.ConeGeometry(0.06, 0.18, 10), 0, 1.35, 0);              // lidah api emas
    } else if (kind === 'gadang') { // Rumah Gadang, Sumatera Barat
      add(new THREE.BoxGeometry(0.8, 0.3, 0.42), 0, 0.27, 0);
      for (const x of [-0.32, 0, 0.32]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), x, 0.06, 0.15);
      add(new THREE.BoxGeometry(0.86, 0.06, 0.5), 0, 0.45, 0);
      for (const [x, tilt, hgt] of [[-0.42, 0.9, 0.42], [-0.2, 0.45, 0.36], [0.2, -0.45, 0.36], [0.42, -0.9, 0.42]]) { // gonjong
        const m = add(new THREE.ConeGeometry(0.1, hgt, 8), x, 0.6, 0); m.rotation.z = tilt;
      }
    } else if (kind === 'tugu') { // Tugu Khatulistiwa, Pontianak
      add(new THREE.BoxGeometry(0.5, 0.08, 0.5), 0, 0.04, 0);
      for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) add(new THREE.BoxGeometry(0.05, 0.62, 0.05), x, 0.39, z);
      const ring = add(new THREE.TorusGeometry(0.2, 0.018, 8, 28), 0, 0.92, 0); ring.rotation.x = 0.4;
      add(new THREE.SphereGeometry(0.1, 14, 10), 0, 0.92, 0);
      const arrow = add(new THREE.ConeGeometry(0.035, 0.5, 6), 0.0, 0.92, 0); arrow.rotation.z = Math.PI / 2;
    } else if (kind === 'tongkonan') { // Tongkonan, Toraja
      for (const [x, z] of [[-0.25, -0.1], [0.25, -0.1], [-0.25, 0.1], [0.25, 0.1]]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), x, 0.1, z);
      add(new THREE.BoxGeometry(0.62, 0.22, 0.3), 0, 0.31, 0);
      const roof = new THREE.Group(); roof.position.y = 0.44; g.add(roof); // atap perahu melengkung ke atas
      for (let i = -4; i <= 4; i++) { const t = i / 4, m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.46), M); m.position.set(t * 0.5, 0.05 + t * t * 0.32, 0); m.rotation.z = -t * 0.55; m.castShadow = true; roof.add(m); }
    } else if (kind === 'honai') { // Honai, rumah bulat Papua
      add(new THREE.CylinderGeometry(0.32, 0.34, 0.28, 18), 0, 0.14, 0);
      const dome = add(new THREE.SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.26, 0); dome.scale.y = 0.95;
      add(new THREE.BoxGeometry(0.12, 0.18, 0.04), 0, 0.09, 0.33);
    } else if (kind === 'tower') { // menara besi bergaya Jawa
      add(new THREE.CylinderGeometry(0.16, 0.36, 0.42, 4, 1, true), 0, 0.21, 0, Math.PI / 4);
      add(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0, 0.43, 0, 0);
      add(new THREE.CylinderGeometry(0.07, 0.16, 0.5, 4, 1, true), 0, 0.7, 0, Math.PI / 4);
      add(new THREE.BoxGeometry(0.2, 0.03, 0.2), 0, 0.95, 0);
      add(new THREE.CylinderGeometry(0.015, 0.07, 0.38, 4), 0, 1.15, 0, Math.PI / 4);
    } else if (kind === 'pagoda') {
      let y = 0;
      [[0.42, 0.22], [0.33, 0.2], [0.25, 0.18]].forEach(([r, hgt]) => {
        add(new THREE.BoxGeometry(r * 1.1, hgt, r * 1.1), 0, y + hgt / 2, 0);
        add(new THREE.CylinderGeometry(0.02, r * 1.05, 0.14, 4), 0, y + hgt + 0.06, 0, Math.PI / 4);
        y += hgt + 0.1;
      });
      add(new THREE.CylinderGeometry(0.012, 0.03, 0.28, 8), 0, y + 0.12, 0);
    } else if (kind === 'pyramids') {
      add(new THREE.ConeGeometry(0.5, 0.62, 4), -0.35, 0.31, 0, Math.PI / 4);
      add(new THREE.ConeGeometry(0.36, 0.45, 4), 0.38, 0.225, 0.12, Math.PI / 4);
      add(new THREE.ConeGeometry(0.22, 0.28, 4), 0.8, 0.14, -0.05, Math.PI / 4);
    } else if (kind === 'city') { // gedung pencakar langit
      [[-0.24, 0.12, 0.2, 0.75], [0.0, -0.08, 0.22, 1.05], [0.24, 0.12, 0.18, 0.6], [0.06, 0.25, 0.16, 0.42]].forEach(([x, z, s, hgt]) => add(new THREE.BoxGeometry(s, hgt, s), x, hgt / 2, z));
      add(new THREE.CylinderGeometry(0.008, 0.03, 0.3, 6), 0, 1.2, -0.08);
    } else { // gunung es Kalimantan
      const ice = new THREE.MeshStandardMaterial({ color: '#dfeef8', roughness: 0.25, metalness: 0.05, flatShading: true });
      [[0, 0, 0.42, 0.85], [0.42, 0.15, 0.28, 0.55], [-0.36, 0.18, 0.24, 0.45]].forEach(([x, z, r, hgt]) => {
        const m = new THREE.Mesh(new THREE.ConeGeometry(r, hgt, 6, 2), ice);
        m.position.set(x, hgt / 2, z); m.rotation.y = Math.random() * 3; m.castShadow = true; g.add(m);
      });
    }
    g.position.set(px, FLOOR_Y, pz);
    this.scene.add(g);
  }

  buildBridge(b) {
    // setiap pasangan pulau punya jembatan sendiri — tetap modern & minimalis.
    // pelat ambang di kedua ujung berwarna pulau yang dituju, agar arah mudah dibaca.
    const g = new THREE.Group();
    const len = GAP + 0.5, wid = 0.92, y = FLOOR_Y - 0.02;
    const key = [b.a, b.b].sort().join('-');
    const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
    const mesh = (geo, m, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) => { const x = new THREE.Mesh(geo, m); x.position.set(px, py, pz); x.rotation.set(rx, ry, rz); x.castShadow = true; x.receiveShadow = true; g.add(x); return x; };
    const RB = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, r);
    let deckMat, railMat;
    const strips = (mat, inset = 0.1, h = 0.055) => { for (const k of [-1, 1]) mesh(RB(len - 0.08, 0.028, 0.07, 0.012), mat, 0, y + h, k * (wid / 2 - inset)); };

    if (key === 'kalimantan-sumatera') {            // ES: dek kaca beku, strip biru es
      deckMat = new THREE.MeshPhysicalMaterial({ color: '#d6efff', roughness: 0.08, transmission: 0.35, thickness: 0.2, clearcoat: 1, emissive: '#22c55e', emissiveIntensity: 0 });
      railMat = M('#e0f6ff', { emissive: '#7dd3fc', emissiveIntensity: 0.6 });
      mesh(RB(len, 0.1, wid, 0.05), deckMat, 0, y);
      strips(railMat);
      for (const t of [-0.32, 0, 0.32]) for (const k of [-1, 1]) mesh(new THREE.OctahedronGeometry(0.06), railMat, t * len, y + 0.12, k * (wid / 2 - 0.02));
    } else if (key === 'papua-sulawesi') {            // JATI: bilah kayu modern terpisah + strip emas
      deckMat = M('#b07a45', { roughness: 0.6, emissive: '#22c55e', emissiveIntensity: 0 });
      railMat = M('#f5e2b0', { emissive: '#f2cf7a', emissiveIntensity: 0.6 });
      const n = 6; for (let i = 0; i < n; i++) mesh(RB(len, 0.07, wid / n - 0.035, 0.02), deckMat, 0, y, -wid / 2 + (i + 0.5) * wid / n);
      mesh(RB(len - 0.2, 0.05, wid - 0.1, 0.02), M('#2b2f36'), 0, y - 0.06, 0);
      strips(railMat, 0.03, 0.045);
    } else if (key === 'jawa-sumatera') {          // GANTUNG: dek grafit, dua pilon ramping & kabel
      deckMat = M('#363d4a', { metalness: 0.2, emissive: '#22c55e', emissiveIntensity: 0 });
      railMat = M('#f5e2b0', { emissive: '#f2cf7a', emissiveIntensity: 0.6 });
      mesh(RB(len, 0.09, wid, 0.04), deckMat, 0, y);
      strips(railMat);
      const cable = M('#e9e4d8', { metalness: 0.5, roughness: 0.3 });
      for (const k of [-1, 1]) {
        for (const e of [-1, 1]) mesh(RB(0.07, 0.75, 0.07, 0.02), cable, e * (len / 2 - 0.06), y + 0.4, k * (wid / 2 - 0.02));
        const c = new THREE.CatmullRomCurve3([-0.5, -0.25, 0, 0.25, 0.5].map(t => new THREE.Vector3(t * (len - 0.12), y + 0.25 + Math.abs(t) * 1.0, k * (wid / 2 - 0.02))));
        mesh(new THREE.TubeGeometry(c, 20, 0.014, 6), cable);
      }
    } else if (key === 'jawa-kalimantan') {        // LENGKUNG: dek putih dengan busur di bawahnya
      deckMat = M('#f1efe9', { emissive: '#22c55e', emissiveIntensity: 0 });
      railMat = M('#e9eef2', { emissive: '#bfe3ff', emissiveIntensity: 0.6 });
      mesh(RB(len, 0.08, wid, 0.04), deckMat, 0, y);
      strips(railMat);
      for (const k of [-1, 1]) mesh(new THREE.TorusGeometry(len / 2 - 0.05, 0.035, 8, 32, Math.PI), M('#f1efe9'), 0, y - 0.04, k * (wid / 2 - 0.12), Math.PI, 0, 0);
    } else if (key === 'jawa-sulawesi') {           // TERAKOTA: dek tanah liat + tembok pembatas rendah
      deckMat = M('#c46a3c', { roughness: 0.75, emissive: '#22c55e', emissiveIntensity: 0 });
      railMat = M('#f5e2b0', { emissive: '#f2cf7a', emissiveIntensity: 0.6 });
      mesh(RB(len, 0.09, wid, 0.04), deckMat, 0, y);
      for (const k of [-1, 1]) mesh(RB(len, 0.14, 0.09, 0.03), M('#e4d2b8', { roughness: 0.8 }), 0, y + 0.1, k * (wid / 2 - 0.045));
      mesh(RB(len - 0.1, 0.02, 0.06, 0.01), railMat, 0, y + 0.05, 0);
    } else {                                       // papua-jawa — JEMBATAN BULAN: lengkung merah lak, minimal
      deckMat = M('#b3262e', { roughness: 0.35, emissive: '#22c55e', emissiveIntensity: 0 });
      railMat = M('#f5e2b0', { emissive: '#f2cf7a', emissiveIntensity: 0.6 });
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        mesh(RB(len / n + 0.02, 0.08, wid, 0.02), deckMat, t * len, y + Math.cos(t * Math.PI) * 0.16, 0, 0, 0, -Math.sin(t * Math.PI) * 0.45);
      }
      for (const k of [-1, 1]) {
        const c = new THREE.CatmullRomCurve3([-0.5, -0.25, 0, 0.25, 0.5].map(t => new THREE.Vector3(t * len, y + 0.2 + Math.cos(t * Math.PI) * 0.16, k * (wid / 2 - 0.05))));
        mesh(new THREE.TubeGeometry(c, 24, 0.022, 8), railMat);
      }
    }
    // pelat ambang berwarna pulau di kedua ujung
    const ends = b.axis === 'x' ? [[b.a, -1], [b.b, 1]] : [[b.a, -1], [b.b, 1]];
    for (const [room, e] of ends) {
      const L = LAYOUT[room];
      const towards = b.axis === 'x' ? Math.sign(L.x - b.x) : Math.sign(L.z - b.z);
      mesh(RB(0.12, 0.03, wid - 0.1, 0.012), M(FELT[room], { emissive: FELT[room], emissiveIntensity: 0.25 }), towards * (len / 2 - 0.06), y + 0.05 + (key === 'jawa-papua' ? 0.0 : 0), 0);
    }
    g.position.set(b.x, 0, b.z);
    if (b.axis === 'z') g.rotation.y = -Math.PI / 2;
    this.scene.add(g);
    return { ...b, deckMat, railMat, railBase: railMat.emissive.getHex(), railIdle: railMat.emissiveIntensity };
  }

  // foto profil: dipusatkan di portraits.js (cache bersama untuk semua layar)
  portrait(id) { return getPortrait(id); }

  // Dadu prisma segi lima: 5 sisi panjang = 5 pulau, 2 ujung segi lima = hitam.
  buildDie() {
    const R = 0.59, H = 0.95; // apotema (R·cos36°) ≈ H/2 → tinggi diam sama, rebah maupun berdiri
    const P = 256, PH = 360;  // ukuran satu panel sisi di atlas
    const sideTex = canvasTex(P * 5, PH, (g) => {
      DIE_SIDES.forEach((f, i) => {
        g.save(); g.translate(i * P, 0);
        g.fillStyle = '#efe5d0'; g.fillRect(0, 0, P, PH);
        g.fillStyle = FELT[f]; g.beginPath(); g.roundRect(20, 20, P - 40, PH - 40, 26); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4;
        g.beginPath(); g.roundRect(32, 32, P - 64, PH - 64, 18); g.stroke();
        // teks memanjang searah sisi agar besar & terbaca saat dadu rebah
        const txt = this.meta.roomLabel[f].toUpperCase();
        g.translate(P / 2, PH / 2); g.rotate(-Math.PI / 2);
        g.fillStyle = INK_ON[f] || CREAM; g.textAlign = 'center'; g.textBaseline = 'middle';
        let size = 62; g.font = `700 ${size}px ${SERIF}`;
        while (g.measureText(txt).width > PH - 90 && size > 24) { size -= 2; g.font = `700 ${size}px ${SERIF}`; }
        g.fillText(txt, 0, 0);
        g.restore();
      });
    });
    const capTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#efe5d0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#15171c'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = BRASS; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 22, 0, Math.PI * 2); g.stroke();
      drawMask(g, w / 2, h / 2, 64, BRASS);
    });
    const phys = map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    const capMat = phys(capTex);
    this.die = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 5, 1, false), [phys(sideTex), capMat, capMat]);
    this.die.castShadow = true;
    this.die.position.copy(DIE_REST);
    this.die.quaternion.copy(this.faceUpQuat('sulawesi', 0.4));
    this.scene.add(this.die);
  }
  // Putar dadu agar sisi `face` menghadap ke atas. Untuk sisi pulau, yaw dihitung supaya
  // tulisan menghadap kamera (terbaca kiri→kanan, tidak terbalik), plus sedikit acak agar alami.
  faceUpQuat(face, yaw = null) {
    const up = new THREE.Vector3(0, 1, 0);
    if (face === 'hitam') {
      const n = new THREE.Vector3(0, Math.random() < 0.5 ? 1 : -1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(n, up);
      return new THREE.Quaternion().setFromAxisAngle(up, yaw ?? Math.random() * Math.PI * 2).multiply(q);
    }
    const a = (DIE_SIDES.indexOf(face) + 0.5) * (Math.PI * 2 / 5);
    const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const q = new THREE.Quaternion().setFromUnitVectors(n, up);
    if (yaw == null) {
      const textUp = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a)).applyQuaternion(q); // arah "atas" huruf
      yaw = Math.PI - Math.atan2(textUp.x, textUp.z) + (Math.random() - 0.5) * 0.5;
    }
    return new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(q);
  }

  buildFigures() {
    const ringGeo = new THREE.RingGeometry(0.33, 0.42, 40);
    const starTex = canvasTex(64, 64, (x, w, h) => { // penanda karaktermu: belah ketupat kuningan
      x.translate(w / 2, h / 2); x.rotate(Math.PI / 4); x.fillStyle = '#f2cf7a'; x.strokeStyle = '#5a3d10'; x.lineWidth = 4;
      x.fillRect(-16, -16, 32, 32); x.strokeRect(-16, -16, 32, 32);
    });
    this.meta.characters.forEach((c, i) => {
      const g = new THREE.Group();
      const { inner, body, pickables } = buildFigure(c, i);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#f2cf7a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; ring.visible = false;
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, depthTest: false }));
      star.scale.set(0.24, 0.24, 1); star.position.y = 1.78; star.visible = false; star.renderOrder = 5;
      const tag = nameTag(c.name); tag.position.y = 1.62;
      g.add(inner, ring, star, tag); g.visible = false; g.scale.setScalar(FIG_S);
      this.scene.add(g);
      this.figures.set(c.id, { group: g, inner, body, pickables, ring, star, tag, room: null, slot: null, lift: 0, removing: false });
    });
    this.buildMeMarker();
  }

  // Penanda "INI KAMU": pilar cahaya emas + cincin berdenyut + gelombang + label besar.
  // Hanya tampil di layarmu sendiri, selama kartu identitas dibuka.
  buildMeMarker() {
    const m = new THREE.Group(); m.visible = false;
    const beamTex = canvasTex(4, 128, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,224,150,0)'); gr.addColorStop(0.55, 'rgba(255,214,120,.35)'); gr.addColorStop(1, 'rgba(255,214,120,.9)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.62, 4.6, 40, 1, true),
      new THREE.MeshBasicMaterial({ map: beamTex, color: '#ffd889', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 2.3; beam.renderOrder = 4;
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 56), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshBasicMaterial({ color: '#ffcf6b', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.025;
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.61, 56), ringMat.clone());
    wave.rotation.x = -Math.PI / 2; wave.position.y = 0.035;
    // label tetap terbaca di layar (ukuran tidak mengecil saat kamera menjauh)
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
    label.material.map.colorSpace = THREE.SRGBColorSpace;
    label.scale.set(0.2, 0.075, 1); label.renderOrder = 9; label.center.set(0.5, 0);
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshBasicMaterial({ color: '#ffd27a', depthTest: false, transparent: true }));
    pin.rotation.x = Math.PI; pin.renderOrder = 8;
    m.add(beam, glow, ring, wave);
    this.scene.add(m, label, pin);
    label.visible = pin.visible = false;
    this.me = { group: m, beam, ring, glow, wave, label, pin, canvas: c, labelFor: null };
  }
  drawMeLabel(name) {
    const { canvas: c, label } = this.me, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(11,14,19,.94)'; g.strokeStyle = '#f2cf7a'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(14, 10, 484, 150, 40); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(236, 158); g.lineTo(256, 186); g.lineTo(276, 158); g.closePath(); g.fillStyle = '#f2cf7a'; g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f2cf7a'; g.font = '800 64px Inter, system-ui, sans-serif'; g.fillText('INI KAMU', 256, 66);
    g.fillStyle = '#f3ead7'; g.font = '600 38px Inter, system-ui, sans-serif'; g.fillText(name, 256, 124);
    label.material.map.needsUpdate = true;
  }

  // Kamera meluncur ke karaktermu, menahan sebentar, lalu kembali.
  spotlightMine(id) {
    const f = this.figures.get(id);
    if (!f || !f.group.visible || REDUCED) return;
    if (this.rolling || this.cineF || (this.drag && this.drag.started)) return;
    if (!this.camMode) this.camSaved = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.camFrom = null; this.camMode = 'spot'; this.spotF = f; this.spotT = 0; this.controls.enabled = false;
    this.dirty = true;
  }

  // ================= kamera =================
  resize(reset = false) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.dirty = true;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (reset || !this.userMoved) this.resetCamera();
  }
  resetCamera() {
    const a = this.camera.aspect, vf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hf = Math.atan(Math.tan(vf) * a);
    // di layar tegak, bingkai kayu boleh terpotong, tapi pulau (dan bidak di tepinya) harus utuh terlihat
    const halfW = a < 0.8 ? SEA_W / 2 - 0.15 : SEA_W / 2 + 0.6, halfD = SEA_D / 2 + 1.6;
    // kamera agak miring agar wajah karakter terlihat, bukan hanya topinya
    const polar = a < 0.8 ? 0.6 : 0.8;
    const d = Math.max(halfW / Math.tan(hf), (halfD * Math.cos(polar) + 1.6) / Math.tan(vf)) * 1.06;
    const target = new THREE.Vector3(0, 0.3, 1.3);
    this.camera.position.set(0, Math.cos(polar) * d, Math.sin(polar) * d).add(target);
    // kabut mengikuti jarak kamera — kalau tidak, papan ikut gelap saat kamera jauh (layar HP tegak)
    this.scene.fog.near = d + 6; this.scene.fog.far = d + 32;
    this.controls.maxDistance = Math.max(40, d * 1.6);
    this.controls.target.copy(target); this.controls.update();
    this.userMoved = false; this.dirty = true;
    if (!this._cl) { this._cl = true; this.controls.addEventListener('start', () => { this.userMoved = true; }); }
  }
  screenPos(obj) { // dipakai untuk tes otomatis
    if (typeof obj === 'string' && obj.startsWith('room:')) obj = obj.slice(5);
    const v = (typeof obj === 'object' ? new THREE.Vector3(obj.x, FLOOR_Y, obj.z) : typeof obj === 'string' && this.figures.has(obj) ? this.figures.get(obj).group.position.clone().add(new THREE.Vector3(0, 0.5, 0))
      : new THREE.Vector3(LAYOUT[obj].x, FLOOR_Y, LAYOUT[obj].z + 0.2)).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  // ================= input: tap & tahan-geser =================
  setupInput(el) {
    let down = null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (this.camMode === 'spot') { this.camMode = 'return'; this.camT = 0; this.camDur = 0.5; this.spotF = null; } // sentuhan menghentikan sorotan
      if (this.rolling || this.drag) return;
      const hit = this.pick(e);
      if (hit && hit.charId && (this.ui.movable || []).includes(hit.charId)) {
        e.stopImmediatePropagation(); e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const grab = this.floorPoint(e), fp = this.figures.get(hit.charId).group.position;
        const offset = grab ? new THREE.Vector3(fp.x - grab.x, 0, fp.z - grab.z) : new THREE.Vector3();
        if (offset.length() > 3) offset.setLength(3);
        this.drag = { id: hit.charId, pointerId: e.pointerId, x: e.clientX, y: e.clientY, started: false, pos: null, hover: null, offset };
        if (this.controls) this.controls.enabled = false;
        this.h.onDragStart && this.h.onDragStart(hit.charId);
        this.dirty = true;
      }
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag && e.pointerType === 'mouse') { // kursor tangan di atas objek yang bisa diklik
        const n = performance.now(); if (n - (this._hoverT || 0) < 70) return; this._hoverT = n;
        const ui = this.ui || {}; let can = false;
        this.setPointer(e);
        if (ui.canRoll && this.raycaster.intersectObject(this.die, false).length) can = true;
        else { const h = this.pick(e); if (h && h.charId) can = (ui.movable || []).includes(h.charId) || (ui.targets || []).includes(h.charId); else if (h && h.room) can = (ui.dests || []).includes(h.room); }
        if (can !== this._hoverCan) { this._hoverCan = can; el.style.cursor = can ? 'pointer' : ''; if (can) this.h.onHover && this.h.onHover(); }
        return;
      }
      const d = this.drag; if (!d || e.pointerId !== d.pointerId) return;
      if (!d.started && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.started = true;
      if (!d.started) return;
      const p = this.floorPoint(e); if (!p) return;
      p.add(d.offset);                                   // bidak tetap di bawah jari, walau dipegang di kepalanya
      d.pos = p; d.hover = this.roomAt(p.x, p.z);
      this.dirty = true;
    });
    const end = e => {
      const d = this.drag;
      if (d && e.pointerId === d.pointerId) {
        this.drag = null;
        if (this.controls) this.controls.enabled = true;
        const f = this.figures.get(d.id);
        if (d.started) {
          f.dragging = false;
          const ok = d.hover && (this.ui.dests || []).includes(d.hover);
          if (ok) { // letakkan tepat di titik lepas; server bisa menggeser sedikit bila bertabrakan
            f.group.position.set(d.pos.x, FLOOR_Y, d.pos.z); f.dropped = true;
            this.h.onDrop(d.id, d.hover, { x: d.pos.x, z: d.pos.z });
          } else { if (f.home) this.hop(f, f.group.position.clone(), f.home.clone()); this.h.onDragCancel && this.h.onDragCancel(d.id, d.hover); }
        }
        down = null; this.dirty = true;
        return;
      }
      if (down && e.type === 'pointerup' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 500) this.tap(e);
      down = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  setPointer(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }
  pick(e) {
    this.setPointer(e);
    const objs = [];
    for (const f of this.figures.values()) if (f.group.visible && !f.removing) objs.push(...f.pickables);
    for (const r of Object.values(this.roomMeshes)) objs.push(r.floor);
    const hit = this.raycaster.intersectObjects(objs, false)[0];
    return hit ? hit.object.userData : null;
  }
  floorPoint(e) {
    this.setPointer(e);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y), p) ? p : null;
  }
  roomAt(x, z) {
    for (const [room, L] of Object.entries(LAYOUT)) if (Math.abs(x - L.x) <= L.w / 2 + 0.2 && Math.abs(z - L.z) <= L.d / 2 + 0.2) return room;
    return null;
  }
  // Ketuk bidak mana pun → label nama profesinya muncul di atas kepala selama ±2,5 detik.
  peekFigure(id, note) {
    if (!this.figures.has(id)) return;
    this.peek = { id, until: performance.now() + 3000 };
    if (!this.peekEl) { this.peekEl = document.createElement('div'); this.peekEl.className = 'peek-label'; this.peekEl.setAttribute('role', 'status'); this.container.append(this.peekEl); }
    const c = this.meta.characters.find(x => x.id === id);
    this.peekEl.textContent = c ? c.name : id;
    if (note) { const n = document.createElement('small'); n.className = 'peek-note'; n.textContent = note; this.peekEl.append(n); }
    this.peekEl.classList.remove('show'); void this.peekEl.offsetWidth; this.peekEl.classList.add('show');
    this.dirty = true;
  }
  // label DOM mengikuti kepala bidak (tajam di semua layar, tidak tertutup objek 3D)
  updatePeekLabel() {
    const el = this.peekEl; if (!el) return;
    const f = this.peek && this.figures.get(this.peek.id);
    if (!f || !f.group.visible) { el.classList.remove('show'); return; }
    const v = f.group.position.clone(); v.y += (2.02 + (f.lift || 0)) * FIG_S; v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect(), c = this.container.getBoundingClientRect();
    const x = r.left - c.left + ((v.x + 1) / 2) * r.width, y = r.top - c.top + ((1 - v.y) / 2) * r.height;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  tap(e) {
    this.setPointer(e);
    if (this.ui.canRoll && this.raycaster.intersectObject(this.die, false).length) { this.h.onDiceTap && this.h.onDiceTap(); return; }
    const hit = this.pick(e);
    if (!hit) return;
    if (hit.charId) this.h.onFigure(hit.charId, this.figures.get(hit.charId).room);
    else if (hit.room) this.h.onRoom(hit.room);
  }

  // ================= state =================
  update(state, ui) {
    this.ui = ui; this.dirty = true;
    if (this.lastRollId === null) {
      this.lastRollId = state.rollId; this.lastEventId = state.lastEvent && state.lastEvent.id;
      if (state.die) this.die.quaternion.copy(this.faceUpQuat(state.die));
      return this.applyFigures(state, true);
    }
    if (state.rollId !== this.lastRollId && state.die) {
      this.lastRollId = state.rollId;
      this.pending = state;
      this.throwDie(state.die, () => { const s = this.pending; this.pending = null; if (s) this.applyFigures(s); });
      return;
    }
    if (this.rolling) { this.pending = state; return; }
    this.applyFigures(state);
  }
  setUI(ui) { this.ui = ui; this.dirty = true; }

  applyFigures(state, instant = false) {
    this.state = state;
    const ev = state.lastEvent && state.lastEvent.id !== this.lastEventId ? state.lastEvent : null;
    this.lastEventId = state.lastEvent && state.lastEvent.id;
    for (const [id, f] of this.figures) {
      if (!(id in state.figures) && f.room && !f.removing) {
        f.home = null;
        if (instant || state.phase === 'LOBBY') { f.group.visible = false; f.room = null; continue; }
        this.removeAnim(f, ev && ev.charId === id ? ev.type : 'left');
      }
    }
    const spots = state.spots || {};
    for (const [id, room] of Object.entries(state.figures)) {
      const f = this.figures.get(id);
      const L = LAYOUT[room], sp = spots[id] || { x: L.x, z: L.z };
      const target = new THREE.Vector3(sp.x, FLOOR_Y, sp.z);
      if (f.removing) { this.cancelTweens(f); f.removing = false; }
      if (f.room === room && f.home && f.home.distanceTo(target) < 0.01) continue;
      if (this.drag && this.drag.id === id) { this.drag = null; f.dragging = false; if (this.controls) this.controls.enabled = true; }
      const from = f.group.position.clone(), wasOn = !!f.room, sameRoom = f.room === room;
      f.room = room; f.home = target;
      f.group.visible = true; f.inner.rotation.set(0, 0, 0); f.group.scale.setScalar(FIG_S);
      if (instant || REDUCED) { f.group.position.copy(target); f.dropped = false; continue; }
      if (!wasOn) { // jatuh dari atas saat pesta dimulai
        const delay = Math.random() * 0.5;
        f.group.position.set(target.x, target.y + 6, target.z);
        this.tween(0.9 + delay, t => { const k = Math.max(0, (t * (0.9 + delay) - delay) / 0.9); f.group.position.y = target.y + 6 * (1 - k * k) * (k < 1 ? 1 : 0); },
          () => f.group.position.copy(target), f);
        continue;
      }
      if (sameRoom || f.dropped) { this.slide(f, from, target); f.dropped = false; continue; } // koreksi kecil: geser halus
      if (ev && ev.type === 'move' && ev.charId === id && ev.by !== this.myId && !REDUCED) { this.cinematic(f, from, target, ev); continue; } // pemain lain melihat sinematik
      this.hop(f, from, target);
    }
  }
  slide(f, a, b) {
    this.cancelTweens(f);
    this.tween(0.28, t => f.group.position.lerpVectors(a, b, easeOutCubic(t)), () => f.group.position.copy(b), f);
  }

  // ================= animasi =================
  cancelTweens(f) { for (const t of this.tweens) if (t.f === f) t.dead = true; }
  tween(dur, fn, done, f) { this.tweens.push({ t: 0, dur, fn, done, f }); }
  // seluruh meja bergetar sebentar (saat topeng terbongkar). Menggeser scene, bukan kamera, agar kontrol orbit tidak bergeser.
  shake(strength = 0.1, dur = 0.5) {
    if (REDUCED) return;
    this.tween(dur, t => { const k = strength * Math.pow(1 - t, 2); this.scene.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k * 0.4, (Math.random() - 0.5) * k); },
      () => this.scene.position.set(0, 0, 0), null);
  }
  // dadu hitam: semua tamu gemetar & melompat kecil, kecuali yang sedang dipindah/dihapus
  panic() {
    if (REDUCED) return;
    for (const f of this.figures.values()) {
      if (!f.group.visible || f.removing || f.dragging) continue;
      const delay = Math.random() * 0.25, dur = 0.9 + delay, base = f.inner.position.y;
      this.tween(dur, t => {
        const k = Math.max(0, (t * dur - delay) / 0.9);
        f.inner.rotation.z = Math.sin(k * Math.PI * 9) * 0.16 * (1 - k);
        f.inner.position.y = base + Math.abs(Math.sin(k * Math.PI * 2)) * 0.35 * (1 - k);
      }, () => { f.inner.rotation.z = 0; f.inner.position.y = base; }, null);
    }
  }
  hop(f, a, b) {
    const h = 1.0 + a.distanceTo(b) * 0.12;
    this.tween(0.7, t => {
      const e = easeInOut(t);
      f.group.position.lerpVectors(a, b, e);
      f.group.position.y = a.y + Math.sin(Math.PI * t) * h;
      f.inner.rotation.y = e * Math.PI * 2;
    }, () => { f.group.position.copy(b); f.inner.rotation.y = 0; }, f);
  }
  burst(pos, big) { // konfeti + gelombang cahaya di lantai
    if (REDUCED) return;
    const n = big ? 46 : 22, colors = big ? ['#f2cf7a', '#ef4444', '#ffffff', '#c9a14a', '#7dd3fc'] : ['#e9e4d8', '#f2cf7a', '#a7a093'];
    const geo = new THREE.BoxGeometry(0.07, 0.07, 0.012);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, side: THREE.DoubleSide }));
      m.position.set(pos.x, FLOOR_Y + 0.9, pos.z);
      const a = Math.random() * Math.PI * 2, sp = (big ? 2.6 : 1.6) * (0.5 + Math.random());
      parts.push({ m, v: new THREE.Vector3(Math.cos(a) * sp * 0.6, 2 + Math.random() * (big ? 3 : 1.8), Math.sin(a) * sp * 0.6), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9) });
      this.scene.add(m);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 48), new THREE.MeshBasicMaterial({ color: big ? '#f2cf7a' : '#e9e4d8', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, FLOOR_Y + 0.02, pos.z); this.scene.add(ring);
    let last = 0;
    this.tween(1.4, t => {
      const dt = t - last; last = t; const sec = dt * 1.4;
      for (const p of parts) {
        p.v.y -= 7 * sec; p.m.position.addScaledVector(p.v, sec);
        if (p.m.position.y < FLOOR_Y + 0.02) { p.m.position.y = FLOOR_Y + 0.02; p.v.multiplyScalar(0.3); }
        p.m.rotation.x += p.r.x * sec; p.m.rotation.y += p.r.y * sec;
        p.m.material.opacity = 1 - Math.max(0, (t - 0.6) / 0.4);
      }
      const k = easeOutCubic(Math.min(1, t / 0.7));
      ring.scale.setScalar(1 + k * (big ? 9 : 5)); ring.material.opacity = 0.9 * (1 - k);
    }, () => { for (const p of parts) { this.scene.remove(p.m); p.m.material.dispose(); } geo.dispose(); this.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); });
  }
  removeAnim(f, type) {
    f.removing = true; f.room = null;
    const start = f.group.position.clone();
    if (type !== 'left') this.burst(start, type === 'eliminated');
    if (type === 'left') {
      this.tween(1.1, t => { f.group.position.y = start.y + easeOutCubic(t) * 3; f.group.scale.setScalar(FIG_S * (1 - t)); f.inner.rotation.y = t * 6; },
        () => { f.group.visible = false; f.removing = false; }, f);
    } else {
      this.tween(1.4, t => {
        const a = Math.min(1, t / 0.45), b = Math.max(0, (t - 0.55) / 0.45);
        f.inner.rotation.z = easeOutCubic(a) * Math.PI / 2;
        f.group.position.y = start.y - b * 0.8;
        f.group.scale.setScalar(FIG_S * (1 - b * 0.9));
      }, () => { f.group.visible = false; f.removing = false; f.inner.rotation.set(0, 0, 0); }, f);
    }
  }
  throwDie(face, done) {
    if (this.rolling) { // lemparan beruntun (mis. pemain offline): selesaikan lemparan lama dulu
      const old = this.tweens.find(t => t.f === this.die && !t.dead);
      if (old) { old.dead = true; old.fn(1); old.done && old.done(); }
    }
    this.rolling = true; this.h.onRollStart && this.h.onRollStart();
    const startPos = new THREE.Vector3(rand(-4, -1), 4.5, DIE_REST.z + 3);
    const end = DIE_REST.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.25, 0.25)));
    const qEnd = this.faceUpQuat(face);
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.3, Math.random() - 0.5).normalize();
    const spins = Math.PI * 2 * (REDUCED ? 1 : 3 + Math.random() * 1.5);
    let bounced = 0;
    this.tween(REDUCED ? 0.6 : 1.4, t => {
      const e = easeOutCubic(t);
      this.die.position.x = THREE.MathUtils.lerp(startPos.x, end.x, e);
      this.die.position.z = THREE.MathUtils.lerp(startPos.z, end.z, e);
      const bounce = Math.abs(Math.cos(Math.PI * 2.5 * t)) * Math.pow(1 - t, 2);
      this.die.position.y = end.y + bounce * (startPos.y - end.y);
      const b = Math.floor(t * 2.5 + 0.5);
      if (b > bounced) { bounced = b; this.h.onDiceBounce && this.h.onDiceBounce(1 - t); }
      this.die.quaternion.copy(qEnd).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, spins * (1 - e)));
    }, () => {
      this.die.position.copy(end); this.die.quaternion.copy(qEnd);
      this.rolling = false; done(); this.h.onRollEnd && this.h.onRollEnd();
    }, this.die);
  }

  // intro: kamera menyapu dari atas-samping ke posisi main saat pesta dimulai
  intro() {
    if (REDUCED) return;
    this.resetCamera();
    const tgt = this.controls.target.clone(), pos = this.camera.position.clone();
    this.camSaved = { pos, target: tgt };
    const off = pos.clone().sub(tgt); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9).multiplyScalar(1.35); off.y *= 1.25;
    this.camera.position.copy(tgt).add(off); this.camera.lookAt(tgt);
    this.camFrom = { pos: this.camera.position.clone(), target: tgt.clone() };
    const far = off.length(); this.scene.fog.near = far + 6; this.scene.fog.far = far + 34; // jangan tertutup kabut saat intro
    this.camMode = 'return'; this.camT = 0; this.camDur = 2.4; this.controls.enabled = false;
  }

  // ================= sinematik pindah bidak (untuk pemain lain) =================
  cinematic(f, a, b, ev) {
    this.cancelTweens(f);
    if (this.cineF && this.cineF !== f) this.finishCinematic(true);
    const br = BRIDGES.find(x => (x.a === ev.from && x.b === ev.to) || (x.b === ev.from && x.a === ev.to));
    const up = FLOOR_Y + 1.0;
    const mid = br ? new THREE.Vector3(br.x, FLOOR_Y + 1.7, br.z) : a.clone().lerp(b, 0.5).setY(FLOOR_Y + 1.9);
    const curve = new THREE.CatmullRomCurve3([a.clone(), new THREE.Vector3(a.x, up, a.z), mid, new THREE.Vector3(b.x, up, b.z), b.clone()], false, 'centripetal');
    f.cine = true; this.cineF = f;
    if (!this.camMode) this.camSaved = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.camFrom = null; this.camMode = 'follow'; this.controls.enabled = false;
    this.h.onCinematicStart && this.h.onCinematicStart(ev);
    const D = 1.5; // sinematik singkat: ±1,5 detik
    this.tween(D, t => {
      let s, squash = 1;
      if (t < 0.12) s = 0.25 * easeOutCubic(t / 0.12);                          // terangkat
      else if (t < 0.88) s = 0.25 + 0.5 * easeInOut((t - 0.12) / 0.76);        // melayang lewat jembatan
      else { const k = (t - 0.88) / 0.12; s = 0.75 + 0.25 * k; squash = 1 - Math.sin(k * Math.PI) * 0.18; } // mendarat
      curve.getPoint(Math.min(1, s), f.group.position);
      f.inner.rotation.y = Math.sin(t * Math.PI * 2) * 0.35;
      f.inner.rotation.z = (t > 0.12 && t < 0.88) ? Math.sin(t * Math.PI) * 0.12 : 0;
      f.inner.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }, () => this.finishCinematic(false), f);
  }
  finishCinematic(skip) {
    const f = this.cineF; if (!f) return;
    if (f.home) f.group.position.copy(f.home); f.inner.rotation.set(0, 0, 0); f.inner.scale.set(1, 1, 1);
    f.cine = false; this.cineF = null;
    this.camMode = 'return'; this.camT = 0;
    if (!skip) this.h.onCinematicLand && this.h.onCinematicLand();
  }
  updateCinematicCamera(dt) {
    if (!this.camMode || !this.camSaved) return false;
    const s = this.camSaved;
    if (this.camMode === 'spot' && this.spotF) {
      this.spotT += dt;
      const fp = this.spotF.group.position;
      const dir = s.pos.clone().sub(s.target).normalize();
      const wantT = new THREE.Vector3(fp.x, FLOOR_Y + 0.7, fp.z);
      const wantP = wantT.clone().add(dir.multiplyScalar(Math.min(8.5, s.pos.distanceTo(s.target) * 0.36)));
      const k = Math.min(1, dt * 5);
      this.controls.target.lerp(wantT, k); this.camera.position.lerp(wantP, k);
      if (this.spotT > 1.9) { this.camMode = 'return'; this.camT = 0; this.camDur = 0.8; this.spotF = null; }
    } else if (this.camMode === 'follow' && this.cineF) {
      const fp = this.cineF.group.position;
      const dir = s.pos.clone().sub(s.target).normalize();
      const wantT = new THREE.Vector3(fp.x, FLOOR_Y + 0.6, fp.z);
      const wantP = wantT.clone().add(dir.multiplyScalar(Math.min(10, s.pos.distanceTo(s.target) * 0.45)));
      const k = Math.min(1, dt * 6);
      this.controls.target.lerp(wantT, k); this.camera.position.lerp(wantP, k);
    } else {
      this.camT = Math.min(1, (this.camT || 0) + dt / (this.camDur || 0.5));
      if (this.camFrom) { // intro: interpolasi langsung dengan easing
        const e = easeInOut(this.camT);
        this.camera.position.lerpVectors(this.camFrom.pos, s.pos, e); this.controls.target.lerpVectors(this.camFrom.target, s.target, e);
      } else { const k = Math.min(1, dt * 7 + this.camT * 0.15); this.controls.target.lerp(s.target, k); this.camera.position.lerp(s.pos, k); }
      if (this.camT >= 1) { this.controls.target.copy(s.target); this.camera.position.copy(s.pos); this.camMode = null; this.camSaved = null; this.camFrom = null; this.camDur = 0.5; this.controls.enabled = true; }
    }
    this.camera.lookAt(this.controls.target);
    const dd = this.camera.position.distanceTo(this.controls.target); // kabut menyesuaikan jarak kamera saat bergerak
    if (this.scene.fog.near < dd + 6) { this.scene.fog.near = dd + 6; this.scene.fog.far = dd + 34; }
    return true;
  }

  frame() {
    const now = performance.now(), dt = Math.min((now - this.lastT) / 1000, 0.1); this.lastT = now; this.elapsed += dt; const time = this.elapsed;
    // iterasi salinan: callback 'done' boleh menambah tween baru tanpa ikut terhapus
    for (const tw of this.tweens.slice()) {
      if (tw.dead) continue;
      tw.t = Math.min(1, tw.t + dt / tw.dur); tw.fn(tw.t);
      if (tw.t >= 1) { tw.dead = true; tw.done && tw.done(); }
    }
    this.tweens = this.tweens.filter(tw => !tw.dead);
    // pengaman: jika animasi sinematik dibatalkan, kembalikan kamera
    if (this.camMode === 'follow' && this.cineF && !this.tweens.some(t => t.f === this.cineF)) this.finishCinematic(true);
    const ui = this.ui || {}, st = this.state;
    const active = st && !this.rolling;
    const movable = new Set(active ? ui.movable || [] : []);
    const targets = new Set(active ? ui.targets || [] : []);
    const dests = new Set(active ? ui.dests || [] : []);
    const drag = this.drag && this.drag.started ? this.drag : null;
    const pulse = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(time * 5);

    if (this.peek && performance.now() > this.peek.until) { this.peek = null; this.dirty = true; if (this.peekEl) this.peekEl.classList.remove('show'); }
    for (const [id, f] of this.figures) {
      if (!f.group.visible || f.removing) continue;
      if (f.cine) { // bidak yang sedang dipindahkan pemain lain: cincin biru berdenyut + label nama
        f.ring.visible = true; f.ring.material.color.set('#7dd3fc'); f.ring.material.opacity = 0.6 + 0.4 * pulse;
        f.tag.visible = true; f.tag.position.y = 1.62; f.body.material.emissiveIntensity = 0.1 + 0.15 * pulse; f.star.visible = false;
        continue;
      }
      if (drag && drag.id === id && drag.pos) {
        f.dragging = true;
        const tgt = new THREE.Vector3(drag.pos.x, FLOOR_Y + 0.9, drag.pos.z);
        f.group.position.lerp(tgt, Math.min(1, dt * 20));
        f.inner.rotation.z = THREE.MathUtils.clamp((tgt.x - f.group.position.x) * -0.6, -0.4, 0.4);
        f.ring.visible = false; f.star.visible = false; f.tag.visible = true;
        continue;
      }
      f.inner.rotation.z = 0;
      const sel = active && (ui.selected === id || ui.killSel === id);
      let lift = 0;
      f.ring.visible = true;
      if (sel) { lift = 0.3; f.ring.material.color.set(ui.killSel === id ? '#ef4444' : '#fff3d6'); f.ring.material.opacity = 1; }
      else if (targets.has(id)) { f.ring.material.color.set('#ef4444'); f.ring.material.opacity = 0.45 + 0.55 * pulse; }
      else if (movable.has(id)) { lift = REDUCED ? 0.06 : 0.06 + Math.sin(time * 4 + id.length) * 0.05; f.ring.material.color.set('#f2cf7a'); f.ring.material.opacity = 0.85; }
      else f.ring.visible = false;
      f.lift += (lift - f.lift) * Math.min(1, dt * 12);
      f.inner.position.y = f.lift;
      f.body.material.emissiveIntensity = sel ? 0.12 : 0;
      f.star.visible = false;
      f.tag.visible = !!(sel || targets.has(id)) && ui.mine !== id && !(this.peek && this.peek.id === id);
      f.tag.position.y = 1.62 + f.lift;
    }
    // penanda "INI KAMU" mengikuti karaktermu (juga saat sedang diseret / dipindah pemain lain)
    const mf = ui.mine && this.figures.get(ui.mine);
    const me = this.me, showMe = !!(mf && mf.group.visible && !mf.removing);
    me.group.visible = me.label.visible = me.pin.visible = showMe;
    if (showMe) {
      if (me.labelFor !== ui.mine) { me.labelFor = ui.mine; this.drawMeLabel(this.meta.characters.find(c => c.id === ui.mine)?.name || ''); }
      const gp = mf.group.position, lift = (mf.lift || 0) * FIG_S;
      me.group.position.set(gp.x, gp.y, gp.z);
      const top = gp.y + lift + 2.05 * FIG_S;
      const bob = REDUCED ? 0 : Math.sin(time * 3) * 0.06;
      me.pin.position.set(gp.x, top + 0.2 + bob, gp.z);
      me.label.position.set(gp.x, top + 0.42 + bob, gp.z);
      me.ring.material.opacity = REDUCED ? 0.9 : 0.65 + 0.35 * pulse;
      me.beam.material.opacity = REDUCED ? 0.5 : 0.38 + 0.17 * pulse;
      me.glow.material.opacity = 0.16 + 0.12 * pulse;
      const w = REDUCED ? 0 : (time * 0.7) % 1;
      me.wave.visible = !REDUCED;
      me.wave.scale.setScalar(1 + w * 1.1); me.wave.material.opacity = (1 - w) * 0.7;
    }
    if (ui.canRoll && !this.rolling) { // dadu "memanggil" saat giliranmu melempar
      this.die.position.y = DIE_REST.y + Math.abs(Math.sin(time * 3)) * 0.18;
      this._dieWasPulse = true;
    } else if (this._dieWasPulse && !this.rolling) { this.die.position.y = DIE_REST.y; this._dieWasPulse = false; }
    const hover = drag ? drag.hover : null;
    const selFig = ui.selected && this.figures.get(ui.selected);
    const from = selFig && selFig.room;
    // pulau mana yang "terlibat" langkah ini → terang; sisanya diberi bayangan gelap
    let lit = null;
    if (active && st.phase === 'PLAYING') {
      if (st.step === 'MOVE' && st.die) {
        lit = from && dests.size ? new Set([from, ...dests])                       // bidak dipilih: asal + tujuan sah
          : new Set([st.die, ...(this.meta.adj[st.die] || [])]);                   // baru lempar: pulau dadu + tetangganya
      } else if (st.step === 'BLACK' && targets.size) {
        const myRoom = this.figures.get([...targets][0]).room;                    // hitam: hanya pulaumu
        lit = new Set([myRoom]);
      }
    }
    let shading = false;
    for (const [room, r] of Object.entries(this.roomMeshes)) {
      const isDest = dests.has(room), rolled = st && st.phase === 'PLAYING' && st.die === room && !this.rolling;
      const isFrom = from && room === from && dests.size;
      const k = room === 'papua' ? 0.25 : 0.5;
      const off = lit && !lit.has(room);                                     // tidak terlibat
      const valid = isDest || (lit && !from && st.step === 'MOVE' && lit.has(room)); // tujuan sah
      r.floorMat.emissiveIntensity = k * (isDest ? (hover === room ? 0.5 : 0.15 + 0.2 * pulse) : rolled || isFrom ? 0.12 : 0);
      // border: hijau menyala = tujuan sah, merah = tidak terlibat, emas = pulau asal bidak
      const mode = off ? 'off' : valid ? 'ok' : isFrom ? 'from' : 'none';
      if (r.mode !== mode) {
        r.mode = mode;
        const [c, e, metal] = mode === 'ok' ? ['#15803d', '#16c75a', 0.1] : mode === 'off' ? ['#991b1b', '#e11d1d', 0.1] : [BRASS, '#ffcf6e', 0.8];
        r.rimMat.color.set(c); r.rimMat.emissive.set(e); r.rimMat.metalness = metal; r.rimMat.roughness = metal > 0.5 ? 0.3 : 0.45;
      }
      r.rimMat.emissiveIntensity = mode === 'ok' ? (hover === room ? 1.6 : 0.55 + 0.55 * pulse) : mode === 'off' ? 0.45 + 0.15 * pulse : mode === 'from' ? 1.0 : rolled ? 0.6 : 0;
      const target = off ? 0.9 : 0;                                          // 0 = normal, 0.9 = gelap
      r.shadeOp += (target - r.shadeOp) * Math.min(1, dt * (REDUCED ? 30 : 10));
      if (Math.abs(target - r.shadeOp) < 0.004) r.shadeOp = target; else shading = true;
      r.floorMat.color.setRGB(1 - r.shadeOp, 1 - r.shadeOp * 0.97, 1 - r.shadeOp * 0.9); // gelap kebiruan seperti bayangan
      if (r.shadeOp > 0.3) r.floorMat.emissiveIntensity = 0;
    }
    for (const b of this.bridges) {
      const on = active && from && ((b.a === from && dests.has(b.b)) || (b.b === from && dests.has(b.a)));
      // jalur aktif: dek & strip lampu menyala hijau (selaras border tujuan sah)
      if (b.on !== !!on) { b.on = !!on; b.railMat.emissive.set(on ? 0x22c55e : b.railBase); }
      b.deckMat.emissiveIntensity = on ? 0.12 + 0.12 * pulse : 0;
      b.railMat.emissiveIntensity = on ? 1.2 + 0.6 * pulse : b.railIdle;
    }

    // ombak bergeser pelan (~20 fps saja agar hemat baterai)
    let waveTick = false;
    if (!REDUCED) {
      this.waveAcc += dt;
      if (this.waveAcc > 0.05) { this.waveTex.offset.x = time * 0.012; this.waveTex.offset.y = Math.sin(time * 0.3) * 0.02; this.waveAcc = 0; waveTick = true; }
    }
    const camMoved = this.updateCinematicCamera(dt) || this.controls.update();
    const animating = this.tweens.length || this.camMode || showMe || this.peek || (ui.canRoll && !this.rolling) || shading || drag || movable.size || targets.size || dests.size || ui.selected || ui.killSel;
    if (this.peek) this.updatePeekLabel();
    if (!animating && !camMoved && !this.dirty && !waveTick) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  }
}
