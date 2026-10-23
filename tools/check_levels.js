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

// 2.4 şekilleri 2001'den başlar: aradaki boş numaralar üretilmesin diye ayrı eklenir
const last = Number(process.argv[2] || Math.max(8, ...Object.keys(pre).map(Number).filter(n => n < 1000)));
const numbers = Array.from({ length: last }, (_, i) => i + 1)
  .concat(process.argv[2] ? [] : Object.keys(Levels.SHAPE_PLAN).map(Number).filter(n => n >= 2000));
let failed = 0;
const seen = new Set();

for (const n of numbers) {
  const t0 = Date.now();
  const def = (n > Levels.HAND_LEVELS.length && pre[n]) || Levels.getLevel(n);
  const ms = Date.now() - t0;
  if (!def) { console.log(`#${n}: ÜRETİLEMEDİ (${ms} ms)`); failed++; continue; }
  const L = Logic.buildLevel(def);
  const problems = [];
  if (!Levels.connected(L)) problems.push('bağlı değil');
  if (!Levels.noRingFreeAtStart(L)) problems.push('başta serbest halka var');
  if (def.par == null) problems.push('çözülemedi');
  else if (def.par > Levels.maxParOf(n)) problems.push(`en iyi çözüm ${def.par} hamle (sınır ${Levels.maxParOf(n)})`);
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
// - Yeni kapı önceki kapının zirvesinden kolay başlar; zirvesi ve ortalaması öncekinden yüksek olmalı.
// - Üretilmiş normal bölümlerde kapının başı ferah, sonu sıkışık (halkaların yakınlığı).
// - Şekiller (ara şekil ve final) sıralamaya girmez: kapının nefes molası ve ödülüdür.
// - Bir mekanik tanıtılmadan onu kullanan bölüm gelemez.
const Worlds = require('../worlds.js');
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.gateOrder(get);
const Dof = s => Levels.difficultyScore(get(s));
const isShape = s => !!get(s).name;
const generated = s => !!(Levels.KEEP_PAR[s] || Levels.NORMAL_PLAN[s]);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const G = Worlds.GATE_SIZE;
console.log('');
if (order.length % G) { console.log(`Bölüm sayısı (${order.length}) ${G}'un katı değil`); failed++; }
if (new Set(order).size !== order.length) { console.log('Sırada tekrar eden bölüm var'); failed++; }
if (order.length / G > Worlds.GATES.length) { console.log(`Kapı tanımı yetersiz: ${order.length / G} kapı gerekiyor`); failed++; }
let prevPeak = -Infinity, prevAvg = -Infinity;
// Bilinen istisna (2.2): kapı 11'in zirvesi (126) üretimi uzun sürdüğü için aralık şartsız üretildi;
// zirvesi ve ortalaması kapı 10'un biraz altında kalır. Kapı içi sıra ve yakınlık kuralları yine geçerli.
const RISE_EXCEPT = new Set([11]);
// 2.4 (kullanıcı kararı): kapı 21-30'da zorluk sabit kalır: zirve ve ortalama artmak zorunda değil, ama zirve
// kapı 20'ninkinden en çok 0,5 sapabilir; kapı içi kolaydan zora sıra ve ferah baş kuralları yine geçerli.
const PLATEAU = Levels.PLATEAU;
let plateauPeak = null;
for (let g = 0; g < order.length / G; g++) {
  const row = order.slice(g * G, g * G + G);
  // Tanıtım bölümleri puana göre değil, tanıttıkları mekaniğin önüne konur
  const intros = Object.values(Levels.INTRO);
  const mains = row.filter(s => !isShape(s) && !intros.includes(s)).map(Dof);
  const peak = Math.max(...mains);
  const gate = Worlds.GATES[g];
  const problems = [];
  if (!isShape(row[G - 1])) problems.push('10. bölüm şekil değil');
  for (let k = 1; k < mains.length; k++) if (mains[k] < mains[k - 1] - 0.05) problems.push(`zorluk ${k + 1}. normal bölümde düşüyor`);
  if (g > 0 && mains[0] >= prevPeak) problems.push(`önceki zirveden (${prevPeak.toFixed(1)}) kolay başlamıyor`);
  // Her kapının zirvesi bir öncekinden yüksek (her kapı bir öncekinden zor)
  const flat = g + 1 >= PLATEAU;
  if (g + 1 === PLATEAU - 1) plateauPeak = peak;
  if (!flat && peak <= prevPeak && !RISE_EXCEPT.has(g + 1)) problems.push(`zirve öncekinden düşük (${peak.toFixed(1)} < ${prevPeak.toFixed(1)})`);
  // Cırcır kapılarının (44-45) zirvesi bilerek 2 yüksek (kullanıcı kararı)
  if (flat && plateauPeak != null && !Levels.RATCHET_GATES.includes(g + 1) && Math.abs(peak - plateauPeak) > 0.5) problems.push(`zirve sabit düzeyden uzak (${peak.toFixed(1)}, kapı ${PLATEAU - 1}: ${plateauPeak.toFixed(1)})`);
  const avgD = avg(mains);
  if (!flat && avgD <= prevAvg && !RISE_EXCEPT.has(g + 1)) problems.push(`ortalama öncekinden düşük (${avgD.toFixed(2)} <= ${prevAvg.toFixed(2)})`);
  const near = row.filter(generated).map(s => Levels.closeness(get(s)));
  const third = Math.max(1, Math.floor(near.length / 3));
  // 2.5 (kullanıcı kararı): kapı 31-40 merkezden dışa büyütülerek üretilir; zorluk sıkışıklıktan değil parçalardan
  // gelir, halka aralıkları benzerdir. Ferah baş kuralı yalnız kapı 1-30'da aranır.
  if (g + 1 <= 30 && near.length >= 3 && avg(near.slice(0, third)) < avg(near.slice(-third)) + 0.06) {
    problems.push(`kapının başı sonundan ferah değil (${avg(near.slice(0, third)).toFixed(2)} / ${avg(near.slice(-third)).toFixed(2)})`);
  }
  console.log(`Kapı ${String(g + 1).padStart(2)} ${(gate ? gate.name : '?').padEnd(14)} ` +
    row.map(s => `${s}${isShape(s) ? '*' : ''}:${Dof(s).toFixed(1)}/${get(s).par}`).join(' ') +
    (problems.length ? '  <-- ' + problems.join(', ') : ''));
  failed += problems.length;
  prevPeak = peak;
  prevAvg = avgD;
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
