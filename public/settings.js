// Pengaturan pemain (tersimpan di perangkat). Satu sumber kebenaran untuk suara, grafis, dan papan.
const KEY = 'pt-settings';
export const DEFAULTS = {
  master: 90, music: 60, sfx: 85, voice: 90, vibrate: true,      // suara (0–100)
  quality: 'seimbang', brightness: 100, reduceMotion: false,      // grafis
  cinematic: true, unmaskCam: true, spotMine: true, peekLabel: true, // papan
};
let cur = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved) cur = { ...DEFAULTS, ...saved };
  else if (localStorage.getItem('pt-reduce-motion') === '1') cur.reduceMotion = true; // migrasi pengaturan lama
} catch {}
const subs = new Set();
export const get = k => (k ? cur[k] : { ...cur });
export function set(k, v) {
  if (cur[k] === v) return;
  cur[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(cur)); if (k === 'reduceMotion') localStorage.setItem('pt-reduce-motion', v ? '1' : '0'); } catch {}
  subs.forEach(f => f(k, v, cur));
}
export function reset() { for (const k of Object.keys(DEFAULTS)) set(k, DEFAULTS[k]); }
export function onChange(f) { subs.add(f); f(null, null, cur); return () => subs.delete(f); }
