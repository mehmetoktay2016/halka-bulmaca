// Kullanım: node tools/build_levels.js [son_seviye]  veya  node tools/build_levels.js <ilk> <son> [parça.json]
// parça.json verilirse yalnızca o aralık bu dosyaya yazılır (paralel üretim; sonra merge_levels.js).
// Var olan levels_data.js ile birleştirir; sadece verilen aralığı yeniden üretir.
// Üretilen seviyeleri levels_data.js dosyasına yazar; oyun açılışta bunları hazır bulur.
const fs = require('fs');
const path = require('path');
const Levels = require('../levels.js');

const file = path.join(__dirname, '..', 'levels_data.js');
const out = fs.existsSync(file)
  ? new Function(fs.readFileSync(file, 'utf8') + '; return RING_LEVEL_DATA;')()
  : {};
for (const k of Object.keys(out)) if (Number(k) <= Levels.HAND_LEVELS.length) delete out[k];
const first = process.argv[3] ? Number(process.argv[2]) : Levels.HAND_LEVELS.length + 1;
const last = Number(process.argv[3] || process.argv[2] || 60);
const made = new Set(); // bu çalıştırmada üretilenler (bulunamayanın eskisi parçaya yazılmasın)
for (let n = first; n <= last; n++) {
  const t0 = Date.now();
  const def = Levels.SHAPE_PLAN[n] ? Levels.finishAnimal(n)
    : Levels.NORMAL_PLAN[n] ? Levels.generateFor(n) : Levels.generate(n);
  if (!def) { console.log(`#${n}: üretilemedi`); continue; }
  out[n] = def;
  made.add(n);
  console.log(`#${n}: ${def.rings.length} halka, hedef=${def.par}, ${Date.now() - t0} ms`);
}

if (process.argv[4]) {
  const part = {};
  for (const n of made) part[n] = out[n];
  fs.writeFileSync(process.argv[4], JSON.stringify(part));
  console.log(`${Object.keys(part).length} seviye yazıldı: ${process.argv[4]}`);
  process.exit(0);
}
fs.writeFileSync(file,
  '// tools/build_levels.js tarafından üretildi — elle düzenlemeyin\n' +
  'var RING_LEVEL_DATA = ' + JSON.stringify(out) + ';\n');
console.log(`${Object.keys(out).length} seviye yazıldı: ${file}`);
