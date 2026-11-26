// Geometri papan — satu sumber kebenaran untuk server (posisi bidak) dan client (render 3D, dikirim via /meta).
'use strict';

const GAP = 1.2, CW = 7.4, CD = 4.6, AD = 4.6, MARGIN = 0.8;   // ukuran wilayah pulau (lebar & lega)
const CX = CW / 2 + GAP / 2, CZ = AD / 2 + GAP + CD / 2;
// [Sumatera][Kalimantan] / [   Jawa   ] / [Sulawesi][Papua] — Jawa di tengah terhubung ke semua pulau.
const ROOMS = {
  sumatera: { x: -CX, z: -CZ, w: CW, d: CD }, kalimantan: { x: CX, z: -CZ, w: CW, d: CD },
  jawa: { x: 0, z: 0, w: CW * 2 + GAP, d: AD },
  sulawesi: { x: -CX, z: CZ, w: CW, d: CD }, papua: { x: CX, z: CZ, w: CW, d: CD },
};
const SEA_W = CW * 2 + GAP + MARGIN * 2, SEA_D = CD * 2 + AD + GAP * 2 + MARGIN * 2;
const BRIDGE_Z = AD / 2 + GAP / 2, BX = CX + 1.9;
const BRIDGES = [
  { a: 'sumatera', b: 'kalimantan', x: 0, z: -CZ, axis: 'x' },
  { a: 'sulawesi', b: 'papua', x: 0, z: CZ, axis: 'x' },
  { a: 'sumatera', b: 'jawa', x: -BX, z: -BRIDGE_Z, axis: 'z' },
  { a: 'kalimantan', b: 'jawa', x: BX, z: -BRIDGE_Z, axis: 'z' },
  { a: 'sulawesi', b: 'jawa', x: -BX, z: BRIDGE_Z, axis: 'z' },
  { a: 'papua', b: 'jawa', x: BX, z: BRIDGE_Z, axis: 'z' },
];
// properti (landmark & dekorasi) — posisi relatif tengah pulau, r = radius area yang tidak boleh ditempati bidak
const BACK = -CD / 2 + 0.65, FRONT = CD / 2 - 0.6, OUT = CW / 2 - 0.65;
const PROPS = {
  sumatera: [{ kind: 'gadang', dx: -OUT, dz: BACK, r: 0.6 }, { kind: 'sawit', dx: OUT, dz: BACK, r: 0.45 }],
  kalimantan: [{ kind: 'tugu', dx: OUT, dz: BACK, r: 0.5 }, { kind: 'hutan', dx: -OUT + 0.1, dz: BACK, r: 0.5 }],
  jawa: [{ kind: 'monas', dx: -3.2, dz: -AD / 2 + 0.65, r: 0.45 }, { kind: 'candi', dx: 3.2, dz: -AD / 2 + 0.65, r: 0.55 }],
  sulawesi: [{ kind: 'tongkonan', dx: OUT - 0.2, dz: BACK, r: 0.65 }, { kind: 'pinisi', dx: -OUT, dz: FRONT, r: 0.55 }],
  papua: [{ kind: 'honai', dx: -OUT, dz: BACK, r: 0.5 }, { kind: 'puncak', dx: OUT, dz: FRONT, r: 0.55 }],
};

const FIG_GAP = 0.9;     // jarak minimum antar-pusat bidak
const PROP_PAD = 0.4;    // jarak tambahan dari properti

// area yang boleh ditempati bidak (di dalam pulau, di luar pita nama di depan)
function area(room) {
  const L = ROOMS[room];
  return { x0: L.x - L.w / 2 + 0.45, x1: L.x + L.w / 2 - 0.45, z0: L.z - L.d / 2 + 0.45, z1: L.z + L.d / 2 - 0.45 };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blockers(room, others) {
  const L = ROOMS[room];
  return [
    ...others.map(o => ({ x: o.x, z: o.z, r: FIG_GAP })),
    ...PROPS[room].map(p => ({ x: L.x + p.dx, z: L.z + p.dz, r: p.r + PROP_PAD })),
  ];
}
const clearance = (x, z, bl) => Math.min(Infinity, ...bl.map(b => Math.hypot(x - b.x, z - b.z) - b.r));

// Cari tempat untuk bidak di sebuah pulau.
// preferred: titik yang dipilih pemain (dijepit ke dalam area, digeser ke titik bebas terdekat bila bertabrakan).
// tanpa preferred: pilih titik yang paling lega (best-candidate sampling) agar bidak tersebar.
function findSpot(room, others, preferred, rng = Math.random) {
  const A = area(room), bl = blockers(room, others);
  const r2 = v => Math.round(v * 1000) / 1000;
  if (preferred && Number.isFinite(preferred.x) && Number.isFinite(preferred.z)) {
    const px = clamp(preferred.x, A.x0, A.x1), pz = clamp(preferred.z, A.z0, A.z1);
    if (clearance(px, pz, bl) >= 0) return { x: r2(px), z: r2(pz) };
    let best = null;
    for (let rad = 0.15; rad <= 3 && !best; rad += 0.15) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, x = px + Math.cos(a) * rad, z = pz + Math.sin(a) * rad;
        if (x < A.x0 || x > A.x1 || z < A.z0 || z > A.z1) continue;
        if (clearance(x, z, bl) >= 0) { best = { x, z }; break; }
      }
    }
    const s = best || { x: px, z: pz };
    return { x: r2(s.x), z: r2(s.z) };
  }
  let best = null, bestC = -Infinity;
  for (let i = 0; i < 40; i++) {
    const x = A.x0 + rng() * (A.x1 - A.x0), z = A.z0 + rng() * (A.z1 - A.z0);
    const edge = Math.min(x - A.x0, A.x1 - x, z - A.z0, A.z1 - z);   // hindari menempel di tepi pulau
    const c = Math.min(clearance(x, z, bl), 0.35 + edge * 1.6, 2.5) + rng() * 0.05;
    if (c > bestC) { bestC = c; best = { x, z }; }
  }
  return { x: r2(best.x), z: r2(best.z) };
}

module.exports = {
  GAP, CW, CD, AD, MARGIN, CX, CZ, SEA_W, SEA_D, ROOMS, BRIDGES, PROPS, FIG_GAP,
  area, findSpot,
  forClient: () => ({ GAP, CW, CD, AD, MARGIN, CX, CZ, SEA_W, SEA_D, ROOMS, BRIDGES, PROPS }),
};
