// Kartu hasil pesta (gambar 1080×1350) untuk dibagikan ke WhatsApp / Story.
// Digambar di canvas dari data yang sudah ada di klien — tanpa server.
const W = 1080, H = 1350;
const C = { nila: '#1F2A52', ink: '#141B38', kunyit: '#F2C14E', kunyitTua: '#D9A62E', cabai: '#C8322A', kertas: '#F6EEDC' };
const DISPLAY = 'Shrikhand, Georgia, serif';
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';

const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function kawung(g, x0, y0, w, h, s, color, alpha) {
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.globalAlpha = alpha; g.fillStyle = color;
  for (let y = y0; y < y0 + h + s; y += s) for (let x = x0; x < x0 + w + s; x += s) {
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(x, y); g.rotate(k * Math.PI / 2 + Math.PI / 4);
      g.beginPath(); g.ellipse(0, -s * 0.26, s * 0.13, s * 0.24, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  g.restore();
}
function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function fitFont(g, text, family, weight, size, maxW) {
  let s = size; do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (g.measureText(text).width > maxW && s > 20);
}

/**
 * data: { win, placement, total, name, charName, portrait, stats:{unmasks,cards}, turns,
 *         awards:[{title,text}], secret:{done,text}|null, titles:[string], others:[{name, portrait, placement}], url, practice }
 */
export async function drawShareCard(data) {
  if (document.fonts) await Promise.race([Promise.all([document.fonts.load(`64px ${DISPLAY}`), document.fonts.load(`800 40px ${SANS}`), document.fonts.load(`600 30px ${SANS}`)]).catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.textBaseline = 'alphabetic';

  // latar nila bermotif kawung
  g.fillStyle = C.nila; g.fillRect(0, 0, W, H);
  kawung(g, 0, 0, W, H, 120, C.kunyit, 0.06);

  // kartu undangan
  const cx = 56, cy = 56, cw = W - 112, ch = H - 170;
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 50; g.shadowOffsetY = 18;
  rr(g, cx, cy, cw, ch, 36); g.fillStyle = C.kunyit; g.fill(); g.restore();
  // pita batik di atas
  g.save(); rr(g, cx, cy, cw, ch, 36); g.clip();
  g.fillStyle = C.cabai; g.fillRect(cx, cy, cw, 62);
  kawung(g, cx, cy, cw, 62, 46, C.kunyit, 0.35);
  g.restore();

  // judul
  g.textAlign = 'center'; g.fillStyle = C.nila;
  g.font = `64px ${DISPLAY}`; g.fillText('Pesta Topeng', W / 2, cy + 150);
  g.font = `600 28px ${SANS}`; g.fillStyle = 'rgba(20,27,56,.7)';
  const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(`Hasil pesta, ${tgl}`, W / 2, cy + 196);

  // potret
  const pr = 140, px = W / 2, py = cy + 380;
  g.save(); g.beginPath(); g.arc(px, py, pr + 12, 0, Math.PI * 2); g.fillStyle = C.kertas; g.fill();
  g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fillStyle = C.nila; g.fill(); g.clip();
  kawung(g, px - pr, py - pr, pr * 2, pr * 2, 70, C.kunyit, 0.08);
  const img = await loadImg(data.portrait);
  if (img) g.drawImage(img, px - pr * 1.05, py - pr * 1.02, pr * 2.1, pr * 2.1);
  g.restore();

  // cap
  const stamp = data.win ? 'Menang' : `Juara ${data.placement}`;
  g.save(); g.translate(px + pr * 1.12, py - pr * 0.42); g.rotate(-0.22);
  g.strokeStyle = C.cabai; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 92, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 80, 0, Math.PI * 2); g.stroke();
  g.fillStyle = C.cabai; g.textAlign = 'center'; fitFont(g, stamp, DISPLAY, '', 40, 140); g.fillText(stamp, 0, 14);
  g.restore();

  // judul hasil
  let y = py + pr + 96;
  g.textAlign = 'center'; g.fillStyle = C.nila;
  const head = data.win ? 'Aku menang!' : data.placement === 2 ? 'Nyaris juara!' : `Juara ${data.placement} dari ${data.total}`;
  fitFont(g, head, DISPLAY, '', 84, cw - 120); g.fillText(head, W / 2, y);
  y += 50;
  g.font = `700 36px ${SANS}`; g.fillStyle = C.ink;
  g.fillText(data.win ? `Bertahan sampai akhir sebagai ${data.charName}` : `Menyamar sebagai ${data.charName}`, W / 2, y);

  // angka
  y += 38;
  const stats = [[data.stats.unmasks || 0, 'topeng dibongkar'], [data.stats.cards || 0, 'kartu dibuka'], [data.turns || 0, 'giliran']];
  const bw = (cw - 120 - 2 * 24) / 3;
  stats.forEach(([n, l], i) => {
    const bx = cx + 60 + i * (bw + 24);
    rr(g, bx, y, bw, 112, 22); g.fillStyle = 'rgba(20,27,56,.09)'; g.fill();
    g.fillStyle = C.nila; g.textAlign = 'center'; g.font = `56px ${DISPLAY}`; g.fillText(String(n), bx + bw / 2, y + 62);
    g.font = `600 25px ${SANS}`; g.fillStyle = 'rgba(20,27,56,.75)'; g.fillText(l, bx + bw / 2, y + 96);
  });
  y += 112 + 44;

  // sorotan: gelar pesta, misi rahasia, gelar baru
  const lines = [];
  (data.awards || []).slice(0, 2).forEach(a => lines.push({ k: a.title, v: a.text }));
  if (data.secret) lines.push({ k: data.secret.done ? 'Misi rahasia selesai' : 'Misi rahasia gagal', v: data.secret.text, bad: !data.secret.done });
  (data.titles || []).slice(0, 1).forEach(t => lines.push({ k: 'Gelar baru', v: t }));
  g.textAlign = 'left';
  for (const ln of lines.slice(0, 3)) {
    const lx = cx + 72, maxW = cw - 144 - 30;
    g.fillStyle = ln.bad ? 'rgba(20,27,56,.35)' : C.cabai; g.beginPath(); g.arc(lx + 9, y - 10, 9, 0, Math.PI * 2); g.fill();
    g.font = `800 28px ${SANS}`; g.fillStyle = C.ink; g.fillText(ln.k, lx + 32, y);
    g.font = `500 26px ${SANS}`; g.fillStyle = 'rgba(20,27,56,.78)';
    let t = ln.v; if (g.measureText(t).width > maxW) { while (t.length > 4 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; }
    g.fillText(t, lx + 32, y + 32);
    y += 76;
  }

  // tamu lain
  const others = (data.others || []).slice(0, 7);
  if (others.length) {
    const r = 34, gap = 18, totalW = others.length * (r * 2) + (others.length - 1) * gap;
    let ox = W / 2 - totalW / 2 + r; const oy = cy + ch - 56;
    const imgs = await Promise.all(others.map(o => loadImg(o.portrait)));
    others.forEach((o, i) => {
      g.save(); g.beginPath(); g.arc(ox, oy, r, 0, Math.PI * 2); g.fillStyle = C.nila; g.fill(); g.clip();
      if (imgs[i]) g.drawImage(imgs[i], ox - r * 1.1, oy - r * 1.05, r * 2.2, r * 2.2);
      g.restore();
      g.lineWidth = 4; g.strokeStyle = C.kertas; g.beginPath(); g.arc(ox, oy, r, 0, Math.PI * 2); g.stroke();
      ox += r * 2 + gap;
    });
  }

  // kaki: ajakan
  g.textAlign = 'center'; g.fillStyle = C.kunyit; g.font = `36px ${DISPLAY}`;
  g.fillText('Siapa di balik topengmu?', W / 2, H - 64);
  g.font = `600 24px ${SANS}`; g.fillStyle = 'rgba(246,238,220,.8)';
  g.fillText(`Main bareng di ${data.url}`, W / 2, H - 26);
  return cv;
}
