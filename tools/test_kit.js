// Test araçlarının ortak parçaları: oyuncunun gördüğü bölümler, hamle hakkı, rastgele oyuncu,
// benzerlik ve paftalar için bölüm küçük resmi (SVG).
const fs = require('fs');
const path = require('path');
const Logic = require('../logic.js');
const Levels = require('../levels.js');

const pre = new Function(fs.readFileSync(path.join(__dirname, '..', 'levels_data.js'), 'utf8') + '; return RING_LEVEL_DATA;')();
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);

// game.js ile aynı kurallar
const moveCap = src => ({ 9: 12, 10: 14, 12: 17 })[Levels.maxParOf(src)] || 10;
const moveLimit = (par, src) => Math.min(moveCap(src), par + Math.max(3, Math.ceil(par * 0.6)));

// Rastgele oyuncu: her hamlede anlamlı hamlelerden (boşluğu bir kesişime getiren çevirme, şalter, tabla)
// birini rastgele seçer, hamle hakkı bitene dek. Bölümü düşünmeden bitirebiliyorsa bölüm kolaydır.
// Dönen: kazanma oranı (0-1) ve kazandığı oyunlarda ortalama hamle.
function randomPlay(def, limit, tries = 200, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const L = Logic.buildLevel(def);
  const start = Logic.startState(L, L.startAngles.slice(), 0);
  let wins = 0, used = 0;
  for (let t = 0; t < tries; t++) {
    let node = start;
    for (let m = 1; m <= limit; m++) {
      const next = [];
      Logic.expand(node, st => { next.push(st); return false; });
      if (!next.length) break;
      node = next[Math.floor(rnd() * next.length)];
      if (node.mask === L.full) { wins++; used += m; break; }
    }
  }
  return { rate: wins / tries, avgMoves: wins ? used / wins : null };
}

// Benzerlik: iki bölümün halka düzeni (ağırlık merkezine göre; aynası da denenir) ne kadar örtüşüyor.
// Halkalar en yakın çiftten başlayarak eşlenir; çift maliyeti merkez uzaklığı + yarıçap farkı,
// eşsiz kalan parça MISS sayılır. 1 aynı düzen, 0 hiç benzemiyor. Yalnız düzene bakar (oyuncunun gözüne
// çarpan odur); parçaların aynı olup olmadığı raporda ayrıca yazılır.
const MISS = 80;
function pieces(def) {
  const P = def.rings.map(r => (r.type === 'bar' ? { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2, r: Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 2, k: 'b' }
    : r.type === 'frame' ? null : { x: r.x, y: r.y, r: r.r, k: 'r' })).filter(Boolean);
  const cx = P.reduce((a, p) => a + p.x, 0) / P.length, cy = P.reduce((a, p) => a + p.y, 0) / P.length;
  return P.map(p => ({ ...p, x: p.x - cx, y: p.y - cy }));
}
function layoutSim(A, B) {
  let best = 0;
  for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pairs = [];
    A.forEach((a, i) => B.forEach((b, j) => {
      if (a.k === b.k) pairs.push([Math.hypot(a.x - fx * b.x, a.y - fy * b.y) + Math.abs(a.r - b.r), i, j]);
    }));
    pairs.sort((p, q) => p[0] - q[0]);
    const ua = new Set(), ub = new Set();
    let cost = 0;
    for (const [c, i, j] of pairs) {
      if (ua.has(i) || ub.has(j)) continue;
      ua.add(i); ub.add(j); cost += Math.min(c, MISS);
    }
    cost += (A.length - ua.size + B.length - ub.size) * MISS;
    best = Math.max(best, 1 - cost / (Math.max(A.length, B.length) * MISS));
  }
  return best;
}
const similarity = (defA, defB) => layoutSim(pieces(defA), pieces(defB));
// Havuzdaki en benzer bölüm: { src, sim }
function nearest(def, pool) {
  let best = { src: null, sim: 0 };
  for (const [src, d] of pool) {
    const sim = similarity(def, d);
    if (sim > best.sim) best = { src, sim };
  }
  return best;
}

