// Kullanım: node tools/test_loot.js
// Halka ödüllerini (rewards.js + loot_data.js) sınar: yerler bölümlerle uyumlu, kurallar sabit ve tohumlu.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Logic = require('../logic.js');
const W = require('../worlds.js');
const R = require('../rewards.js');

const root = path.join(__dirname, '..');
const LOOT = new Function(fs.readFileSync(path.join(root, 'loot_data.js'), 'utf8') + '; return RING_LOOT_DATA;')();
// Konumlar tarayıcıdaki gibi (ortalanmış) denetlenir
const { getLevel: get, order } = require('./browser_levels.js')();
const G = order.length / W.GATE_SIZE;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  HATA ' + name + '\n       ' + e.message); }
}
const planOf = g => R.gatePlan(g, p => LOOT[order[W.gateStart(g) + p - 2]], W.GATE_SIZE);
const chestsOf = g => new Set([...planOf(g)].filter(([, t]) => t === 'chest').map(([p]) => p));

test('loot_data.js bugünkü bölümlerle uyumlu (değilse: node tools/build_loot.js)', () => {
  for (const [src, cands] of Object.entries(LOOT)) {
    const def = get(Number(src));
    assert.ok(def && order.includes(Number(src)), `bölüm ${src} yok`);
    const L = Logic.buildLevel(def);
    for (const [i, x, y] of cands) {
      const r = L.rings[i];
      assert.ok(r && r.kind === 'ring', `bölüm ${src}: ${i} halka değil`);
      assert.ok(Math.hypot(x - r.x, y - r.y) < r.r - 20, `bölüm ${src}: ödül halka ${i}'nin içinde değil`);
      // Başka hiçbir halkanın çizgisine yakın değil
      L.rings.forEach((o, j) => {
        if (j !== i && o.kind === 'ring') assert.ok(Math.abs(Math.hypot(x - o.x, y - o.y) - o.r) > 20, `bölüm ${src}: ödül halka ${j}'nin çizgisinde`);
      });
      assert.ok(!(def.deco || []).some(d => d.ring === i), `bölüm ${src}: halka ${i} süslü`);
      assert.ok(!(def.table && def.table.carried.includes(i)), `bölüm ${src}: halka ${i} tablada taşınıyor`);
    }
  }
});

test('1. kapıda tek tanıtım sandığı, diğer kapılarda kural kadar; kapının 1. bölümünde sandık yok', () => {
  assert.strictEqual(chestsOf(1).size, 1);
  for (let g = 2; g <= G; g++) {
    const c = chestsOf(g);
    assert.strictEqual(c.size, R.LOOT.chestsPerGate, `kapı ${g}`);
    assert.ok(!c.has(1), `kapı ${g}: 1. bölümde sandık`);
  }
});

test('altın halka kapı başına en çok bir (altın sığmayan kapıda yok), ampul halkası yalnız listedeki kapılarda', () => {
  let golds = 0;
  for (let g = 1; g <= G; g++) {
    const types = [...planOf(g).values()];
    const n = t => types.filter(x => x === t).length;
    golds += n('gold');
    assert.ok(n('gold') <= (g === 1 ? 0 : R.LOOT.goldPerGate), `kapı ${g} altın`);
    assert.strictEqual(n('bulb'), R.LOOT.bulbGates.includes(g) ? 1 : 0, `kapı ${g} ampul`);
    assert.ok(!planOf(g).has(1), `kapı ${g}: 1. bölümde ödül`);
  }
  assert.ok(golds >= (G - 1) * 0.8, `yalnız ${golds} altın halka`);
});

test('altın halkalı bölümlere en az goldCoins altın sığıyor', () => {
  for (let g = 2; g <= G; g++) {
    for (const [p, t] of planOf(g)) {
      if (t !== 'gold') continue;
      const spot = R.spotFor('gold', LOOT[order[W.gateStart(g) + p - 2]]);
      assert.ok(spot && spot[3] >= R.LOOT.goldCoins, `kapı ${g} bölüm ${p}`);
    }
  }
});

test('aynı bölüm her zaman aynı sandığı verir (tohumlu)', () => {
  for (const src of order.slice(0, 40)) {
    assert.deepStrictEqual(R.chestFor(src, 5), R.chestFor(src, 5));
  }
  assert.deepStrictEqual([...planOf(7)], [...planOf(7)]);
});

