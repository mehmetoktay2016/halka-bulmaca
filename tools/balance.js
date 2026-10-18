// Kullanım: node tools/balance.js   (HINT_NODES=10000 node tools/balance.js: farklı ipucu bütçesi)
// Denge testi: oyuncunun gördüğü 200 bölümün her birini yalnızca ipucuna uyarak oynar.
// - Her bölüm hamle hakkı içinde bitmeli (ipucu takılırsa oyuncu da takılır).
// - İpucunun en yavaş adımı ölçülür (telefonda gecikme hissedilmemeli).
// - Altın, ampul ve rozet ekonomisinin toplamları çıkarılır.
const fs = require('fs');
const path = require('path');
const Logic = require('../logic.js');
const Levels = require('../levels.js');
const Badges = require('../achievements.js');

const pre = new Function(fs.readFileSync(path.join(__dirname, '..', 'levels_data.js'), 'utf8') + '; return RING_LEVEL_DATA;')();
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);

// game.js ile aynı kurallar
const moveCap = src => ({ 9: 12, 10: 14 })[Levels.maxParOf(src)] || 10; // game.js ile aynı
const moveLimit = (par, src) => Math.min(moveCap(src), par + Math.max(3, Math.ceil(par * 0.6)));
// İpucu arama bütçesi (game.js ile aynı olmalı); farklı bütçeleri denemek için HINT_NODES verilebilir
const HINT_NODES = Number(process.env.HINT_NODES || 2000);
const FALLBACK_NODES = Number(process.env.FALLBACK_NODES || 30000);
const bestMove = (L, a, m) => Logic.solveFast(L, a, m, HINT_NODES, 0.8) || Logic.solveFast(L, a, m, FALLBACK_NODES);

let failed = 0, slowest = 0, slowestAt = 0, threeStar = 0, coinLinks = 0;
const rows = [];
order.forEach((src, i) => {
  const n = i + 1, def = get(src), L = Logic.buildLevel(def);
  const limit = moveLimit(def.par, src);
  let { mask: m, angles: a } = Logic.cascade(L, L.startAngles.slice(), 0), moves = 0;
  while (m !== L.full && moves < limit + 2) {
    const t0 = Date.now();
    const s = bestMove(L, a, m);
    const ms = Date.now() - t0;
    if (ms > slowest) { slowest = ms; slowestAt = n; }
    if (!s || !s.first) break;
    ({ mask: m, angles: a } = Logic.cascade(L, Logic.rotate(L, a, s.first.ring, s.first.delta), m));
    moves++;
  }
  const ok = m === L.full && moves <= limit;
  if (!ok) failed++;
  if (ok && moves <= def.par) threeStar++;
  // Altın: oyun her bölüme 1-3 altını halka-halka kesişimlerine koyar (en çok bağ sayısı kadar)
  coinLinks += Math.min(2, L.links.filter(k => L.rings[k.a].kind === 'ring' && L.rings[k.b].kind === 'ring').length);
  rows.push({ n, src, par: def.par, limit, moves, ok });
  if (!ok) console.log(`Bölüm ${n} (#${src}): ipucuyla ${moves} hamle, hak ${limit}  <-- BİTMEDİ`);
});

const G = order.length / 10;
const shapes = order.filter(s => Levels.SHAPE_PLAN[s]).length;
const badgeCoins = Badges.BADGES.reduce((s, b) => s + Badges.TIERS[b.tier].coins, 0);
const tight = rows.filter(r => r.limit - r.par <= 2).length;
console.log(`\nİpucuyla oynanan ${order.length} bölüm: ${order.length - failed} hamle hakkı içinde bitti, ${threeStar} tanesi 3 yıldızla`);
console.log(`İpucunun en yavaş adımı: ${slowest} ms (bölüm ${slowestAt}; bu bilgisayarda, telefonda birkaç kat yavaş)`);
console.log(`Hata payı 2 hamle ya da daha az olan bölüm: ${tight}`);
console.log('\nEkonomi (yolculuğun tamamı):');
console.log(`  bölümlerdeki altın: ortalama ~${coinLinks} (bölüm başına ortalama 2, 1-3 arası rastgele)`);
console.log(`  rozet altını: ${badgeCoins} (25 rozet)`);
console.log(`  ampul: başlangıç 3 + kapı açılışı ${G - 1} + altın kapı en çok ${G * 3} = en çok ${3 + G - 1 + G * 3}`);
console.log(`  altınla alınabilecek ampul: ~${Math.floor((coinLinks + badgeCoins) / 20)} (20 altın = 1 ampul)`);
console.log(`  şekil (albüm): ${shapes}`);
process.exit(failed ? 1 : 0);
