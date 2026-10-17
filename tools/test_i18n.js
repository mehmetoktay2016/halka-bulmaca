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
const vars = s => (s.match(/\{\w+\}/g) || []).sort().join(',');

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

test('sayfadaki ve koddaki her metnin İngilizcesi var', () => {
  const missing = [...sources()].filter(([s]) => EN[s] == null).map(([s, f]) => `${f}: "${s}"`);
  assert.deepStrictEqual(missing, [], `${missing.length} eksik çeviri:\n       ` + missing.join('\n       '));
});

test('değişkenler iki dilde aynı ({n}, {name}...)', () => {
  const bad = Object.entries(EN).filter(([s, e]) => vars(s) !== vars(e)).map(([s]) => s);
  assert.deepStrictEqual(bad, []);
});

test('İngilizce metinler boş değil ve Türkçe harf içermiyor', () => {
  const bad = Object.entries(EN).filter(([, e]) => !e.trim() || /[çğıöşüÇĞİÖŞÜ]/.test(e)).map(([s]) => s);
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

test('çeviri: sözlükte olmayan metin Türkçe kalır, değişkenler doldurulur', () => {
  const I = require('../i18n.js');
  globalThis.RING_LANG_EN = { '{n} hamle': '{n} moves' };
  I.setLang('en');
  assert.strictEqual(I.t('{n} hamle', { n: 3 }), '3 moves');
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
