// Kullanım: node tools/test_i18n.js
// Dil desteğini (i18n.js, i18n_en.js) sınar: sayfadaki ve koddaki her metnin İngilizcesi var mı,
// değişkenler ({n} gibi) iki dilde aynı mı, dil seçimi doğru mu.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const EN = require('../i18n_en.js');
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  HATA ' + name + '\n       ' + e.message); }
}
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const vars = s => [...new Set(s.match(/\{\w+\}/g) || [])].sort().join(',');
const forms = e => (Array.isArray(e) ? e : [e]); // [tekil, çoğul] ya da tek metin

// Kaynak metinler: index.html'deki data-t öğeleri ve JS dosyalarındaki tr('...') çağrıları
function sources() {
  const out = new Map();
  const html = read('index.html');
  // data-t tam ad olarak (data-tier gibi özellikler sayılmaz)
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-t(?:="([^"]*)")?(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) out.set((m[2] || m[3]).trim(), 'index.html');
  for (const m of html.matchAll(/data-t-(?:aria|title)="([^"]+)"/g)) out.set(m[1], 'index.html');
  for (const f of ['game.js']) {
    const js = read(f).replace(/^\s*\/\/.*$/gm, ''); // açıklama satırlarındaki örnekler sayılmaz
    for (const m of js.matchAll(/\btr\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) out.set(m[2].replace(/\\(['"`])/g, '$1'), f);
  }
  return out;
}

// Veri dosyalarındaki adlar ve metinler (dünya, kapı, unvan, rozet, mağaza, çıkartma, sandık, öğretici, tanıtım, şekil)
function dataSources() {
  const out = new Map();
  const add = (s, f) => { if (s) out.set(s, f); };
  const W = require('../worlds.js'), B = require('../achievements.js'), R = require('../rewards.js');
  const STK = require('../stickers.js'), Lv = require('../levels.js');
  for (const w of W.WORLDS) { add(w.name, 'worlds.js'); add(w.intro, 'worlds.js'); add(w.title, 'worlds.js (unvan)'); }
  for (const g of W.GATES) add(g.name, 'worlds.js');
  for (let k = 0; k <= W.GATES.length; k++) add(W.titleFor(k), 'worlds.js (unvan)');
  for (const b of B.BADGES) { add(b.name, 'achievements.js'); add(b.desc, 'achievements.js'); add(b.group, 'achievements.js'); }
  for (const c of Object.values(R.SHOP)) { add(c.title, 'rewards.js'); add(c.tab, 'rewards.js'); for (const it of c.items) { add(it.name, 'rewards.js'); add(it.desc, 'rewards.js'); } }
  for (const m of read('rewards.js').match(/RARITY_NAMES = \{([^}]*)\}/)[1].matchAll(/'([^']+)'/g)) add(m[1], 'rewards.js (sandık)');
  for (const st of Object.values(STK.SETS)) add(st.name, 'stickers.js');
  for (const d of Lv.TUTORIAL) { add(d.title, 'levels.js (öğretici)'); add(d.text, 'levels.js (öğretici)'); }
  for (const d of Object.values(Lv.MECH_LEVELS)) { add(d.title, 'levels.js (tanıtım)'); add(d.tip, 'levels.js (tanıtım)'); }
  for (const a of Lv.ANIMALS) add(a.name, 'levels.js (şekil)');
  for (const p of Object.values(Lv.SHAPE_PLAN)) add(p.name, 'levels.js (şekil)');
  return out;
}

test('veri dosyalarındaki her adın İngilizcesi var (şekiller, dünyalar, rozetler, mağaza...)', () => {
  const missing = [...dataSources()].filter(([s]) => EN[s] == null).map(([s, f]) => `${f}: "${s}"`);
  assert.deepStrictEqual(missing, [], `${missing.length} eksik çeviri:\n       ` + missing.join('\n       '));
});

test('sayfadaki ve koddaki her metnin İngilizcesi var', () => {
  const missing = [...sources()].filter(([s]) => EN[s] == null).map(([s, f]) => `${f}: "${s}"`);
  assert.deepStrictEqual(missing, [], `${missing.length} eksik çeviri:\n       ` + missing.join('\n       '));
});

test('değişkenler iki dilde aynı ({n}, {name}...)', () => {
  const bad = Object.entries(EN).filter(([s, e]) => forms(e).some(f => vars(s) !== vars(f)) || (Array.isArray(e) && (e.length !== 2 || !s.includes('{n}')))).map(([s]) => s);
  assert.deepStrictEqual(bad, []);
});

test('İngilizce metinler boş değil ve Türkçe harf içermiyor', () => {
  const bad = Object.entries(EN).filter(([, e]) => forms(e).some(f => !f.trim() || /[çğıöşüÇĞİÖŞÜ]/.test(f))).map(([s]) => s);
  assert.deepStrictEqual(bad, []);
});

test('dil seçimi: kayıttaki dil önce, yoksa telefon dili (Türkçe değilse İngilizce)', () => {
  const load = (saved, nav) => {
    delete require.cache[require.resolve('../i18n.js')];
    const store = { getItem: () => (saved ? JSON.stringify({ lang: saved }) : null) };
    globalThis.localStorage = store; globalThis.navigator = { language: nav };
    try { return require('../i18n.js').detect(); } finally { delete globalThis.localStorage; delete globalThis.navigator; }
  };
  assert.strictEqual(load(null, 'tr-TR'), 'tr');
  assert.strictEqual(load(null, 'en-GB'), 'en');
  assert.strictEqual(load(null, 'de-DE'), 'en');
  assert.strictEqual(load('tr', 'en-US'), 'tr', 'oyuncunun seçimi telefon dilinden önce gelir');
  assert.strictEqual(load('en', 'tr-TR'), 'en');
});

test('çeviri: sözlükte olmayan metin Türkçe kalır, değişkenler doldurulur, çoğul seçilir', () => {
  const I = require('../i18n.js');
  globalThis.RING_LANG_EN = { '{n} hamle': '{n} moves', '+{n} altın': ['+{n} coin', '+{n} coins'] };
  I.setLang('en');
  assert.strictEqual(I.t('{n} hamle', { n: 3 }), '3 moves');
  assert.strictEqual(I.t('+{n} altın', { n: 1 }), '+1 coin');
  assert.strictEqual(I.t('+{n} altın', { n: 20 }), '+20 coins');
  assert.strictEqual(I.t('Sözlükte yok'), 'Sözlükte yok');
  I.setLang('tr');
  assert.strictEqual(I.t('{n} hamle', { n: 3 }), '3 hamle');
  delete globalThis.RING_LANG_EN;
});

test('Android paketi dil dosyalarını içerir (build_www listesi)', () => {
  const w = read('tools/build_www.js');
  assert.ok(w.includes("'i18n.js'") && w.includes("'i18n_en.js'"));
});

console.log(failed ? `\n${failed} test başarısız` : '\nTüm dil testleri geçti');
process.exit(failed ? 1 : 0);
