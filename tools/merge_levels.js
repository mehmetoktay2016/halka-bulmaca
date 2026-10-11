// Kullanım: node tools/merge_levels.js parça1.json parça2.json ...
// Paralel üretilen parçaları birleştirip levels_data.js dosyasını baştan yazar.
const fs = require('fs');
const path = require('path');

const out = {};
for (const f of process.argv.slice(2)) Object.assign(out, JSON.parse(fs.readFileSync(f, 'utf8')));
const file = path.join(__dirname, '..', 'levels_data.js');
fs.writeFileSync(file,
  '// tools/build_levels.js tarafından üretildi — elle düzenlemeyin\n' +
  'var RING_LEVEL_DATA = ' + JSON.stringify(out) + ';\n');
console.log(`${Object.keys(out).length} seviye yazıldı: ${file}`);
