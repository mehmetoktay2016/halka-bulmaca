// Kullanım: node tools/store_shots.js [adres] [--lang en]   (adres: oyunu sunan yerel sunucu ya da file:/// yolu;
// varsayılan http://localhost:8800)
// Google Play ekran görüntülerini (1080×1920) ve öne çıkan görseli (1024×500) üretir: store/ klasörüne yazar.
// Her görsel: oyunun bir anı telefon çerçevesinde, üstte tek mesajlı başlık (store/poster.html).
// --lang en: İngilizce mağaza sayfası için store/screenshots-en/ ve store/feature-graphic-en.png (Türkçeye dokunmaz).
// Chrome ve puppeteer-core gerekir (npm i puppeteer-core); oyunu örnek bir oyuncu ilerlemesiyle açar.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const args = process.argv.slice(2);
const LANG = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'tr';
const BASE = args.find(a => /^(https?|file):/.test(a)) || 'http://localhost:8800';
const EN = LANG === 'en';
const OUT = path.join(__dirname, '..', 'store', EN ? 'screenshots-en' : 'screenshots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

// Görseller (Play Console sırası numaradan gelir): ne çekilecek, başlık, alt yazı, zemin ve vurgu rengi
const has = k => d => d.rings.some(r => r[k] != null && r[k] !== false);
const SHOTS = [
  { name: ['1-macera-haritasi', '1-adventure-map'], url: 'screen=levels', ms: 2600,
    title: ['*400 bölümlük* macera', 'A *400-level* adventure'], sub: ['16 dünya, 40 kapı, her kapıda tören', '16 worlds, 40 gates, a party at every gate'], bg: '#1b2a5a', acc: '#ffc94a' },
  { name: ['2-bomba', '2-bombs'], level: d => has('bomb')(d) && !has('boss')(d),
    title: ['Döndür, *patlat*, kurtar!', 'Turn, *blast*, set free!'], sub: ['Tek hamlede zincirleme patlamalar', 'Chain reactions in a single move'], bg: '#3a1430', acc: '#ff7a45' },
  { name: ['3-dev-halka', '3-giant-ring'], level: has('boss'),
    title: ['Kapı sonunda *Dev Halka*', 'Beat the *Giant Ring*'], sub: ['Zırhını kır, yolu aç', 'Break its armour, open the way'], bg: '#2a1020', acc: '#ff6b6b' },
  { name: ['4-buz', '4-ice'], level: d => has('ice')(d) && !has('boss')(d),
    title: ['Her dünya *yeni bir kural*', 'Every world, *a new rule*'], sub: ['Buz, bomba, motor, portal...', 'Ice, bombs, motors, portals...'], bg: '#12324a', acc: '#8fe3ff' },
  { name: ['5-portal', '5-portals'], level: d => has('portal')(d) && !has('boss')(d),
    title: ['Büyülü *ikiz portallar*', 'Magic *twin portals*'], sub: ['Biri kurtulunca öbürü ışınlanır', 'Free one and its twin teleports'], bg: '#2a1450', acc: '#c08aff' },
  { name: ['6-album', '6-album'], url: '', tab: 'tabAlbum', ms: 2600,
    title: ['*79 şekli* kurtar', 'Rescue *79 shapes*'], sub: ['Halkalara takılan dostlarını albümde topla', 'Collect your ring-bound friends in the album'], bg: '#14382a', acc: '#7ee081' },
  { name: ['7-rozetler', '7-badges'], url: '', tab: 'tabBadges', ms: 2600,
    title: ['*45 rozet*, gizli sürprizler', '*45 badges* and secrets'], sub: ['Yıldız, altın, sandık ve çıkartma', 'Stars, coins, chests and stickers'], bg: '#2a2410', acc: '#ffc94a' },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'], protocolTimeout: 120000 });
  const page = await browser.newPage(), poster = await browser.newPage();
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3 });
  await poster.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await poster.goto(`${BASE}/store/poster.html`);
  await page.goto(`${BASE}/index.html?debug`);
  await wait(400);
  // Bölüm seçimi: koşula uyan en kalabalık bölüm (tahta dolu görünsün); parçaları görülmüş say (tanıtım kartı görüntüyü kapatmasın)
  const { levels, pieces } = await page.evaluate(src => {
    const o = window.__halka.ORDER, L = window.RingLevels;
    return { levels: o.map(s => L.getLevel(s)), pieces: window.RingPieces.PIECES.map(p => p.id) };
  });
  const levelOf = pred => levels.reduce((best, d, i) => (d && pred(d) && (!best || d.rings.length > levels[best - 1].rings.length) ? i + 1 : best), 0);

  // Örnek oyuncu: 304 bölüm bitmiş (harita Havai Fişek kalesinde), çoğu 3 yıldız
  const done = 304, ORDER = await page.evaluate(() => window.__halka.ORDER);
  const stars = Object.fromEntries(ORDER.slice(0, done).map((s, i) => [String(s), i % 7 === 3 ? 2 : 3]));
  const progress = {
    version: 3, layout: 4, lang: LANG, stars, best: {}, sound: false, music: false, coins: 1840, hints: 6, tutorialDone: true, introDone: true,
    coinTip: true, shapeTip: true, helpTip: true, seenFrontier: done + 1,
    rewards: Object.fromEntries(Array.from({ length: 31 }, (_, i) => ['gate:' + (i + 1), true]).concat(['vadi', 'atolye', 'saat', 'zindan', 'sehir', 'fabrika', 'uzay', 'usta', 'lunapark', 'santral', 'fener', 'rasathane', 'fisek', 'buzul', 'degirmen', 'buyu'].map(w => ['world:' + w, true]))),
    badges: {}, seenBadges: {}, clean: {}, seenPieces: Object.fromEntries(pieces.map(id => [id, true])),
    stats: { coinsTotal: 4200, chains: 120, bestChain: 5, hintsUsed: 9, bombs: 14, bosses: 3, rains: 2, mysteries: 6, bestStreak: 6 },
    streak: { day: TODAY, count: 3 }, hintGiftDay: TODAY, lootTip: true, goldTip: true, bulbTip: true, pieceTip: true,
  };

  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
  const L = EN ? 1 : 0;
  for (const s of SHOTS) {
    await page.evaluate(p => localStorage.setItem('halka.progress.v3', JSON.stringify(p)), progress);
    const n = s.level ? levelOf(s.level) : 0;
    await page.bringToFront(); // arka sekmede geçiş animasyonları durur, ekranlar soluk kalır
    await page.goto(`${BASE}/index.html?debug&${n ? 'level=' + n : s.url}`);
    await wait(s.ms || 1600);
    await page.evaluate(tab => {
      // açık kart (günlük sandık, parça, dünya, kapı) görüntüyü kapatmasın
      document.querySelectorAll('.overlay, #toast').forEach(e => e.classList.add('hidden'));
      if (tab) { document.getElementById('homeTrophies').click(); document.getElementById(tab).click(); }
    }, s.tab);
    if (s.tab) await wait(2000);
    const img = 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' });
    await poster.bringToFront();
    await poster.evaluate(o => window.poster(o), { img, title: s.title[L], sub: s.sub[L], bg: s.bg, acc: s.acc });
    await wait(300);
    await poster.screenshot({ path: path.join(OUT, s.name[L] + '.png') });
    console.log('  ' + s.name[L] + (n ? ` (bölüm ${n})` : ''));
  }

  // Öne çıkan görsel
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/store/feature-graphic.html?lang=${LANG}`);
  await wait(800);
  await page.screenshot({ path: path.join(__dirname, '..', 'store', EN ? 'feature-graphic-en.png' : 'feature-graphic.png') });
  console.log('  feature-graphic');
  await browser.close();
})();