test('sandık içerikleri tablodaki aralıkta', () => {
  for (let g = 2; g <= G; g++) {
    for (const p of chestsOf(g)) {
      const c = R.chestFor(order[W.gateStart(g) + p - 2], g);
      const [lo, hi] = R.LOOT.chest[c.rarity].coins;
      assert.ok(c.coins >= lo && c.coins <= hi, `kapı ${g}: ${c.coins} altın`);
      assert.ok(c.bulbs === 0 || c.bulbs === 1);
      if (c.rarity === 'common') assert.strictEqual(c.bulbs, 0);
      if (c.rarity === 'epic') assert.strictEqual(c.bulbs, 1);
    }
  }
});

test('her nadirlikten en az bir sandık var; efsane, sıradandan az', () => {
  const n = { common: 0, rare: 0, epic: 0 };
  for (let g = 2; g <= G; g++) for (const p of chestsOf(g)) n[R.chestFor(order[W.gateStart(g) + p - 2], g).rarity]++;
  assert.ok(n.common && n.rare && n.epic, JSON.stringify(n));
  assert.ok(n.epic < n.common, JSON.stringify(n));
});

const STK = require('../stickers.js');
const worldLevels = id => order.map((_, i) => i + 1).filter(n => W.worldOfGate(W.gateOf(n)).id === id);

test('her dünyanın çıkartması ve 5 parçası var; parçalar farklı bölümlerde, sonuncusu dünyanın son bölümünde', () => {
  for (const w of W.WORLDS) {
    const levels = worldLevels(w.id);
    if (!levels.length) continue; // bölümleri henüz eklenmemiş dünya
    assert.ok(STK.SETS[w.id] && STK.SETS[w.id].name, w.id + ' çıkartması yok');
    const at = R.stickerLevels(levels);
    assert.strictEqual(at.length, STK.PIECES, w.id);
    assert.strictEqual(new Set(at).size, STK.PIECES, w.id + ' aynı bölümde iki parça');
    assert.strictEqual(at[STK.PIECES - 1], levels[levels.length - 1], w.id + ' son parça');
    for (const n of at) assert.ok(W.posInGate(n) !== 1, `${w.id}: parça kapının ilk bölümünde (${n})`);
  }
});

test('çıkartma çizimi her durumda geçerli SVG', () => {
  for (const id of Object.keys(STK.SETS)) {
    for (const owned of [[0, 0, 0, 0, 0], [1, 0, 1, 0, 0], [1, 1, 1, 1, 1]]) {
      const s = STK.svg(id, owned.map(Boolean), '#2dd4bf', 2);
      assert.ok(s.startsWith('<svg') && s.endsWith('</svg>'), id);
      assert.ok(!/undefined|NaN/.test(s), id + ' çiziminde boş değer');
    }
  }
});

test('günlük seri: aynı gün ikinci kez yok, ertesi gün artar, kaçırılan gün kadar geri düşer, 7 günde bir başa döner', () => {
  assert.strictEqual(R.streakStep({ day: '2026-10-16', count: 3 }, '2026-10-16'), null);
  const first = R.streakStep(null, '2026-10-16');
  assert.deepStrictEqual([first.count, first.slot, first.missed], [1, 0, 0]);
  assert.strictEqual(R.streakStep({ day: '2026-10-15', count: 3 }, '2026-10-16').count, 4);
  assert.strictEqual(R.streakStep({ day: '2026-10-13', count: 5 }, '2026-10-16').count, 4);
  assert.strictEqual(R.streakStep({ day: '2026-10-01', count: 3 }, '2026-10-16').count, 1, 'uzun aradan sonra en az 1');
  assert.strictEqual(R.streakStep({ day: '2026-10-15', count: 7 }, '2026-10-16').slot, 0);
  assert.strictEqual(R.streakStep({ day: '2026-12-31', count: 2 }, '2027-01-01').count, 3, 'yıl dönümü');
  assert.strictEqual(R.streakStep({ day: '2026-10-17', count: 2 }, '2026-10-16').count, 3, 'saat geri alınsa da çökmez');
  const last = R.streakStep({ day: '2026-10-15', count: 6 }, '2026-10-16');
  assert.strictEqual(last.reward.rarity, 'epic');
  assert.strictEqual(last.reward.bulbs, 1);
});

test('mağaza: her bölümün ilki bedava, kimlikler tekil, fiyatlar pozitif', () => {
  const ids = [];
  for (const [cat, c] of Object.entries(R.SHOP)) {
    assert.strictEqual(c.items[0].price, 0, cat + ' bedava ilk ürün');
    for (const it of c.items.slice(1)) assert.ok(it.price > 0, it.id);
    for (const it of c.items) { ids.push(it.id); assert.ok(it.name && it.desc, it.id); assert.strictEqual(R.shopItem(it.id), it); }
  }
  assert.strictEqual(new Set(ids).size, ids.length);
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm ödül testleri geçti');
process.exit(failed ? 1 : 0);
