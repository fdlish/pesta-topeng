// Jalankan Pesta Topeng dari laptop sendiri dan buat link publik lewat Cloudflare Quick Tunnel.
//   node online.js        (atau klik dua kali MAIN-ONLINE.bat di Windows)
// Yang dilakukan:
//   1. memastikan .env berisi kunci Supabase (menanyakan secret key sekali saja),
//   2. memasang dependensi bila belum ada,
//   3. mengunduh cloudflared bila belum ada,
//   4. menyalakan server game + tunnel, menulis link ke LINK-GAME.txt dan membukanya di browser,
//   5. menyalakan ulang server/tunnel otomatis kalau mati.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const ENV_FILE = path.join(ROOT, '.env');
const BIN_DIR = path.join(ROOT, 'bin');
const LINK_FILE = path.join(ROOT, 'LINK-GAME.txt');
const IS_WIN = process.platform === 'win32';
const SUPABASE_DEFAULTS = {
  SUPABASE_URL: 'https://dgqpedigzbdrpjvonjfi.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1oEVJmLy7LkHCt36qx1bOQ_XF0BlQ9C',
};

const log = (...a) => console.log('[pesta-topeng]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ .env --
function readEnv() {
  const out = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* belum ada */ }
  return out;
}
function writeEnv(env) {
  const body = [
    '# Dibuat oleh online.js. Jangan bagikan file ini: berisi kunci rahasia.',
    ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
    '',
  ].join('\n');
  fs.writeFileSync(ENV_FILE, body);
}
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = function (s) { if (!rl.stdoutMuted) rl.output.write(s); else if (s.includes('\n')) rl.output.write('\n'); else rl.output.write('*'); };
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
    rl.stdoutMuted = true;
  });
}
async function ensureEnv() {
  const env = { ...SUPABASE_DEFAULTS, ...readEnv() };
  if (!env.SUPABASE_SECRET_KEY || !/^sb_secret_|^eyJ/.test(env.SUPABASE_SECRET_KEY)) {
    console.log('\nKunci rahasia Supabase belum diisi (cukup sekali).');
    console.log('Ambil di: https://supabase.com/dashboard/project/dgqpedigzbdrpjvonjfi/settings/api-keys');
    console.log('  tab "Publishable and secret API keys" > Secret keys > salin kunci sb_secret_...');
    console.log('Kosongkan lalu Enter kalau mau jalan tanpa akun/poin dulu.\n');
    const key = await askHidden('Tempel SUPABASE_SECRET_KEY lalu Enter: ');
    if (key) {
      if (!/^sb_secret_|^eyJ/.test(key)) log('Peringatan: kunci tidak diawali sb_secret_ — periksa lagi kalau login gagal.');
      env.SUPABASE_SECRET_KEY = key;
    }
  }
  if (env.SUPABASE_SECRET_KEY) writeEnv(env);
  return env;
}

// ---------------------------------------------------------- dependensi --
function ensureDeps() {
  const need = ['express', 'socket.io', 'three', '@supabase/supabase-js'].some(m => !fs.existsSync(path.join(ROOT, 'node_modules', m)));
  if (!need) return;
  log('Memasang dependensi (sekali saja, 1–2 menit)…');
  const r = spawnSync(IS_WIN ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: IS_WIN });
  if (r.status !== 0) { log('Gagal memasang dependensi. Pastikan internet tersambung lalu coba lagi.'); process.exit(1); }
}

// ----------------------------------------------------------- cloudflared --
function which(cmd) {
  const r = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}
