// Kullanım: node tools/gate_report.js <kapı> [--file aday.json] [--tries 200]
// Kapı testi: bir kapının bölümlerini (oyundaki ya da üreticinin aday dosyasındaki { kaynak: bölüm }) sınar,
// tools/out/rapor/kapi<N>.txt raporu ve kapi<N>.png paftasını yazar.
// - Rastgele oyuncu: anlamlı hamlelerden rastgele seçerek hamle hakkı içinde kaç kez bitiriyor (EASY üstü: kolay;
//   kapının normal bölümlerinde ortalaması GATE_EASY üstüyse kapı kolay).
// - Benzerlik: oyundaki bütün normal bölümlere göre en benzeri (SIMILAR üstü: benzer). Şekiller sınanmaz.
// - Zorluk eğrisi: her kapının normal bölümlerinin en kolayı, ortalaması, zirvesi ve rastgele oyuncunun ortalama
//   kazanma oranı; sınanan kapı vurgulu. Oyundaki bölümlerin oranı rapor/rastgele.json'da saklanır.
const fs = require('fs');
const path = require('path');
const Logic = require('../logic.js');
const Levels = require('../levels.js');
const Worlds = require('../worlds.js');
const Kit = require('./test_kit.js');

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const GATE = Number(args[0]);
const TRIES = Number(opt('--tries') || 200);
// Eşikler 1-400 bölümlerinde ölçülerek seçildi (R1). Rastgele oyuncu kapı 19-30'da kapı ortalaması %3-39,
// tek bölümde en çok ~%50 kazanır (kapı 31-40'ta ortalama %18-44: bomba ve portal hamleyi kısaltıyor).
// Oyundaki her bölümün en benzeri en çok %73 (ortanca %53); bunun üstü önceki bir bölümün kopyası sayılır.
const EASY = 0.5, GATE_EASY = 0.3, SIMILAR = 0.75;
const G = Worlds.GATE_SIZE;

const order = Levels.gateOrder(Kit.get);
const isShape = d => !!d.name;
const intros = new Set(Object.values(Levels.INTRO));
// Sınanacak bölümler: aday dosyası verilmişse ondan, yoksa oyundaki kapıdan
const file = opt('--file');
const tested = file
  ? Object.entries(JSON.parse(fs.readFileSync(file, 'utf8'))).map(([s, d]) => [Number(s), d])
  : order.slice((GATE - 1) * G, GATE * G).map(s => [s, Kit.get(s)]);
const testedSrc = new Set(tested.map(t => t[0]));
// Benzerlik havuzu: oyundaki normal bölümler (sınananlar hariç)
const pool = order.filter(s => !testedSrc.has(s) && !isShape(Kit.get(s))).map(s => [s, Kit.get(s)]);
const posOf = s => order.indexOf(s) + 1;

const rows = tested.map(([src, def]) => {
  const L = Logic.buildLevel(def);
  const limit = Kit.moveLimit(def.par, src);
  const row = { src, def, shape: isShape(def), intro: intros.has(src), limit, score: Levels.difficultyScore(def),
    near: Levels.closeness(def), feats: Levels.features(def), links: L.links.length, problems: [] };
  if (!Levels.noRingFreeAtStart(L)) row.problems.push('başta serbest halka');
  if (row.shape) return row;
  Object.assign(row, Kit.randomPlay(def, limit, TRIES), { close: Kit.nearest(def, pool) });
  if (!row.intro && row.rate > EASY) row.problems.push(`kolay: rastgele %${Math.round(row.rate * 100)}`);
  if (row.close.src && row.close.sim > SIMILAR) row.problems.push(`benzer: bölüm ${posOf(row.close.src)} (#${row.close.src}) %${Math.round(row.close.sim * 100)}`);
  return row;
});

