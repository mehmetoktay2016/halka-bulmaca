// Kullanım: node tools/build_loot.js   (bölümler değişince yeniden çalıştırılır)
// Her bölüm için ödül taşıyabilecek halkaları seçip loot_data.js'e yazar.
// Ödülün hangi bölümde olacağı, nadirliği ve içeriği burada değil, rewards.js'te belirlenir.
// Seçim kuralları:
// - Ödül halkanın içinde, yalnızca o halkaya ait boş bir yere çizilir (başka halkanın içi değil, çizgilerden uzak).
// - Süslü (şekil yüzü) halkalar olmaz; kilitli, anahtar, sabit ve dişli işaretli halkalarda ortadaki simgeden uzak durulur.
// - İpucuyla oynanan çözümde geç kurtulan halka önce gelir: ödülün heyecanı bölümün sonuna kadar sürsün.
//   Son hamlede kurtulanlar en sona kalır (orada bölüm sonu ekranı hemen açılır).
const fs = require('fs');
const path = require('path');
const Logic = require('../logic.js');
const Levels = require('../levels.js');

const root = path.join(__dirname, '..');
const pre = new Function(fs.readFileSync(path.join(root, 'levels_data.js'), 'utf8') + '; return RING_LEVEL_DATA;')();
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);
const CLEAR = 22; // ödülün çevresinde boş kalması gereken yarıçap
const MAX = 3;    // bölüm başına en çok kaç aday halka

const segDist = (px, py, b) => {
  const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
  const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
};
const pieceDist = (px, py, r) => (r.kind === 'frame' ? Math.min(...r.segs.map(s => segDist(px, py, s))) : segDist(px, py, r));

// İpucuna uyarak oynar (balance.js ile aynı); her halkanın kaçıncı hamlede kurtulduğunu döner
function releaseMoves(L) {
  let a = L.startAngles.slice(), m = Logic.cascade(L, a, 0).mask, moves = 0;
  const at = {};
  while (m !== L.full && moves < 30) {
    const s = Logic.solveFast(L, a, m, 2000, 0.8) || Logic.solveFast(L, a, m, 30000);
    if (!s || !s.first) break;
    a = Logic.rotate(L, a, s.first.ring, s.first.delta);
    const next = Logic.cascade(L, a, m).mask;
    moves++;
    for (let i = 0; i < L.rings.length; i++) if ((next & (1 << i)) && !(m & (1 << i))) at[i] = moves;
    m = next;
  }
  return { at, total: moves };
}

// Halkanın içinde, yalnızca bu halkaya ait (başka halkanın içinde olmayan) ve her çizgiden uzak en iyi nokta.
// Ortadaki simgelerden (kilit, anahtar, dişli işareti) de uzak durur.
function spot(L, i, centerBusy) {
  const r = L.rings[i];
  let best = null;
  for (let y = r.y - r.r; y <= r.y + r.r; y += 4) {
    for (let x = r.x - r.r; x <= r.x + r.r; x += 4) {
      const own = r.r - Math.hypot(x - r.x, y - r.y); // kendi çizgisine uzaklık (içerideyse artı)
      if (own < CLEAR) continue;
      if (centerBusy && Math.hypot(x - r.x, y - r.y) < 30) continue;
      if (x < CLEAR || y < CLEAR || x > Levels.BOARD.w - CLEAR || y > Levels.BOARD.h - CLEAR) continue;
      let clear = own;
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

const out = {};
let none = 0;
for (const src of order) {
  const def = get(src), L = Logic.buildLevel(def);
  const deco = new Set((def.deco || []).map(d => d.ring));
  const marked = new Set(L.couples.filter(c => c.ratio !== 1).flatMap(c => [c.a, c.b]));
  const { at, total } = releaseMoves(L);
  const cands = [];
  L.rings.forEach((r, i) => {
    if (r.kind !== 'ring' || deco.has(i) || !at[i]) return;
    const busy = r.fixed || r.lockedBy >= 0 || marked.has(i) || L.rings.some(k => k.lockedBy === i);
    const p = spot(L, i, busy);
    if (p) cands.push({ i, x: p.x, y: p.y, rank: at[i] === total ? -1 : at[i] });
  });
  // Önce son hamleden önce kurtulanlar (geç olan önde), sonra son hamlede kurtulanlar
  const picks = cands.sort((p, q) => q.rank - p.rank || p.i - q.i).slice(0, MAX).map(c => `[${c.i},${c.x},${c.y}]`);
  if (picks.length) out[src] = picks; else none++;
}

const body = Object.keys(out).sort((a, b) => a - b).map(s => `${s}:[${out[s].join(',')}]`).join(',');
fs.writeFileSync(path.join(root, 'loot_data.js'),
  '// tools/build_loot.js üretir; elle düzenlemeyin. Bölüm kimliği -> [halka, x, y] adayları (öncelik sırasıyla).\n' +
  `var RING_LOOT_DATA = {${body}};\n`);
console.log(`loot_data.js: ${Object.keys(out).length} bölümde aday halka var, ${none} bölümde yok.`);
