// Kullanım: node tools/economy.js   (STARS=3 node tools/economy.js: bölüm başına farklı ortalama yıldız)
// Ekonomi ölçümü: 200 bölümü sırayla birer kez bitiren "tipik oyuncu" her kapıda ne kazanır?
// Değerler rewards.js'ten okunur; dengeyi değiştirince bu araç yeniden çalıştırılır.
// - Bölüm altını: bölümdeki halka-halka kesişimi sayısıyla sınırlı, levelCoins aralığında rastgele (beklenen değer).
//   Oyun bazı kesişimleri yerleşim yüzünden eler, gerçek değer biraz daha düşük olabilir.
// - Rozet altını: yalnızca ilerlemeyle kesin gelen rozetler (bölüm, kapı, dünya, yıldız, şekil, toplam altın).
//   Beceriye ya da davranışa bağlı rozetler (3 yıldız, ipucusuz, zincir...) ayrıca toplanır.
// - Çıkartma setleri: dünyanın son bölümünde setCoins altın (sandık sütununa eklenir).
// - Halka ödülleri: rewards.js'teki yer ve içerik kurallarıyla (her bölümde bir kez). Altın halkanın katı
//   bölüm altınına, ampul halkası sandık ampullerine eklenir.
// - Talep: ortalama en iyi çözüm (par), hata payı (hamle hakkı - par), payı 2 ya da daha az olan "dar" bölüm.
const fs = require('fs');
const path = require('path');
const Logic = require('../logic.js');
const Levels = require('../levels.js');
const W = require('../worlds.js');
const Badges = require('../achievements.js');
const Save = require('../save.js');
const R = require('../rewards.js');
const E = R.ECONOMY;

const LOOT = new Function(fs.readFileSync(path.join(__dirname, '..', 'loot_data.js'), 'utf8') + '; return RING_LOOT_DATA;')();
const pre = new Function(fs.readFileSync(path.join(__dirname, '..', 'levels_data.js'), 'utf8') + '; return RING_LEVEL_DATA;')();
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);
const STARS = Number(process.env.STARS || 2);

// game.js ile aynı kurallar
const moveCap = src => ((Levels.gateOfSource(src) || 1) >= 17 ? 14 : 10);
const moveLimit = (par, src) => Math.min(moveCap(src), par + Math.max(3, Math.ceil(par * 0.6)));
// min(n, düzgün dağılımlı lo..hi) beklenen değeri
function expectedCoins(n) {
  const [lo, hi] = E.levelCoins;
  let s = 0;
  for (let k = lo; k <= hi; k++) s += Math.min(n, k);
  return s / (hi - lo + 1);
}

const PROGRESS_KEYS = new Set(['wins', 'gatesDone', 'worldsSeen', 'stars', 'shapes', 'coinsTotal']);
const progressBadge = b => {
  const probe = { wins: 0, gatesDone: 0, worldsSeen: 0, stars: 0, shapes: 0, coinsTotal: 0, shapesTotal: 1 };
  const seen = new Set();
  const ctx = new Proxy(probe, { get: (o, k) => { seen.add(k); return o[k] ?? 0; } });
  b.value(ctx);
  return [...seen].every(k => PROGRESS_KEYS.has(k));
};
const skillCoins = Badges.BADGES.filter(b => !progressBadge(b)).reduce((s, b) => s + Badges.TIERS[b.tier].coins, 0);

