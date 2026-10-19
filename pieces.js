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
    fixed: '#5d6488', blue: '#3d9bff', amber: '#ff8a1f', lamp: '#ffd27a', table: '#c3a6ff' };

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
  ];

  // Canlandırmalardaki kısa yazılar; drawDemo'ya verilen çeviri işleviyle (tr) çevrilir
  const LABELS = ['tık', 'çerçeve kalır', 'tekme: hamle sayılmaz', 'şalter = 1 hamle', '1. hamle: kapak kapandı', '2. hamle: kapak açıldı', 'tabla = 1 hamle'];
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
