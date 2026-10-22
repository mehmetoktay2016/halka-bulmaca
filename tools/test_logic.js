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

// Döner tabla: tanıtım düzeni (iki halka tablada)
const TABLE = { rings: [{ x: 159, y: 321, r: 52, a: 270 }, { x: 241, y: 239, r: 52, a: 120 }, { x: 328, y: 280, r: 56, a: 90 },
  { x: 105, y: 375, r: 64, a: 30 }, { x: 295, y: 185, r: 60, a: 270 }], table: { x: 200, y: 280, r: 112, step: 90, carried: [0, 1] } };

test('döner tabla: her konum ayrı düzen, çevirmek taşınan halkaları ve boşluklarını döndürür', () => {
  const L = Logic.buildLevel(TABLE);
  assert.strictEqual(L.table.k, 4);
  assert.strictEqual(L.variants.length, 4);
  const t = Logic.turnTable(L, L.startAngles);
  assert.strictEqual(t.L.tableIdx, 1);
  close(t.angles[0], Logic.norm(L.startAngles[0] + 90 * DEG));
  close(t.angles[2], L.startAngles[2]);
  // taşınan halka 0: (159,321) -> göbek (200,280) etrafında saat yönünde 90°: (159,239)
  assert.ok(Math.abs(t.L.rings[0].x - 159) < 1e-6 && Math.abs(t.L.rings[0].y - 239) < 1e-6);
  let tt = t; for (let k = 0; k < 3; k++) tt = Logic.turnTable(tt.L, tt.angles);
  assert.strictEqual(tt.L, L, 'dört turda başa döner');
});

test('döner tabla: çözücü tablayı da kullanır; tablasız daha uzun', () => {
  const L = Logic.buildLevel(TABLE);
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 2);
  const P = Logic.buildLevel({ rings: TABLE.rings });
  assert.strictEqual(Logic.solve(P, P.startAngles, 0).moves, 3);
  assert.strictEqual(Logic.solveFast(L, L.startAngles, 0, 30000, 0.8).moves, 2);
});

// Bomba halka: tanıtım düzeni ve zincirleme (Z1)
const BOMB = [{ x: 200, y: 215, r: 70, a: 255, bomb: true }, { x: 140, y: 320, r: 64, a: 210 }, { x: 260, y: 320, r: 64, a: 105 }];
const BOMB_CHAIN = [{ x: 80, y: 160, r: 58, a: 60 }, { x: 150, y: 220, r: 60, a: 60, bomb: true }, { x: 235, y: 210, r: 58, a: 285, bomb: true },
  { x: 290, y: 285, r: 60, a: 15, bomb: true }, { x: 255, y: 375, r: 62, a: 180 }, { x: 160, y: 380, r: 58, a: 225 }];
const noBomb = rings => rings.map(({ bomb, ...r }) => r);

test('bomba halka: kurtulunca kesiştiği halkalar kilitli olsalar da sonraki dalgada uçar', () => {
  const L = Logic.buildLevel({ rings: BOMB });
  assert.strictEqual(Logic.cascade(L, L.startAngles, 0).mask, 0);
  const sol = Logic.solve(L, L.startAngles, 0);
  assert.strictEqual(sol.moves, 1);
  const c = Logic.cascade(L, Logic.rotate(L, L.startAngles, sol.first.ring, sol.first.delta), 0);
  assert.deepStrictEqual(c.waves, [[0], [1, 2]]);
  assert.deepStrictEqual(c.blasts, [[{ from: 0, hits: [1, 2] }], []]);
  const P = Logic.buildLevel({ rings: noBomb(BOMB) });
  assert.strictEqual(Logic.solve(P, P.startAngles, 0).moves, 2);
});

