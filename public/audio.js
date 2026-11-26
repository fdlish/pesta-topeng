// Audio Pesta Topeng — semua suara disintesis WebAudio (tanpa file).
//  • Musik latar generatif bergaya "masquerade lounge": progresi jazz ii–V–I–VI, bas, sikat drum, melodi acak.
//    Tidak pernah berulang persis sama, dan bisa naik intensitas saat permainan memanas.
//  • Paket efek suara: klik, giliran, timer, dadu, ambil/lepas bidak, terbang, buka topeng, kartu, menang, kalah.
//  • Musik & efek bisa dimatikan terpisah (disimpan di perangkat).

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch {} },
};

let ctx = null, master, musicBus, sfxBus, delay, noise;
const state = { music: store.get('pt-music', true), sfx: store.get('pt-sfx', true), voice: store.get('pt-voice', true), intensity: 0, playing: false };

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = state.music ? 0.32 : 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = state.sfx ? 1 : 0; sfxBus.connect(master);
  // gema lembut untuk melodi & lonceng
  delay = ctx.createDelay(1); delay.delayTime.value = 0.32;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
  delay.connect(dl).connect(fb).connect(delay); dl.connect(musicBus);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

// Membuka audio pada interaksi pertama (wajib di iPhone/Safari & Chrome).
export function unlock() {
  try {
    if (!ctx) build();
    if (ctx.state !== 'running') ctx.resume();
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    if (state.music && !state.playing) startMusic();
  } catch {}
  return ctx && ctx.state === 'running';
}
const ready = () => ctx && ctx.state === 'running';

// ================= util sintesis =================
const now = () => ctx.currentTime;
function env(g, t, a, peak, dcy, sus = 0.0001) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dcy);
}
function tone({ f, t = now(), type = 'sine', a = 0.005, d = 0.3, peak = 0.2, to = null, bus = sfxBus, detune = 0, send = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  env(g, t, a, peak, d);
  o.connect(g).connect(bus);
  if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(delay); }
  o.start(t); o.stop(t + a + d + 0.05);
}
function hiss({ t = now(), dur = 0.2, type = 'bandpass', f = 2000, f2 = null, q = 1, peak = 0.2, bus = sfxBus, a = 0.005 }) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; s.loop = true; fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, a, peak, dur);
  s.connect(fl).connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const bell = (f, t, peak = 0.12, d = 1.2) => { // lonceng: sinus + harmonik tak bulat
  tone({ f, t, a: 0.003, d, peak, send: 0.3 });
  tone({ f: f * 2.76, t, a: 0.003, d: d * 0.5, peak: peak * 0.35, send: 0.2 });
  tone({ f: f * 5.4, t, a: 0.002, d: d * 0.25, peak: peak * 0.12 });
};
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// ================= efek suara =================
export const sfx = {
  click() { if (!ready()) return; tone({ f: 1400, type: 'triangle', d: 0.05, peak: 0.08 }); },
  hover() { if (!ready()) return; tone({ f: 2200, d: 0.03, peak: 0.025 }); },
  pick() { if (!ready()) return; tone({ f: 520, to: 880, type: 'triangle', d: 0.1, peak: 0.12 }); },
  land() {
    if (!ready()) return; const t = now();
    tone({ f: 620, to: 160, t, d: 0.18, peak: 0.28 }); hiss({ t, dur: 0.06, f: 3000, peak: 0.12 });
  },
  swoosh(dur = 1.4) {
    if (!ready()) return; const t = now();
    hiss({ t, dur, f: 300, f2: 2200, q: 1.8, peak: 0.3, a: dur * 0.4 });
    tone({ f: 330, to: 660, t, a: 0.2, d: dur * 0.8, peak: 0.05, send: 0.3 });
  },
  dice(strength = 1) { if (!ready()) return; hiss({ dur: 0.05, f: 1800 + Math.random() * 900, q: 4, peak: 0.15 + 0.45 * strength }); },
  diceShake() { if (!ready()) return; const t = now(); for (let i = 0; i < 6; i++) hiss({ t: t + i * 0.045, dur: 0.035, f: 2500 + Math.random() * 1500, q: 5, peak: 0.12 }); },
  turn() { // giliranmu: dua nada lonceng naik
    if (!ready()) return; const t = now();
    bell(midi(79), t, 0.13); bell(midi(86), t + 0.13, 0.13); bell(midi(91), t + 0.26, 0.08, 1.6);
  },
  tick(urgent = false) { if (!ready()) return; tone({ f: urgent ? 1180 : 880, type: 'square', d: 0.04, peak: 0.05 }); },
  unmask() { // buka topeng pemain: dentuman + gong + nada turun dramatis
    if (!ready()) return; const t = now();
    tone({ f: 110, to: 40, t, d: 0.7, peak: 0.5 });
    hiss({ t, dur: 0.5, type: 'lowpass', f: 900, f2: 120, peak: 0.25 });
    [64, 61, 57].forEach((n, i) => tone({ f: midi(n), t: t + 0.15 + i * 0.16, type: 'sawtooth', d: 0.35, peak: 0.06, send: 0.25 }));
    bell(midi(45), t + 0.05, 0.18, 2.4);
  },
  poof() { // tamu biasa terbuka / pulang
    if (!ready()) return; const t = now();
    hiss({ t, dur: 0.35, f: 1200, f2: 300, q: 0.8, peak: 0.25 });
    [76, 72, 69].forEach((n, i) => tone({ f: midi(n), t: t + 0.05 + i * 0.07, d: 0.18, peak: 0.07, send: 0.2 }));
  },
  card() { // kartu dibalik
    if (!ready()) return; const t = now();
    hiss({ t, dur: 0.16, f: 4000, f2: 1500, q: 0.7, peak: 0.22 });
    [84, 88, 91].forEach((n, i) => bell(midi(n), t + 0.12 + i * 0.06, 0.05, 0.6));
  },
  win() { // fanfare kemenangan
    if (!ready()) return; const t = now();
    [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [76, 0.6], [79, 0.72], [84, 0.84]].forEach(([n, dt]) => {
      tone({ f: midi(n), t: t + dt, type: 'triangle', d: 0.5, peak: 0.12, send: 0.25 });
      tone({ f: midi(n) * 2, t: t + dt, d: 0.3, peak: 0.03 });
    });
    bell(midi(96), t + 1.0, 0.1, 2.5);
    for (let i = 0; i < 10; i++) bell(midi(88 + (i % 5) * 2), t + 1.1 + i * 0.07, 0.03, 0.5);
  },
  lose() { if (!ready()) return; const t = now(); [67, 66, 65, 62].forEach((n, i) => tone({ f: midi(n), t: t + i * 0.28, type: 'triangle', a: 0.02, d: i === 3 ? 0.9 : 0.3, peak: 0.1, send: 0.2 })); },
  join() { if (!ready()) return; const t = now(); tone({ f: 600, to: 1200, t, d: 0.09, peak: 0.12 }); tone({ f: 900, to: 1800, t: t + 0.08, d: 0.09, peak: 0.08 }); },
  error() { if (!ready()) return; const t = now(); tone({ f: 180, t, type: 'square', d: 0.09, peak: 0.06 }); tone({ f: 150, t: t + 0.12, type: 'square', d: 0.12, peak: 0.06 }); },
  start() { if (!ready()) return; const t = now(); [60, 67, 72, 76, 79].forEach((n, i) => bell(midi(n), t + i * 0.09, 0.08, 1.2)); },
};

