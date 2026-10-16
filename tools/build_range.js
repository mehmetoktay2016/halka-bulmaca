// Kullanım: node tools/build_range.js <bölüm> <ilk aday> <aday sayısı> <çıktı.json>
// Tek bir yeni bölümü belirli bir aday aralığında üretir. Zor bölümlerde aynı bölüm için farklı
// aralıklar paralel çalıştırılıp ilk bulunan (ya da hedefe en yakın) sonuç levels_data.js'e eklenir.
const fs = require('fs');
const Levels = require('../levels.js');
const [n, first, count, out] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const t0 = Date.now();
const def = Levels.generateFor(n, first, count);
if (def) fs.writeFileSync(out, JSON.stringify({ [n]: def }));
console.log(`#${n} [${first}-${first + count}): ${def ? `${def.rings.length} parça, en iyi ${def.par}, zorluk ${Levels.difficultyScore(def).toFixed(2)}` : 'bulunamadı'}, ${Math.round((Date.now() - t0) / 1000)} sn`);