test('bomba halka: patlamaya yakalanan bomba da patlar (zincir), çıkmış halka vurulmaz', () => {
  const L = Logic.buildLevel({ rings: BOMB_CHAIN });
  const sol = Logic.solve(L, L.startAngles, 0);
  assert.strictEqual(sol.moves, 2);
  const after1 = Logic.cascade(L, Logic.rotate(L, L.startAngles, sol.first.ring, sol.first.delta), 0);
  const s2 = Logic.solve(L, after1.angles, after1.mask);
  const c = Logic.cascade(L, Logic.rotate(L, after1.angles, s2.first.ring, s2.first.delta), after1.mask);
  assert.deepStrictEqual(c.blasts.flat(), [{ from: 1, hits: [2] }, { from: 2, hits: [3] }, { from: 3, hits: [4] }]);
  assert.strictEqual(c.mask, L.full);
  assert.strictEqual(Logic.solve(Logic.buildLevel({ rings: noBomb(BOMB_CHAIN) }), L.startAngles, 0).moves, 5);
});

test('bomba halka: yalnızca halka bomba olabilir', () => {
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50 }, { type: 'bar', x1: 40, y1: 100, x2: 160, y2: 100, bomb: true }] }), /bomba yalnızca halka/);
});

// Buz halka (Z2): çift katlı göbek halka, iki komşusu çıkınca erir
const ICE = [{ x: 145, y: 280, r: 66, a: 135, ice: 2 }, { x: 200, y: 375, r: 60, a: 180 }, { x: 255, y: 280, r: 66, a: 165 }, { x: 200, y: 185, r: 60, a: 15 }];

test('buz halka: donmuşken dönmez, her çıkan komşu bir kat çatlatır, bitince döner', () => {
  const L = Logic.buildLevel({ rings: ICE });
  assert.strictEqual(Logic.iceLeft(L, 0, 0), 2);
  assert.strictEqual(Logic.canRotate(L, 0, 0), false);
  assert.strictEqual(Logic.iceLeft(L, 0, 1 << 1), 1);
  assert.strictEqual(Logic.canRotate(L, 0, 1 << 1), false);
  assert.strictEqual(Logic.iceLeft(L, 0, 1 << 1 | 1 << 2), 0);
  assert.strictEqual(Logic.canRotate(L, 0, 1 << 1 | 1 << 2), true);
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 3);
  assert.strictEqual(Logic.solve(Logic.buildLevel({ rings: ICE.map(({ ice, ...r }) => r) }), L.startAngles, 0).moves, 2);
});

test('buz halka: patlama donmuş halkayı da uçurur', () => {
  const rings = [{ x: 145, y: 280, r: 66, a: 0, ice: 2 }, { x: 200, y: 375, r: 60, a: 45 }, { x: 255, y: 280, r: 66, a: 15, bomb: true }, { x: 200, y: 185, r: 60, a: 180 }];
  const L = Logic.buildLevel({ rings });
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 2);
});

test('buz halka: geçersiz tanımlar hata verir', () => {
  const two = (a, b) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }] });
  assert.throws(() => two({ ice: 2 }, {}), /eritecek kadar komşusu/);
  assert.throws(() => two({ ice: 1, fixed: true }, {}), /buz/);
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ice: 1 }, { x: 170, y: 100, r: 50 }], couples: [[0, 1]] }), /buz halka eşli/);
  assert.throws(() => two({ kick: [1, 90] }, { ice: 1 }), /hedefi geçersiz/);
});

// Motor halka (Z3): üstteki halka motorlu, her hamleden sonra çeyrek tur döner
const MOTOR = [{ x: 200, y: 215, r: 70, a: 240, motor: 90 }, { x: 140, y: 320, r: 64, a: 15 }, { x: 260, y: 320, r: 64, a: 180 }];

test('motor halka: oyuncu çeviremez, her hamleden sonra kendiliğinden bir adım döner', () => {
  const L = Logic.buildLevel({ rings: MOTOR });
  assert.strictEqual(Logic.canRotate(L, 0, 0), false);
  // İlk hamle hiçbir halkayı kurtarmasa da motor döner (boş dalgada motor tekmesi)
  const a = Logic.rotate(L, L.startAngles, 1, 10 * DEG);
  const c = Logic.afterMove(L, a, 0);
  assert.deepStrictEqual(c.waves, [[]]);
  assert.deepStrictEqual(c.kicks[0].map(k => [k.target, k.motor]), [[0, true]]);
  close(c.angles[0], 330 * DEG);
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 2);
  assert.strictEqual(Logic.solve(Logic.buildLevel({ rings: MOTOR.map(({ motor, ...r }) => r) }), L.startAngles, 0).moves, 1);
});

