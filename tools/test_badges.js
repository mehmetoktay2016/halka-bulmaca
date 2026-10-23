// Kullanım: node tools/test_badges.js
// Başarım listesini (achievements.js) sınar: kimlikler, kademeler, ilerleme ve kazanma.
const assert = require('assert');
const B = require('../achievements.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  HATA ' + name + '\n       ' + e.message); }
}

// Hiçbir şey yapmamış oyuncu
const zero = {
  wins: 0, gatesDone: 0, worldsSeen: 1, stars: 0, perfect: 0, goldGates: 0, hintless: 0,
  bestChain: 0, chains: 0, comebacks: 0, shapes: 0, shapesTotal: 10, coinsTotal: 0, bulbsBought: 0, hintsUsed: 0, st: {},
};

test('53 rozet, kimlikler tekil ve kebab-case', () => {
  assert.strictEqual(B.BADGES.length, 53);
  assert.ok(B.BADGES.every(b => B.ICONS[b.icon] && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.id)));
  const ids = B.BADGES.map(b => b.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

test('her rozetin kademesi, simgesi, adı ve açıklaması var', () => {
  for (const b of B.BADGES) {
    assert.ok(B.TIERS[b.tier], b.id + ' kademe');
    assert.ok(B.ICONS[b.icon], b.id + ' simge');
    assert.ok(b.name && b.desc, b.id + ' metin');
  }
});

test('yeni oyuncu hiçbir rozeti kazanmamış', () => {
  assert.deepStrictEqual(B.newlyEarned({}, zero), []);
});

test('ilk bölüm "İlk Adım"ı verir', () => {
  assert.deepStrictEqual(B.newlyEarned({}, { ...zero, wins: 1 }).map(b => b.id), ['ilk-adim']);
});

test('kazanılmış rozet ikinci kez verilmez', () => {
  assert.deepStrictEqual(B.newlyEarned({ 'ilk-adim': '2026-10-15' }, { ...zero, wins: 5 }), []);
});

test('ilerleme hedefte kesilir', () => {
  const b = B.BADGES.find(x => x.id === 'yildiz-50');
  assert.deepStrictEqual(B.status(b, { ...zero, stars: 20 }), { value: 20, goal: 50, done: false });
  assert.deepStrictEqual(B.status(b, { ...zero, stars: 80 }), { value: 50, goal: 50, done: true });
});

test('albüm hedefi oyundaki şekil sayısına göre', () => {
  const b = B.BADGES.find(x => x.id === 'album-tamam');
  assert.strictEqual(B.status(b, { ...zero, shapes: 9 }).done, false);
  assert.strictEqual(B.status(b, { ...zero, shapes: 10 }).done, true);
  assert.strictEqual(B.status(b, { ...zero, shapes: 10, shapesTotal: 40 }).done, false);
  // Şekil yokken albüm kendiliğinden tamamlanmış sayılmaz
  assert.strictEqual(B.status(b, { ...zero, shapesTotal: 0 }).done, false);
});

test('zincir rozetleri bir hamledeki halka sayısına bakar', () => {
  const ids = B.newlyEarned({}, { ...zero, bestChain: 3 }).map(b => b.id);
  assert.deepStrictEqual(ids.sort(), ['domino', 'zincirleme']);
});

test('2.5 sayaç rozetleri oyuncu kaydının stats alanına bakar', () => {
  const ids = B.newlyEarned({}, { ...zero, st: { bosses: 1, rains: 1, lastBreath: 1 } }).map(b => b.id);
  assert.deepStrictEqual(ids.sort(), ['dev-avcisi', 'son-nefes', 'yagmur-cocugu']);
  assert.ok(B.BADGES.filter(b => b.secret).length === 3);
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm rozet testleri geçti');
process.exit(failed ? 1 : 0);
