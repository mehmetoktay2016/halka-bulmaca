// Kullanım: node tools/test_save.js
// Kayıt modülünü (save.js) sınar: eski sürümlerden taşıma, kilit sınırı, bozuk kayıt.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const Save = require('../save.js');

const root = path.join(__dirname, '..');
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  HATA ' + name + '\n       ' + e.message); }
}
function memStorage(init = {}) {
  const data = { ...init };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

// Tarayıcıdaki gibi: logic.js, levels_data.js, levels.js aynı global alanda yüklenir
function browserOrder() {
  const ctx = { Math, JSON, Object, Array, Number, String, Map, Set, Date };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['logic.js', 'levels_data.js', 'levels.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace(/^var RING_LEVEL_DATA/m, 'this.RING_LEVEL_DATA'), ctx);
  }
  return Array.from(ctx.RingLevels.levelOrder(ctx.RingLevels.getLevel));
}

const ORDER = Save.V2_ORDER;

test('v2 sırası, oyunun 1.1 sürümündeki sırayla aynı', () => {
  // levels.js değişince bu karşılaştırma anlamını yitirir; o zaman git'teki 1.1 sürümüne bakılır.
  const src = fs.readFileSync(path.join(root, 'levels.js'), 'utf8');
  if (!/function levelOrder\(get\) \{\n    const intro = \{ fixed: 5, couple: 7, double: 8, bar: 9 \};/.test(src)) {
    console.log('       (levels.js sıralaması değişmiş, karşılaştırma atlandı)');
    return;
  }
  assert.deepStrictEqual(browserOrder(), ORDER);
});

test('v2 sırası 1-60 arasındaki her bölümü tam bir kez içeriyor', () => {
  assert.deepStrictEqual(ORDER.slice().sort((a, b) => a - b), Array.from({ length: 60 }, (_, i) => i + 1));
});

test('hiç kayıt yoksa: temiz başlangıç, 3 ampul, 1. bölüm açık', () => {
  const s = memStorage();
  const p = Save.load(s);
  assert.strictEqual(p.version, 3);
  assert.strictEqual(p.hints, 3);
  assert.deepStrictEqual(p.stars, {});
  assert.strictEqual(Save.frontier(p, ORDER), 1);
  assert.strictEqual(s.getItem(Save.KEY), null, 'boş kayıt diske yazılmamalı');
});

test('v2 kaydı taşınıyor: yıldızlar doğru bölüme, sınır aynı yerde', () => {
  // v2 oyuncusu: 1-12. sıradaki bölümleri bitirmiş, 13. sırada
  const stars = {}, best = {};
  for (let n = 1; n <= 12; n++) { stars[n] = (n % 3) + 1; best[n] = stars[n] * 100 + 25; }
  const v2 = { unlocked: 13, stars, best, sound: false, coins: 47, coinTip: true, tutorialDone: true };
  const s = memStorage({ [Save.V2_KEY]: JSON.stringify(v2) });
  const p = Save.load(s);
  for (let n = 1; n <= 12; n++) {
    assert.strictEqual(p.stars[String(ORDER[n - 1])], stars[n], `sıra ${n}`);
    assert.strictEqual(p.best[String(ORDER[n - 1])], best[n], `sıra ${n} skor`);
  }
  assert.strictEqual(Object.keys(p.stars).length, 12);
  assert.strictEqual(p.coins, 47);
  assert.strictEqual(p.sound, false);
  assert.strictEqual(p.tutorialDone, true);
  assert.strictEqual(p.coinTip, true);
  assert.strictEqual(p.hints, 3, 'eski oyuncu da 3 ampulle başlar');
  assert.strictEqual(Save.frontier(p, ORDER), 13, 'kilit sınırı değişmemeli');
  // Toplam yıldız ve skor korunur
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum(p.stars), sum(stars));
  assert.strictEqual(sum(p.best), sum(best));
  // v3 olarak yazıldı, v2 yerinde duruyor
  assert.strictEqual(JSON.parse(s.getItem(Save.KEY)).version, 3);
  assert.ok(s.getItem(Save.V2_KEY));
});

test('taşıma bir kez yapılır: ikinci açılışta v3 okunur', () => {
  const v2 = { unlocked: 3, stars: { 1: 3, 2: 2 }, best: {}, coins: 5 };
  const s = memStorage({ [Save.V2_KEY]: JSON.stringify(v2) });
  const p = Save.load(s);
  p.coins = 99;
  p.stars['4'] = 1;
  Save.save(s, p);
  const again = Save.load(s);
  assert.strictEqual(again.coins, 99);
  assert.strictEqual(again.stars['4'], 1);
});

test('oyunu bitirmiş v2 oyuncusu: 60 bölüm, sınır sonda', () => {
  const stars = {};
  for (let n = 1; n <= 60; n++) stars[n] = 3;
  const p = Save.fromV2({ unlocked: 60, stars, best: {} });
  assert.strictEqual(Object.keys(p.stars).length, 60);
  assert.strictEqual(Save.frontier(p, ORDER), 60);
});

test('v1 kaydından yalnızca altın ve ayarlar gelir', () => {
  const s = memStorage({ [Save.V1_KEY]: JSON.stringify({ coins: 12, sound: false, stars: { 1: 3 } }) });
  const p = Save.load(s);
  assert.strictEqual(p.coins, 12);
  assert.strictEqual(p.sound, false);
  assert.deepStrictEqual(p.stars, {});
});

test('bozuk kayıt oyunu çökertmez', () => {
  const s = memStorage({ [Save.KEY]: '{bozuk', [Save.V2_KEY]: 'de bozuk' });
  const p = Save.load(s);
  assert.strictEqual(p.version, 3);
});

test('erişilemeyen depolama (gizli sekme) oyunu çökertmez', () => {
  const s = { getItem() { throw new Error('yasak'); }, setItem() { throw new Error('yasak'); } };
  const p = Save.load(s);
  assert.strictEqual(p.version, 3);
  Save.save(s, p);
});

test('2.0 kaydı ödül alanları olmadan açılır: hiçbir şey kaybolmaz, yeni alanlar boş', () => {
  // 2.0 sürümünün yazdığı kayıt: loot, stickers, streak alanları yok
  const old = { ...Save.fresh(), stars: { 1: 3, 52: 2 }, best: { 1: 350 }, coins: 140, hints: 7,
    badges: { 'ilk-adim': '2026-10-01' }, rewards: { 'gate:2': true }, clean: { 1: true }, title: 'Gezgin' };
  delete old.loot; delete old.stickers; delete old.streak;
  const s = memStorage({ [Save.KEY]: JSON.stringify(old) });
  const p = Save.load(s);
  for (const k of ['stars', 'best', 'coins', 'hints', 'badges', 'rewards', 'clean', 'title']) {
    assert.deepStrictEqual(p[k], old[k], k);
  }
  assert.deepStrictEqual(p.loot, {});
  assert.deepStrictEqual(p.stickers, {});
  assert.strictEqual(p.streak, null);
});

test('sıra değişince yıldızlar bölümle birlikte gider', () => {
  const p = Save.fresh();
  p.stars['52'] = 3; // Kedi
  const newOrder = [52, ...ORDER.filter(x => x !== 52)];
  assert.strictEqual(p.stars[String(newOrder[0])], 3);
  assert.strictEqual(Save.frontier(p, newOrder), 2);
});

test('2.2 düzen taşıması: oyuncu ekrandaki yerini korur, bir kez çalışır', () => {
  const oldOrder = [1, 2, 3, 4, 5], newOrder = [2, 1, 3, 5, 4];
  const v3 = { ...Save.fresh(), stars: { 1: 3, 2: 2, 4: 1 }, best: { 1: 300, 2: 200, 4: 100 }, clean: { 2: true }, loot: { 4: 'chest' } };
  delete v3.layout;
  const p = Save.load(memStorage({ [Save.KEY]: JSON.stringify(v3) }));
  assert.strictEqual(p.layout, 3, 'eski kayıt eski düzende sayılır');
  assert.strictEqual(Save.relayout(p, oldOrder, newOrder), true);
  // 1. sıradaki (kimlik 1) kayıt yeni 1. sıradakine (kimlik 2) geçer
  assert.deepStrictEqual(p.stars, { 2: 3, 1: 2, 5: 1 });
  assert.deepStrictEqual(p.best, { 2: 300, 1: 200, 5: 100 });
  assert.deepStrictEqual(p.clean, { 1: true });
  assert.deepStrictEqual(p.loot, { 5: 'chest' });
  assert.strictEqual(Save.frontier(p, newOrder), Save.frontier({ stars: { 1: 3, 2: 2, 4: 1 } }, oldOrder));
  assert.strictEqual(Save.relayout(p, oldOrder, newOrder), false, 'ikinci kez taşımaz');
  assert.strictEqual(Save.fresh().layout, 4, 'yeni oyuncu taşınmaz');
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm kayıt testleri geçti');
process.exit(failed ? 1 : 0);