test('motor halka: hamlenin kurtardıkları önce uçar, motor sonra döner ve yeni dalgalar gelir', () => {
  const L = Logic.buildLevel({ rings: MOTOR });
  let st = { angles: L.startAngles, mask: 0 };
  for (let k = 0; k < 2; k++) {
    const s = Logic.solve(L, st.angles, st.mask);
    const c = Logic.afterMove(L, Logic.rotate(L, st.angles, s.first.ring, s.first.delta), st.mask);
    const w = c.kicks.findIndex(ks => ks.some(x => x.motor));
    // motor tekmesi hep ilk aşamanın son dalgasında; ondan sonraki dalgalarda motor yok
    assert.ok(w >= 0 || (c.mask & 1));
    st = c;
  }
  assert.strictEqual(st.mask, L.full);
});

test('motor halka: geçersiz tanımlar hata verir', () => {
  const two = (a, b) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }] });
  assert.throws(() => two({ motor: 70 }, {}), /motor adımı/);
  assert.throws(() => two({ motor: 90, ice: 1 }, {}), /motor halka başka/);
  assert.throws(() => two({ motor: 90, step: 45 }, {}), /motor halka başka/);
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, motor: 90 }, { x: 170, y: 100, r: 50 }], couples: [[0, 1]] }), /motor halka eşli/);
  assert.throws(() => two({ kick: [1, 90] }, { motor: 90 }), /hedefi geçersiz/);
});

// İkiz portal (Z4): üstteki ve sağdaki halka ikiz
const PORTAL = [{ x: 200, y: 215, r: 70, a: 195, portal: 1 }, { x: 140, y: 320, r: 64, a: 300 }, { x: 260, y: 320, r: 64, a: 330, portal: 1 }];

test('ikiz portal: biri çıkınca öbürü bağlarına bakılmadan sonraki dalgada çıkar', () => {
  const L = Logic.buildLevel({ rings: PORTAL });
  assert.deepStrictEqual(L.twin, [2, -1, 0]);
  const s = Logic.solve(L, L.startAngles, 0);
  assert.strictEqual(s.moves, 1);
  const c = Logic.cascade(L, Logic.rotate(L, L.startAngles, s.first.ring, s.first.delta), 0);
  assert.strictEqual(c.mask, L.full);
  const tp = c.portals.flat();
  assert.strictEqual(tp.length, 1);
  assert.strictEqual(L.twin[tp[0].from], tp[0].to);
  assert.strictEqual(Logic.solve(Logic.buildLevel({ rings: PORTAL.map(({ portal, ...r }) => r) }), L.startAngles, 0).moves, 2);
});

test('ikiz portal: geçersiz tanımlar hata verir', () => {
  const two = (a, b) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }] });
  assert.throws(() => two({ portal: 1 }, {}), /tam iki halkada/);
  assert.throws(() => two({ portal: 1, bomb: true }, { portal: 1 }), /portal yalnızca/);
  assert.throws(() => two({ portal: 1 }, { portal: 1, motor: 90 }), /portal yalnızca/);
  // Portalsız çubuklar birbirinin ikizi sayılmamalı
  const bars = Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50 }, { type: 'bar', x1: 40, y1: 100, x2: 160, y2: 100 }, { type: 'bar', x1: 100, y1: 40, x2: 100, y2: 160 }] });
  assert.deepStrictEqual(bars.twin, [-1, -1, -1]);
});

// Basınç kazanı (Z19): zincirin ortasındaki halka 1 basınçlı kazan
const BOILER = [{ x: 80, y: 160, r: 58, a: 45 }, { x: 150, y: 220, r: 60, a: 75 }, { x: 235, y: 210, r: 58, a: 300, boiler: 1 },
  { x: 290, y: 285, r: 60, a: 0 }, { x: 255, y: 375, r: 62, a: 45 }];

