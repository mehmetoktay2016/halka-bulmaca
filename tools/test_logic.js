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

test('tıklı halka: hedef en yakın tık yerine çekilir', () => {
  const L = Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, a: 10, step: 45 }] });
  close(Logic.snapStep(L, 0, 70 * DEG), 55 * DEG);   // 10 + 45
  close(Logic.snapStep(L, 0, 300 * DEG), 280 * DEG); // 10 - 90
});

test('tıklı halka: çözücünün her hamlesi tık yerine düşer', () => {
  const Levels = require('../levels.js');
  const L = Logic.buildLevel(Levels.MECH_LEVELS[1003]);
  let a = L.startAngles.slice(), m = 0, n = 0;
  while (m !== L.full && n < 10) {
    const s = Logic.solve(L, a, m, 200000);
    a = Logic.rotate(L, a, s.first.ring, s.first.delta);
    const k = Logic.signedDelta(L.startAngles[0], a[0]) / L.rings[0].step;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-9, 'tıklı halka tık yeri dışında: ' + k);
    m = Logic.cascade(L, a, m).mask;
    n++;
  }
  assert.strictEqual(m, L.full);
});

test("tıklı halka eşli olamaz, adım 360'ı bölmeli", () => {
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, step: 45 }, { x: 170, y: 100, r: 50 }], couples: [[0, 1]] }), /eşli olamaz/);
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, step: 50 }] }), /360/);
});

test('anahtarlı kilit: anahtar halkası tahtadan çıkınca döner', () => {
  const L = Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, lockedBy: 1 }, { x: 170, y: 100, r: 50 }] });
  assert.strictEqual(Logic.canRotate(L, 0, 0), false);
  assert.strictEqual(Logic.canRotate(L, 0, 1 << 1), true);
  assert.strictEqual(Logic.canRotate(L, 1, 0), true);
});

test('anahtarlı kilit: çözücü kilitli halkayı anahtar çıkmadan döndürmez', () => {
  const Levels = require('../levels.js');
  const L = Logic.buildLevel(Levels.MECH_LEVELS[1004]);
  let a = L.startAngles.slice(), m = 0, n = 0;
  while (m !== L.full && n < 10) {
    const s = Logic.solve(L, a, m, 200000);
    if (s.first.ring === 0) assert.ok(m & (1 << 1), 'kilitli halka anahtar çıkmadan döndü');
    a = Logic.rotate(L, a, s.first.ring, s.first.delta);
    m = Logic.cascade(L, a, m).mask;
    n++;
  }
  assert.strictEqual(m, L.full);
});

test('anahtarlı kilit: geçersiz tanımlar hata verir', () => {
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, lockedBy: 0 }] }), /anahtar/);
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, lockedBy: 1, fixed: true }, { x: 170, y: 100, r: 50 }] }), /sabit/);
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, lockedBy: 2 }, { x: 170, y: 100, r: 50 }, { x: 240, y: 100, r: 50 }], couples: [[0, 1]] }), /eşli/);
});

const box = [[110, 190], [290, 190], [290, 370], [110, 370]];

test('çerçeve: her kesen kenar ayrı bağ, bölümün bitişine çerçeve dahil değil', () => {
  const L = Logic.buildLevel({ rings: [{ x: 110, y: 270, r: 66 }, { type: 'frame', points: box }] });
  assert.strictEqual(L.links.length, 1);
  assert.ok(L.links[0].seg, 'bağda kenar bilgisi yok');
  assert.strictEqual(L.full, 1); // yalnızca halka
});

test('çerçeve: hiç tahtadan çıkmaz, halka ondan kurtulunca bölüm biter', () => {
  const L = Logic.buildLevel({ rings: [{ x: 110, y: 270, r: 66, a: 180 }, { type: 'frame', points: box }] });
  // Boşluk (180°) halkanın sol tarafında: kesişimler x=110 çizgisinde, halkanın üstünde ve altında (90°/270°)
  assert.strictEqual(Logic.cascade(L, L.startAngles, 0).mask, 0);
  const a = Logic.rotate(L, L.startAngles, 0, 90 * DEG);
  const m = Logic.cascade(L, a, 0).mask;
  assert.strictEqual(m, L.full);
  assert.ok(!(m & 2), 'çerçeve çıkmamalı');
});

test('çerçeve: köşesi halkanın içinde kalırsa hata verir', () => {
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 120, y: 200, r: 40 }, { type: 'frame', points: box }] }), /köşesi/);
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm kural testleri geçti');
process.exit(failed ? 1 : 0);
