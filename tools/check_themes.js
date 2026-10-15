// Kullanım: node tools/check_themes.js
// Her dünyanın zemini üzerinde halkaların, kilitli halkanın ve çubuğun okunabildiğini doğrular.
// Ölçü WCAG kontrast oranıdır; zeminin en açık noktası (üst renk + en güçlü ışık) ve en koyu
// noktası (alt renk) için ayrı ayrı hesaplanır, kötü olanı sayılır.
const fs = require('fs');
const path = require('path');
const Worlds = require('../worlds.js');
const Levels = require('../levels.js');

// Grafik öğeler için WCAG 1.4.11 en az 3:1 ister. Kilitli halka bilerek sönük (dönmediğini anlatır),
// yine de zeminden ayrılmalı.
const MIN = { ring: 3.0, bar: 3.0, fixed: 2.0 };

const hex = h => { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const lum = rgb => {
  const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (base, over, alpha) => base.map((c, k) => Math.round(c * (1 - alpha) + over[k] * alpha));

const dataFile = path.join(__dirname, '..', 'levels_data.js');
const pre = new Function(fs.readFileSync(dataFile, 'utf8') + '; return RING_LEVEL_DATA;')();
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);

let failed = 0;
for (const w of Worlds.WORLDS) {
  const t = w.theme;
  const top = hex(t.top);
  const brightest = t.glows.reduce((best, [c, a]) => {
    const m = mix(top, hex(c), a);
    return lum(m) > lum(best) ? m : best;
  }, top);
  const grounds = [brightest, hex(t.bottom)];
  const worst = color => Math.min(...grounds.map(g => contrast(hex(color), g)));

  // Bu dünyadaki bölümlerin kendi halka renkleri (şekiller)
  const gates = Worlds.GATES.map((g, i) => (g.world === w.id ? i : -1)).filter(i => i >= 0);
  const own = new Set();
  for (const g of gates) {
    for (const s of order.slice(g * Worlds.GATE_SIZE, g * Worlds.GATE_SIZE + Worlds.GATE_SIZE)) {
      for (const r of get(s).rings) if (r.color && !r.fixed) own.add(r.color);
    }
  }
  const checks = [
    ...Worlds.PIECE_COLORS.rings.map(c => ['ring', c]),
    ...[...own].filter(c => !Worlds.PIECE_COLORS.rings.includes(c)).map(c => ['ring', c]),
    ['fixed', Worlds.PIECE_COLORS.fixed],
    ['bar', Worlds.PIECE_COLORS.bar],
  ];
  const bad = checks.filter(([kind, c]) => worst(c) < MIN[kind]);
  const lowest = Math.min(...checks.filter(([k]) => k === 'ring').map(([, c]) => worst(c)));
  console.log(`${w.name.padEnd(17)} en düşük halka kontrastı ${lowest.toFixed(2)}, ` +
    `kilitli ${worst(Worlds.PIECE_COLORS.fixed).toFixed(2)}, çubuk ${worst(Worlds.PIECE_COLORS.bar).toFixed(2)}` +
    (bad.length ? '  <-- ' + bad.map(([k, c]) => `${k} ${c} (${worst(c).toFixed(2)})`).join(', ') : ''));
  failed += bad.length;
}
console.log(failed ? `\n${failed} renk zeminde yeterince seçilmiyor` : '\nBütün dünyalarda parçalar okunaklı');
process.exit(failed ? 1 : 0);