// ================= musik latar generatif =================
const BPM = 96, BEAT = 60 / BPM, SWING = 0.12;
// ii–V–I–VI dalam C (Dm9, G13, Cmaj9, A7b9) + variasi kedua (Fmaj9, E7, Am9, D9)
const PROGS = [
  [[50, 53, 57, 60, 64], [43, 53, 59, 64, 69], [48, 52, 55, 59, 62], [45, 55, 58, 61, 64]],
  [[41, 52, 55, 57, 64], [40, 50, 56, 59, 62], [45, 52, 55, 60, 64], [50, 54, 57, 60, 64]],
];
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79]; // pentatonik + nada warna
let timer = null, nextT = 0, step = 0, bar = 0, prog = 0, lastMel = 72;

function chordVoice(notes, t, len) {
  for (const n of notes.slice(1)) {
    const f = midi(n);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 7;
    lp.type = 'lowpass'; lp.frequency.value = 1600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o1.connect(lp); o2.connect(lp); lp.connect(g).connect(musicBus);
    o1.start(t); o2.start(t); o1.stop(t + len + 0.05); o2.stop(t + len + 0.05);
  }
}
function bass(n, t, len) {
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = midi(n - 12); lp.type = 'lowpass'; lp.frequency.value = 500;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(lp).connect(g).connect(musicBus); o.start(t); o.stop(t + len + 0.05);
}
function brush(t, peak) {
  const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 6500;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  s.connect(hp).connect(g).connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.1);
}
function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3);
}
function melody(t) {
  const cand = SCALE.filter(n => Math.abs(n - lastMel) <= 5 && n !== lastMel);
  const n = cand[Math.floor(Math.random() * cand.length)] || 72; lastMel = n;
  const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
  o.type = 'sine'; o.frequency.value = midi(n); vib.frequency.value = 5; vg.gain.value = 3; vib.connect(vg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g); g.connect(musicBus); const sd = ctx.createGain(); sd.gain.value = 0.6; g.connect(sd).connect(delay);
  o.start(t); vib.start(t); o.stop(t + 1); vib.stop(t + 1);
}