// Zorluk eğrisi: kapı başına normal bölümlerin puanları ve rastgele oranları (tanıtım ve şekiller hariç);
// sınanan kapı adaydan
const outDir = path.join(__dirname, 'out', 'rapor');
fs.mkdirSync(outDir, { recursive: true });
const cacheFile = path.join(outDir, 'rastgele.json');
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const rateOf = (s, d) => {
  const key = `${s}:${JSON.stringify(d.rings).length}:${d.par}`; // bölüm yeniden üretilirse anahtar değişir
  if (cache[key] == null) cache[key] = Kit.randomPlay(d, Kit.moveLimit(d.par, s), 100).rate;
  return cache[key];
};
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const gates = [];
for (let g = 1; g <= Math.max(order.length / G, GATE); g++) {
  const own = g === GATE ? rows.filter(r => !r.shape && !r.intro)
    : order.slice((g - 1) * G, g * G).filter(s => !intros.has(s) && !isShape(Kit.get(s)))
      .map(s => ({ score: Levels.difficultyScore(Kit.get(s)), rate: rateOf(s, Kit.get(s)) }));
  const sc = own.map(r => r.score);
  if (sc.length) gates.push({ g, min: Math.min(...sc), avg: mean(sc), max: Math.max(...sc), rate: mean(own.map(r => r.rate)) });
}
fs.writeFileSync(cacheFile, JSON.stringify(cache));

// ---- Metin raporu ----
const pct = x => (x == null ? '-' : `%${Math.round(x * 100)}`);
const gate = Worlds.GATES[GATE - 1];
const lines = [`Kapı ${GATE} ${gate ? gate.name : ''} (${file ? 'aday: ' + path.basename(file) : 'oyundaki bölümler'}), rastgele oyuncu ${TRIES} deneme`, ''];
for (const r of rows) {
  lines.push(`#${String(r.src).padEnd(5)} ${(r.shape ? 'şekil ' + r.def.name : r.intro ? 'tanıtım' : 'normal').padEnd(16)} ` +
    `${r.def.rings.length} parça ${String(r.links).padStart(2)} bağ  hedef ${r.def.par}/${r.limit}  puan ${r.score.toFixed(1).padStart(4)}  ` +
    `yakınlık ${r.near.toFixed(2)}  rastgele ${pct(r.rate).padStart(4)}  ` +
    (r.close && r.close.src ? `en benzer #${r.close.src} ${pct(r.close.sim)}  ` : '') + `[${r.feats.join(' ')}]` +
    (r.problems.length ? '  <-- ' + r.problems.join(', ') : ''));
}
const cur = gates.find(x => x.g === GATE), prev = gates.find(x => x.g === GATE - 1);
lines.push('', `Zorluk: en kolay ${cur.min.toFixed(1)}, ortalama ${cur.avg.toFixed(2)}, zirve ${cur.max.toFixed(1)}` +
  (prev ? ` (kapı ${GATE - 1}: ${prev.min.toFixed(1)} / ${prev.avg.toFixed(2)} / ${prev.max.toFixed(1)})` : '') +
  `; rastgele oyuncu ortalama ${pct(cur.rate)}` + (prev ? ` (kapı ${GATE - 1}: ${pct(prev.rate)})` : ''));
let bad = rows.filter(r => r.problems.length).length;
if (cur.rate > GATE_EASY) { lines.push(`Kapı kolay: rastgele oyuncu ortalaması ${pct(cur.rate)} > ${pct(GATE_EASY)}`); bad++; }
lines.push(bad ? `${bad} sorun var` : 'Sorun yok');
fs.writeFileSync(path.join(outDir, `kapi${GATE}.txt`), lines.join('\n'));
console.log(lines.join('\n'));

// ---- Pafta: bölüm kartları (yanında en benzer bölüm) ve zorluk eğrisi ----
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = r => `<div class="card${r.problems.length ? ' bad' : ''}">
  <div class="pics">${Kit.thumb(r.def, 150)}${r.close && r.close.src ? `<div class="twin">${Kit.thumb(Kit.get(r.close.src), 70)}<span>en benzer<br>${posOf(r.close.src)}. bölüm<br>${pct(r.close.sim)}</span></div>` : ''}</div>
  <b>#${r.src}</b> ${esc(r.shape ? r.def.name : r.intro ? 'tanıtım' : '')} · hedef ${r.def.par}/${r.limit} · puan ${r.score.toFixed(1)}<br>
  ${r.shape ? 'şekil' : `rastgele ${pct(r.rate)} · yakınlık ${r.near.toFixed(2)}`}<br><small>${esc(r.feats.join(' '))}</small>
  ${r.problems.map(p => `<div class="warn">${esc(p)}</div>`).join('')}</div>`;

