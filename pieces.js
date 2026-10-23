// Parça kartları (2.4): oyuncu bir parçayı ilk kez görünce çıkan "kullanma kılavuzu" ve koleksiyondaki
// Parçalar sekmesi. Her parçanın adı, iki kısa cümlesi ve döngü halinde oynayan küçük bir canlandırması var.
// Canlandırmalar oyunun çizim dilini taklit eder (halka, boşluk, açık kesişim, rozetler) ama kural motorunu
// kullanmaz: yalnızca kuralı gösteren kısa bir senaryodur. Çizim alanı DEMO_W × DEMO_H (mantıksal piksel).
// Hem tarayıcıda (window.RingPieces) hem Node'da (require) çalışır.
(function (root) {
  'use strict';

  const DEMO_W = 260, DEMO_H = 190;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const GAP = 26 * DEG, STROKE = 11;
  const C = { red: '#ff6b6b', yellow: '#ffc94a', teal: '#2dd4bf', sky: '#4cc9f0', violet: '#b388ff', orange: '#ff9f1c',
    fixed: '#5d6488', blue: '#3d9bff', amber: '#ff8a1f', lamp: '#ffd27a', table: '#c3a6ff',
    ice: '#aae6ff', brass: '#c98f45', moon: '#c9a7ff', heat: '#ff5a28' };

  // id: levels.js features() adı; intro: parçanın tanıtım bölümü (kaynak numarası)
  const PIECES = [
    { id: 'reverse', intro: 1001, name: 'Ters dişli',
      text: 'Noktalı çizgiyle bağlı iki halka birlikte döner. Ters dişlide biri sağa dönerse eşi sola döner.' },
    { id: 'click', intro: 1003, name: 'Tıklı halka',
      text: 'Bu halka serbest dönmez, tık tık ilerler. Boşluğu yalnızca halkanın dışındaki noktalarda durur.' },
    { id: 'key', intro: 1004, name: 'Kilit ve anahtar',
      text: 'Asma kilitli halka dönmez. Anahtar taşıyan halkayı kurtar: anahtar kilide uçar ve halka açılır.' },
    { id: 'frame', intro: 1005, name: 'Çerçeve',
      text: 'Çerçeve hiç oynamaz ve tahtadan çıkmaz. Halkaların boşluğunu çerçevenin kenarına getirip kurtar.' },
    { id: 'fast', intro: 1002, name: 'Hızlı dişli',
      text: '×2 yazan halka, eşinin iki katı döner. Eşi çeyrek tur dönerse o yarım tur döner.' },
    { id: 'kick', intro: 1006, name: 'Yaylı halka',
      text: 'Rozetli halka yaylıdır. Kurtulup uçarken değdiği halkayı sarmal yayın gösterdiği yöne çeyrek tur iter. Tekme hamle sayılmaz.' },
    { id: 'token', intro: 1007, name: 'Jetonlu halka',
      text: 'Sayılı halka jeton olmadan dönmez. Jeton taşıyan halkayı kurtar, jetonu ona uçar. Her dönüş bir jeton harcar.' },
    { id: 'switch', intro: 1008, name: 'Şalter',
      text: 'Yalnızca şalterin gösterdiği renkteki halkalar döner. Şaltere dokunmak bir hamledir.' },
    { id: 'pulse', intro: 1009, name: 'Nabız halka',
      text: 'Boşluğun kapağı her hamlede açılır ya da kapanır. Kapak kapalıyken boşluk işe yaramaz: ritmi yakala.' },
    { id: 'table', intro: 1010, name: 'Döner tabla',
      text: 'Göbekteki düğmeye dokun: tabla çeyrek tur döner, üstündeki halkalar yer değiştirir. Bu bir hamledir.' },
    // 2.5 parçaları (kapı 31-40)
    { id: 'bomb', intro: 1011, name: 'Bomba halka',
      text: 'Fitilli halka kurtulunca patlar. Turuncu yıldızların olduğu yerde değdiği halkalar, kilitli olsalar da uçar.' },
    { id: 'boiler', intro: 1015, name: 'Basınç kazanı',
      text: 'Göstergedeki sayı kadar komşusu kurtulunca basınç dolar. Düdük öter, kazan patlar ve hâlâ değdiği halkaları uçurur.' },
    { id: 'ice', intro: 1012, name: 'Buz halka',
      text: 'Buzlu halka dönmez. Değdiği her halka kurtuldukça buzu bir kat çatlar; buz eriyince halka döner.' },
    { id: 'motor', intro: 1013, name: 'Motor halka',
      text: 'Dişli halkayı sen çeviremezsin. Her hamlenden sonra kendisi bir adım döner; kesikli iz boşluğunun sonraki yeri.' },
    { id: 'portal', intro: 1014, name: 'İkiz portal',
      text: 'Aynı işareti taşıyan iki halka ikizdir. Biri kurtulunca öbürü nereye bağlı olursa olsun ışınlanıp onunla gider.' },
    // Kapı 31-40 finalleri: tanıtım bölümü yok, ilk finalde kart açılır
    { id: 'boss', intro: null, name: 'Dev Halka',
      text: 'Zırhlı gövde dönmez. Değdiği her halka kurtuldukça bir plaka kırılır; zırh bitince parçalanır ve yanındakilere yol açar.' },
    // 2.6 parçaları (kapı 41-50)
    { id: 'cbomb', intro: 1016, name: 'Renk Bombası',
      text: 'Sarılı şekerli halka kurtulunca kendi rengindeki bütün halkalar, nerede ve neye kilitli olurlarsa olsunlar, onunla uçar. Renkler desenle de ayrılır.' },
    { id: 'ratchet', intro: 1017, name: 'Cırcır halka',
      text: 'Dişli pirinç halka yalnız rozetindeki okun yönüne ve her hamlede bir tık döner. Fazla çevirirsen geri dönemezsin: turu tamamla.' },
    { id: 'pearl', intro: 1018, name: 'İnci halka',
      text: 'Dalgalı kenarlı istiridye kurtulunca içindeki inci belirir. İnci saklıyken hiçbir halkayı tutmaz; belirince değdiklerini tutar. İstiridyeyi en sona bırak.' },
  ];

  // Canlandırmalardaki kısa yazılar; drawDemo'ya verilen çeviri işleviyle (tr) çevrilir
  const LABELS = ['tık', 'çerçeve kalır', 'tekme: hamle sayılmaz', 'şalter = 1 hamle', '1. hamle: kapak kapandı', '2. hamle: kapak açıldı', 'tabla = 1 hamle',
    'değdikleri de uçar', 'basınç doldu!', 'zırh bitti!', 'donmuş: dönmez', 'buz eridi', 'hamle → motor 1 adım', 'ikizi ışınlandı',
    'aynı renk de uçar', 'geri dönmez', 'inci belirdi'];
  let tx = s => s;

  // ---- Zaman yardımcıları ----
  const clamp = t => Math.max(0, Math.min(1, t));
  const seg = (t, a, b) => clamp((t - a) / (b - a));                       // [a, b] aralığında 0→1
  const io = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);  // yumuşak giriş-çıkış
  const back = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2); // sonda hafif geri yaylanma
  const fade = (t, total) => Math.min(1, t / 250, (total - t) / 250);      // döngü başı ve sonu yumuşak geçiş

  // ---- Çizim parçaları ----
  function ring(g, x, y, r, ang, color, o = {}) {
    g.save();
    g.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    g.lineCap = 'round';
    const from = ang + GAP, to = ang + TAU - GAP;
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = STROKE + 5;
    g.beginPath(); g.arc(x + 1.5, y + 3, r, from, to); g.stroke();
    if (o.glow) { g.shadowColor = color; g.shadowBlur = 14; }
    g.strokeStyle = color; g.lineWidth = STROKE;
    g.beginPath(); g.arc(x, y, r, from, to); g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x - 1.5, y - 1.5, r, from, to); g.stroke();
    // çilek deseni (renk bombasının rengi)
    if (o.dots) { g.fillStyle = 'rgba(255,255,255,.88)'; for (let a = from + 0.2; a < to; a += 26 / r) { g.beginPath(); g.arc(...at(x, y, r, a), 2.6, 0, TAU); g.fill(); } }
    g.restore();
  }
  function openPoint(g, x, y, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, 13);
    gr.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fill();
  }
  // Parmak: dokunurken bastırılmış, ötesinde hafif yukarıda
  function finger(g, x, y, press, a = 1) {
    if (a <= 0) return;
    g.save();
    g.globalAlpha *= a;
    if (press) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 17, 0, TAU); g.stroke(); }
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y + (press ? 0 : -5), press ? 10 : 12, 0, TAU); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(x, y + (press ? 0 : -5), 4, 0, TAU); g.fill();
    g.restore();
  }
  // Halkanın üzerindeki bir açıyı sürükleyen parmak (boşluğun karşısından tutar)
  function dragFinger(g, x, y, r, ang, t, total = 1) {
    const a = ang + Math.PI;
    finger(g, x + Math.cos(a) * r, y + Math.sin(a) * r, t > 0 && t < total, t > 0 && t < total ? 1 : 0);
  }
  const at = (x, y, r, a) => [x + Math.cos(a) * r, y + Math.sin(a) * r];
  // Uçan halka: merkezden dışarı doğru, büyüyerek kaybolur
  function flyRing(g, x, y, r, ang, color, t, dx, dy) {
    if (t >= 1) return;
    const e = t * t;
    g.save();
    g.translate(x + dx * 140 * e, y + dy * 140 * e); g.scale(1 + 0.15 * t, 1 + 0.15 * t);
    ring(g, 0, 0, r, ang, color, { alpha: 1 - t });
    g.restore();
  }
  function label(g, text, x, y, a = 1) {
    if (a <= 0) return;
    g.save();
    g.globalAlpha *= a;
    g.font = '800 13px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + 16;
    g.fillStyle = 'rgba(10,8,20,.75)';
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 11, w, 22, 11) : g.rect(x - w / 2, y - 11, w, 22); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, x, y + 1);
    g.restore();
  }
  function couple(g, a, b) {
    g.save();
    g.setLineDash([5, 7]); g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
    g.restore();
  }
  function turnArrow(g, x, y, R, from, dir, color) {
    g.save();
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    const to = from + dir * 70 * DEG;
    g.beginPath(); g.arc(x, y, R, Math.min(from, to), Math.max(from, to)); g.stroke();
    const [hx, hy] = at(x, y, R, to), tg = to + dir * Math.PI / 2;
    g.beginPath();
    g.moveTo(hx + Math.cos(tg) * 8, hy + Math.sin(tg) * 8);
    g.lineTo(hx + Math.cos(tg + 2.4) * 7, hy + Math.sin(tg + 2.4) * 7);
    g.lineTo(hx + Math.cos(tg - 2.4) * 7, hy + Math.sin(tg - 2.4) * 7);
    g.closePath(); g.fill();
    g.restore();
  }
  function hexChip(g, x, y, R, color, text) {
    const hex = rr => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); };
    g.save();
    g.translate(0, 2); hex(R + 2); g.fillStyle = 'rgba(10,8,20,.9)'; g.fill(); g.translate(0, -2);
    hex(R); g.fillStyle = '#fff'; g.fill();
    hex(R - 2.4); g.fillStyle = color; g.fill();
    g.fillStyle = '#fff'; g.font = `900 ${Math.round(R)}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y + 1);
    g.restore();
  }
  function springBadge(g, x, y, color) {
    g.save();
    g.fillStyle = 'rgba(10,8,20,.9)'; g.beginPath(); g.arc(x, y + 2, 14, 0, TAU); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc(x, y, 12.5, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 9.5, 0, TAU); g.fill();
    g.strokeStyle = color; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath(); for (let k = 0; k <= 5; k++) g[k ? 'lineTo' : 'moveTo'](x + (k % 2 ? 4 : -4), y - 6 + k * 2.4); g.stroke();
    g.restore();
  }
  function coil(g, x, y, r, phi0, dir, color) {
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const [w, c] of [[6, 'rgba(10,8,20,.85)'], [3, color]]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath();
      for (let k = 0; k <= 50; k++) {
        const u = k / 50, ph = phi0 + dir * (6 * DEG + u * 48 * DEG), R = r + (u < 0.9 ? Math.sin(u / 0.9 * 5 * TAU) * 6 : 0);
        g[k ? 'lineTo' : 'moveTo'](x + Math.cos(ph) * R, y + Math.sin(ph) * R);
      }
      g.stroke();
    }
    const end = phi0 + dir * 54 * DEG, [hx, hy] = at(x, y, r, end), tg = end + dir * Math.PI / 2;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(hx + Math.cos(tg) * 10, hy + Math.sin(tg) * 10);
    g.lineTo(hx + Math.cos(tg + 2.3) * 8, hy + Math.sin(tg + 2.3) * 8);
    g.lineTo(hx + Math.cos(tg - 2.3) * 8, hy + Math.sin(tg - 2.3) * 8);
    g.closePath(); g.fill();
    g.restore();
  }
  function padlock(g, x, y, open) {
    g.save();
    g.strokeStyle = '#e3e7f1'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y - 6 - open * 6, 6, Math.PI, 0); g.stroke();
    g.fillStyle = '#e3b04b'; g.fillRect(x - 9, y - 6, 18, 14);
    g.fillStyle = '#5a3d0a'; g.beginPath(); g.arc(x, y + 1, 2.5, 0, TAU); g.fill();
    g.restore();
  }
  function keyIcon(g, x, y) {
    g.save();
    g.strokeStyle = '#ffd36b'; g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath(); g.arc(x - 6, y, 5, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x + 10, y); g.moveTo(x + 6, y); g.lineTo(x + 6, y + 5); g.moveTo(x + 10, y); g.lineTo(x + 10, y + 4); g.stroke();
    g.restore();
  }

  // ---- 2.5 rozetleri ve efektleri ----
  function badgeBase(g, x, y, fill, edge) {
    g.fillStyle = 'rgba(10,8,20,.9)'; g.beginPath(); g.arc(x, y + 2, 14, 0, TAU); g.fill();
    g.fillStyle = fill; g.beginPath(); g.arc(x, y, 12.5, 0, TAU); g.fill();
    g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
  }
  function bombBadge(g, x, y, t) {
    g.save();
    badgeBase(g, x, y, '#2a2630', C.red);
    g.strokeStyle = '#d9b48a'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 6, y - 11); g.quadraticCurveTo(x + 10, y - 19, x + 15, y - 17); g.stroke();
    const f = 0.75 + 0.35 * Math.sin(t / 55) * Math.sin(t / 83);
    const sg = g.createRadialGradient(x + 15, y - 17, 0, x + 15, y - 17, 8 * f);
    sg.addColorStop(0, '#fff'); sg.addColorStop(0.35, '#ffd34a'); sg.addColorStop(1, 'rgba(255,90,61,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(x + 15, y - 17, 8 * f, 0, TAU); g.fill();
    g.restore();
  }
  // Renk bombası rozeti: iki ucu bükülmüş sarılı çilek şekeri (noktalı), hafifçe nefes alır
  function candyBadge(g, x, y, t) {
    g.save();
    g.translate(x, y); g.scale(1 + 0.07 * Math.sin(t / 260), 1 + 0.07 * Math.sin(t / 260)); g.rotate(-0.35);
    for (const d of [-1, 1]) {
      g.fillStyle = 'rgba(10,8,20,.9)'; g.beginPath(); g.moveTo(d * 8, 0); g.lineTo(d * 22, -9); g.lineTo(d * 22, 9); g.closePath(); g.fill();
      g.fillStyle = '#ff6fc0'; g.beginPath(); g.moveTo(d * 9, 0); g.lineTo(d * 19.5, -6.5); g.quadraticCurveTo(d * 17, 0, d * 19.5, 6.5); g.closePath(); g.fill();
    }
    badgeBase(g, 0, 0, '#ff6fc0', 'rgba(255,255,255,.6)');
    g.rotate(0.35);
    g.fillStyle = 'rgba(10,8,20,.78)';
    for (const [dx, dy] of [[-4, -3], [4, -3], [0, 4]]) { g.beginPath(); g.arc(dx, dy, 2.2, 0, TAU); g.fill(); }
    g.restore();
  }
  function star(g, x, y, t) {
    g.save();
    g.translate(x, y); g.rotate(t / 900);
    g.fillStyle = '#ff7a45'; g.strokeStyle = 'rgba(10,8,20,.9)'; g.lineWidth = 2;
    g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 3 : 7.5, a = k * Math.PI / 5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.stroke(); g.fill();
    g.restore();
  }
  // Patlama: beyaz-sarı parlama, genişleyen şok halkası, kor parçaları (u: 0→1)
  function blast(g, x, y, u) {
    if (u <= 0 || u >= 1) return;
    g.save();
    if (u < 0.3) {
      const a = 1 - u / 0.3, gr = g.createRadialGradient(x, y, 0, x, y, 70);
      gr.addColorStop(0, `rgba(255,255,240,${a})`); gr.addColorStop(0.4, `rgba(255,211,74,${0.8 * a})`); gr.addColorStop(1, 'rgba(255,90,61,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 70, 0, TAU); g.fill();
    }
    const e = 1 - Math.pow(1 - u, 3);
    g.strokeStyle = `rgba(255,170,90,${1 - u})`; g.lineWidth = 8 * (1 - u) + 1;
    g.beginPath(); g.arc(x, y, 20 + 80 * e, 0, TAU); g.stroke();
    for (let k = 0; k < 14; k++) {
      const a = k * TAU / 14 + 0.3, d = (30 + (k % 3) * 14) * e;
      g.fillStyle = ['#ffd34a', '#ff7a45', '#fff'][k % 3]; g.globalAlpha = 1 - u;
      g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d + 20 * u * u, 2.5, 0, TAU); g.fill();
    }
    g.restore();
  }
  // Dönerek uçan halka (patlamayla vurulan)
  function spinFly(g, x, y, r, ang, color, t, dx, dy, o = {}) {
    if (t >= 1) return;
    const e = t * t;
    g.save();
    g.translate(x + dx * 170 * e, y + dy * 170 * e);
    ring(g, 0, 0, r, ang + 2.5 * e, color, { ...o, alpha: 1 - t });
    g.restore();
  }
  function heatColor(base, h) {
    const a = parseInt(base.slice(1), 16), b = [255, 90, 40];
    const c = [a >> 16, (a >> 8) & 255, a & 255].map((v, k) => Math.round(v + (b[k] - v) * Math.min(1, h * 0.85)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function gauge(g, x, y, h, text) {
    g.save();
    badgeBase(g, x, y, '#f4ece6', '#7a4a3a');
    const A0 = Math.PI * 0.75, SPAN = Math.PI * 1.5;
    [['#4caf6a', 0, 0.45], ['#ffc94a', 0.45, 0.75], ['#ff5a3d', 0.75, 1]].forEach(([c, a, b]) => {
      g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 9.5, A0 + SPAN * a, A0 + SPAN * b); g.stroke();
    });
    const na = A0 + SPAN * h;
    g.strokeStyle = '#2a0e0a'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(na) * 8, y + Math.sin(na) * 8); g.stroke();
    g.fillStyle = '#2a0e0a'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
    g.fillStyle = '#fff1ec'; g.font = '800 8.5px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y + 0.5);
    g.restore();
  }
  // Buz kabuğu (left: kalan kat) ve kar tanesi rozeti
  function iceShell(g, x, y, r, ang, left, pop = 1) {
    g.save();
    g.lineCap = 'round';
    g.shadowColor = '#9be7ff'; g.shadowBlur = 8;
    g.strokeStyle = left >= 2 ? 'rgba(170,230,255,.78)' : 'rgba(170,230,255,.58)'; g.lineWidth = (STROKE + (left >= 2 ? 10 : 7)) * pop;
    g.beginPath(); g.arc(x, y, r, ang + GAP, ang + TAU - GAP); g.stroke();
    g.shadowBlur = 0;
    for (let k = 0; k < 12; k++) {
      const p = ang + GAP + 0.15 + k * (TAU - 2 * GAP - 0.3) / 11;
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(...at(x, y, r - 6, p - 0.05)); g.lineTo(...at(x, y, r + 6, p + 0.05)); g.stroke();
      if (left === 1 && k % 3 === 1) {
        g.strokeStyle = 'rgba(30,60,80,.75)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(...at(x, y, r - 7, p + 0.1)); g.lineTo(...at(x, y, r - 1, p + 0.16)); g.lineTo(...at(x, y, r + 6, p + 0.1)); g.stroke();
      }
    }
    g.restore();
  }
  function snowBadge(g, x, y, n) {
    g.save();
    badgeBase(g, x, y, '#dff6ff', '#4cb8e6');
    g.strokeStyle = '#3a9ccc'; g.lineWidth = 1.5; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8.5, y + Math.sin(a) * 8.5); g.stroke(); }
    g.fillStyle = '#dff6ff'; g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill();
    g.fillStyle = '#0d3a52'; g.font = '800 10px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), x, y + 0.5);
    g.restore();
  }
  function shards(g, x, y, r, u) {
    if (u <= 0 || u >= 1) return;
    g.save();
    for (let k = 0; k < 14; k++) {
      const a = k * TAU / 14, sp = 30 + (k % 4) * 9, px = x + Math.cos(a) * (r + sp * u), py = y + Math.sin(a) * (r + sp * u) + 40 * u * u;
      g.globalAlpha = 1 - u; g.fillStyle = 'rgba(235,250,255,.95)'; g.strokeStyle = '#4cb8e6'; g.lineWidth = 1;
      g.save(); g.translate(px, py); g.rotate(a + u * 4);
      g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 4); g.lineTo(-4, 3); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
  }
  // Motor: dişler (halkanın altında) ve çark rozeti
  function teeth(g, x, y, r, ang) {
    g.save();
    g.fillStyle = C.brass; g.strokeStyle = 'rgba(18,12,7,.9)'; g.lineWidth = 1.2;
    for (let k = 0; k < 24; k++) {
      const a = ang + 0.12 + k * TAU / 24;
      if (Math.abs(((a - ang + Math.PI) % TAU + TAU) % TAU - Math.PI) < GAP + 0.08) continue;
      g.save(); g.translate(...at(x, y, r + STROKE / 2, a)); g.rotate(a);
      g.beginPath(); g.rect(-1, -4, 6, 8); g.fill(); g.stroke(); g.restore();
    }
    g.restore();
  }
  function gearBadge(g, x, y, ang) {
    g.save();
    g.fillStyle = 'rgba(18,12,7,.9)'; g.beginPath(); g.arc(x, y + 2, 14, 0, TAU); g.fill();
    g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#e0a85c'; g.strokeStyle = '#5a3a14'; g.lineWidth = 1.4;
    g.beginPath();
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, rr = k % 2 ? 9 : 12.5; g.lineTo(Math.cos(a - 0.12) * rr, Math.sin(a - 0.12) * rr); g.lineTo(Math.cos(a + 0.12) * rr, Math.sin(a + 0.12) * rr); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2a1a0c'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
    g.restore();
  }
  function nextGap(g, x, y, r, c, a = 1) {
    g.save();
    g.globalAlpha *= a;
    g.strokeStyle = 'rgba(18,12,7,.8)'; g.lineWidth = STROKE + 3; g.lineCap = 'butt';
    g.beginPath(); g.arc(x, y, r, c - GAP * 0.8, c + GAP * 0.8); g.stroke();
    g.strokeStyle = '#fff4e6'; g.lineWidth = 2; g.setLineDash([4, 4]);
    for (const rr of [r - STROKE / 2 - 2, r + STROKE / 2 + 2]) { g.beginPath(); g.arc(x, y, rr, c - GAP * 0.8, c + GAP * 0.8); g.stroke(); }
    g.restore();
  }
  // Portal: ay işaretli girdap rozeti, ikizleri bağlayan iz, ışınlanma girdabı
  function moonBadge(g, x, y, t) {
    g.save();
    badgeBase(g, x, y, '#1c1538', C.moon);
    g.translate(x, y);
    g.save(); g.rotate(t / 700); g.strokeStyle = C.moon; g.globalAlpha = 0.55; g.lineWidth = 1.5; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { g.rotate(TAU / 3); g.beginPath(); g.arc(4, 0, 6.5, Math.PI * 0.9, Math.PI * 1.6); g.stroke(); }
    g.restore();
    g.fillStyle = C.moon; g.beginPath(); g.arc(0, 0, 5.5, 0.6, TAU - 0.6); g.arc(3, 0, 4.3, TAU - 1.05, 1.05, true); g.closePath(); g.fill();
    g.restore();
  }
  function thread(g, a, b, t) {
    g.save();
    g.strokeStyle = C.moon; g.globalAlpha = 0.55; g.lineWidth = 2; g.lineCap = 'round';
    g.setLineDash([2, 7]); g.lineDashOffset = -t / 40;
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 46, b[0], b[1]); g.stroke();
    g.restore();
  }
  function vortex(g, x, y, r, u) {
    if (u <= 0 || u >= 1) return;
    const e = Math.sin(Math.PI * u);
    g.save();
    g.translate(x, y); g.rotate(u * 6);
    g.strokeStyle = C.moon; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { g.globalAlpha = (1 - u) * (1 - k * 0.25); g.beginPath(); g.arc(0, 0, r * (0.3 + 0.25 * k) * e + 2, k, k + Math.PI * 1.3); g.stroke(); }
    g.restore();
  }

  // ---- Canlandırmalar: demo(g, t) — t döngü içindeki milisaniye ----
  const DEMOS = {
    reverse: { ms: 3600, draw(g, t) {
      const e = io(seg(t, 500, 1600)), A = [88, 96], B = [172, 96];
      couple(g, A, B);
      ring(g, A[0], A[1], 46, -Math.PI / 2 + e * 90 * DEG, C.red);
      ring(g, B[0], B[1], 46, -Math.PI / 2 - e * 90 * DEG, C.yellow);
      dragFinger(g, A[0], A[1], 46, -Math.PI / 2 + e * 90 * DEG, t - 400, 1300);
      if (t > 500 && t < 2600) { turnArrow(g, A[0], A[1], 60, 200 * DEG, 1, C.red); turnArrow(g, B[0], B[1], 60, -20 * DEG, -1, C.yellow); }
    } },
    fast: { ms: 3600, draw(g, t) {
      const e = io(seg(t, 500, 1600)), A = [84, 100], B = [176, 100];
      couple(g, A, B);
      ring(g, A[0], A[1], 46, -Math.PI / 2 + e * 90 * DEG, C.teal);
      ring(g, B[0], B[1], 42, -Math.PI / 2 + e * 180 * DEG, C.violet);
      dragFinger(g, A[0], A[1], 46, -Math.PI / 2 + e * 90 * DEG, t - 400, 1300);
      label(g, '×2', B[0], B[1], 1);
      label(g, `${Math.round(e * 90)}°`, A[0], A[1] + 66, seg(t, 500, 700));
      label(g, `${Math.round(e * 180)}°`, B[0], B[1] + 66, seg(t, 500, 700));
    } },
    click: { ms: 4200, draw(g, t) {
      const x = 130, y = 98, r = 56, step = Math.min(4, Math.floor(seg(t, 400, 3000) * 5));
      const pop = t > 400 ? 1 - ((t - 400) % 520) / 520 : 0;
      for (let k = 0; k < 8; k++) {
        const [px, py] = at(x, y, r + 16, -Math.PI / 2 + k * 45 * DEG), on = k === step;
        g.fillStyle = on ? '#fff' : 'rgba(255,255,255,.35)';
        g.beginPath(); g.arc(px, py, on ? 4 + 2 * pop : 3, 0, TAU); g.fill();
      }
      ring(g, x, y, r, -Math.PI / 2 + step * 45 * DEG, C.orange);
      dragFinger(g, x, y, r, -Math.PI / 2 + step * 45 * DEG, t - 400, 2600);
      label(g, tx('tık'), x, y, pop * (t < 3000 ? 1 : 0));
    } },
    key: { ms: 4800, draw(g, t) {
      const K = [92, 100], Lk = [170, 100], r = 46;
      const turn = io(seg(t, 400, 1300)), kAng = 200 * DEG + turn * -160 * DEG;
      const fly = seg(t, 1400, 1950), keyT = io(seg(t, 1500, 2300)), open = seg(t, 2300, 2700), lt = io(seg(t, 2900, 3900));
      if (fly < 1) {
        if (fly === 0) ring(g, K[0], K[1], r, kAng, C.sky); else flyRing(g, K[0], K[1], r, kAng, C.sky, fly, -1, -0.3);
      }
      ring(g, Lk[0], Lk[1], r, 0 + lt * 120 * DEG, C.yellow);
      if (t > 1100 && fly < 0.3) openPoint(g, 130, 66);
      if (open < 1) padlock(g, Lk[0], Lk[1], open);
      if (keyT < 1) keyIcon(g, K[0] + (Lk[0] - K[0]) * keyT, K[1] - Math.sin(Math.PI * keyT) * 40);
      dragFinger(g, K[0], K[1], r, kAng, t - 300, 1000);
      dragFinger(g, Lk[0], Lk[1], r, lt * 120 * DEG, t - 2800, 1100);
    } },
    frame: { ms: 4200, draw(g, t) {
      const x = 150, y = 98, r = 52, e = io(seg(t, 400, 1400)), ang = 90 * DEG - e * 90 * DEG, fly = seg(t, 1600, 2200);
      g.save();
      g.strokeStyle = '#8b93b5'; g.lineWidth = 9; g.lineJoin = 'round';
      g.strokeRect(46, 40, 156, 116);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(46, 40, 156, 116);
      g.restore();
      if (fly === 0) ring(g, x, y, r, ang, C.red); else flyRing(g, x, y, r, ang, C.red, fly, 1, -0.2);
      if (t > 1300 && fly < 0.3) openPoint(g, 202, y);
      dragFinger(g, x, y, r, ang, t - 300, 1200);
      label(g, tx('çerçeve kalır'), 124, 172, seg(t, 2300, 2600));
    } },
    kick: { ms: 4600, draw(g, t) {
      const S = [92, 92], T = [168, 108], r = 46;
      const e = io(seg(t, 400, 1300)), sAng = 160 * DEG - e * 130 * DEG, fly = seg(t, 1450, 2000), kick = seg(t, 1600, 2100);
      const tAng = 180 * DEG + (kick > 0 ? back(kick) : 0) * 90 * DEG;
      ring(g, T[0], T[1], r, tAng, C.yellow);
      if (fly === 0) {
        ring(g, S[0], S[1], r, sAng, C.teal);
        const th = Math.atan2(S[1] - T[1], S[0] - T[0]);
        coil(g, T[0], T[1], r, th + 30 * DEG, 1, C.teal);
        springBadge(g, S[0] - 34, S[1] - 32, C.teal);
      } else flyRing(g, S[0], S[1], r, sAng, C.teal, fly, -1, -0.5);
      if (kick > 0 && kick < 0.6) {
        g.fillStyle = C.teal;
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8, d = 6 + 30 * kick; g.beginPath(); g.arc(128 + Math.cos(a) * d, 86 + Math.sin(a) * d, 2.5, 0, TAU); g.fill(); }
      }
      dragFinger(g, S[0], S[1], r, sAng, t - 300, 1100);
      label(g, tx('tekme: hamle sayılmaz'), 130, 174, seg(t, 2100, 2400));
    } },
    token: { ms: 5200, draw(g, t) {
      const Cr = [88, 112], T = [170, 90], r = 44;
      const e = io(seg(t, 400, 1200)), cAng = 0 + e * 140 * DEG, fly = seg(t, 1300, 1850), chip = io(seg(t, 1400, 2200));
      const has = t > 2200 ? 1 : 0, turn = io(seg(t, 2700, 3700)), spent = t > 3700;
      ring(g, T[0], T[1], r, 200 * DEG + turn * 110 * DEG, C.red, { alpha: has || spent ? 1 : 0.75 });
      if (fly === 0) { ring(g, Cr[0], Cr[1], r, cAng, C.yellow); hexChip(g, Cr[0] - 30, Cr[1] + 34, 10, C.red, '★'); }
      else flyRing(g, Cr[0], Cr[1], r, cAng, C.yellow, fly, -1, 0.4);
      if (chip > 0 && chip < 1) hexChip(g, Cr[0] - 30 + (T[0] + 32 - Cr[0] + 30) * chip, Cr[1] + 34 + (T[1] - 34 - Cr[1] - 34) * chip - Math.sin(Math.PI * chip) * 40, 10, C.red, '★');
      hexChip(g, T[0] + 32, T[1] - 34, 14, has && !spent ? C.red : C.fixed, has && !spent ? '1' : '0');
      dragFinger(g, Cr[0], Cr[1], r, cAng, t - 300, 1000);
      dragFinger(g, T[0], T[1], r, 200 * DEG + turn * 110 * DEG, t - 2600, 1200);
    } },
    switch: { ms: 4600, draw(g, t) {
      const flip = io(seg(t, 1000, 1200)), on = t > 1100 ? 1 : 0, turn = io(seg(t, 1700, 2700));
      const Bp = [92, 112], Op = [168, 112], r = 44;
      ring(g, Bp[0], Bp[1], r, 30 * DEG, C.blue, { alpha: on ? 0.4 : 1 });
      ring(g, Op[0], Op[1], r, 150 * DEG + turn * 100 * DEG, C.amber, { alpha: on ? 1 : 0.4 });
      // şalter
      const x = 130, y = 30, w = 70, h = 32;
      g.save();
      g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : g.rect(x - w / 2, y - h / 2, w, h); g.save(); g.clip();
      g.fillStyle = C.blue; g.globalAlpha = on ? 0.35 : 1; g.fillRect(x - w / 2, y - h / 2, w / 2, h);
      g.fillStyle = C.amber; g.globalAlpha = on ? 1 : 0.35; g.fillRect(x, y - h / 2, w / 2, h);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.stroke();
      const kx = x - w / 2 + h / 2 + flip * (w - h);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(kx, y, h / 2 - 3, 0, TAU); g.fill();
      g.restore();
      finger(g, x + 14, y + 4, t > 850 && t < 1250, t > 600 && t < 1500 ? 1 : 0);
      dragFinger(g, Op[0], Op[1], r, 150 * DEG + turn * 100 * DEG, t - 1600, 1200);
      label(g, tx('şalter = 1 hamle'), 130, 174, seg(t, 1200, 1500));
    } },
    pulse: { ms: 5600, draw(g, t) {
      const x = 130, y = 104, r = 54, e1 = io(seg(t, 400, 1200)), e2 = io(seg(t, 2400, 2900));
      const ang = -90 * DEG + e1 * 70 * DEG + e2 * 0.0001;
      const shut = t < 1200 ? 0 : t < 2900 ? 1 : 0, fly = seg(t, 3100, 3700);
      if (fly === 0) ring(g, x, y, r, ang, C.red); else flyRing(g, x, y, r, ang, C.red, fly, 0, -1);
      if (fly === 0) {
        g.save(); g.lineCap = 'butt';
        if (shut) {
          g.strokeStyle = '#141826'; g.lineWidth = STROKE + 3; g.beginPath(); g.arc(x, y, r, ang - GAP, ang + GAP); g.stroke();
          g.strokeStyle = '#4a516e'; g.lineWidth = STROKE - 3; g.beginPath(); g.arc(x, y, r, ang - GAP, ang + GAP); g.stroke();
          g.strokeStyle = C.lamp; g.lineWidth = 2;
          for (let k = -2; k <= 2; k++) { const a = ang + k * GAP / 2.5; g.beginPath(); g.moveTo(...at(x, y, r - 4, a)); g.lineTo(...at(x, y, r + 4, a)); g.stroke(); }
        } else {
          for (const s of [-1, 1]) { const [px, py] = at(x, y, r, ang + s * GAP); const gr = g.createRadialGradient(px, py, 0, px, py, 13); gr.addColorStop(0, 'rgba(255,236,170,.95)'); gr.addColorStop(1, 'rgba(255,210,122,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, 13, 0, TAU); g.fill(); }
        }
        g.restore();
      }
      dragFinger(g, x, y, r, ang, t - 300, 1000);
      dragFinger(g, x, y, r, ang, t - 2300, 700);
      label(g, tx('1. hamle: kapak kapandı'), x, 176, t > 1300 && t < 2300 ? 1 : 0);
      label(g, tx('2. hamle: kapak açıldı'), x, 176, t > 2900 && t < 4200 ? 1 : 0);
    } },
    table: { ms: 4600, draw(g, t) {
      const T = [130, 100], R = 76, turn = io(seg(t, 1000, 1700)) * 90 * DEG;
      g.save();
      const gr = g.createRadialGradient(T[0], T[1] - 14, 6, T[0], T[1], R);
      gr.addColorStop(0, 'rgba(120,96,220,.32)'); gr.addColorStop(1, 'rgba(60,44,140,.22)');
      g.fillStyle = gr; g.beginPath(); g.arc(T[0], T[1], R, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(195,166,255,.55)'; g.lineWidth = 2.5; g.setLineDash([8, 7]);
      g.beginPath(); g.arc(T[0], T[1], R, turn, turn + TAU); g.stroke(); g.setLineDash([]);
      g.restore();
      ring(g, 222, 100, 34, 200 * DEG, C.sky);
      const off = [-38, 0], cx = T[0] + off[0] * Math.cos(turn) - off[1] * Math.sin(turn), cy = T[1] + off[0] * Math.sin(turn) + off[1] * Math.cos(turn);
      g.save(); g.strokeStyle = 'rgba(195,166,255,.55)'; g.lineWidth = 6; g.beginPath(); g.moveTo(T[0], T[1]); g.lineTo(cx, cy); g.stroke(); g.restore();
      ring(g, cx, cy, 34, 0 + turn, C.yellow);
      g.save();
      g.fillStyle = C.table; g.beginPath(); g.arc(T[0], T[1], 18, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(T[0], T[1], 14.5, 0, TAU); g.fill();
      g.strokeStyle = '#6a4fd0'; g.lineWidth = 2.6; g.lineCap = 'round';
      for (const b of [0, Math.PI]) { g.beginPath(); g.arc(T[0], T[1], 8, b + turn - 1, b + turn + 0.7); g.stroke(); }
      g.restore();
      finger(g, T[0] + 6, T[1] + 6, t > 750 && t < 1100, t > 500 && t < 1400 ? 1 : 0);
      label(g, tx('tabla = 1 hamle'), T[0], 178, seg(t, 1700, 2000));
    } },
    // 2.5: bomba kurtulup patlar, değdiği iki halka (birbirine kilitli olsalar da) dönerek uçar
    bomb: { ms: 4400, draw(g, t) {
      const Bm = [130, 66], L1 = [88, 128], R1 = [172, 128], r = 40;
      const e = io(seg(t, 400, 1200)), bAng = 120 * DEG - e * 120 * DEG + 0 * DEG;
      const fly = seg(t, 1350, 1800), boomU = seg(t, 1550, 2400), hit = seg(t, 1750, 2500);
      if (hit === 0) { ring(g, L1[0], L1[1], r, 200 * DEG, C.yellow); ring(g, R1[0], R1[1], r, -20 * DEG, C.teal); }
      else { spinFly(g, L1[0], L1[1], r, 200 * DEG, C.yellow, hit, -0.8, 0.5); spinFly(g, R1[0], R1[1], r, -20 * DEG, C.teal, hit, 0.8, 0.5); }
      if (fly === 0) {
        ring(g, Bm[0], Bm[1], r, bAng, C.red);
        for (const p of [[103, 95], [157, 95]]) star(g, p[0], p[1], t);
        bombBadge(g, Bm[0] - 26, Bm[1] - 30, t);
      } else flyRing(g, Bm[0], Bm[1], r, bAng, C.red, fly, 0, -1);
      if (t > 1100 && fly < 0.3) openPoint(g, ...at(Bm[0], Bm[1], r, 0));
      blast(g, Bm[0], Bm[1], boomU);
      dragFinger(g, Bm[0], Bm[1], r, bAng, t - 300, 1000);
      label(g, tx('değdikleri de uçar'), 130, 178, seg(t, 2300, 2600));
    } },
    // 2.5: kazanın iki komşusu gidince basınç dolar; düdük, akkor, patlama ve kalan komşu uçar
    boiler: { ms: 5400, draw(g, t) {
      const B = [130, 112], A = [66, 112], Cn = [194, 112], T = [130, 46], r = 38;
      const aFly = seg(t, 700, 1200), cFly = seg(t, 1800, 2300), fuse = t > 2400 && t < 3300, boomU = seg(t, 3300, 4100), tHit = seg(t, 3450, 4200);
      const gone = (aFly > 0 ? 1 : 0) + (cFly > 0 ? 1 : 0), h = fuse || boomU > 0 ? 1 : gone / 2;
      if (aFly === 0) ring(g, A[0], A[1], r, 180 * DEG, C.sky); else flyRing(g, A[0], A[1], r, 180 * DEG, C.sky, aFly, -1, -0.2);
      if (cFly === 0) ring(g, Cn[0], Cn[1], r, 0, C.violet); else flyRing(g, Cn[0], Cn[1], r, 0, C.violet, cFly, 1, -0.2);
      if (tHit === 0) ring(g, T[0], T[1], r - 4, -90 * DEG, C.yellow); else spinFly(g, T[0], T[1], r - 4, -90 * DEG, C.yellow, tHit, 0, -1);
      if (boomU === 0) {
        const jit = fuse ? 2.5 * Math.sin(t / 21) : h * 1.4 * Math.sin(t / 21);
        g.save();
        if (h) { g.shadowColor = fuse ? '#fff3b0' : C.heat; g.shadowBlur = 8 + 20 * h; }
        ring(g, B[0] + jit, B[1], r, 90 * DEG, h ? heatColor(C.red, h) : C.red);
        g.restore();
        gauge(g, B[0] + jit + 26, B[1] + 30, h, fuse ? '!' : String(2 - gone));
      }
      blast(g, B[0], B[1], boomU);
      finger(g, A[0] - 30, A[1] + 26, t > 500 && t < 750, t > 300 && t < 900 ? 1 : 0);
      finger(g, Cn[0] + 30, Cn[1] + 26, t > 1600 && t < 1850, t > 1400 && t < 2000 ? 1 : 0);
      label(g, tx('basınç doldu!'), 130, 178, fuse ? 1 : 0);
    } },
    // 2.5: buzlu halka dönmez; komşusu kurtulunca buz çatlayıp erir, sonra döner
    ice: { ms: 5200, draw(g, t) {
      const I = [92, 104], N = [170, 104], r = 44;
      const deny = t > 400 && t < 1300, shake = deny ? Math.sin((t - 400) / 25) * 4 * (1 - (t - 400) / 900) : 0;
      const nE = io(seg(t, 1500, 2200)), nFly = seg(t, 2300, 2800), crack = seg(t, 2350, 3100), turn = io(seg(t, 3400, 4300));
      if (nFly === 0) ring(g, N[0], N[1], r, 200 * DEG - nE * 200 * DEG, C.yellow); else flyRing(g, N[0], N[1], r, 0, C.yellow, nFly, 1, -0.3);
      const iAng = 30 * DEG + turn * 110 * DEG;
      ring(g, I[0] + shake, I[1], r, iAng, C.sky);
      if (crack === 0) { iceShell(g, I[0] + shake, I[1], r, iAng, 1); snowBadge(g, I[0] - 30 + shake, I[1] - 32, 1); }
      else if (crack < 0.25) iceShell(g, I[0], I[1], r, iAng, 1, 1 + 0.1 * Math.sin(crack / 0.25 * Math.PI));
      shards(g, I[0], I[1], r, crack);
      dragFinger(g, I[0], I[1], r, iAng, deny ? 1 : 0, 2);
      dragFinger(g, N[0], N[1], r, 200 * DEG - nE * 200 * DEG, t - 1400, 900);
      dragFinger(g, I[0], I[1], r, iAng, t - 3300, 1100);
      label(g, tx('donmuş: dönmez'), 130, 178, deny ? 1 : 0);
      label(g, tx('buz eridi'), 130, 178, t > 2500 && t < 3300 ? 1 : 0);
    } },
    // 2.5: her hamleden sonra motor halka kendiliğinden bir adım (çeyrek tur) döner
    motor: { ms: 5600, draw(g, t) {
      const M = [160, 104], O = [80, 104], r = 46;
      const m1 = io(seg(t, 400, 1100)), k1 = seg(t, 1250, 1700), m2 = io(seg(t, 2600, 3300)), k2 = seg(t, 3450, 3900);
      const mAng = -90 * DEG + (k1 > 0 ? back(k1) : 0) * 90 * DEG + (k2 > 0 ? back(k2) : 0) * 90 * DEG;
      const oAng = 160 * DEG + m1 * 50 * DEG + m2 * 50 * DEG;
      ring(g, O[0], O[1], r, oAng, C.teal);
      teeth(g, M[0], M[1], r, mAng);
      ring(g, M[0], M[1], r, mAng, C.red);
      const still = (k1 === 0 || k1 === 1) && (k2 === 0 || k2 === 1);
      if (still) nextGap(g, M[0], M[1], r, mAng + 90 * DEG, 0.6 + 0.3 * Math.sin(t / 260));
      gearBadge(g, M[0] + 32, M[1] - 34, mAng);
      dragFinger(g, O[0], O[1], r, oAng, t - 300, 900);
      dragFinger(g, O[0], O[1], r, oAng, t - 2500, 900);
      label(g, tx('hamle → motor 1 adım'), 130, 178, (k1 > 0 && t < 2400) || k2 > 0 ? 1 : 0);
    } },
    // 2.5: ikizlerden biri kurtulunca öbürü (uzakta olsa da) girdapta dönerek kaybolur
    portal: { ms: 4600, draw(g, t) {
      const P1 = [66, 112], Mid = [130, 112], P2 = [214, 70], r = 38;
      const e = io(seg(t, 400, 1200)), pAng = 60 * DEG + e * 120 * DEG, fly = seg(t, 1350, 1850);
      const vU = seg(t, 1550, 2350), tele = seg(t, 1750, 2450), te = tele * tele;
      ring(g, Mid[0], Mid[1], r, -40 * DEG, C.yellow);
      ring(g, 214, 140, 30, 150 * DEG, C.teal);
      if (tele < 1) {
        g.save(); g.translate(P2[0], P2[1]); g.scale(Math.max(0.02, 1 - te), Math.max(0.02, 1 - te));
        ring(g, 0, 0, r - 8, 90 * DEG + 5 * te, C.violet, { alpha: 1 - te }); g.restore();
      }
      if (fly === 0) ring(g, P1[0], P1[1], r, pAng, C.red); else flyRing(g, P1[0], P1[1], r, pAng, C.red, fly, -1, -0.3);
      const b1 = [P1[0] - 26, P1[1] - 30], b2 = [P2[0] - 22, P2[1] - 24];
      if (fly === 0) { thread(g, b1, b2, t); moonBadge(g, b1[0], b1[1], t); }
      if (tele === 0) moonBadge(g, b2[0], b2[1], t);
      if (t > 1100 && fly < 0.3) openPoint(g, ...at(P1[0], P1[1], r, 0));
      vortex(g, P2[0], P2[1], r, vU);
      dragFinger(g, P1[0], P1[1], r, pAng, t - 300, 1000);
      label(g, tx('ikizi ışınlandı'), 130, 178, seg(t, 2000, 2300));
    } },
    // 2.5: Dev Halka; iki komşusu gidince iki plaka kırılır, sarsılır, parçalanır ve üstteki halka serbest kalır
    boss: { ms: 5200, draw(g, t) {
      const B = [130, 100], A = [64, 100], Cn = [196, 100], T = [130, 38], r = 46;
      const aFly = seg(t, 700, 1200), cFly = seg(t, 1700, 2200), fuse = t > 2300 && t < 3000, brk = seg(t, 3000, 3800), tFly = seg(t, 3150, 3650);
      const left = 2 - (aFly > 0 ? 1 : 0) - (cFly > 0 ? 1 : 0);
      if (aFly === 0) ring(g, A[0], A[1], 28, 180 * DEG, C.sky); else flyRing(g, A[0], A[1], 28, 180 * DEG, C.sky, aFly, -1, -0.2);
      if (cFly === 0) ring(g, Cn[0], Cn[1], 28, 0, C.violet); else flyRing(g, Cn[0], Cn[1], 28, 0, C.violet, cFly, 1, -0.2);
      if (tFly === 0) ring(g, T[0], T[1], 24, -90 * DEG, C.yellow); else flyRing(g, T[0], T[1], 24, -90 * DEG, C.yellow, tFly, 0, -1);
      if (brk === 0) {
        const jx = fuse ? 3 * Math.sin(t / 19) : 0;
        ring(g, B[0] + jx, B[1], r, 90 * DEG, C.red);
        for (let k = 0; k < left; k++) {
          const c = -90 * DEG + (k - 0.5) * 140 * DEG, hit = (t > 1200 && t < 1450 && k === 1) || (t > 2200 && t < 2450 && k === 0);
          g.save(); g.lineCap = 'butt';
          g.strokeStyle = 'rgba(10,8,20,.6)'; g.lineWidth = STROKE + 10; g.beginPath(); g.arc(B[0] + jx + 1, B[1] + 2, r, c - 0.9, c + 0.9); g.stroke();
          g.strokeStyle = hit ? '#fff' : '#9aa6bd'; g.lineWidth = STROKE + 7; g.beginPath(); g.arc(B[0] + jx, B[1], r, c - 0.9, c + 0.9); g.stroke();
          g.fillStyle = '#4a5368'; for (const a of [c - 0.82, c + 0.82]) { g.beginPath(); g.arc(...at(B[0] + jx, B[1], r, a), 2.2, 0, TAU); g.fill(); }
          g.restore();
        }
      } else if (brk < 1) {
        g.save();
        for (let k = 0; k < 20; k++) {
          const a = k * TAU / 20, d = r * (0.6 + brk * 1.6);
          g.globalAlpha = 1 - brk; g.fillStyle = k % 3 ? C.red : '#fff';
          g.save(); g.translate(...at(B[0], B[1] + 30 * brk * brk, d, a)); g.rotate(a + brk * 5);
          g.beginPath(); g.moveTo(0, -6); g.lineTo(5, 5); g.lineTo(-5, 4); g.closePath(); g.fill(); g.restore();
        }
        g.restore();
      }
      // can çubuğu
      g.save();
      g.fillStyle = 'rgba(10,8,20,.75)'; g.fillRect(95, 163, 70, 14);
      for (let k = 0; k < 2; k++) {
        const on = k < left && brk === 0;
        g.fillStyle = on ? (fuse && Math.sin(t / 50) > 0 ? '#fff3b0' : '#e8463a') : 'rgba(255,255,255,.12)';
        g.fillRect(98 + k * 33, 166, 31, 8);
      }
      g.restore();
      finger(g, A[0] - 24, A[1] + 30, t > 500 && t < 750, t > 300 && t < 900 ? 1 : 0);
      finger(g, Cn[0] + 24, Cn[1] + 30, t > 1500 && t < 1750, t > 1300 && t < 1900 ? 1 : 0);
      label(g, tx('zırh bitti!'), 130, 150, fuse ? 1 : 0);
    } },
    // 2.6: renk bombası kurtulur, uzaktaki kilitli çilek halkaya şerit uzanır ve o da uçar; ortağı serbest kalır
    cbomb: { ms: 4600, draw(g, t) {
      const B = [62, 96], Lv = [112, 136], P = [178, 74], S = [210, 126], r = 36, pink = '#ff6fc0';
      const e = io(seg(t, 400, 1200)), bAng = 200 * DEG - e * 150 * DEG, fly = seg(t, 1350, 1800);
      const beam = seg(t, 1500, 1740), hit = seg(t, 1800, 2450), sFly = seg(t, 2550, 3000);
      if (fly === 0) ring(g, Lv[0], Lv[1], 30, 230 * DEG, C.violet); else flyRing(g, Lv[0], Lv[1], 30, 230 * DEG, C.violet, fly, 0.3, 1);
      if (sFly === 0) ring(g, S[0], S[1], 32, 120 * DEG, C.sky); else flyRing(g, S[0], S[1], 32, 120 * DEG, C.sky, sFly, 1, 0.4);
      if (hit === 0) ring(g, P[0], P[1], 34, 300 * DEG, pink, { dots: true, glow: beam === 1 });
      else spinFly(g, P[0], P[1], 34, 300 * DEG, pink, hit, 0.6, -1, { dots: true });
      if (fly === 0) {
        ring(g, B[0], B[1], r, bAng, pink, { dots: true });
        candyBadge(g, ...at(B[0], B[1], r, bAng + Math.PI), t);
      } else flyRing(g, B[0], B[1], r, bAng, pink, fly, -1, -0.6);
      if (t > 1100 && fly < 0.3) openPoint(g, 92, 115);
      if (beam > 0 && t < 2100) {
        // şerit: bombanın yerinden çilek halkaya, ucunda parıltı
        const hx = B[0] + (P[0] - B[0]) * beam, hy = B[1] + (P[1] - B[1]) * beam;
        g.save(); g.globalAlpha *= 1 - seg(t, 1850, 2100); g.lineCap = 'round';
        for (const [w, c] of [[9, 'rgba(10,8,20,.55)'], [5.5, pink], [2, '#fff']]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(B[0], B[1]); g.lineTo(hx, hy); g.stroke(); }
        g.restore();
      }
      dragFinger(g, B[0], B[1], r, bAng, t - 300, 1000);
      label(g, tx('aynı renk de uçar'), 130, 178, seg(t, 2000, 2300));
    } },
    // 2.6: cırcır saat yönünde bir tık ilerler, ters çevrilince mandal takılır, sonra bir tık daha
    ratchet: { ms: 5000, draw(g, t) {
      const x = 130, y = 94, r = 52, brass = '#f0b44a';
      const c1 = seg(t, 500, 800), c2 = seg(t, 3200, 3500), deny = t > 1700 && t < 2500;
      const ang = -90 * DEG + (c1 > 0 ? back(c1) : 0) * 90 * DEG + (c2 > 0 ? back(c2) : 0) * 90 * DEG + (deny ? 0.04 * Math.sin(t / 22) : 0);
      const pos = (c1 > 0.5 ? 1 : 0) + (c2 > 0.5 ? 1 : 0);
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 2, [px, py] = at(x, y, r + 22, a);
        if (k === pos + 1 && !deny && (t < 300 || (t > 1000 && t < 3000) || t > 3700)) {
          g.save(); g.translate(px, py); g.rotate(a + Math.PI / 2);
          g.fillStyle = '#ffe6a8'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -7); g.lineTo(-2, 0); g.lineTo(-5, 7); g.closePath(); g.fill(); g.restore();
          continue;
        }
        g.fillStyle = k === pos ? '#ffd36b' : 'rgba(255,255,255,.4)';
        g.beginPath(); g.arc(px, py, k === pos ? 5 : 3, 0, TAU); g.fill();
      }
      // testere dişleri: dik yüz dönüş yönünde
      g.save(); g.fillStyle = brass;
      for (let th = ang + GAP + 0.1; th < ang + TAU - GAP - 0.3; th += 0.3) {
        g.beginPath(); g.moveTo(...at(x, y, r + 4, th)); g.lineTo(...at(x, y, r + 10, th + 0.3)); g.lineTo(...at(x, y, r + 4, th + 0.3)); g.closePath(); g.fill();
      }
      g.restore();
      ring(g, x, y, r, ang, brass);
      // rozet: pirinç disk, saat yönü ok; takılınca kızarır
      const [bx, by] = at(x, y, r, ang + Math.PI);
      g.save(); g.translate(bx + (deny ? 2.5 * Math.sin(t / 18) : 0), by);
      g.fillStyle = 'rgba(10,8,20,.9)'; g.beginPath(); g.arc(0, 2, 14, 0, TAU); g.fill();
      g.fillStyle = deny ? '#e64a32' : brass; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
      g.strokeStyle = '#3a2500'; g.fillStyle = '#3a2500'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, 6, -2.4, 0.75); g.stroke();
      const [hx, hy] = at(0, 0, 6, 0.75), ta = 0.75 + Math.PI / 2;
      g.beginPath(); g.moveTo(...at(hx, hy, 4, ta)); g.lineTo(...at(hx, hy, 3.6, ta + 2.4)); g.lineTo(...at(hx, hy, 3.6, ta - 2.4)); g.closePath(); g.fill();
      g.restore();
      dragFinger(g, x, y, r, ang, t - 300, 700);
      // ters yöne çeken parmak
      dragFinger(g, x, y, r, ang + (t > 1600 ? -0.25 * seg(t, 1600, 1900) : 0), t - 1500, 1100);
      dragFinger(g, x, y, r, ang, t - 3000, 700);
      label(g, tx('tık'), x, y, (c1 > 0 && t < 1300) || (c2 > 0 && t < 4100) ? 1 : 0);
      label(g, tx('geri dönmez'), x, y, deny ? 1 : 0);
    } },
    // 2.6: önce yandaki halka gider, sonra istiridye; kapaklar ayrılır, inci belirir ve hemen uçar
    pearl: { ms: 4800, draw(g, t) {
      const O = [120, 96], N = [196, 96], r = 50, shell = '#a99bc4', pearl = '#f4efe6';
      const n1 = io(seg(t, 400, 1100)), nFly = seg(t, 1250, 1700), s1 = io(seg(t, 1900, 2600)), sFly = seg(t, 2750, 3150);
      const born = seg(t, 2800, 3200), pFly = seg(t, 3450, 3900);
      if (nFly === 0) ring(g, N[0], N[1], 40, 250 * DEG + n1 * 110 * DEG, C.teal); else flyRing(g, N[0], N[1], 40, 0, C.teal, nFly, 1, -0.2);
      if (born === 0) {
        g.save(); g.setLineDash([4, 6]); g.strokeStyle = 'rgba(244,239,230,.35)'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(O[0], O[1], 28, 0, TAU); g.stroke(); g.restore();
        g.save(); g.shadowColor = '#fff'; g.shadowBlur = 12; g.fillStyle = pearl; g.beginPath(); g.arc(O[0], O[1], 9, 0, TAU); g.fill(); g.restore();
      } else if (pFly === 0) ring(g, O[0], O[1], 28 * (0.3 + 0.7 * born), 90 * DEG, pearl, { glow: born < 1 });
      else flyRing(g, O[0], O[1], 28, 90 * DEG, pearl, pFly, -1, -0.4);
      if (sFly === 0) {
        g.save(); g.fillStyle = shell;
        const ang = 160 * DEG + s1 * 200 * DEG;
        for (let a = ang + GAP + 0.1; a < ang + TAU - GAP - 0.2; a += 0.28) { g.beginPath(); g.arc(...at(O[0], O[1], r + 6, a + 0.14), 4.5, 0, TAU); g.fill(); }
        g.restore();
        ring(g, O[0], O[1], r, ang, shell);
      } else if (sFly < 1) {
        g.save(); g.globalAlpha *= 1 - sFly; g.fillStyle = shell;
        for (const d of [-1, 1]) { g.beginPath(); g.ellipse(O[0] + d * 30 * sFly, O[1] + 40 * sFly * sFly, 26, 18, d * sFly, 0, TAU); g.fill(); }
        g.restore();
      }
      dragFinger(g, N[0], N[1], 40, 250 * DEG + n1 * 110 * DEG, t - 300, 900);
      dragFinger(g, O[0], O[1], r, 160 * DEG + s1 * 200 * DEG, t - 1800, 900);
      label(g, tx('inci belirdi'), 130, 178, seg(t, 2900, 3150) * (t < 3700 ? 1 : 0));
    } },
  };

  // Kartın canlandırması: döngü başı/sonu hafif kararır
  function drawDemo(g, id, now, translate) {
    const d = DEMOS[id];
    if (!d) return;
    tx = translate || (x => x);
    const t = now % (d.ms + 600);
    g.clearRect(0, 0, DEMO_W, DEMO_H);
    g.save();
    g.globalAlpha = fade(Math.min(t, d.ms), d.ms + 600);
    d.draw(g, Math.min(t, d.ms));
    g.restore();
  }

  const api = { PIECES, LABELS, DEMO_W, DEMO_H, drawDemo, DEMOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingPieces = api;
})(this);
