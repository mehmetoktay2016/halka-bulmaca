// Kullanım: node tools/build_parallel.js [süreç sayısı=3] [ilk kapı=21] [son kapı=30]
// Kapıların üretilen bölümlerini (normal bölümler ve şekiller) birkaç süreçte paralel üretir.
// - Her bölüm biter bitmez tools/out/part<k>.json dosyasına yazılır; durursa yeniden çalıştırınca
//   bitmiş bölümleri atlar ve kaldığı yerden devam eder.
// - Günlük: tools/out/log<k>.txt (#kaynak: ... satırları), hepsi bitince tools/out/done.txt.
// - Bitince parçalar levels_data.js'e eklenir (var olan bölümler korunur).
// Uzun sürer (bölüm başına 1-30 dk); bellek süreç başına 0,4-0,8 GB: en çok 3 süreç önerilir.
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const OUT = path.join(__dirname, 'out');
const DATA = path.join(__dirname, '..', 'levels_data.js');

if (process.argv[2] === '--worker') {
  // İşçi: verilen kaynakları sırayla üretir, her birini hemen dosyaya yazar
  const Levels = require('../levels.js');
  // 2.6 (kapı 41+) ek sınavı: rastgele oyuncu hamle hakkı içinde EASY'den sık bitiremez (kapı ortalaması gate_report'un
  // GATE_EASY %30'unun altında kalsın diye pay bırakıldı), oyundaki bir bölüme SIMILAR'dan çok benzemez
  const Kit = require('./test_kit.js');
  const EASY = 0.35, SIMILAR = 0.75;
  const pool = Object.entries(Kit.pre).filter(([, d]) => !d.name).map(([s, d]) => [Number(s), d]);
  Levels.setGrowCheck((def, n) => {
    if (Levels.NORMAL_PLAN[n].gate < 41) return null;
    // Bulut Krallığı'nda (49-50) sınır bölüm sınırı %50 (raylı halka denemesinde kullanıcı kararı)
    if (Kit.randomPlay(def, Kit.moveLimit(def.par, n), 100).rate > (Levels.NORMAL_PLAN[n].gate >= 49 ? 0.5 : EASY)) return 'rastgele_kolay';
    if (Kit.nearest(def, pool).sim > SIMILAR) return 'benzer';
    return null;
  });
  const [k, list] = [process.argv[3], process.argv[4].split(',').map(Number)];
  const partFile = path.join(OUT, `part${k}.json`), logFile = path.join(OUT, `log${k}.txt`);
  const part = fs.existsSync(partFile) ? JSON.parse(fs.readFileSync(partFile, 'utf8')) : {};
  // Süreç sayısı değişse de bitmiş bölüm yeniden üretilmesin: bütün parça dosyalarına bakılır
  const doneAll = new Set();
  for (const f of fs.readdirSync(OUT)) if (/^part\d+\.json$/.test(f)) for (const n of Object.keys(JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')))) doneAll.add(Number(n));
  for (const n of list) {
    if (part[n] || doneAll.has(n)) continue;
    const t0 = Date.now();
    const def = Levels.SHAPE_PLAN[n] ? Levels.finishAnimal(n) : Levels.generateFor(n);
    const line = def ? `#${n}: ${def.rings.length} halka, hedef=${def.par}, ${Date.now() - t0} ms` : `#${n}: üretilemedi`;
    if (def) { part[n] = def; fs.writeFileSync(partFile, JSON.stringify(part)); }
    fs.appendFileSync(logFile, line + '\n');
    console.log(`[${k}] ${line}`);
  }
  process.exit(0);
}

const Levels = require('../levels.js');
const workers = Number(process.argv[2] || 3), g0 = Number(process.argv[3] || 21), g1 = Number(process.argv[4] || 30);
fs.mkdirSync(OUT, { recursive: true });
try { fs.unlinkSync(path.join(OUT, 'done.txt')); } catch (e) { /* yok */ }
// Üretilecekler: kapıların normal bölümleri önce, şekiller sonra; süreçlere sırayla dağıtılır
const normals = Object.keys(Levels.NORMAL_PLAN).map(Number).filter(s => Levels.NORMAL_PLAN[s].gate >= g0 && Levels.NORMAL_PLAN[s].gate <= g1);
const shapes = Object.keys(Levels.SHAPE_PLAN).map(Number).filter(s => Levels.SHAPE_PLAN[s].gate >= g0 && Levels.SHAPE_PLAN[s].gate <= g1);
const all = [...normals, ...shapes];
const lists = Array.from({ length: workers }, (_, k) => all.filter((_, i) => i % workers === k));
console.log(`${all.length} bölüm, ${workers} süreç. Günlük: ${OUT}`);
let left = workers;
lists.forEach((list, k) => {
  const w = fork(__filename, ['--worker', String(k), list.join(',')]);
  w.on('exit', code => {
    console.log(`süreç ${k} bitti (çıkış ${code})`);
    if (--left) return;
    // Parçaları levels_data.js'e ekle
    const data = fs.existsSync(DATA) ? new Function(fs.readFileSync(DATA, 'utf8') + '; return RING_LEVEL_DATA;')() : {};
    let added = 0;
    for (const pf of fs.readdirSync(OUT).filter(x => /^part\d+\.json$/.test(x))) {
      const f = path.join(OUT, pf);
      const part = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const [n, def] of Object.entries(part)) { data[n] = def; added++; }
    }
    fs.writeFileSync(DATA, '// tools/build_levels.js tarafından üretildi — elle düzenlemeyin\nvar RING_LEVEL_DATA = ' + JSON.stringify(data) + ';\n');
    const missing = all.filter(n => !data[n]);
    fs.writeFileSync(path.join(OUT, 'done.txt'), `eklenen ${added}, eksik ${missing.length ? missing.join(',') : 'yok'}\n`);
    console.log(`levels_data.js güncellendi: ${added} bölüm eklendi. Eksik: ${missing.length ? missing.join(', ') : 'yok'}`);
  });
});