const CW = 1180, CH = 240, top = Math.ceil(Math.max(...gates.map(x => x.max)) + 1), bottom = Math.floor(Math.min(...gates.map(x => x.min)) - 1);
const X = g => 40 + (g - 1) * (CW - 60) / Math.max(1, gates.length - 1), Y = v => 10 + (top - v) * (CH - 40) / (top - bottom);
const poly = k => gates.map(x => `${X(x.g).toFixed(1)},${Y(x[k]).toFixed(1)}`).join(' ');
const chart = `<svg width="${CW}" height="${CH}" font-family="sans-serif" font-size="11">
  ${Array.from({ length: top - bottom + 1 }, (_, i) => bottom + i).filter(v => v % 2 === 0).map(v => `<line x1="40" x2="${CW - 20}" y1="${Y(v)}" y2="${Y(v)}" stroke="#2c3556"/><text x="30" y="${Y(v) + 4}" text-anchor="end" fill="#8b93b0">${v}</text>`).join('')}
  ${gates.filter(x => x.g % 5 === 0 || x.g === GATE).map(x => `<text x="${X(x.g)}" y="${CH - 8}" text-anchor="middle" fill="${x.g === GATE ? '#ffd34a' : '#8b93b0'}">${x.g}</text>`).join('')}
  ${[0, 50, 100].map(v => `<text x="${CW - 16}" y="${14 + (1 - v / 100) * (CH - 40)}" fill="#7ed957">%${v}</text>`).join('')}
  <rect x="${X(GATE) - 7}" y="10" width="14" height="${CH - 40}" fill="#ffd34a" opacity=".15"/>
  <polyline points="${poly('max')}" fill="none" stroke="#ff5a5f" stroke-width="2"/>
  <polyline points="${poly('avg')}" fill="none" stroke="#ffd34a" stroke-width="2"/>
  <polyline points="${poly('min')}" fill="none" stroke="#3ec1d3" stroke-width="2"/>
  <polyline points="${gates.map(x => `${X(x.g).toFixed(1)},${(10 + (1 - x.rate) * (CH - 40)).toFixed(1)}`).join(' ')}" fill="none" stroke="#7ed957" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="50" y="24" fill="#ff5a5f">zirve</text><text x="90" y="24" fill="#ffd34a">ortalama</text><text x="150" y="24" fill="#3ec1d3">en kolay</text>
  <text x="210" y="24" fill="#7ed957">rastgele oyuncu kazanma oranı (kesikli, üst %100, alt %0)</text></svg>`;

const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:20px;background:#121729;color:#e8ebf5;font:13px/1.45 sans-serif;width:${CW}px}
  h1{font-size:20px;margin:0 0 4px} .sum{color:#8b93b0;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
  .card{background:#1a2036;border-radius:10px;padding:8px;border:2px solid transparent} .card.bad{border-color:#ff5a5f}
  .pics{display:flex;gap:6px;align-items:flex-end;margin-bottom:6px} .twin{display:flex;flex-direction:column;gap:2px;color:#8b93b0;font-size:10px;opacity:.85}
  .warn{color:#ff8a8d;font-weight:700} small{color:#8b93b0}</style>
  <h1>Kapı ${GATE} ${esc(gate ? gate.name : '')}</h1>
  <div class="sum">${esc(lines.slice(rows.length + 3).join(' · '))} · rastgele oyuncu ${TRIES} deneme, kolay eşiği ${pct(EASY)}, kapı eşiği ${pct(GATE_EASY)}, benzerlik eşiği ${pct(SIMILAR)}</div>
  <div class="grid">${rows.map(card).join('')}</div><h1>Zorluk eğrisi</h1>${chart}`;
const htmlFile = path.join(outDir, `kapi${GATE}.html`);
fs.writeFileSync(htmlFile, html);
Kit.screenshot(htmlFile, path.join(outDir, `kapi${GATE}.png`), CW + 40, 120 + Math.ceil(rows.length / 5) * 330 + CH + 60);
console.log(`\nPafta: ${path.join(outDir, `kapi${GATE}.png`)}`);
process.exit(bad ? 1 : 0);
