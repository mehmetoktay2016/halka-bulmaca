// Kullanım: node tools/check_shapes.js
// Şekil kütüphanesini (levels.js ANIMALS) bulmacaya dönüşmeden önce denetler:
// halkalar temiz kesişmeli, kesişmeyenler arasında boşluk kalmalı (check_levels.js ile aynı ölçüler),
// şekil tek parça olmalı, tahtaya sığmalı, süsler tanınan türlerden olmalı ve gri (kilitli) renk kullanılmamalı.
const Levels = require('../levels.js');
const Worlds = require('../worlds.js');
// deco.js tarayıcıda window.Deco'yu kurar; Node'da aynı nesne module.exports.Deco olur
const { TYPES } = require('../deco.js').Deco;

let bad = 0;
for (const s of Levels.ANIMALS) {
  const R = s.rings.filter(r => r.type !== 'bar'), n = R.length, problems = [];
  const adj = R.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = R[i], B = R[j], d = Math.hypot(A.x - B.x, A.y - B.y);
      const crosses = d < A.r + B.r && d > Math.abs(A.r - B.r);
      if (crosses) { adj[i].push(j); adj[j].push(i); }
      if (crosses && (d > A.r + B.r - 24 || d < Math.abs(A.r - B.r) + 20)) problems.push(`${i}-${j} sıyırıyor`);
      if (!crosses && d < A.r + B.r + 8 && d > Math.abs(A.r - B.r)) problems.push(`${i}-${j} çok yakın`);
      if (d <= Math.abs(A.r - B.r)) problems.push(`${i}-${j} iç içe`);
    }
  }
  const seen = new Set([0]), stack = [0];
  while (stack.length) for (const k of adj[stack.pop()]) if (!seen.has(k)) { seen.add(k); stack.push(k); }
  if (seen.size !== n) problems.push('tek parça değil');
  const w = Math.max(...R.map(r => r.x + r.r)) - Math.min(...R.map(r => r.x - r.r));
  const h = Math.max(...R.map(r => r.y + r.r)) - Math.min(...R.map(r => r.y - r.r));
  // Kenarlarda en az 12 birim pay (bölüm üreticisiyle aynı)
  if (w > Levels.BOARD.w - 24 || h > Levels.BOARD.h - 24) problems.push(`tahtaya sığmıyor (${Math.round(w)}×${Math.round(h)})`);
  for (const d of s.deco || []) {
    if (!TYPES.includes(d.type)) problems.push(`bilinmeyen süs "${d.type}"`);
    if (!R[d.ring]) problems.push(`süs olmayan halkada (${d.ring})`);
  }
  if (R.some(r => r.color === Worlds.PIECE_COLORS.fixed)) problems.push('gri (kilitli halka) rengi kullanılmış');
  if (problems.length) bad++;
  console.log(`${s.name.padEnd(15)} ${String(n).padStart(2)} halka ${String(Math.round(w)).padStart(3)}×${String(Math.round(h)).padEnd(3)}` +
    (problems.length ? '  <-- ' + problems.join(', ') : ''));
}
console.log(bad ? `\n${bad} şekilde sorun var` : `\n${Levels.ANIMALS.length} şeklin hepsi geçerli`);
process.exit(bad ? 1 : 0);