test('basınç kazanı: komşusu çıkınca basınç dolar, kazan çıkıp patlar ve değdiklerini uçurur', () => {
  const L = Logic.buildLevel({ rings: BOILER });
  assert.strictEqual(Logic.pressureLeft(L, 2, 0), 1);
  assert.strictEqual(Logic.pressureLeft(L, 2, 1 << 1), 0);
  // En iyi çözümde kazan basınçla dolar: dolduğu dalgadan sonra çıkar ve hâlâ değdiği komşusunu patlatır
  let st = { angles: L.startAngles, mask: 0 }, fusedAt = -1, c = null;
  while (st.mask !== L.full && fusedAt < 0) {
    const q = Logic.solve(L, st.angles, st.mask);
    c = Logic.cascade(L, Logic.rotate(L, st.angles, q.first.ring, q.first.delta), st.mask);
    fusedAt = c.fuses.findIndex(f => f.includes(2));
    st = c;
  }
  assert.ok(fusedAt >= 0);
  assert.ok(c.waves[fusedAt + 1].includes(2));
  assert.ok(c.blasts[fusedAt + 1].some(b => b.from === 2 && b.hits.length));
  assert.strictEqual(Logic.solve(L, L.startAngles, 0).moves, 2);
  assert.strictEqual(Logic.solve(Logic.buildLevel({ rings: BOILER.map(({ boiler, ...r }) => r) }), L.startAngles, 0).moves, 4);
});

test('basınç kazanı: geçersiz tanımlar hata verir', () => {
  const two = (a, b) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }] });
  assert.throws(() => two({ boiler: 2 }, {}), /dolduracak kadar komşusu/);
  assert.throws(() => two({ boiler: 1, bomb: true }, {}), /kazan 1-3/);
  assert.throws(() => two({ boiler: 4 }, {}), /kazan 1-3/);
});

// Dev halka (Z9): Davul şeklinin gövdesi 2 zırhlı dev halka (3 komşusu var); iki komşusu gidince parçalanır
const BOSS = [{ x: 200, y: 260, r: 84, a: 45, boss: 2 }, { x: 140.6, y: 200.6, r: 26, a: 75 }, { x: 259.4, y: 200.6, r: 26, a: 255 }, { x: 200, y: 348, r: 30, a: 300 }];

test('dev halka: zırhlıyken dönmez, komşuları gittikçe plaka kırılır, zırh bitince parçalanıp çıkar', () => {
  const L = Logic.buildLevel({ rings: BOSS, couples: [[1, 2, -1]] });
  assert.strictEqual(Logic.armorLeft(L, 0, 0), 2);
  assert.strictEqual(Logic.canRotate(L, 0, 0), false);
  assert.strictEqual(Logic.armorLeft(L, 0, 1 << 1), 1);
  // Bir komşusu gitmiş tahtada ikinci komşu (2) kurtulunca zırh biter: dev halka sonraki dalgada parçalanır, patlamaz
  let c = null;
  for (let d = 0; d < 360 && !(c && c.waves[0] && c.waves[0].includes(2) && !c.waves[0].includes(0)); d += 5) c = Logic.cascade(L, Logic.rotate(L, L.startAngles, 2, d * DEG), 1 << 1);
  assert.ok(c.waves[0].includes(2));
  const w = c.fuses.findIndex(f => f.includes(0));
  assert.ok(w >= 0 && c.waves[w + 1].includes(0));
  assert.ok(!c.blasts.flat().some(b => b.from === 0));
});

test('dev halka: geçersiz tanımlar hata verir', () => {
  const two = (a, b) => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, ...a }, { x: 170, y: 100, r: 50, ...b }] });
  assert.throws(() => two({ boss: 2 }, {}), /zırhını kıracak kadar komşusu/);
  assert.throws(() => two({ boss: 1, ice: 1 }, {}), /dev halka 1-6/);
  assert.throws(() => Logic.buildLevel({ rings: [{ x: 100, y: 100, r: 50, boss: 1 }, { x: 170, y: 100, r: 50 }], couples: [[0, 1]] }), /dev halka eşli/);
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm kural testleri geçti');
process.exit(failed ? 1 : 0);
