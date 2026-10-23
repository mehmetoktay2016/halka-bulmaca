// Kullanım: node tools/build_loot.js   (bölümler değişince yeniden çalıştırılır)
// Her bölüm için ödül taşıyabilecek halkaları seçip loot_data.js'e yazar.
// Ödülün hangi bölümde olacağı, nadirliği ve içeriği burada değil, rewards.js'te belirlenir.
// Seçim kuralları:
// - Ödül halkanın içinde, yalnızca o halkaya ait boş bir yere çizilir (başka halkanın içi değil, çizgilerden uzak).
// - Döner tablanın taşıdığı halkalar olmaz (tabla dönünce yer değiştirir); ödül tablanın göbeğinden ve kenarından uzak durur.
// - Süslü (şekil yüzü) halkalar olmaz; kilitli, anahtar, sabit ve dişli işaretli halkalarda ortadaki simgeden uzak durulur.
// - Her aday için o bölüme kaç altın sığdığı da yazılır (game.js placeCoins kuralları, ödüle 46'dan yakın olmayan):
//   altın halka yalnız en az LOOT.goldCoins altın sığan yere konur.
// - İpucuyla oynanan çözümde geç kurtulan halka önce gelir: ödülün heyecanı bölümün sonuna kadar sürsün.
//   Son hamlede kurtulanlar en sona kalır (orada bölüm sonu ekranı hemen açılır).
const fs = require('fs');
const path = require('path');
const Logic = require('../logic.js');
const Levels = require('../levels.js');

const root = path.join(__dirname, '..');
// Konumlar tarayıcıdaki gibi (ortalanmış, şekiller ölçeklenmiş) olmalı
const { getLevel: get, order } = require('./browser_levels.js')();
const CLEAR = 22; // ödülün çevresinde boş kalması gereken yarıçap
const MAX = 3;    // bölüm başına en çok kaç aday halka

const segDist = (px, py, b) => {
  const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
  const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
};
const pieceDist = (px, py, r) => (r.kind === 'frame' ? Math.min(...r.segs.map(s => segDist(px, py, s))) : segDist(px, py, r));

// İpucuna uyarak oynar (balance.js ile aynı); her halkanın kaçıncı hamlede kurtulduğunu döner
function releaseMoves(L0) {
  let L = L0;
  let { mask: m, angles: a, left } = Logic.cascade(L, L.startAngles.slice(), 0), moves = 0, sw = L.startSw, ph = 0;
  const at = {};
  while (m !== L.full && moves < 30) {
    const s = Logic.solveFast(L, a, m, 2000, 0.8, left, sw, ph) || Logic.solveFast(L, a, m, 30000, undefined, left, sw, ph);
    if (!s || !s.first) break;
    if (L.hasPulse) ph ^= 1;
    if (s.first.toggle) { sw ^= 1; moves++; ({ mask: m, angles: a, left } = Logic.cascade(L, a, m, left, ph)); continue; }
    if (s.first.table) { const t = Logic.turnTable(L, a); L = t.L; moves++; ({ mask: m, angles: a, left } = Logic.cascade(L, t.angles, m, left, ph)); continue; }
    const c = Logic.cascade(L, Logic.rotate(L, a, s.first.ring, s.first.delta), m, Logic.spend(L, left, s.first.ring), ph);
    const next = c.mask;
    a = c.angles;
    left = c.left;
    moves++;
    for (let i = 0; i < L.rings.length; i++) if ((next & (1 << i)) && !(m & (1 << i))) at[i] = moves;
    m = next;
  }
  return { at, total: moves };
}

