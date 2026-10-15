// Kullanım: node tools/test_logic.js
// Kural motorunu (logic.js) sınar: eşli halkaların dönüş oranları (ters ve hızlı dişli).
const assert = require('assert');
const Logic = require('../logic.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  HATA ' + name + '\n       ' + e.message); }
}
const DEG = Logic.DEG;
const close = (a, b) => assert.ok(Logic.angDist(a, b) < 1e-9, `${a / DEG}° ≠ ${b / DEG}°`);
const level = couples => Logic.buildLevel({
  rings: [{ x: 100, y: 100, r: 50 }, { x: 170, y: 100, r: 50 }, { x: 240, y: 100, r: 50 }],
  couples,
});

test('eş tanımı oransızsa aynı yöne aynı açı', () => {
  const L = level([[0, 1]]);
  const a = Logic.rotate(L, [0, 0, 0], 0, 30 * DEG);
  close(a[0], 30 * DEG); close(a[1], 30 * DEG); close(a[2], 0);
});

test('ters dişli (-1): eşi aynı açıyla ters yöne döner, hangisi çevrilirse çevrilsin', () => {
  const L = level([[0, 1, -1]]);
  let a = Logic.rotate(L, [0, 0, 0], 0, 40 * DEG);
  close(a[0], 40 * DEG); close(a[1], -40 * DEG);
  a = Logic.rotate(L, [0, 0, 0], 1, 40 * DEG);
  close(a[0], -40 * DEG); close(a[1], 40 * DEG);
});

test('hızlı dişli (2): eşi iki kat, eşi çevrilince yarım döner', () => {
  const L = level([[0, 1, 2]]);
  let a = Logic.rotate(L, [0, 0, 0], 0, 30 * DEG);
  close(a[1], 60 * DEG);
  a = Logic.rotate(L, [0, 0, 0], 1, 30 * DEG);
  close(a[0], 15 * DEG);
});

test('zincir: oranlar çarpılır (0→1 ters, 1→2 hızlı)', () => {
  const L = level([[0, 1, -1], [1, 2, 2]]);
  const a = Logic.rotate(L, [0, 0, 0], 0, 10 * DEG);
  close(a[1], -10 * DEG); close(a[2], -20 * DEG);
  assert.deepStrictEqual(L.group[0].slice().sort(), [0, 1, 2]);
});

test('çelişen oranlar hata verir', () => {
  assert.throws(() => level([[0, 1, -1], [1, 2, 1], [2, 0, 1]]), /çelişiyor/);
});

test('kilitli halkaya bağlı eş dönmez', () => {
  const L = Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, fixed: true }, { x: 170, y: 100, r: 50 }], couples: [[0, 1, -1]] });
  assert.deepStrictEqual(L.rotatable, [false, false]);
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm kural testleri geçti');
process.exit(failed ? 1 : 0);