function schedule() {
  while (nextT < ctx.currentTime + 0.25) {
    const eighth = step % 8, beat = Math.floor(eighth / 2), off = eighth % 2;
    const t = nextT + (off ? SWING * BEAT : 0);
    const chord = PROGS[prog][bar % 4];
    if (eighth === 0) { chordVoice(chord, t, BEAT * 3.6); bass(chord[0], t, BEAT * 0.9); kick(t); }
    if (eighth === 4) { bass(chord[0] + 7, t, BEAT * 0.9); if (state.intensity > 0) kick(t); }
    if (eighth === 3 || eighth === 7) bass(chord[0] + (Math.random() < 0.5 ? 12 : 10), t, BEAT * 0.4);
    if (eighth === 6 && Math.random() < 0.5) chordVoice(chord, t, BEAT * 1.6);
    brush(t, off ? 0.035 + state.intensity * 0.02 : (beat % 2 ? 0.06 : 0.03));
    if (!off && Math.random() < 0.28 + state.intensity * 0.12) melody(t);
    nextT += BEAT / 2; step++;
    if (step % 8 === 0) { bar++; if (bar % 8 === 0) prog = (prog + 1) % PROGS.length; }
  }
}
export function startMusic() {
  if (!ctx || state.playing) return;
  state.playing = true; nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 60);
}
export function stopMusic() { clearInterval(timer); timer = null; state.playing = false; }
export function setIntensity(v) { state.intensity = Math.max(0, Math.min(1, v)); }

export function setMusic(on) {
  state.music = !!on; store.set('pt-music', state.music);
  if (ctx) {
    musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.2);
    if (on && !state.playing && ready()) startMusic();
    if (!on) setTimeout(() => { if (!state.music) stopMusic(); }, 600); // hemat baterai
  }
}
export function setSfx(on) { state.sfx = !!on; store.set('pt-sfx', state.sfx); if (ctx) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05); }
export const isMusicOn = () => state.music;
export const isSfxOn = () => state.sfx;

// ================= narator (voice over) =================
// Klip suara narator misterius (public/vo/*.mp3). Lewat sfxBus: tombol efek suara ikut membisukannya.
// Antrean: kalimat tidak saling tumpuk; kalimat basi (terlalu lama mengantre) dibuang.
let voiceBus = null, vPlaying = null, vBusy = false;
const vBuf = new Map(), vQueue = [];
function vbus() { if (!voiceBus) { voiceBus = ctx.createGain(); voiceBus.gain.value = state.voice ? 1.15 : 0; voiceBus.connect(sfxBus); } return voiceBus; }
function loadVo(name) {
  if (!vBuf.has(name)) vBuf.set(name, fetch(`/vo/${name}.mp3`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(a => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej))).catch(() => null));
  return vBuf.get(name);
}
export function preloadVoice(names) { if (ctx && state.voice) names.forEach(loadVo); }
function duck(on) { if (ctx && state.music) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, on ? 0.08 : 0.5); }
async function pump() {
  if (vBusy || !vQueue.length) return;
  const item = vQueue.shift();
  if (performance.now() - item.at > item.ttl) return pump(); // sudah basi
  vBusy = true; duck(true);
  for (const name of item.lines) {
    const buf = await loadVo(name);
    if (!buf || item.cancelled) continue;
    await new Promise(res => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(vbus());
      vPlaying = { src, item }; src.onended = res; src.start(); (window.__voLog ||= []).push(name);
    });
    vPlaying = null;
    if (!item.cancelled) await new Promise(r => setTimeout(r, 120));
  }
  vBusy = false;
  if (!vQueue.length) duck(false);
  pump();
}
// say(lines, { prio, ttl }) — prio 0: info ringan (pulau, giliran, waktu); 1: momen permainan; 2: buka topeng & akhir pesta.
// Kalimat baru menyingkirkan antrean berprioritas lebih rendah & memotong yang sedang diputar bila prioritasnya lebih rendah.
// Info ringan yang menumpuk cukup diwakili yang terbaru.
export function say(lines, { prio = 1, ttl = 4500 } = {}) {
  if (!ctx || !state.voice || !state.sfx || ctx.state !== 'running') return;
  const item = { lines: [].concat(lines), at: performance.now(), ttl, prio, cancelled: false };
  for (let i = vQueue.length - 1; i >= 0; i--) if (vQueue[i].prio < prio || (prio === 0 && vQueue[i].prio === 0)) vQueue.splice(i, 1);
  if (vPlaying && vPlaying.item.prio < prio) { vPlaying.item.cancelled = true; try { vPlaying.src.stop(); } catch {} }
  vQueue.push(item); pump();
}
export function setVoice(on) {
  state.voice = !!on; store.set('pt-voice', state.voice);
  if (voiceBus) voiceBus.gain.setTargetAtTime(on ? 1.15 : 0, ctx.currentTime, 0.05);
  if (!on) { vQueue.length = 0; if (vPlaying) { vPlaying.item.cancelled = true; try { vPlaying.src.stop(); } catch {} } }
}
export const isVoiceOn = () => state.voice;

// hentikan penjadwalan saat tab disembunyikan (hemat baterai), lanjut saat kembali
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { stopMusic(); ctx.suspend().catch(() => {}); }
  else ctx.resume().then(() => { if (state.music && !state.playing) startMusic(); }).catch(() => {});
});

// untuk pengujian otomatis
export const _debug = () => ({ ctx: ctx && ctx.state, playing: state.playing, music: state.music, sfx: state.sfx, t: ctx && ctx.currentTime });
