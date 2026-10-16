// Kullanım: node tools/store_shots.js [adres]   (varsayılan http://localhost:8800, oyunu sunan bir yerel sunucu)
// Google Play ekran görüntülerini (1080×1920) ve öne çıkan görseli (1024×500) üretir: store/ klasörüne yazar.
// Chrome ve puppeteer-core gerekir (npm i puppeteer-core); oyunu örnek bir oyuncu ilerlemesiyle açar.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || 'http://localhost:8800';
const OUT = path.join(__dirname, '..', 'store', 'screenshots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3 });
  await page.goto(`${BASE}/index.html?debug`);
  await wait(400);
  const ORDER = await page.evaluate(() => window.__halka.ORDER);

  // Örnek oyuncu: 9 kapı bitmiş, çoğu bölüm 3 yıldız, birkaç rozet
  const done = 92;
  const stars = Object.fromEntries(ORDER.slice(0, done).map((s, i) => [String(s), i % 7 === 3 ? 2 : 3]));
  const best = Object.fromEntries(Object.entries(stars).map(([k, v]) => [k, v * 100 + 25]));
  const progress = {
    version: 3, stars, best, sound: false, coins: 84, hints: 6, tutorialDone: true,
    coinTip: true, shapeTip: true, helpTip: true, title: 'Saatçi', seenFrontier: done + 1,
    rewards: Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['gate:' + (i + 1), true]).concat([['world:atolye', true], ['world:saat', true], ['world:zindan', true], ['world:uzay', true]])),
    badges: {}, seenBadges: {}, clean: {}, stats: { coinsTotal: 260, chains: 14, bestChain: 3, hintsUsed: 9 },
  };
  const seed = () => page.evaluate(p => localStorage.setItem('halka.progress.v3', JSON.stringify(p)), progress);
  const shot = async (name, url, prep, ms = 1500) => {
    await seed();
    await page.goto(`${BASE}/index.html?${url}`);
    await wait(ms);
    if (prep) await prep();
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  ' + name);
  };
  const levelOf = (pred) => ORDER.findIndex(pred) + 1;
  const src = n => ORDER[n - 1];

  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
  await shot('1-ana-menu', '', null, 2600);
  await shot('2-harita', 'screen=levels', async () => {
    await page.evaluate(() => { const g = document.getElementById('gateGo'); if (!document.getElementById('gateCard').classList.contains('hidden')) g.click(); });
    await wait(1600);
  }, 1200);
  await shot('3-atolye-ters-disli', `level=${68}`);
  await shot('4-calar-saat', `level=${levelOf(s => s === 67)}`);
  await shot('5-zindan-kilit', `level=${108}`);
  await shot('6-kademeli-ipucu', `level=${86}`, async () => { await page.click('#hint'); await wait(500); });
  await shot('7-rozetler', '', async () => {
    // Rozetler oyun açılırken bu örnek ilerlemeye göre sessizce verilir
    await page.click('#homeTrophies'); await wait(700);
  }, 2600);
  await shot('8-uzay', `level=${166}`);

  // Öne çıkan görsel
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/store/feature-graphic.html`);
  await wait(800);
  await page.screenshot({ path: path.join(__dirname, '..', 'store', 'feature-graphic.png') });
  console.log('  feature-graphic');
  console.log('kullanılan bölümler:', [68, 108, 86, 166].map(n => `${n} (#${src(n)})`).join(', '));
  await browser.close();
})();
