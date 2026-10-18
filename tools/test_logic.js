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

// Yaylı halka: Büyük domino deneme bölümü (yol 0-1-2-3-4, yaylar 0→1, 1→2, 2→3)
const DOMINO = [{ x: 80, y: 160, r: 58, a: 30, kick: [1, 90] }, { x: 150, y: 220, r: 60, a: 220.7, kick: [2, 90] },
  { x: 235, y: 210, r: 58, a: 285, kick: [3, 90] }, { x: 290, y: 285, r: 60, a: 342.8 }, { x: 255, y: 375, r: 62, a: 0 }];

test('yaylı halka: çıkarken hedefini döndürür, zincir tek hamlede dalga dalga sürer', () => {
  const L = Logic.buildLevel({ rings: DOMINO });
  assert.strictEqual(Logic.cascade(L, L.startAngles, 0).mask, 0);
  const sol = Logic.solve(L, L.startAngles, 0);
  assert.strictEqual(sol.moves, 1);
  const c = Logic.cascade(L, Logic.rotate(L, L.startAngles, sol.first.ring, sol.first.delta), 0);
  assert.strictEqual(c.mask, L.full);
  assert.deepStrictEqual(c.waves, [[0], [1], [2], [3, 4]]);
  assert.deepStrictEqual(c.kicks.map(w => w.map(k => k.target)), [[1], [2], [3], []]);
  close(c.angles[1], Logic.norm((220.7 + 90) * DEG));
});

test('yaylı halka: yaysız aynı düzen daha çok hamle ister', () => {
  const L = Logic.buildLevel({ rings: DOMINO.map(({ kick, ...r }) => r) });
  assert.ok(Logic.solve(L, L.startAngles, 0).moves > 1);
});

test('yaylı halka: tahtadan çıkmış hedefe tekme atılmaz', () => {
  const L = Logic.buildLevel({ rings: DOMINO });
  const a = L.startAngles.slice();
  const c = Logic.cascade(L, a, 2); // hedef (1) zaten çıkmış
  assert.ok(c.kicks.flat().every(k => k.target !== 1));
});

test('yaylı halka: geçersiz hedef hata verir (kendisi, sabit, anahtarlı, tık adımına uymayan)', () => {
  const two = (a, b) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }] });
  assert.throws(() => two({ kick: [0, 90] }, {}), /hedefi geçersiz/);
  assert.throws(() => two({ kick: [1, 90] }, { fixed: true }), /hedefi geçersiz/);
  assert.throws(() => two({ kick: [1, 90] }, { lockedBy: 0 }), /hedefi geçersiz/);
  assert.throws(() => two({ kick: [1, 90] }, { step: 60 }), /tık adımına/);
  assert.doesNotThrow(() => two({ kick: [1, 90] }, { step: 45 }));
});

// Jetonlu halka: tanıtım düzeni (0 jetonlu üst halka, sol alt jeton taşır)
const TOKEN = [{ x: 200, y: 215, r: 70, a: 165, tokens: 0 }, { x: 140, y: 320, r: 64, a: 60, token: 0 }, { x: 260, y: 320, r: 64, a: 195 }];

test('jetonlu halka: jetonsuz dönmez, jeton taşıyan kurtulunca jeton gelir, döndürünce harcanır', () => {
  const L = Logic.buildLevel({ rings: TOKEN });
  assert.ok(!Logic.canRotate(L, 0, 0));
  assert.ok(Logic.canRotate(L, 0, 0, [2, null, null]));
  const sol = Logic.solve(L, L.startAngles, 0);
  assert.strictEqual(sol.moves, 2);
  assert.strictEqual(sol.first.ring, 1, 'önce jeton taşıyan halka');
  const c = Logic.cascade(L, Logic.rotate(L, L.startAngles, 1, sol.first.delta), 0, Logic.spend(L, L.tokens, 1));
  assert.ok(c.mask & 2, 'taşıyan kurtuldu');
  assert.deepStrictEqual(c.tokens.flat(), [{ from: 1, to: 0 }]);
  assert.strictEqual(c.left[0], 1);
  assert.strictEqual(Logic.spend(L, c.left, 0)[0], 0);
});

