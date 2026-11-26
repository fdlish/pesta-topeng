// Foto profil karakter — dirender dari model 3D chibi dengan renderer kecil terpisah,
// sehingga bisa dipakai di layar awal, lobby, kartu identitas, pengungkapan, dan layar akhir.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFigure } from './figures3d.js';

const cache = new Map();
let r = null, env = null, chars = [];
const SIZE = 192;

export function initPortraits(characters) { chars = characters; }

function renderer() {
  if (r) return r;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(SIZE, SIZE, false); r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  return r;
}

export function getPortrait(id) {
  if (cache.has(id)) return cache.get(id);
  const idx = chars.findIndex(c => c.id === id);
  if (idx < 0) return '';
  const rr = renderer();
  const sc = new THREE.Scene(); sc.environment = env; sc.environmentIntensity = 0.5;
  sc.add(new THREE.HemisphereLight('#ffffff', '#3b2a20', 1.1));
  const key = new THREE.DirectionalLight('#ffe9c7', 2.3); key.position.set(1.5, 2.5, 2.5); sc.add(key);
  const rim = new THREE.DirectionalLight('#9cc4ff', 1.3); rim.position.set(-2, 1.5, -1.5); sc.add(rim);
  const { inner } = buildFigure(chars[idx], idx);
  inner.rotation.y = -0.3; sc.add(inner);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  cam.position.set(0.35, 1.05, 2.05); cam.lookAt(0, 0.86, 0);
  rr.clear(); rr.render(sc, cam);
  const url = rr.domElement.toDataURL('image/png');
  cache.set(id, url);
  return url;
}

// render semua foto secara bertahap saat browser senggang (tidak membuat layar tersendat)
export function warmAll(onEach) {
  const queue = chars.map(c => c.id).filter(id => !cache.has(id));
  const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
  const work = deadline => {
    while (queue.length && deadline.timeRemaining() > 4) { const id = queue.shift(); getPortrait(id); onEach && onEach(id); }
    if (queue.length) idle(work);
  };
  idle(work);
}
