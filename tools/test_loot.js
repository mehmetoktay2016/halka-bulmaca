// Kullanım: node tools/test_loot.js
// Halka ödüllerini (rewards.js + loot_data.js) sınar: yerler bölümlerle uyumlu, kurallar sabit ve tohumlu.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Logic = require('../logic.js');
const Levels = require('../levels.js');
const W = require('../worlds.js');
const R = require('../rewards.js');

const root = path.join(__dirname, '..');
const pre = new Function(fs.readFileSync(path.join(root, 'levels_data.js'), 'utf8') + '; return RING_LEVEL_DATA;')();
const LOOT = new Function(fs.readFileSync(path.join(root, 'loot_data.js'), 'utf8') + '; return RING_LOOT_DATA;')();
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);
const G = order.length / W.GATE_SIZE;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  HATA ' + name + '\n       ' + e.message); }
}
const chestsOf = g => R.chestPositions(g, p => !!LOOT[order[W.gateStart(g) + p - 2]], W.GATE_SIZE);

test('loot_data.js bugünkü bölümlerle uyumlu (değilse: node tools/build_loot.js)', () => {
  for (const [src, cands] of Object.entries(LOOT)) {
    const def = get(Number(src));
    assert.ok(def && order.includes(Number(src)), `bölüm ${src} yok`);
    const L = Logic.buildLevel(def);
    for (const [i, x, y] of cands) {
      const r = L.rings[i];
      assert.ok(r && r.kind === 'ring', `bölüm ${src}: ${i} halka değil`);
      assert.ok(Math.hypot(x - r.x, y - r.y) < r.r - 20, `bölüm ${src}: ödül halka ${i}'nin içinde değil`);
      assert.ok(!(def.deco || []).some(d => d.ring === i), `bölüm ${src}: halka ${i} süslü`);
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

test('aynı bölüm her zaman aynı sandığı verir (tohumlu)', () => {
  for (const src of order.slice(0, 40)) {
    assert.deepStrictEqual(R.chestFor(src, 5), R.chestFor(src, 5));
  }
  assert.deepStrictEqual([...chestsOf(7)], [...chestsOf(7)]);
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

console.log(failed ? `\n${failed} test başarısız` : '\nTüm ödül testleri geçti');
process.exit(failed ? 1 : 0);