const shapesTotal = order.filter(s => get(s).name).length;
const earned = {};
let wins = 0, stars = 0, shapes = 0, coinsTotal = 0, bulbs = Save.START_HINTS;
const worlds = new Set();
const rows = [];
const G = order.length / W.GATE_SIZE;
for (let g = 1; g <= G; g++) {
  worlds.add(W.worldOfGate(g).id);
  if (g >= 2) bulbs += E.gateBulbs;
  let levelCoins = 0, badgeCoins = 0, parSum = 0, padSum = 0, tight = 0, chestCoins = 0, chestBulbs = 0;
  const plan = R.gatePlan(g, p => LOOT[order[W.gateStart(g) + p - 2]], W.GATE_SIZE);
  for (let n = W.gateStart(g); n < W.gateStart(g) + W.GATE_SIZE; n++) {
    const src = order[n - 1], def = get(src), L = Logic.buildLevel(def);
    const links = L.links.filter(k => L.rings[k.a].kind === 'ring' && L.rings[k.b].kind === 'ring').length;
    const type = plan.get(W.posInGate(n));
    // Altın halkalı bölüm: tahtada goldCoins kadar altın, hepsi goldMult kat
    const c = type === 'gold' ? Math.min(R.spotFor('gold', LOOT[src])[3], R.LOOT.goldCoins) * R.LOOT.goldMult : expectedCoins(links);
    levelCoins += c; coinsTotal += c;
    if (type === 'bulb') { chestBulbs++; bulbs++; }
    if (type === 'chest') {
      const ch = R.chestFor(src, g);
      chestCoins += ch.coins; coinsTotal += ch.coins; chestBulbs += ch.bulbs; bulbs += ch.bulbs;
    }
    const pad = moveLimit(def.par, src) - def.par;
    parSum += def.par; padSum += pad;
    if (pad <= 2) tight++;
    // Dünyanın son bölümü: çıkartma seti tamamlanır
    if (n === order.length || W.worldOfGate(W.gateOf(n + 1)).id !== W.worldOfGate(g).id) { chestCoins += R.STICKERS.setCoins; coinsTotal += R.STICKERS.setCoins; }
    wins++; stars += STARS;
    if (def.name) shapes++;
    const gatesDone = n % W.GATE_SIZE === 0 ? g : g - 1;
    // Rozet altını toplam altına da sayılır: bir rozet başka rozeti tetikleyebilir
    for (let again = true; again;) {
      again = false;
      const ctx = { wins, gatesDone, worldsSeen: worlds.size, stars, shapes, shapesTotal, coinsTotal };
      for (const b of Badges.BADGES) {
        if (earned[b.id] || !progressBadge(b) || !Badges.status(b, ctx).done) continue;
        earned[b.id] = g;
        const v = Badges.TIERS[b.tier].coins;
        badgeCoins += v; coinsTotal += v; again = true;
      }
    }
  }
  rows.push({ g, world: W.worldOfGate(g).name, par: parSum / W.GATE_SIZE, pad: padSum / W.GATE_SIZE, tight,
    levelCoins, badgeCoins, chestCoins, chestBulbs, coinsTotal, bulbs, free: g === 1 });
}

const pad = (s, n) => String(s).padStart(n);
const padR = (s, n) => String(s).padEnd(n);
console.log(`Tipik oyuncu: her bölümü bir kez bitirir, bölüm başına ${STARS} yıldız, ipucunu ve altını harcamaz.\n`);
console.log('Kapı  Dünya              ort.par  ort.pay  dar  bölüm alt.  rozet alt.  sandık  toplam alt.  =ampul  garanti ampul');
for (const r of rows) {
  console.log(`${pad(r.g, 4)}  ${padR(r.world, 17)} ${pad(r.par.toFixed(1), 7)}  ${pad(r.pad.toFixed(1), 7)}  ${pad(r.tight, 3)}` +
    `  ${pad(Math.round(r.levelCoins), 10)}  ${pad(r.badgeCoins, 10)}  ${pad(r.chestCoins + (r.chestBulbs ? '+' + r.chestBulbs + 'a' : ''), 6)}  ${pad(Math.round(r.coinsTotal), 11)}` +
    `  ${pad(Math.floor(r.coinsTotal / E.bulbPrice), 6)}  ${pad(r.bulbs, 13)}${r.free ? '  (bu kapıda ipucu ücretsiz)' : ''}`);
}
const last = rows[rows.length - 1];
const lvl = rows.reduce((s, r) => s + r.levelCoins, 0);
const chest = rows.reduce((s, r) => s + r.chestCoins, 0), chestB = rows.reduce((s, r) => s + r.chestBulbs, 0);
console.log(`\nYolculuk sonunda: ~${Math.round(last.coinsTotal)} altın (${Math.round(lvl)} bölümlerden, ${Math.round(last.coinsTotal - lvl - chest)} rozetlerden, ${chest} sandıklardan)` +
  ` = ${Math.floor(last.coinsTotal / E.bulbPrice)} ampul; garanti ampul ${last.bulbs} (${chestB} tanesi sandık ve ampul halkalarından; tabloda "a" = ampul).`);
console.log(`Beceriye bağlı ek kaynaklar: rozetler en çok ${skillCoins} altın, altın kapılar en çok ${G * E.goldGateBulbs} ampul, günlük ampul (ampulü bitene, günde ${E.dailyBulbs}).`);
console.log(`Not: bölüm altınları tekrar oynayınca yeniden toplanabiliyor (bölüm başına ~${expectedCoins(9).toFixed(0)}); bu hesapta yok.`);
const shopTotal = Object.values(R.SHOP).reduce((s, c) => s + c.items.reduce((t, i) => t + i.price, 0), 0);
console.log(`Harcama yeri: süs mağazasının tamamı ${shopTotal} altın; günlük sandık haftada ${R.STREAK.days.reduce((s, d) => s + d.coins, 0)} altın + 1 ampul (hesapta yok).`);