async function ensureCloudflared() {
  const local = path.join(BIN_DIR, IS_WIN ? 'cloudflared.exe' : 'cloudflared');
  if (fs.existsSync(local) && fs.statSync(local).size > 1e6) return local;
  const sys = which('cloudflared');
  if (sys) return sys;
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? '386' : 'amd64';
  const asset = IS_WIN ? `cloudflared-windows-${arch}.exe` : process.platform === 'darwin' ? null : `cloudflared-linux-${arch}`;
  if (!asset) { log('Di Mac, pasang dulu: brew install cloudflared'); process.exit(1); }
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`;
  log(`Mengunduh cloudflared dari GitHub resmi Cloudflare…`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) { log(`Gagal mengunduh cloudflared (${res.status}).`); process.exit(1); }
  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  if (!IS_WIN) fs.chmodSync(local, 0o755);
  log('cloudflared siap.');
  return local;
}

// ------------------------------------------------------------- proses ---
const children = new Set();
let stopping = false;
function run(cmd, args, opts, onLine) {
  const ch = spawn(cmd, args, { cwd: ROOT, ...opts, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.add(ch);
  for (const s of [ch.stdout, ch.stderr]) {
    readline.createInterface({ input: s }).on('line', l => onLine && onLine(l));
  }
  ch.on('exit', () => children.delete(ch));
  return ch;
}
function stopAll() {
  if (stopping) return; stopping = true;
  log('Mematikan server & tunnel…');
  for (const ch of children) { try { ch.kill(); } catch {} }
  try { fs.writeFileSync(LINK_FILE, 'Server sedang mati. Jalankan MAIN-ONLINE.bat untuk link baru.\n'); } catch {}
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

async function waitHealthy(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/health`); if (r.ok) return true; } catch {}
    await sleep(400);
  }
  return false;
}

function startServer(env) {
  const ch = run(process.execPath, ['server.js'], { env: { ...process.env, ...env, PORT: String(PORT) } }, l => console.log('  [server]', l));
  ch.on('exit', code => {
    if (stopping) return;
    log(`Server berhenti (kode ${code}). Menyalakan ulang dalam 3 detik…`);
    setTimeout(() => startServer(env), 3000);
  });
}

function announce(link) {
  const line = '═'.repeat(link.length + 4);
  console.log(`\n╔${line}╗\n║  ${link}  ║\n╚${line}╝`);
  console.log('Bagikan link di atas ke teman. Biarkan jendela ini tetap terbuka.\n(Link juga disimpan di LINK-GAME.txt)\n');
  try { fs.writeFileSync(LINK_FILE, `${link}\n\nDibuat: ${new Date().toLocaleString('id-ID')}\nLink berubah setiap kali MAIN-ONLINE.bat dijalankan ulang.\n`); } catch {}
  if (!process.env.NO_BROWSER) {
    if (IS_WIN) spawn('cmd', ['/c', 'start', '', link], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    else if (process.platform === 'darwin') spawn('open', [link], { detached: true, stdio: 'ignore' }).unref();
  }
}

let tunnelFails = 0;
function startTunnel(bin) {
  let announced = false;
  const ch = run(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], {}, l => {
    const m = l.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !announced) { announced = true; tunnelFails = 0; announce(m[0]); }
    else if (/ERR|error/i.test(l) && !/Cannot determine default/.test(l)) console.log('  [tunnel]', l);
  });
  ch.on('exit', code => {
    if (stopping) return;
    tunnelFails++;
    const wait = Math.min(60, 5 * tunnelFails);
    log(`Tunnel terputus (kode ${code}). Membuat link baru dalam ${wait} detik…`);
    setTimeout(() => startTunnel(bin), wait * 1000);
  });
}

(async () => {
  console.log('\n  PESTA TOPENG — server dari laptop sendiri\n');
  if (Number(process.versions.node.split('.')[0]) < 18) { log(`Node.js ${process.versions.node} terlalu lama. Pasang versi LTS terbaru dari https://nodejs.org`); process.exit(1); }
  const env = await ensureEnv();
  ensureDeps();
  const bin = await ensureCloudflared();
  log(env.SUPABASE_SECRET_KEY ? 'Akun & poin: tersambung ke Supabase.' : 'Akun & poin: mode lokal (secret key belum diisi).');
  startServer(env);
  if (!(await waitHealthy())) { log('Server tidak menyala. Lihat pesan [server] di atas.'); stopAll(); return; }
  log(`Server jalan di http://localhost:${PORT}. Membuat link publik…`);
  startTunnel(bin);
})().catch(e => { console.error(e); stopAll(); });
