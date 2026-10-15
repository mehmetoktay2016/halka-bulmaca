// Kullanım: node tools/check_levels.js [son_seviye]
// Her seviyenin bağlı, başta kilitli ve çözülebilir olduğunu doğrular.
const Logic = require('../logic.js');
const Levels = require('../levels.js');
const fs = require('fs');
const path = require('path');

// Önceden üretilmiş seviyeler varsa onları doğrula (oyuncunun göreceği seviyeler bunlar)
const dataFile = path.join(__dirname, '..', 'levels_data.js');
const pre = fs.existsSync(dataFile)
  ? new Function(fs.readFileSync(dataFile, 'utf8') + '; return RING_LEVEL_DATA;')()
  : {};

const last = Number(process.argv[2] || Math.max(8, ...Object.keys(pre).map(Number)));
let failed = 0;
const seen = new Set();

for (let n = 1; n <= last; n++) {
  const t0 = Date.now();
  const def = (n > Levels.HAND_LEVELS.length && pre[n]) || Levels.getLevel(n);
  const ms = Date.now() - t0;
  if (!def) { console.log(`#${n}: ÜRETİLEMEDİ (${ms} ms)`); failed++; continue; }
  const L = Logic.buildLevel(def);
  const problems = [];
  if (!Levels.connected(L)) problems.push('bağlı değil');
  if (!Levels.noRingFreeAtStart(L)) problems.push('başta serbest halka var');
  if (def.par == null) problems.push('çözülemedi');
  else if (def.par > Levels.MAX_PAR) problems.push(`en iyi çözüm ${def.par} hamle (sınır ${Levels.MAX_PAR})`);
  else {
    const fast = Logic.solveFast(L, L.startAngles, 0, 30000);
    if (!fast) problems.push('hızlı çözücü çözemedi (ipucu çalışmaz)');
    else if (fast.moves < def.par) problems.push(`hedef yanlış: ${fast.moves} hamlede çözülüyor`);
  }
  // Görsel netlik: kesişenler belirgin kesişmeli, kesişmeyenler arasında boşluk kalmalı
  for (let i = 0; i < def.rings.length; i++) {
    for (let j = i + 1; j < def.rings.length; j++) {
      const A = def.rings[i], B = def.rings[j];
      if (A.type === 'bar' || B.type === 'bar') {
        if (A.type === 'bar' && B.type === 'bar') continue;
        const [bar, ring] = A.type === 'bar' ? [A, B] : [B, A];
        if (Levels.barVsRing(bar, ring) === 'bad') problems.push(`çubuk ${A.type === 'bar' ? i : j} halkayı sıyırıyor`);
        continue;
      }
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      const crosses = d < A.r + B.r && d > Math.abs(A.r - B.r);
      if (crosses && (d > A.r + B.r - 24 || d < Math.abs(A.r - B.r) + 20)) problems.push(`halka ${i}-${j} sıyırarak kesişiyor`);
      if (!crosses && d < A.r + B.r + 8 && d > Math.abs(A.r - B.r)) problems.push(`halka ${i}-${j} çok yakın`);
      if (d <= Math.abs(A.r - B.r)) problems.push(`halka ${i}-${j} iç içe`);
    }
  }
  const sig = JSON.stringify(def.rings.map(r => [r.x, r.y, r.r, r.x1]));
  if (seen.has(sig)) problems.push('tekrar eden seviye');
  seen.add(sig);
  const fixed = def.rings.filter(r => r.fixed).length;
  const barCount = def.rings.filter(r => r.type === 'bar').length;
  console.log(`#${String(n).padStart(2)}: ${def.name ? def.name + ', ' : ''}${def.rings.length} halka, ${L.links.length} bağ, ` +
    `${fixed} kilitli, ${barCount} çubuk, ${(def.couples || []).length} eş, hedef=${def.par} hamle, ${ms} ms` +
    (problems.length ? '  <-- ' + problems.join(', ') : ''));
  if (problems.length) failed++;
}
// Oyuncunun gördüğü sıra: 10'ar bölümlük kapılar (testere dişi zorluk).
// - Her kapı tam 10 bölüm, 10. bölüm bir şekil finali.
// - Kapının içinde normal bölümler kolaydan zora gider.
// - Yeni kapı önceki kapının zirvesinden kolay başlar, ama zirvesi öncekinden düşük olamaz.
// - Final, kapının normal bölümlerinin zorluk aralığında olmalı (en kolayından kolay olamaz).
// - Bir mekanik tanıtılmadan onu kullanan bölüm gelemez.
const Worlds = require('../worlds.js');
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);
const Dof = s => Levels.difficultyScore(get(s));
const isShape = s => !!get(s).name;
const G = Worlds.GATE_SIZE;
console.log('');
if (order.length % G) { console.log(`Bölüm sayısı (${order.length}) ${G}'un katı değil`); failed++; }
if (new Set(order).size !== order.length) { console.log('Sırada tekrar eden bölüm var'); failed++; }
if (order.length / G > Worlds.GATES.length) { console.log(`Kapı tanımı yetersiz: ${order.length / G} kapı gerekiyor`); failed++; }
let prevPeak = -Infinity;
for (let g = 0; g < order.length / G; g++) {
  const row = order.slice(g * G, g * G + G);
  const mains = row.filter(s => !isShape(s)).map(Dof);
  const peak = Math.max(...mains);
  const gate = Worlds.GATES[g];
  const problems = [];
  if (!isShape(row[G - 1])) problems.push('10. bölüm şekil değil');
  for (let k = 1; k < mains.length; k++) if (mains[k] < mains[k - 1] - 0.05) problems.push(`zorluk ${k + 1}. normal bölümde düşüyor`);
  if (g > 0 && mains[0] >= prevPeak) problems.push(`önceki zirveden (${prevPeak.toFixed(1)}) kolay başlamıyor`);
  if (peak < prevPeak - 0.05) problems.push(`zirve öncekinden düşük (${peak.toFixed(1)} < ${prevPeak.toFixed(1)})`);
  if (Dof(row[G - 1]) < Math.min(...mains) - 0.05) problems.push(`final kapının en kolay bölümünden kolay (${Dof(row[G - 1]).toFixed(1)})`);
  console.log(`Kapı ${String(g + 1).padStart(2)} ${(gate ? gate.name : '?').padEnd(14)} ` +
    row.map(s => `${s}${isShape(s) ? '*' : ''}:${Dof(s).toFixed(1)}`).join(' ') +
    (problems.length ? '  <-- ' + problems.join(', ') : ''));
  failed += problems.length;
  prevPeak = Math.max(prevPeak, peak);
}
const seenFeat = new Set();
order.forEach((s, p) => {
  for (const f of Levels.features(get(s))) {
    if (Levels.INTRO[f] !== s && !seenFeat.has(f)) { console.log(`Sıra ${p + 1} (#${s}): "${f}" tanıtılmadan kullanılıyor`); failed++; }
  }
  if (Object.values(Levels.INTRO).includes(s)) seenFeat.add(Object.keys(Levels.INTRO).find(k => Levels.INTRO[k] === s));
});
// Yeni mekaniklerin tanıtım bölümleri: çözülebilir, başta kilitli ve kural gerçekten gerekli
// (mekanik kaldırılınca, örneğin eş oranları 1 ya da tıklar yokken, çözüm aynı kalmamalı)
for (const [src, def] of Object.entries(Levels.MECH_LEVELS)) {
  const L = Logic.buildLevel(def);
  const sol = Logic.solve(L, L.startAngles, 0, 200000);
  const problems = [];
  if (Logic.cascade(L, L.startAngles, 0).mask) problems.push('başta serbest halka var');
  if (!sol) problems.push('çözülemiyor');
  else {
    if (sol.moves !== Levels.getLevel(Number(src)).par) problems.push(`par ${def.par}, çözüm ${sol.moves}`);
    const plain = Logic.buildLevel(Levels.plainVersion(def));
    const ps = Logic.solve(plain, plain.startAngles, 0, 200000);
    if (ps && ps.moves === sol.moves) problems.push(`kural fark etmiyor (mekaniksiz de ${ps.moves} hamle)`);
  }
  if (!Levels.features(def).some(f => Levels.INTRO[f] === Number(src))) problems.push('INTRO tablosunda yok');
  console.log(`Tanıtım #${src} ${def.title.padEnd(12)} par ${sol ? sol.moves : '-'}` + (problems.length ? '  <-- ' + problems.join(', ') : ''));
  failed += problems.length;
}
console.log(failed ? `\n${failed} sorun var` : '\nTüm seviyeler geçerli, kapılar kolaydan zora gidiyor');
process.exit(failed ? 1 : 0);