// Bölüm küçük resmi: halkalar boşluklarıyla (başlangıç açısında), çubuk ve çerçeveler, parça işaretleri.
// Kilitli halka gri, buz kalın açık mavi, bomba turuncu B, motor M, portal Pn, jetonlu Tn, renk bombası R.
// Şeker renkli halka kendi renginde; renkli bölümde renksizler oyundaki gibi şekerle karışmayan renkte.
const PALETTE = ['#ff5a5f', '#ffb400', '#3ec1d3', '#7ed957', '#a06cd5', '#ff8c42', '#4d96ff', '#f15bb5', '#00c2a8', '#c9a227'];
function thumb(def, w = 160) {
  const B = Levels.BOARD, L = Logic.buildLevel(def), D = Logic.DEG;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B.w} ${B.h}" width="${w}" height="${Math.round(w * B.h / B.w)}">`,
    `<rect width="${B.w}" height="${B.h}" rx="18" fill="#1d2440"/>`];
  def.rings.forEach((r, i) => {
    if (r.type === 'bar') { out.push(`<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#c8cbd6" stroke-width="10" stroke-linecap="round"/>`); return; }
    if (r.type === 'frame') { out.push(`<polygon points="${r.points.map(q => q.join(',')).join(' ')}" fill="none" stroke="#c8cbd6" stroke-width="8"/>`); return; }
    const PC = require('../worlds.js').PIECE_COLORS, painted = def.rings.some(q => q.paint != null);
    const R = L.rings[i], col = r.fixed ? '#8a8fa3' : r.ice ? '#bfeaff' : r.paint != null ? PC.paints[r.paint]
      : painted ? PC.plain[i % PC.plain.length] : r.color || PALETTE[i % PALETTE.length];
    const half = Logic.GAP_HALF;
    for (const g of R.gaps) {
      // halkayı boşluğun bitiminden öbür ucuna dek çiz (boşluk açısı: başlangıç açısı + boşluk)
      const a0 = L.startAngles[i] + g + half, a1 = L.startAngles[i] + g + (R.gaps.length > 1 ? Math.PI : 2 * Math.PI) - half;
      const p = a => `${(r.x + r.r * Math.cos(a)).toFixed(1)} ${(r.y + r.r * Math.sin(a)).toFixed(1)}`;
      out.push(`<path d="M ${p(a0)} A ${r.r} ${r.r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}" fill="none" stroke="${col}" stroke-width="${r.ice ? 12 : 8}" stroke-linecap="round"/>`);
    }
    const tag = [r.bomb && 'B', r.cbomb && 'R', r.motor && 'M', r.ratchet && (r.ratchet > 0 ? 'C+' : 'C-'), r.pearl != null && 'I' + r.pearl, r.chain != null && 'Z' + r.chain, r.gust && 'R' + (r.gust > 0 ? '+' : '-'), r.portal != null && 'P' + r.portal, r.tokens != null && 'T' + r.tokens,
      r.boiler && 'K' + r.boiler, r.ice && '*' + r.ice, r.step && 'tık', r.lockedBy != null && 'k' + r.lockedBy].filter(Boolean).join(' ');
    if (tag) out.push(`<text x="${r.x}" y="${r.y + 8}" text-anchor="middle" font-size="24" font-weight="700" fill="${col}" font-family="sans-serif">${tag}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}

// Bir HTML dosyasının ekran görüntüsü (Chrome başsız); yüksekliği içeriğe göre verilir
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
function screenshot(htmlFile, pngFile, width, height) {
  require('child_process').execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', `--screenshot=${pngFile}`,
    `--window-size=${width},${height}`, 'file:///' + htmlFile.replace(/\\/g, '/')], { stdio: 'ignore' });
}

module.exports = { pre, get, moveLimit, randomPlay, similarity, nearest, thumb, screenshot };
