// Kullanım: node tools/build_bonus.js [süreç sayısı=3]
// Ara oyunlar (2.5, Z22): her 20 bölümde bir, isteğe bağlı ve çok zor bölüm. Kaynak numarası levels.js BONUS.first + k - 1,
// k. ara oyun 20k. bölümden sonra (kapı 2k'nın sonunda) açılır.
// Zorluk: o kapının en zor bölümünün puanından BONUS.extra fazla; hamle tavanı kapınınkinden BONUS.par fazla;
// o ana kadar tanıtılmış parçalardan en çok üçü, hepsi çözümde işe yarar (levels.js growFor). Bitmiş ara oyun atlanır,
// her biri biter bitmez tools/out/bonus.json'a yazılır; hepsi bitince levels_data.js'e eklenir.
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const OUT = path.join(__dirname, 'out'), FILE = path.join(OUT, 'bonus.json');
const DATA = path.join(__dirname, '..', 'levels_data.js');
const Levels = require('../levels.js');
// numaralar levels.js'te (oyun da oradan okur); burada yalnız üretim ayarları
const BONUS = { ...Levels.BONUS, count: 20, extra: 1.5, par: 3, maxPar: 14, pieces: 3 };
const readData = () => new Function(fs.readFileSync(DATA, 'utf8') + '; return RING_LEVEL_DATA;')();
const readDone = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {});

// k. ara oyunun planı: kapı, hedef zorluk, hamle tavanı, parçalar
function planFor(k, pre, order) {
  const gate = (BONUS.every / 10) * k, get = s => pre[s] || Levels.getLevel(s);
  let peak = 0;
  for (let n = (gate - 1) * 10 + 1; n <= gate * 10; n++) peak = Math.max(peak, Levels.difficultyScore(get(order[n - 1])));
  const intro = m => Levels.gateOfSource(Levels.INTRO[m]) || 99;
  const avail = Levels.GROW_MECH.filter(m => intro(m) <= gate).sort((a, b) => intro(a) - intro(b));
  // en yeni iki parça ve eskilerden biri: oyuncu son öğrendiklerini bir arada kullanır
  const mech = avail.length <= BONUS.pieces ? avail : [...avail.slice(-2), avail[(k * 7) % (avail.length - 2)]];
  const maxPar = Math.min(BONUS.maxPar, Levels.maxParOf(order[gate * 10 - 1]) + BONUS.par);
  return { gate, target: Math.round((peak + BONUS.extra) * 100) / 100, peak: true, top: peak + BONUS.extra + 1.2,
    near: 0.58, maxPar, mech, own: mech };
}

if (process.argv[2] === '--worker') {
  const pre = readData(), order = Levels.gateOrder(s => pre[s] || Levels.getLevel(s));
  for (const k of process.argv[3].split(',').map(Number)) {
    if (readDone()[BONUS.first + k - 1]) continue;
    const plan = planFor(k, pre, order), t0 = Date.now();
    const def = Levels.growFor(BONUS.first + k - 1, plan);
    const line = `ara oyun ${k} (kapı ${plan.gate}, hedef ${plan.target}, ${plan.mech.join('+') || 'parçasız'}): ` +
      (def ? `${def.rings.length} halka, ${def.par} hamle, puan ${Levels.difficultyScore(def).toFixed(2)}` : 'üretilemedi') + `, ${Math.round((Date.now() - t0) / 1000)} sn`;
    if (def) { const all = readDone(); all[BONUS.first + k - 1] = def; fs.writeFileSync(FILE, JSON.stringify(all)); }
    console.log(line);
  }
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const workers = Number(process.argv[2] || 3), ks = Array.from({ length: BONUS.count }, (_, i) => i + 1);
let left = workers;
for (let w = 0; w < workers; w++) {
  fork(__filename, ['--worker', ks.filter((_, i) => i % workers === w).join(',')]).on('exit', () => {
    if (--left) return;
    const data = readData(), done = readDone();
    Object.assign(data, done);
    fs.writeFileSync(DATA, '// tools/build_levels.js tarafından üretildi — elle düzenlemeyin\nvar RING_LEVEL_DATA = ' + JSON.stringify(data) + ';\n');
    const missing = ks.filter(k => !done[BONUS.first + k - 1]);
    console.log(`levels_data.js güncellendi: ${Object.keys(done).length} ara oyun. Eksik: ${missing.join(', ') || 'yok'}`);
  });
}