// Halkanın içinde, yalnızca bu halkaya ait (başka halkanın içinde olmayan) ve her çizgiden uzak en iyi nokta.
// Ortadaki simgelerden (kilit, anahtar, dişli işareti) de uzak durur.
function spot(L, i, centerBusy, table) {
  const r = L.rings[i];
  let best = null;
  for (let y = r.y - r.r; y <= r.y + r.r; y += 4) {
    for (let x = r.x - r.r; x <= r.x + r.r; x += 4) {
      const own = r.r - Math.hypot(x - r.x, y - r.y); // kendi çizgisine uzaklık (içerideyse artı)
      if (own < CLEAR) continue;
      if (centerBusy && Math.hypot(x - r.x, y - r.y) < 30) continue;
      if (x < CLEAR || y < CLEAR || x > Levels.BOARD.w - CLEAR || y > Levels.BOARD.h - CLEAR) continue;
      let clear = own;
      if (table) {
        const dt = Math.hypot(x - table.x, y - table.y);
        if (dt < 34) continue; // göbek düğmesi
        clear = Math.min(clear, Math.abs(dt - table.r));
      }
      for (let j = 0; j < L.rings.length && clear >= CLEAR; j++) {
        if (j === i) continue;
        const o = L.rings[j];
        if (o.kind !== 'ring') { clear = Math.min(clear, pieceDist(x, y, o)); continue; }
        const d = Math.hypot(x - o.x, y - o.y);
        if (d < o.r + 6) clear = -1; // başka halkanın içinde: hangi halkanın ödülü olduğu karışır
        else clear = Math.min(clear, d - o.r);
      }
      if (clear < CLEAR) continue;
      // Ortaya yakın ve geniş yer daha iyi
      const score = Math.min(clear, 40) - Math.hypot(x - r.x, y - r.y) * 0.05;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best;
}

// game.js placeCoins ile aynı kurallar: halka-halka kesişiminin ortası, başka parçalardan ve dişli işaretlerinden uzak
function coinSpots(L) {
  const marks = L.couples.filter(c => c.ratio !== 1).map(c => {
    const a = L.rings[c.a], b = L.rings[c.b];
    if (c.ratio === -1) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const f = Math.abs(c.ratio) > 1 ? b : a;
    return { x: f.x, y: f.y - 22 };
  });
  const out = [];
  for (const k of L.links) {
    // saklı incinin kesişimine altın konmaz (görünmeyen halkada asılı kalırdı)
    if (L.rings[k.a].kind !== 'ring' || L.rings[k.b].kind !== 'ring' || k.pts.length < 2 || L.shellOf[k.a] >= 0 || L.shellOf[k.b] >= 0) continue;
    const x = (k.pts[0].x + k.pts[1].x) / 2, y = (k.pts[0].y + k.pts[1].y) / 2;
    const clear = L.rings.every((r, i) => i === k.a || i === k.b ||
      (r.kind !== 'ring' ? pieceDist(x, y, r) > 18 : Math.abs(Math.hypot(x - r.x, y - r.y) - r.r) > 18));
    if (clear && marks.every(m => Math.hypot(m.x - x, m.y - y) > 30)) out.push({ x, y });
  }
  return out;
}
// Ödül (x, y)'deyken sığan altın sayısı (birbirine 30'dan yakın olmayanlar)
function coinRoom(spots, x, y) {
  const kept = [];
  for (const c of spots) {
    if (Math.hypot(c.x - x, c.y - y) > 46 && kept.every(k => Math.hypot(k.x - c.x, k.y - c.y) >= 30)) kept.push(c);
  }
  return kept.length;
}

const out = {};
let none = 0;
for (const src of order) {
  const def = get(src), L = Logic.buildLevel(def);
  const deco = new Set((def.deco || []).map(d => d.ring));
  const marked = new Set(L.couples.filter(c => c.ratio !== 1).flatMap(c => [c.a, c.b]));
  const carried = new Set(def.table ? def.table.carried : []);
  const { at, total } = releaseMoves(L);
  const spots = coinSpots(L);
  const cands = [];
  L.rings.forEach((r, i) => {
    if (r.kind !== 'ring' || deco.has(i) || carried.has(i) || !at[i] || L.shellOf[i] >= 0) return;
    const busy = r.fixed || r.lockedBy >= 0 || marked.has(i) || L.rings.some(k => k.lockedBy === i);
    const p = spot(L, i, busy, def.table);
    if (p) cands.push({ i, x: p.x, y: p.y, room: coinRoom(spots, p.x, p.y), rank: at[i] === total ? -1 : at[i] });
  });
  // Önce son hamleden önce kurtulanlar (geç olan önde), sonra son hamlede kurtulanlar
  const picks = cands.sort((p, q) => q.rank - p.rank || p.i - q.i).slice(0, MAX).map(c => `[${c.i},${+c.x.toFixed(1)},${+c.y.toFixed(1)},${c.room}]`);
  if (picks.length) out[src] = picks; else none++;
}

const body = Object.keys(out).sort((a, b) => a - b).map(s => `${s}:[${out[s].join(',')}]`).join(',');
fs.writeFileSync(path.join(root, 'loot_data.js'),
  '// tools/build_loot.js üretir; elle düzenlemeyin. Bölüm kimliği -> [halka, x, y, sığan altın] adayları (öncelik sırasıyla).\n' +
  `var RING_LOOT_DATA = {${body}};\n`);
console.log(`loot_data.js: ${Object.keys(out).length} bölümde aday halka var, ${none} bölümde yok.`);