test('jetonlu halka: kural olmasa daha kısa', () => {
  const L = Logic.buildLevel({ rings: TOKEN.map(({ tokens, token, ...r }) => r) });
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 1);
});

test('jetonlu halka: geçersiz tanımlar hata verir', () => {
  const two = (a, b, couples) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }], couples });
  assert.throws(() => two({ token: 1 }, {}), /jetonlu değil/);
  assert.throws(() => two({ tokens: 1 }, {}, [[0, 1]]), /jetonlu halka/);
  assert.throws(() => two({ tokens: 1, kick: [1, 90] }, {}), /jetonlu halka/);
  assert.doesNotThrow(() => two({ tokens: 0 }, { token: 0 }));
});

// Şalter: tanıtım düzeni (başta mavi; 2 mavi, kalanlar turuncu)
const CROSS = [{ x: 145, y: 280, r: 66 }, { x: 200, y: 375, r: 60 }, { x: 255, y: 280, r: 66 }, { x: 200, y: 185, r: 60 }];
const SWITCH = { switch: 0, rings: CROSS.map((r, i) => ({ ...r, a: [75, 180, 345, 315][i], side: [1, 1, 0, 1][i] })) };

test('şalter: yalnızca gösterdiği renk döner; şalter bir hamle, çözücü onu da kullanır', () => {
  const L = Logic.buildLevel(SWITCH);
  assert.ok(Logic.canRotate(L, 2, 0) && !Logic.canRotate(L, 0, 0));
  assert.ok(Logic.canRotate(L, 0, 0, null, 1) && !Logic.canRotate(L, 2, 0, null, 1));
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 3);
  const plain = Logic.buildLevel({ rings: SWITCH.rings.map(({ side, ...r }) => r) });
  assert.strictEqual(Logic.solve(plain, plain.startAngles, 0).moves, 2);
  // turuncu açıkken ilk hamle şalter olmalı (hiçbir halka tek başına işe yaramıyorsa)
  const s = Logic.solve(L, Logic.rotate(L, L.startAngles, 2, 0), 0, 100000, null, 0);
  assert.ok(s.first.toggle || s.first.ring === 2);
});

test('şalter: eşler aynı renkte olmalı, renkli halka şaltersiz bölümde olamaz', () => {
  const two = (a, b, extra) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }], ...extra });
  assert.throws(() => two({ side: 0 }, { side: 1 }, { switch: 0, couples: [[0, 1]] }), /aynı şalter/);
  assert.throws(() => two({ side: 0 }, {}, {}), /şalter yok/);
  assert.doesNotThrow(() => two({ side: 1 }, { side: 1 }, { switch: 0, couples: [[0, 1]] }));
});

// Nabız halka: tanıtım düzeni (üst halkanın kapağı başta açık)
const PULSE = [{ x: 200, y: 215, r: 70, a: 195, pulse: 0 }, { x: 140, y: 320, r: 64, a: 15 }, { x: 260, y: 320, r: 64, a: 180 }];

test('nabız halka: kapak kapalıyken boşluk sayılmaz, her hamle kapağı çevirir, ritmi yakalamak gerekir', () => {
  const L = Logic.buildLevel({ rings: PULSE });
  assert.ok(L.hasPulse);
  const plain = Logic.buildLevel({ rings: PULSE.map(({ pulse, ...r }) => r) });
  const p = Logic.solve(plain, plain.startAngles, 0);
  assert.strictEqual(p.moves, 1);
  // aynı hamle nabızlı bölümde: kapak kapanır (ph 1), hiçbir halka çıkmaz
  const a = Logic.rotate(L, L.startAngles, p.first.ring, p.first.delta);
  assert.strictEqual(Logic.cascade(L, a, 0, null, 1).mask, 0);
  assert.strictEqual(Logic.cascade(L, a, 0, null, 0).mask, L.full, 'kapak açık olsaydı hepsi çıkardı');
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 2);
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm kural testleri geçti');
process.exit(failed ? 1 : 0);
