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
// Oyuncunun gördüğü sıra kolaydan zora gitmeli: 5 seviyelik hareketli ortalama hiç düşmemeli,
// tek tek seviyeler ise bir öncekinden en fazla 1.5 puan kolay olabilir.
const get = s => (s > Levels.HAND_LEVELS.length && pre[s]) || Levels.getLevel(s);
const order = Levels.levelOrder(get);
const D = order.map(s => Levels.difficultyScore(get(s)));
console.log('\nOyuncu sırası (kaynak):', order.join(' '));
console.log('Hedef hamle:', order.map(s => get(s).par).join(' '));
console.log('Zorluk puanı:', D.map(d => d.toFixed(1)).join(' '));
const avg = D.map((_, i) => { const w = D.slice(Math.max(0, i - 4), i + 1); return w.reduce((a, b) => a + b, 0) / w.length; });
for (let i = 1; i < D.length; i++) {
  if (avg[i] < avg[i - 1] - 0.05) { console.log(`Sıra ${i + 1}: ortalama zorluk düşüyor (${avg[i - 1].toFixed(2)} → ${avg[i].toFixed(2)})`); failed++; }
  if (D[i] < D[i - 1] - 1.5) { console.log(`Sıra ${i + 1}: ani kolaylaşma (${D[i - 1].toFixed(1)} → ${D[i].toFixed(1)})`); failed++; }
}
console.log(failed ? `\n${failed} sorun var` : '\nTüm seviyeler geçerli, sıra kolaydan zora gidiyor');
process.exit(failed ? 1 : 0);
