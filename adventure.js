// Macera haritası: bütün bölümlerin yolu tek bir canvas'a çizilir (yalnız görünen kısım).
// Her durak bir istasyon (dünyanın kendi yapıları), kapılar dünyaya uygun yapılar, ulaşılmamış yer sisin altında.
// Halka (oyunun maskotu) şimdiki durakta bekler; bölüm kazanılınca önceki istasyonun nesnesiyle sonrakine gider.
// Kaydırma ve dokunma oyunun DOM düğmelerinde kalır (erişilebilirlik): bu modül yalnız çizer ve düzeni verir.
// Tarayıcıda window.RingAdventure; Node'da require (yalnız düzen ve istasyon adları sınanır).
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  // Mantıksal genişlik 400: çizim gerçek genişliğe ölçeklenir. Yukarı doğru: her durak STEP, kapı yapısına GATE_GAP
  const W = 400, STEP = 124, GATE_GAP = 340, FIRST = 380, TOP_PAD = 460;
  const INK = '#141826', GOLD = '#ffc94a';
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(c * (1 + k)))); return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`; };
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  // ---- istasyonlar ve yolculuk: durak adları, çizimleri ve yolculuk biçimi journey.js'te (kapı kapı) ----
  // journey.js'teki yolculuk adı -> çizimdeki biçim
  const TRAVEL_OF = { fener: 'lantern', balon: 'balloon', roket: 'rocket', top: 'cannon', ziplama: 'bounce', kus: 'bird',
    tekerlek: 'wheel', kayma: 'slide', paten: 'skate', kizak: 'sled', kartopu: 'snowball', isinlanma: 'teleport',
    tekne: 'boat', vagon: 'cart', teleferik: 'zip', ucurtma: 'kite', sarkac: 'swing' };
  const TRAVEL_MS = { lantern: 1500, balloon: 1500, rocket: 950, cannon: 800, bounce: 1100, bird: 1300, wheel: 1100, slide: 1000, skate: 1000,
    sled: 1000, snowball: 1300, teleport: 900, boat: 1300, cart: 1000, zip: 1100, kite: 1500, swing: 1100 };
  const PATH_MODES = new Set(['wheel', 'slide', 'skate', 'sled', 'snowball', 'boat', 'cart']);
  const CROUCH = 380; // hizalanma: boşluk gideceği istasyona döner
  const HERO = { r: 20, band: 10 };

  // ---- düzen: bölümler aşağıdan yukarı; her kapının altında kapı yapısı ----
  function layout(count, gateSize) {
    const gates = Math.ceil(count / gateSize);
    const yb = n => { const i = n - 1, g = Math.floor(i / gateSize); return FIRST + g * (gateSize * STEP + GATE_GAP) + (i % gateSize) * STEP; };
    const H = yb(count) + TOP_PAD;
    const nodes = [], gateY = [], pts = [], index = [];
    for (let n = 1; n <= count; n++) nodes[n] = { x: W / 2 + Math.sin(n * 0.95 + 0.4) * 108, y: H - yb(n) };
    // Kapı yapısının taban çizgisi: kapının ilk durağının 294 altında (önceki kapının son durağının 170 üstünde)
    for (let g = 1; g <= gates; g++) gateY[g] = H - (yb((g - 1) * gateSize + 1) - 294);
    for (let g = 1; g <= gates; g++) {
      pts.push({ x: W / 2, y: gateY[g] - 8 });
      for (let n = (g - 1) * gateSize + 1; n <= Math.min(count, g * gateSize); n++) { index[n] = pts.length; pts.push(nodes[n]); }
    }
    return { H, nodes, gateY, pts, index, gates };
  }

  function create(o) {
    const cv = o.canvas, g = cv.getContext('2d'), sc = o.scroller, D = o.data;
    const J = o.journey || root.RingJourney || { STOPS: {} };
    const tr = o.tr || (s => s);
    const reduced = () => (o.reduced ? o.reduced() : false);
    const snd = o.sound || { tone() {}, noise() {} };
    const N = D.count, GS = D.gateSize;
    const L = layout(N, GS), H = L.H, NODES = L.nodes, PTS = L.pts, GATE_Y = L.gateY;
    const gateOf = n => Math.floor((n - 1) / GS) + 1;
    const gateStart = gt => (gt - 1) * GS + 1;
    const worldOfGate = gt => D.worldOfGate(gt);
    const worldOf = n => worldOfGate(gateOf(n));

    function pathPoint(t) {
      const m = PTS.length, i = Math.max(0, Math.min(m - 2, Math.floor(t))), f = t - i;
      const p0 = PTS[Math.max(0, i - 1)], p1 = PTS[i], p2 = PTS[i + 1], p3 = PTS[Math.min(m - 1, i + 2)];
      const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
      return { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) };
    }
    // Yol taşları: eğri boyunca eşit aralıklı; 100 px'lik kovalara ayrılır (yakınlık sorgusu ve görünür kısım için)
    const STONES = [], BUCKET = new Map();
    (function () {
      let prev = pathPoint(0), acc = 0;
      for (let t = 0; t <= PTS.length - 1; t += 0.01) {
        const p = pathPoint(t), d = Math.hypot(p.x - prev.x, p.y - prev.y);
        acc += d;
        if (acc >= 19) {
          acc = 0;
          const q = pathPoint(Math.min(PTS.length - 1, t + 0.01));
          const s = { x: p.x, y: p.y, a: Math.atan2(q.y - p.y, q.x - p.x), t, s: 0.85 + ((t * 977) % 1) * 0.3 };
          STONES.push(s);
          const b = Math.floor(p.y / 100);
          if (!BUCKET.has(b)) BUCKET.set(b, []);
          BUCKET.get(b).push(s);
        }
        prev = p;
      }
    })();
    const stonesNear = y => [...(BUCKET.get(Math.floor(y / 100) - 1) || []), ...(BUCKET.get(Math.floor(y / 100)) || []), ...(BUCKET.get(Math.floor(y / 100) + 1) || [])];

    // Dünya bölgeleri: kapı yapısının arkasından (150 üstünden) bir sonraki dünyanın başlangıcına
    const REGIONS = [];
    (function () {
      let cur = null;
      for (let gt = 1; gt <= L.gates; gt++) {
        const w = worldOfGate(gt);
        if (!cur || cur.world.id !== w.id) {
          const edge = gt === 1 ? H : GATE_Y[gt] - 150;
          if (cur) cur.top = edge;
          cur = { world: w, bottom: edge, top: 0, gate: gt };
          REGIONS.push(cur);
        }
      }
    })();
    const regionAt = y => REGIONS.find(r => y >= r.top && y < r.bottom) || REGIONS[0];

    // ---- durum ----
    const S = { pos: D.frontier(), hop: null, land: null, cheer: 0, cheerStar: false, fx: [], fireworks: [], flyStars: [], trail: [],
      opening: {}, fogT: {}, follow: false, wow: 0, k: 1, playRect: null };
    let k = 1; // mantıksal birimden piksele

    // ---- yardımcı çizimler ----
    const add = fn => { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); };
    function glow(x, y, r, color, a = 1) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1; }
    function shadow(x, y, rx, ry, a = 0.45) { g.fillStyle = `rgba(10,4,16,${a})`; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); g.fill(); }
    function star(x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    function gear(x, y, r, teeth, rot, col) {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i < teeth * 2; i++) { const a = i * Math.PI / teeth, rr2 = i % 2 ? r : r * 0.78; g.lineTo(Math.cos(a - 0.12) * rr2, Math.sin(a - 0.12) * rr2); g.lineTo(Math.cos(a + 0.12) * rr2, Math.sin(a + 0.12) * rr2); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(0, 0, r * 0.45, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * 0.22, 0, TAU); g.fill();
      g.restore();
    }
    // Meşale: duvar yuvası, titreyen alev ve ışık
    function torch(x, y, now) {
      const f = reduced() ? 1 : 0.8 + 0.2 * Math.sin(now / 70 + x) * Math.sin(now / 113 + y);
      g.fillStyle = '#3a3440'; g.fillRect(x - 3, y, 6, 9); g.fillStyle = '#5a3a20'; g.fillRect(x - 1.5, y - 8, 3, 9);
      g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(x - 4, y - 8); g.quadraticCurveTo(x, y - 22 * f, x + 4, y - 8); g.fill();
      add(() => { glow(x, y - 12, 40 * f, 'rgba(255,150,60,.65)'); glow(x, y - 12, 8 * f, 'rgba(255,245,200,1)'); });
    }
    // Fıçı: çemberli ahşap gövde
    function barrel(x, y, s) {
      g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(x, y - 11 * s, 9 * s, 12 * s, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3a2410'; g.lineWidth = 1.8 * s; g.beginPath(); g.moveTo(x - 8.5 * s, y - 17 * s); g.lineTo(x + 8.5 * s, y - 17 * s); g.moveTo(x - 8.5 * s, y - 5 * s); g.lineTo(x + 8.5 * s, y - 5 * s); g.stroke();
      g.fillStyle = '#b07a40'; g.beginPath(); g.ellipse(x, y - 22 * s, 7.5 * s, 2.6 * s, 0, 0, TAU); g.fill();
    }
    // Hazine sandığı: kapağı op oranında açılır
    function chest(op) {
      g.fillStyle = '#8a4a1a'; g.fillRect(-13, -4, 26, 15); g.fillStyle = '#5a2e10'; g.fillRect(-13, 8, 26, 3);
      g.save(); g.translate(0, -4); g.rotate(-op * 1.6); g.fillStyle = '#b0622a'; g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(0, -14, 13, 0); g.closePath(); g.fill(); g.restore();
      g.fillStyle = '#ffd34a'; g.fillRect(-2.5, -6, 5, 11); g.fillRect(-13, 2, 26, 2.5);
    }
    // Maden vagonu: tahta kasa, rot açısıyla dönen tekerlekler
    function cart(rot) {
      for (const wx of [-14, 14]) { g.save(); g.translate(wx, 10); g.rotate(rot); g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill(); g.strokeStyle = '#9aa0b0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.moveTo(0, -5); g.lineTo(0, 5); g.stroke(); g.restore(); }
      g.fillStyle = INK; g.beginPath(); g.moveTo(-25, -10); g.lineTo(25, -10); g.lineTo(21, 8); g.lineTo(-21, 8); g.closePath(); g.fill();
      g.fillStyle = '#8a5a34'; g.beginPath(); g.moveTo(-23, -8); g.lineTo(23, -8); g.lineTo(19.5, 6); g.lineTo(-19.5, 6); g.closePath(); g.fill();
      g.fillStyle = '#5a3a20'; g.fillRect(-22, -3, 44, 2);
    }
    // Duman: yükselip dağılan üç bulut (baca, buharlı tren, kazan)
    function smoke(x, y, t, k = 1) {
      for (let i = 0; i < 3; i++) { const ph = (t / 1200 + i / 3) % 1; g.fillStyle = `rgba(220,220,232,${0.55 * (1 - ph)})`; g.beginPath(); g.arc(x + ph * 7 * k, y - ph * 21 * k, (3.5 + ph * 5.5) * k, 0, TAU); g.fill(); }
    }
    // Rayda gidip gelen yüklü vagon (maden, kömür)
    function railCart(on, t, load) {
      g.strokeStyle = '#9aa0b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.stroke();
      g.save(); g.translate(on ? Math.sin(t / 1200) * 6 : 0, -18); g.scale(0.7, 0.7); cart(on ? t / 300 : 0);
      g.fillStyle = load; g.beginPath(); g.arc(-8, -11, 4, 0, TAU); g.arc(2, -13, 5, 0, TAU); g.arc(10, -10, 4, 0, TAU); g.fill(); g.restore();
    }
    // Basınç göstergesi: yarım kadran, titreyen ibre
    function gauge(x, y, r, t) {
      g.fillStyle = '#2a2a34'; g.beginPath(); g.arc(x, y, r + 2, 0, TAU); g.fill(); g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = '#c0392b'; g.lineWidth = r / 5; g.beginPath(); g.arc(x, y, r * 0.75, -0.3, 0.3); g.stroke();
      const a = -0.5 + Math.sin(t / 400) * 0.25; g.strokeStyle = INK; g.lineWidth = r / 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); g.stroke();
    }
    // Kafes kule: iki dikme ve çapraz bağlar
    function lattice(x, y, w, h, col) {
      g.strokeStyle = col; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y - h);
      for (let k = 0; k < h; k += w) { g.moveTo(x - w / 2, y - k); g.lineTo(x + w / 2, y - k - w); g.moveTo(x + w / 2, y - k); g.lineTo(x - w / 2, y - k - w); }
      g.stroke();
    }
    // Kafes kulede inip çıkan kabin (zürafa asansörü, serbest düşüş)
    function liftTower(on, t, col, fall) {
      lattice(0, 0, 14, 50, '#9aa0b0');
      const ph = on ? (t / (fall ? 1400 : 2200)) % 1 : 0.5;
      // serbest düşüş tepede bekler, sonra hızla iner; asansör yavaşça iner kalkar
      const y = fall ? -46 + Math.max(0, ph - 0.7) / 0.3 * 34 : -40 + Math.abs(ph * 2 - 1) * 32;
      g.fillStyle = col; rr(-10, y, 20, 12, 3); g.fill(); g.fillStyle = 'rgba(255,240,200,.75)'; g.fillRect(-6, y + 3, 12, 5);
    }
    // Lunapark tezgâhı: tenteli tezgâh (dekordaki stall) ve tezgâhın üstündeki ürün
    function standStall(c, item, t) { DECOR_ART.stall({ x: 0, y: -14, c }, t); g.save(); g.translate(0, -40); item(); g.restore(); }
    // Uçan kâğıt fener (yolculukta Halka'yı taşır, Uçan Fener Tepesi'nde yükselir)
    function skyLantern(ly, c1, c2, t) {
      add(() => glow(0, ly, 46, c1 === '#9ff0ff' ? 'rgba(140,240,255,.55)' : 'rgba(255,200,110,.6)'));
      g.fillStyle = INK; g.beginPath(); g.moveTo(-15, ly - 18); g.lineTo(15, ly - 18); g.lineTo(11, ly + 15); g.lineTo(-11, ly + 15); g.closePath(); g.fill();
      const lg = g.createLinearGradient(0, ly - 17, 0, ly + 14); lg.addColorStop(0, c1); lg.addColorStop(1, c2);
      g.fillStyle = lg; g.beginPath(); g.moveTo(-13.5, ly - 16.5); g.lineTo(13.5, ly - 16.5); g.lineTo(9.8, ly + 13.5); g.lineTo(-9.8, ly + 13.5); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-4, ly - 15, 2, 27); g.fillRect(4, ly - 15, 2, 27);
      g.fillStyle = '#fff5c0'; g.beginPath(); g.ellipse(0, ly + 9, 3, 4 + Math.sin(t * 20), 0, 0, TAU); g.fill();
    }
    // Teleskop: üç ayak üstünde, a açısıyla göğe bakan tüp
    function telescope(x, y, k, a) {
      g.save(); g.translate(x, y); g.scale(k, k);
      g.strokeStyle = '#6a5a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -14); g.lineTo(-9, 0); g.moveTo(0, -14); g.lineTo(9, 0); g.moveTo(0, -14); g.lineTo(0, 0); g.stroke();
      g.translate(0, -16); g.rotate(a); g.fillStyle = '#c99a3a'; g.fillRect(-14, -3.5, 28, 7); g.fillStyle = '#e0b24a'; g.fillRect(10, -4.5, 6, 9); g.fillStyle = '#2a2a34'; g.fillRect(-17, -2.5, 4, 5);
      g.restore();
    }
    // Gözlemevi: silindir gövde, yarığı açık kubbe, yarıktan çıkan teleskop
    function observatory(x, y, k, now) {
      g.save(); g.translate(x, y); g.scale(k, k);
      g.fillStyle = '#d8d0c0'; g.fillRect(-20, -20, 40, 20); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(6, -20, 14, 20);
      g.fillStyle = '#9aa6b8'; g.beginPath(); g.arc(0, -20, 20, Math.PI, 0); g.fill(); g.fillStyle = '#1a1e2e'; g.fillRect(-3, -40, 7, 20);
      g.save(); g.translate(0, -22); g.rotate(-1 + (reduced() ? 0 : Math.sin(now / 3000) * 0.15)); g.fillStyle = '#c99a3a'; g.fillRect(0, -2.5, 22, 5); g.restore();
      g.fillStyle = '#ffd98a'; g.fillRect(-12, -14, 6, 7); add(() => glow(-9, -10, 12, 'rgba(255,210,130,.5)'));
      g.restore();
    }
    // Takımyıldız: yıldızlar ve aralarındaki ince çizgiler
    function constellation(pts, t) {
      g.strokeStyle = 'rgba(180,200,255,.55)'; g.lineWidth = 0.9; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      add(() => pts.forEach(([x, y], i) => { const tw = 0.6 + 0.4 * Math.sin(t / 400 + i); g.fillStyle = `rgba(255,250,220,${tw})`; star(x, y, 2.6); }));
    }
    function barn(x, y, k, lit) {
      g.save(); g.translate(x, y); g.scale(k, k);
      g.fillStyle = '#a8322a'; g.beginPath(); g.moveTo(-22, 0); g.lineTo(-22, -24); g.lineTo(-14, -36); g.lineTo(14, -36); g.lineTo(22, -24); g.lineTo(22, 0); g.closePath(); g.fill();
      g.fillStyle = '#5a2a20'; g.beginPath(); g.moveTo(-24, -24); g.lineTo(-15, -38); g.lineTo(15, -38); g.lineTo(24, -24); g.lineTo(21, -24); g.lineTo(13, -35); g.lineTo(-13, -35); g.lineTo(-21, -24); g.closePath(); g.fill();
      g.strokeStyle = '#f2ece0'; g.lineWidth = 1.6; g.strokeRect(-9, -18, 18, 18); g.beginPath(); g.moveTo(-9, -18); g.lineTo(9, 0); g.moveTo(9, -18); g.lineTo(-9, 0); g.stroke();
      g.fillStyle = lit ? '#ffd98a' : '#3a1a14'; g.fillRect(-4, -31, 8, 6);
      g.restore();
    }
    function windmill(x, y, k, now) {
      g.save(); g.translate(x, y); g.scale(k, k);
      g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-7, -34); g.lineTo(7, -34); g.lineTo(10, 0); g.closePath(); g.fill();
      g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(-9, -34); g.lineTo(0, -44); g.lineTo(9, -34); g.closePath(); g.fill(); g.fillStyle = '#5a3a24'; g.fillRect(-3, -10, 6, 10);
      g.save(); g.translate(0, -36); g.rotate(reduced() ? 0.4 : now / 900);
      for (let i = 0; i < 4; i++) { g.rotate(TAU / 4); g.fillStyle = '#6b4a2a'; g.fillRect(-1, 0, 2, 26); g.fillStyle = 'rgba(240,232,215,.9)'; g.fillRect(1, 8, 6, 18); }
      g.restore(); g.restore();
    }
    function waterWheel(x, y, r, now) {
      g.save(); g.translate(x, y); g.rotate(reduced() ? 0 : now / 1400);
      g.strokeStyle = '#6b4a2a'; g.lineWidth = r / 8; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r); g.stroke(); g.fillStyle = '#8a643a'; g.fillRect(-r / 6, r - 1, r / 3, r / 4); }
      g.restore();
    }
    // Kazan: kaynayan sıvı ve yükselen kabarcıklar (tutkal, iksir)
    function cauldron(liquid, bubble, on, t) {
      g.fillStyle = '#4a4a54'; g.beginPath(); g.moveTo(-14, -24); g.lineTo(14, -24); g.lineTo(11, 0); g.lineTo(-11, 0); g.closePath(); g.fill();
      g.fillStyle = liquid; g.beginPath(); g.ellipse(0, -24, 14, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#7a4e28'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(4, -24); g.lineTo(12, -40); g.stroke();
      if (on) for (let i = 0; i < 2; i++) { const ph = (t / 900 + i * 0.5) % 1; g.fillStyle = bubble.replace('A', 1 - ph); g.beginPath(); g.arc(-4 + i * 6, -26 - ph * 14, 2.4, 0, TAU); g.fill(); }
    }
    // Portal: dönen ışık halkası ve ortasında girdap
    function portalRing(x, y, r, c, now) {
      const a = reduced() ? 0 : now / 600;
      add(() => { glow(x, y, r * 1.6, c + '55'); g.save(); g.translate(x, y); g.rotate(a); for (let i = 0; i < 3; i++) { g.strokeStyle = c; g.globalAlpha = 0.9 - i * 0.25; g.lineWidth = r / 6; g.beginPath(); g.ellipse(0, 0, r - i * r / 5, r * 1.25 - i * r / 4, 0, i, i + 4.6); g.stroke(); } g.restore(); });
      g.fillStyle = 'rgba(20,6,40,.7)'; g.beginPath(); g.ellipse(x, y, r * 0.55, r * 0.75, 0, 0, TAU); g.fill();
    }
    function lighthouse(x, y, k, now) {
      g.save(); g.translate(x, y); g.scale(k, k);
      for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#c0392b' : '#f2ece0'; g.beginPath(); g.moveTo(-10 + i * 0.8, -i * 10); g.lineTo(10 - i * 0.8, -i * 10); g.lineTo(10 - (i + 1) * 0.8, -(i + 1) * 10); g.lineTo(-10 + (i + 1) * 0.8, -(i + 1) * 10); g.closePath(); g.fill(); }
      g.fillStyle = '#2a2a34'; g.fillRect(-8, -54, 16, 4); g.fillStyle = '#ffe9a0'; g.fillRect(-5, -62, 10, 8); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(-7, -62); g.lineTo(0, -70); g.lineTo(7, -62); g.closePath(); g.fill();
      const a = reduced() ? 0.4 : now / 900;
      add(() => { glow(0, -58, 18, 'rgba(255,240,180,.9)'); g.globalAlpha = 0.28; const d = Math.cos(a) * 90; g.fillStyle = '#fff2c0'; g.beginPath(); g.moveTo(0, -58); g.lineTo(d, -78); g.lineTo(d, -40); g.closePath(); g.fill(); g.globalAlpha = 1; });
      g.restore();
    }
    // Gezegen: gölgeli küre, isteğe bağlı halka (ring) ve bulut bantları
    function planet(x, y, r, c1, c2, ring) {
      if (ring) { g.strokeStyle = ring; g.lineWidth = r / 5; g.beginPath(); g.ellipse(x, y, r * 1.7, r * 0.45, -0.3, Math.PI, TAU); g.stroke(); }
      const gr = g.createRadialGradient(x - r / 3, y - r / 3, r / 6, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (ring) { g.strokeStyle = ring; g.lineWidth = r / 5; g.beginPath(); g.ellipse(x, y, r * 1.7, r * 0.45, -0.3, 0, Math.PI); g.stroke(); }
    }
    // Saat kadranı: akrep ve yelkovan gerçek zamanla döner
    function clock(x, y, r, now) {
      g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#c99a3a'; g.lineWidth = r / 9; g.stroke();
      const m = reduced() ? 1 : now / 1000; g.strokeStyle = INK; g.lineWidth = r / 12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(m - Math.PI / 2) * r * 0.78, y + Math.sin(m - Math.PI / 2) * r * 0.78); g.moveTo(x, y); g.lineTo(x + Math.cos(m / 12 - Math.PI / 2) * r * 0.5, y + Math.sin(m / 12 - Math.PI / 2) * r * 0.5); g.stroke();
      add(() => glow(x, y, r * 1.7, 'rgba(255,230,170,.3)'));
    }
    // Dükkân cephesi: renkli tente, ışıklı vitrin; icon vitrinin içini çizer
    function shop(c, on, icon) {
      g.fillStyle = '#5a4a5e'; g.fillRect(-20, -36, 40, 36); g.fillStyle = '#463a4a'; g.fillRect(-22, -40, 44, 5);
      for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? c : '#fff5ea'; g.beginPath(); g.moveTo(-22 + i * 8.8, -34); g.lineTo(-13.2 + i * 8.8, -34); g.lineTo(-13.2 + i * 8.8, -27); g.quadraticCurveTo(-17.6 + i * 8.8, -23, -22 + i * 8.8, -27); g.fill(); }
      g.fillStyle = on ? '#ffd98a' : '#4a4050'; g.fillRect(-16, -22, 22, 14); g.fillStyle = '#2a2230'; g.fillRect(10, -20, 7, 20);
      if (on) light(-5, -15, 18, 'rgba(255,210,130,.5)');
      g.save(); g.translate(-5, -15); icon(); g.restore();
    }
    function sparkle(x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.25, y - s * 0.25); g.lineTo(x + s, y); g.lineTo(x + s * 0.25, y + s * 0.25); g.lineTo(x, y + s); g.lineTo(x - s * 0.25, y + s * 0.25); g.lineTo(x - s, y); g.lineTo(x - s * 0.25, y - s * 0.25); g.closePath(); g.fill(); }
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    const light = (x, y, r, col) => add(() => glow(x, y, r, col));
    const isIce = w => w.id === 'buzul';

    // ---- zemin ----
    function ground(r, top, bot, now) {
      const id = r.world.id, th = r.world.theme;
      if (id === 'fisek') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#2b1036'); gr.addColorStop(0.5, '#3a1430'); gr.addColorStop(1, '#241024');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        g.strokeStyle = 'rgba(255,200,230,.045)'; g.lineWidth = 1;
        for (let y = Math.floor(top / 26) * 26; y < bot; y += 26) {
          const off = (y / 26) % 2 ? 0 : 20;
          g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
          for (let x = off; x < W; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(bot, y + 26)); g.stroke(); }
        }
        for (let y = Math.floor(top / 420) * 420 + 200; y < bot + 200; y += 420) glow((y / 420) % 2 ? 80 : 320, y, 230, 'rgba(255,120,80,.10)');
        const R = rng(Math.floor(top / 300));
        for (let y0 = Math.floor(top / 300) * 300; y0 < bot; y0 += 300) {
          const R2 = rng(y0 * 7 + 5);
          for (let i = 0; i < 18; i++) { const x = R2() * W, y = y0 + R2() * 300; if (y < top || y > bot || nearPathFast(x, y, 30)) continue; g.strokeStyle = 'rgba(140,220,150,.18)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x, y); g.lineTo(x + 2, y - 7); g.stroke(); }
        }
        return R;
      }
      if (id === 'atolye') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#2a1a12'); gr.addColorStop(1, '#1e130d');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
        for (let x = 0; x <= W; x += 44) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); }
        for (let y = Math.floor(top / 180) * 180; y < bot; y += 180) for (let x = 0; x < W; x += 44) { const o = ((x / 44) * 67) % 180; g.beginPath(); g.moveTo(x, y + o); g.lineTo(x + 44, y + o); g.stroke(); }
        g.strokeStyle = 'rgba(255,220,180,.04)'; for (let x = 6; x < W; x += 44) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); }
        for (let y0 = Math.floor(top / 300) * 300; y0 < bot; y0 += 300) { const R = rng(y0 * 3 + 1); for (let i = 0; i < 14; i++) { const x = R() * W, y = y0 + R() * 300; g.fillStyle = 'rgba(230,190,130,.25)'; g.beginPath(); g.ellipse(x, y, 2.4, 1, R() * 3, 0, TAU); g.fill(); } }
        for (let y = Math.floor(top / 380) * 380 + 120; y < bot + 260; y += 380) glow((y / 380) % 2 ? 80 : 320, y, 200, 'rgba(255,170,90,.14)');
        return null;
      }
      if (id === 'saat') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#16192e'); gr.addColorStop(1, '#121426');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        for (let y = Math.floor(top / 340) * 340 + 170; y < bot + 260; y += 340) {
          const left = (y / 340) % 2, rot = reduced() ? 0 : now / (left ? 9000 : -11000);
          g.globalAlpha = 0.16; gear(left ? 40 : 360, y, 120, 18, rot, '#d9b45a'); gear(left ? 160 : 240, y + 120, 60, 10, -rot * 2, '#9aa0b0'); g.globalAlpha = 1;
        }
        g.strokeStyle = 'rgba(217,180,90,.07)'; g.lineWidth = 1;
        for (let y = Math.floor(top / 40) * 40; y < bot; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        return null;
      }
      const FLOOR = { // [üst, alt, blok eni, boyu, çizgi, kalınlık, şaşırtmalı, ışık]
        zindan: ['#1a1820', '#131118', 48, 26, 'rgba(0,0,0,.45)', 2, 1, 'rgba(255,140,60,.13)'],
        sehir: ['#1c1a2e', '#15142a', 18, 12, 'rgba(255,255,255,.05)', 1, 1, 'rgba(255,220,150,.12)'],
        fabrika: ['#1c2026', '#14171c', 40, 40, 'rgba(255,255,255,.06)', 1.4, 0, 'rgba(255,140,60,.12)'],
        usta: ['#24212e', '#1a1822', 36, 36, 'rgba(217,180,90,.14)', 1.2, 0, 'rgba(255,210,120,.13)'],
        lunapark: ['#251a32', '#1b1428', 30, 30, 'rgba(255,143,171,.08)', 1, 1, 'rgba(255,120,200,.13)'],
        santral: ['#1d2127', '#15181d', 60, 60, 'rgba(255,220,80,.06)', 1.2, 0, 'rgba(120,200,255,.14)'],
      }[id];
      if (FLOOR) {
        // blok döşeme: zindanda kaba taş, şehirde parke, fabrikada çelik levha (sarı uyarı şeritli)
        const [c0, c1, bw, bh, line, lw, stag, lamp] = FLOOR, gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        g.strokeStyle = line; g.lineWidth = lw;
        for (let y = Math.floor(top / bh) * bh; y < bot; y += bh) {
          g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
          for (let x = stag * ((y / bh) % 2) * bw / 2; x < W; x += bw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke(); }
        }
        if (id === 'fabrika') for (let y = Math.floor(top / 480) * 480 + 300; y < bot; y += 480) for (let x = 0; x < W; x += 24) { g.fillStyle = (x / 24) % 2 ? '#e0b02a' : '#1c2026'; g.fillRect(x, y, 24, 8); }
        for (let y = Math.floor(top / 360) * 360 + 140; y < bot + 260; y += 360) glow((y / 360) % 2 ? 70 : 330, y, 190, lamp);
        return null;
      }
      if (id === 'buyu') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#1a0e2e'); gr.addColorStop(1, '#130a22');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        for (let y = Math.floor(top / 300) * 300 + 150; y < bot + 240; y += 300) glow(((y / 300) % 3) * 140 + 60, y + (reduced() ? 0 : Math.sin(now / 2000 + y) * 20), 200, 'rgba(170,90,255,.13)');
        add(() => {
          for (let y0 = Math.floor(top / 220) * 220; y0 < bot; y0 += 220) {
            const R = rng(y0 * 23 + 9);
            for (let i = 0; i < 6; i++) { const x = R() * W, y = y0 + R() * 220 - (reduced() ? 0 : (now / 40 + i * 30) % 60), a = 0.4 + 0.5 * Math.abs(Math.sin(now / 700 + i)); g.fillStyle = `rgba(220,180,255,${a})`; star(x, y, 2); }
          }
        });
        return null;
      }
      if (id === 'fener') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#0d2236'); gr.addColorStop(1, '#0a1a2a');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        g.strokeStyle = 'rgba(160,210,255,.09)'; g.lineWidth = 1.4;
        for (let y = Math.floor(top / 34) * 34; y < bot; y += 34) { g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / 30 + y + (reduced() ? 0 : now / 900)) * 3); g.stroke(); }
        for (let y = Math.floor(top / 420) * 420 + 200; y < bot + 260; y += 420) glow((y / 420) % 2 ? 80 : 320, y, 220, 'rgba(255,240,180,.08)');
        return null;
      }
      if (id === 'uzay' || id === 'rasathane') {
        const ras = id === 'rasathane';
        g.fillStyle = ras ? '#0c1024' : '#070912'; g.fillRect(0, top, W, bot - top);
        for (let y = Math.floor(top / 500) * 500 + 250; y < bot + 300; y += 500) glow((y / 500) % 2 ? 90 : 310, y, 240, ras ? 'rgba(220,230,255,.09)' : (y / 500) % 2 ? 'rgba(140,80,220,.16)' : 'rgba(60,140,230,.14)');
        add(() => {
          for (let y0 = Math.floor(top / 200) * 200; y0 < bot; y0 += 200) {
            const R = rng(y0 * 17 + 5);
            for (let i = 0; i < 18; i++) { const x = R() * W, y = y0 + R() * 200, tw = reduced() ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(now / 900 + i + y0)); g.fillStyle = `rgba(255,255,255,${tw})`; g.beginPath(); g.arc(x, y, R() < 0.15 ? 1.6 : 0.8, 0, TAU); g.fill(); }
          }
        });
        return null;
      }
      if (id === 'vadi' || id === 'degirmen') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#132a2a'); gr.addColorStop(0.5, '#14302a'); gr.addColorStop(1, '#0f231f');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        for (let y = Math.floor(top / 420) * 420 + 160; y < bot + 220; y += 420) glow((y / 420) % 2 ? 90 : 310, y, 220, 'rgba(90,200,140,.08)');
        for (let y0 = Math.floor(top / 300) * 300; y0 < bot; y0 += 300) {
          const R = rng(y0 * 11 + 3);
          for (let i = 0; i < 26; i++) {
            const x = R() * W, y = y0 + R() * 300, kind = R();
            if (y < top - 10 || y > bot + 10 || nearPathFast(x, y, 30)) continue;
            if (kind < 0.7) { g.strokeStyle = 'rgba(110,200,130,.28)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 7); g.moveTo(x, y); g.lineTo(x + 2, y - 8); g.moveTo(x, y); g.lineTo(x, y - 9); g.stroke(); }
            else { g.fillStyle = ['rgba(255,255,255,.55)', 'rgba(255,201,74,.55)', 'rgba(255,143,171,.55)'][Math.floor(R() * 3)]; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); }
          }
        }
        if (id === 'degirmen') for (let y = Math.floor(top / 500) * 500 + 330; y < bot; y += 500) { g.strokeStyle = 'rgba(210,180,90,.13)'; g.lineWidth = 5; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, y + k * 12); g.lineTo(W, y + k * 12 - 30); g.stroke(); } }
        add(() => {
          for (let y0 = Math.floor(top / 260) * 260; y0 < bot; y0 += 260) {
            const R = rng(y0 * 5 + 7);
            for (let i = 0; i < 5; i++) {
              const bx = R() * W, by = y0 + R() * 260, ph = R() * TAU;
              const x = bx + (reduced() ? 0 : Math.sin(now / 1400 + ph) * 14), y = by + (reduced() ? 0 : Math.cos(now / 1100 + ph) * 10);
              const a = reduced() ? 0.6 : 0.35 + 0.65 * Math.max(0, Math.sin(now / 600 + ph * 3));
              glow(x, y, 9, `rgba(210,255,140,${0.7 * a})`); g.fillStyle = `rgba(250,255,200,${a})`; g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill();
            }
          }
        });
        return null;
      }
      if (id === 'buzul') {
        const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
        gr.addColorStop(0, '#cfe9f7'); gr.addColorStop(1, '#a9d3ea');
        g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
        for (let y0 = Math.floor(top / 400) * 400; y0 < bot + 80; y0 += 400) {
          const R = rng(y0 * 3 + 9);
          for (let i = 0; i < 5; i++) { const x = R() * W, y = y0 + R() * 400; g.fillStyle = 'rgba(120,170,210,.12)'; g.beginPath(); g.ellipse(x, y, 60 + R() * 60, 14 + R() * 10, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - 8, y - 5, 50, 8, 0, 0, TAU); g.fill(); }
        }
        add(() => {
          for (let y0 = Math.floor(top / 520) * 520 + 200; y0 < bot + 300; y0 += 520) {
            const b = (y0 / 520) % 2; g.globalAlpha = 0.18;
            const a = g.createLinearGradient(0, y0 - 120, 0, y0 + 120); a.addColorStop(0, 'rgba(0,0,0,0)'); a.addColorStop(0.5, b ? '#b388ff' : '#59ffc8'); a.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = a; g.beginPath(); g.moveTo(0, y0 + 120); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x / 70 + now / 1800 + b) * 40); g.lineTo(W, y0 + 120); g.closePath(); g.fill();
          }
          g.globalAlpha = 1;
          for (let y0 = Math.floor(top / 300) * 300; y0 < bot; y0 += 300) {
            const R = rng(y0 * 13 + 1);
            for (let i = 0; i < 6; i++) { const x = R() * W, y = y0 + R() * 300, tw = reduced() ? 0.7 : Math.max(0, Math.sin(now / 500 + i * 1.7 + y0)); if (tw < 0.6) continue; g.fillStyle = `rgba(255,255,255,${tw})`; sparkle(x, y, 3 + tw * 3); }
          }
        });
        return null;
      }
      // Henüz kendi sahnesi çizilmemiş dünyalar: temanın renkleri, köşelerden vuran ışıklar ve ince bir doku
      const gr = g.createLinearGradient(0, r.top, 0, r.bottom);
      gr.addColorStop(0, th.top); gr.addColorStop(1, th.bottom);
      g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
      const glows = th.glows || [];
      for (let y = Math.floor(top / 360) * 360 + 180, i = 0; y < bot + 260; y += 360, i++) {
        const [col, a] = glows[Math.abs(Math.floor(y / 360)) % Math.max(1, glows.length)] || [th.accent, 0.12];
        g.globalAlpha = Math.min(0.5, a * 1.6); glow((Math.floor(y / 360) % 2) ? 70 : 330, y, 240, col); g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(255,255,255,.035)';
      for (let y = Math.floor(top / 28) * 28; y < bot; y += 28) for (let x = ((y / 28) % 2) * 14; x < W; x += 28) { g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill(); }
      return null;
    }
    const nearPathFast = (x, y, m) => { for (const s of stonesNear(y)) if (Math.abs(s.y - y) < m && Math.hypot(s.x - x, s.y - y) < m) return true; return false; };

    // ---- dekor ----
    const asDecor = (kind, k = 1) => (d, now) => { g.save(); g.translate(d.x, d.y); g.scale(k * d.s, k * d.s); STATION_ART[kind](true, reduced() ? 0 : now, 'done', d); g.restore(); };
    const DECOR_ART = {
      tent(d, now) {
        const { x, y, c } = d;
        shadow(x + 6, y + 30, 40, 9);
        g.save(); g.translate(x, y);
        for (let i = -3; i < 3; i++) { g.fillStyle = i % 2 ? c : '#fff5ea'; g.beginPath(); g.moveTo(0, -34); g.lineTo(i * 11, 28); g.lineTo((i + 1) * 11, 28); g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.moveTo(0, -34); g.lineTo(0, 28); g.lineTo(33, 28); g.closePath(); g.fill();
        g.fillStyle = '#3a1430'; g.beginPath(); g.moveTo(-9, 28); g.quadraticCurveTo(0, 6, 9, 28); g.fill();
        add(() => glow(0, 22, 18, 'rgba(255,200,120,.55)'));
        g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -34); g.lineTo(0, -48); g.stroke();
        const wave = reduced() ? 0 : Math.sin(now / 240 + d.ph) * 3;
        g.fillStyle = c; g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(8, -46 + wave, 15, -44 + wave); g.lineTo(0, -40); g.fill();
        g.restore();
      },
      lamp(d, now) {
        const { x, y } = d, fl = reduced() ? 1 : 0.85 + 0.15 * Math.sin(now / 90 + d.ph) * Math.sin(now / 137);
        add(() => glow(x, y + 14, 70 * fl, 'rgba(255,190,110,.32)'));
        shadow(x + 3, y + 18, 9, 3);
        g.fillStyle = '#1e1028'; g.fillRect(x - 2, y - 30, 4, 48); g.fillStyle = '#2a1636'; g.fillRect(x - 7, y + 14, 14, 4);
        g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(x, y - 34, 6, 0, TAU); g.fill();
        add(() => glow(x, y - 34, 22 * fl, 'rgba(255,220,150,.9)'));
      },
      stall(d) {
        const { x, y, c } = d;
        shadow(x + 5, y + 22, 36, 7);
        g.fillStyle = '#5a2a3a'; g.fillRect(x - 28, y - 6, 56, 26); g.fillStyle = '#3a1a28'; g.fillRect(x - 28, y + 12, 56, 8);
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? c : '#fff5ea'; g.beginPath(); g.moveTo(x - 32 + i * 9.3, y - 20); g.lineTo(x - 32 + (i + 1) * 9.3, y - 20); g.lineTo(x - 32 + (i + 1) * 9.3, y - 8); g.quadraticCurveTo(x - 32 + (i + 0.5) * 9.3, y - 3, x - 32 + i * 9.3, y - 8); g.fill(); }
        add(() => glow(x, y + 4, 30, 'rgba(255,200,120,.45)'));
        g.fillStyle = '#ffd36b'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x - 14 + i * 14, y + 4, 4, 0, TAU); g.fill(); }
      },
      balloons(d, now) {
        const { x, y } = d, cols = ['#ff6b6b', '#ffc94a', '#4cc9f0', '#b388ff'];
        shadow(x, y + 24, 10, 3);
        for (let i = 0; i < 4; i++) {
          const bx = x - 15 + i * 10 + (reduced() ? 0 : Math.sin(now / 700 + i + d.ph) * 3), by = y - 34 - (i % 2) * 12;
          g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 20); g.quadraticCurveTo(bx, by + 24, bx, by + 12); g.stroke();
          g.fillStyle = cols[i]; g.beginPath(); g.ellipse(bx, by, 9, 11, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(bx - 3, by - 4, 2.5, 3.5, -0.4, 0, TAU); g.fill();
        }
      },
      carousel(d, now) {
        const { x, y } = d, rot = reduced() ? 0 : now / 1400;
        shadow(x + 6, y + 30, 46, 10);
        g.fillStyle = '#3a1a3a'; g.beginPath(); g.ellipse(x, y + 22, 40, 10, 0, 0, TAU); g.fill();
        for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6, hx = x + Math.cos(a) * 30, hy = y + 10 + Math.sin(a) * 7; g.strokeStyle = '#ffd36b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, y - 18); g.lineTo(hx, hy); g.stroke(); g.fillStyle = ['#ff6b6b', '#4cc9f0', '#ffc94a'][i % 3]; g.beginPath(); g.ellipse(hx, hy, 6, 4, 0, 0, TAU); g.fill(); }
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ff6fb5' : '#fff5ea'; g.beginPath(); g.moveTo(x, y - 42); g.arc(x, y - 18, 40, Math.PI + i * Math.PI / 8, Math.PI + (i + 1) * Math.PI / 8); g.closePath(); g.fill(); }
        add(() => { for (let i = 0; i < 9; i++) { const a = Math.PI + i * Math.PI / 8; glow(x + Math.cos(a) * 40, y - 18 + Math.sin(a) * 40, 6, `rgba(255,230,160,${0.6 + 0.4 * Math.sin(now / 200 + i)})`); } });
        g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(x, y - 44, 4, 0, TAU); g.fill();
      },
      pine(d) {
        const { x, y, s } = d;
        shadow(x + 10 * s, y + 18 * s, 22 * s, 7 * s, 0.25);
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = '#4a3328'; g.fillRect(-3, 6, 6, 12);
        for (let i = 0; i < 3; i++) {
          const yy = 8 - i * 14, w = 22 - i * 5;
          g.fillStyle = '#1f5a5a'; g.beginPath(); g.moveTo(-w, yy); g.lineTo(0, yy - 20); g.lineTo(w, yy); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-w * 0.75, yy - 4); g.lineTo(0, yy - 20); g.lineTo(w * 0.55, yy - 6); g.quadraticCurveTo(0, yy - 9, -w * 0.75, yy - 4); g.fill();
        }
        g.restore();
      },
      ice(d) {
        const { x, y, s } = d;
        shadow(x + 6, y + 14 * s, 20 * s, 6 * s, 0.2);
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = 'rgba(150,220,250,.9)'; g.beginPath(); g.moveTo(-16, 12); g.lineTo(-12, -14); g.lineTo(4, -20); g.lineTo(16, -6); g.lineTo(14, 12); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(-12, -14); g.lineTo(4, -20); g.lineTo(0, -4); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(70,150,200,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -4); g.lineTo(14, 12); g.moveTo(0, -4); g.lineTo(-16, 12); g.stroke();
        g.restore();
      },
      lake(d, now) {
        const { x, y, s } = d;
        g.fillStyle = 'rgba(90,170,215,.55)'; g.beginPath(); g.ellipse(x, y, 46 * s, 18 * s, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
        const sh = ((now / 3000) % 1) * 2 - 0.5;
        g.save(); g.beginPath(); g.ellipse(x, y, 46 * s, 18 * s, 0, 0, TAU); g.clip();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + (sh - 0.4) * 90 * s, y - 20); g.lineTo(x + (sh - 0.1) * 90 * s, y + 20); g.stroke(); g.restore();
      },
      // Başlangıç Vadisi: yuvarlak ağaç, çalı, çiçek kümesi, mantar, yosunlu kaya
      tree(d) {
        const { x, y, s } = d;
        shadow(x + 10 * s, y + 18 * s, 26 * s, 7 * s, 0.35);
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = '#4a3020'; g.fillRect(-3, -4, 6, 22);
        g.fillStyle = '#1f4a34'; for (const [cx, cy, cr] of [[-10, -12, 13], [10, -12, 13], [0, -24, 15]]) { g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(120,210,150,.18)'; g.beginPath(); g.arc(-4, -28, 8, 0, TAU); g.fill();
        g.restore();
      },
      bush(d) {
        const { x, y, s } = d;
        shadow(x + 4, y + 8 * s, 18 * s, 4 * s, 0.3);
        g.fillStyle = '#21543a'; for (const [cx, cr] of [[-8, 8], [0, 10], [9, 7]]) { g.beginPath(); g.arc(x + cx * s, y - 2 * s, cr * s, Math.PI, 0); g.fill(); }
        g.fillStyle = d.c; g.beginPath(); g.arc(x - 3 * s, y - 8 * s, 1.8, 0, TAU); g.arc(x + 6 * s, y - 5 * s, 1.8, 0, TAU); g.fill();
      },
      flowers(d, now) {
        const { x, y } = d;
        for (let i = 0; i < 6; i++) {
          const fx = x - 14 + i * 5.5, h = 8 + ((i * 7) % 5) * 2, sw = reduced() ? 0 : Math.sin(now / 900 + i + d.ph) * 1.5;
          g.strokeStyle = '#3fa86a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(fx, y); g.lineTo(fx + sw, y - h); g.stroke();
          g.fillStyle = [d.c, '#ffffff', '#ffc94a'][i % 3]; g.beginPath(); g.arc(fx + sw, y - h, 2.4, 0, TAU); g.fill();
        }
      },
      mushroom(d) {
        const { x, y, s } = d;
        g.fillStyle = '#efe2cc'; g.fillRect(x - 2 * s, y - 9 * s, 4 * s, 9 * s);
        g.fillStyle = '#c0392b'; g.beginPath(); g.ellipse(x, y - 9 * s, 7 * s, 4.5 * s, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 2 * s, y - 11 * s, 1, 0, TAU); g.arc(x + 3 * s, y - 10 * s, 1, 0, TAU); g.fill();
      },
      mossRock(d) {
        const { x, y, s } = d;
        shadow(x + 5, y + 6 * s, 18 * s, 5 * s, 0.3);
        g.fillStyle = '#4e5660'; g.beginPath(); g.moveTo(x - 16 * s, y + 4 * s); g.lineTo(x - 10 * s, y - 10 * s); g.lineTo(x + 4 * s, y - 14 * s); g.lineTo(x + 15 * s, y + 4 * s); g.closePath(); g.fill();
        g.fillStyle = '#3f8a52'; g.beginPath(); g.moveTo(x - 12 * s, y - 6 * s); g.quadraticCurveTo(x - 2 * s, y - 18 * s, x + 8 * s, y - 8 * s); g.quadraticCurveTo(x - 2 * s, y - 10 * s, x - 12 * s, y - 6 * s); g.fill();
      },
      // Atölye ve Saat Kulesi
      crate(d) {
        const { x, y, s } = d;
        shadow(x + 6, y + 14 * s, 20 * s, 5 * s, 0.4);
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = '#8a5a34'; g.fillRect(-14, -14, 28, 26); g.strokeStyle = '#5a3a20'; g.lineWidth = 2; g.strokeRect(-14, -14, 28, 26); g.beginPath(); g.moveTo(-14, -14); g.lineTo(14, 12); g.stroke();
        g.restore();
      },
      toolbox(d) {
        const { x, y } = d;
        shadow(x + 4, y + 8, 16, 4, 0.4);
        g.fillStyle = '#c0392b'; g.fillRect(x - 14, y - 8, 28, 14); g.fillStyle = '#a0301f'; g.fillRect(x - 14, y - 8, 28, 4);
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 8); g.lineTo(x - 6, y - 13); g.lineTo(x + 6, y - 13); g.lineTo(x + 6, y - 8); g.stroke();
      },
      sawhorse(d) {
        const { x, y } = d;
        g.strokeStyle = '#7a4e28'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 16, y + 8); g.lineTo(x - 10, y - 8); g.lineTo(x - 4, y + 8); g.moveTo(x + 4, y + 8); g.lineTo(x + 10, y - 8); g.lineTo(x + 16, y + 8); g.stroke();
        g.fillStyle = '#a0784a'; g.fillRect(x - 20, y - 11, 40, 4);
      },
      planks(d) {
        const { x, y } = d;
        for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#a0784a' : '#8a643a'; g.fillRect(x - 22 + i * 2, y - i * 4, 40, 4); }
      },
      hangLamp(d, now) {
        const { x, y } = d, sw = reduced() ? 0 : Math.sin(now / 900 + d.ph) * 3, acc = d.world.id === 'saat' ? 'rgba(255,220,150,' : 'rgba(255,180,100,';
        add(() => glow(x + sw, y + 30, 70, acc + '.18)'));
        g.strokeStyle = 'rgba(20,14,10,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + sw, y - 6); g.stroke();
        g.fillStyle = '#3a3a44'; g.beginPath(); g.moveTo(x + sw - 9, y + 2); g.lineTo(x + sw - 4, y - 6); g.lineTo(x + sw + 4, y - 6); g.lineTo(x + sw + 9, y + 2); g.closePath(); g.fill();
        g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(x + sw, y + 3, 3, 0, TAU); g.fill();
        add(() => glow(x + sw, y + 4, 16, acc + '.9)'));
      },
      clockFace(d, now) {
        const { x, y, s } = d;
        g.fillStyle = 'rgba(217,180,90,.25)'; g.beginPath(); g.arc(x, y, 20 * s, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(217,180,90,.55)'; g.lineWidth = 2; g.stroke();
        const a = reduced() ? 1 : now / 2000 + d.ph; g.strokeStyle = 'rgba(240,230,200,.6)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 15 * s, y + Math.sin(a) * 15 * s); g.moveTo(x, y); g.lineTo(x + Math.cos(a / 12) * 9 * s, y + Math.sin(a / 12) * 9 * s); g.stroke();
      },
      cogStack(d, now) {
        const { x, y, s } = d, r = reduced() ? 0 : now / 1200 + d.ph;
        gear(x - 8 * s, y, 12 * s, 9, r, '#8a7440'); gear(x + 10 * s, y - 8 * s, 8 * s, 7, -r * 1.5, '#6a6f84');
      },
      pipe(d) {
        const { x, y } = d;
        g.strokeStyle = '#8a6a2a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 24, y); g.lineTo(x, y); g.lineTo(x, y - 24); g.lineTo(x + 18, y - 24); g.stroke();
        g.strokeStyle = 'rgba(255,230,170,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 24, y - 2); g.lineTo(x - 2, y - 2); g.stroke();
        g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
      },
      // Zindan ve Şehir
      torchPost(d, now) { g.fillStyle = '#2a2630'; g.fillRect(d.x - 3, d.y - 18, 6, 26); torch(d.x, d.y - 26, now); },
      barrels(d) { shadow(d.x + 4, d.y + 2, 20, 5, 0.4); barrel(d.x - 8, d.y, 0.9); barrel(d.x + 8, d.y + 2, 1); },
      web: asDecor('ag', 0.9),
      bench: asDecor('bank'),
      asteroid: asDecor('goktasi', 0.8),
      ringPlanet: asDecor('satürn', 0.7),
      probe: asDecor('uydu', 0.7),
      comet: asDecor('kuyruklu', 0.9),
      statue: asDecor('heykel', 0.9),
      column: asDecor('sutun', 1.1),
      pylon: asDecor('direk', 0.9),
      reel: asDecor('makara'),
      solar: asDecor('gunes', 0.9),
      buoy: asDecor('samandira'),
      gull: asDecor('marti', 0.9),
      smallLight(d, now) { lighthouse(d.x, d.y, 0.6 * d.s, now); },
      smallDome(d, now) { observatory(d.x, d.y, 0.9 * d.s, now); },
      scope: asDecor('devteleskop', 0.8),
      globe: asDecor('gokkure', 0.8),
      constel: asDecor('takimyildiz'),
      smallMill(d, now) { windmill(d.x, d.y, 0.9 * d.s, now + d.ph * 999); },
      hay: asDecor('saman', 0.8),
      crystalD: asDecor('crystal', 0.9),
      books: asDecor('kitaplar', 0.8),
      rune: asDecor('run', 0.8),
      smallPortal(d, now) { portalRing(d.x, d.y - 14, 12 * d.s, '#c08aff', now + d.ph * 999); },
      fence: asDecor('cit', 0.8),
      house(d, now) {
        const { x, y, s } = d;
        shadow(x + 8, y + 4, 30 * s, 6 * s, 0.4);
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = d.c; g.fillRect(-22, -30, 44, 30); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(6, -30, 16, 30);
        g.fillStyle = '#5a3040'; g.beginPath(); g.moveTo(-26, -30); g.lineTo(0, -50); g.lineTo(26, -30); g.closePath(); g.fill();
        const lit = (Math.floor(d.ph * 10) % 3) !== 0;
        g.fillStyle = lit ? '#ffd98a' : '#2a2230'; g.fillRect(-15, -22, 9, 9); g.fillRect(6, -22, 9, 9); g.fillStyle = '#2a2230'; g.fillRect(-4, -13, 8, 13);
        if (lit) light(-10, -18, 20, 'rgba(255,210,130,.45)');
        g.restore();
      },
      // Sahnesi henüz çizilmemiş dünyalar için sade dekor: kaya, temanın renginde ışıklı direk, süzülen ışık
      rock(d) {
        const { x, y, s } = d, base = d.world.theme.bottom;
        shadow(x + 6, y + 10 * s, 22 * s, 6 * s, 0.35);
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = shade(base, 1.4); g.beginPath(); g.moveTo(-18, 8); g.lineTo(-12, -8); g.lineTo(2, -14); g.lineTo(16, -4); g.lineTo(18, 8); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(-12, -8); g.lineTo(2, -14); g.lineTo(-2, -2); g.closePath(); g.fill();
        g.restore();
      },
      glowLamp(d, now) {
        const { x, y } = d, acc = d.world.theme.accent, fl = reduced() ? 1 : 0.85 + 0.15 * Math.sin(now / 300 + d.ph);
        shadow(x + 3, y + 18, 9, 3);
        g.fillStyle = 'rgba(10,12,24,.85)'; g.fillRect(x - 2, y - 26, 4, 44);
        g.fillStyle = acc; g.beginPath(); g.arc(x, y - 30, 5, 0, TAU); g.fill();
        add(() => { glow(x, y - 30, 26 * fl, acc + '99'); glow(x, y + 14, 50, acc + '22'); });
      },
      mote(d, now) {
        const acc = d.world.theme.accent, b = reduced() ? 0 : Math.sin(now / 900 + d.ph) * 6;
        add(() => glow(d.x, d.y + b, 16, acc + '55'));
      },
    };

    // ---- yol ----
    function road(lit, top, bot) {
      g.strokeStyle = 'rgba(12,6,20,.55)'; g.lineWidth = 46; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); let first = true;
      // Görünen kısmın t aralığı: noktalar yukarı doğru dizili, kabaca bulunur
      let t0 = 0, t1 = PTS.length - 1;
      for (let i = 0; i < PTS.length; i++) { if (PTS[i].y > bot + 200) t0 = i; if (PTS[i].y < top - 200) { t1 = i; break; } }
      for (let t = t0; t <= t1 + 1e-6; t += 0.05) { const p = pathPoint(t); if (first) { g.moveTo(p.x, p.y); first = false; } else g.lineTo(p.x, p.y); }
      g.stroke();
      for (let b = Math.floor(top / 100) - 1; b <= Math.floor(bot / 100) + 1; b++) {
        for (const s of BUCKET.get(b) || []) {
          if (s.y < top - 30 || s.y > bot + 30) continue;
          const gt = gateAtT(s.t);
          if (gateHiddenStone(s, gt)) continue;
          const w = worldOfGate(gt), on = s.t <= lit, ice = isIce(w);
          g.save(); g.translate(s.x, s.y); g.rotate(s.a);
          g.fillStyle = 'rgba(0,0,0,.35)'; rr(-8 * s.s, -10, 16 * s.s, 24, 5); g.fill();
          g.fillStyle = on ? w.theme.accent : ice ? '#e9f6fd' : 'rgba(150,130,170,.45)';
          rr(-8 * s.s, -12, 16 * s.s, 24, 5); g.fill();
          g.fillStyle = on ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.12)'; g.fillRect(-6 * s.s, -10, 12 * s.s, 4);
          g.restore();
          if (on) add(() => glow(s.x, s.y, 20, w.theme.accent + '40'));
        }
      }
      if (S.hop) add(() => { const p = pathPoint(lit); glow(p.x, p.y, 46, 'rgba(255,240,200,.9)'); });
    }
    // t konumu hangi kapının yolunda (kapı yapısı noktası o kapıya aittir)
    const gateAtT = t => { const i = Math.min(PTS.length - 1, Math.max(0, Math.round(t))); return Math.floor(i / (GS + 1)) + 1; };
    // Kapalı kapının altından geçen taşlar görünmez
    const gateHiddenStone = (s, gt) => !gateShownOpen(gt) && Math.abs(s.y - (GATE_Y[gt] - 30)) < 60 && Math.abs(s.x - W / 2) < 60;
    const tOf = n => L.index[n];
    const gateShownOpen = gt => gt === 1 || (S.opening[gt] != null) || D.gateOpen(gt);
    const openAmount = (gt, now) => (S.opening[gt] != null ? Math.min(1, (now - S.opening[gt]) / 1200) : gateShownOpen(gt) ? 1 : 0);

    // ---- kaideler, istasyonlar, plaket, ödüller ----
    function pedestals(now, top, bot) {
      const front = D.frontier();
      S.playRect = null;
      const banners = [];
      for (let n = 1; n <= N; n++) {
        const nd = NODES[n];
        if (nd.y < top - 160 || nd.y > bot + 120) continue;
        // Sıradaki durak, Halka oraya varınca canlanır (Oyna düğmesi, ad şeridi)
        const stars = D.stars(n), done = stars > 0, cur = n === front && S.pos === front && !S.hop, w = worldOf(n), acc = w.theme.accent, ice = isIce(w);
        const locked = n > front;
        const land = S.land && S.land.n === n ? Math.max(0, 1 - (now - S.land.t0) / 450) : 0;
        const bounce = land ? Math.sin(land * Math.PI * 3) * land * 6 : 0;
        g.save(); g.translate(nd.x, nd.y - bounce);
        shadow(4, 20 + bounce, 30, 9);
        g.fillStyle = done ? shade(acc, -0.35) : ice ? '#8fb8cf' : 'rgba(40,30,60,.95)';
        g.beginPath(); g.ellipse(0, 8, 27, 11, 0, 0, Math.PI); g.lineTo(-27, 0); g.ellipse(0, 0, 27, 11, 0, Math.PI, 0, true); g.closePath(); g.fill();
        g.fillRect(-27, 0, 54, 8);
        g.fillStyle = done ? acc : cur ? '#fff8ee' : ice ? '#dff2fb' : 'rgba(70,55,95,.95)';
        g.beginPath(); g.ellipse(0, 0, 27, 11, 0, 0, TAU); g.fill();
        g.strokeStyle = done ? '#fff' : cur ? acc : 'rgba(255,255,255,.25)'; g.lineWidth = 2.5; g.stroke();
        g.save(); g.scale(1, 0.4); g.lineCap = 'round';
        const ga = cur && !reduced() ? now / 500 : 0.9;
        g.strokeStyle = done ? 'rgba(255,255,255,.9)' : cur ? acc : 'rgba(255,255,255,.14)'; g.lineWidth = 5;
        g.beginPath(); g.arc(0, 0, 15, ga + 0.35, ga + TAU - 0.35); g.stroke();
        g.restore();
        if (done) for (let i = 0; i < 3; i++) { g.fillStyle = i < stars ? GOLD : 'rgba(255,255,255,.25)'; star(-15 + i * 15, -19 + (i === 1 ? -4 : 0), 6); }
        g.restore();
        if (cur) add(() => {
          const pulse = reduced() ? 0.5 : (now / 1100) % 1;
          const beam = g.createLinearGradient(0, nd.y - 140, 0, nd.y);
          beam.addColorStop(0, 'rgba(255,240,200,0)'); beam.addColorStop(1, 'rgba(255,240,200,.35)');
          g.fillStyle = beam; g.beginPath(); g.moveTo(nd.x - 22, nd.y); g.lineTo(nd.x - 8, nd.y - 140); g.lineTo(nd.x + 8, nd.y - 140); g.lineTo(nd.x + 22, nd.y); g.closePath(); g.fill();
          g.strokeStyle = `rgba(255,230,170,${0.8 * (1 - pulse)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(nd.x, nd.y, 27 + pulse * 24, 11 + pulse * 10, 0, 0, TAU); g.stroke();
        });
        if (land) add(() => { g.strokeStyle = `rgba(255,255,255,${land})`; g.lineWidth = 4 * land; g.beginPath(); g.ellipse(nd.x, nd.y, 27 + (1 - land) * 50, 11 + (1 - land) * 20, 0, 0, TAU); g.stroke(); });
        const st = STATIONS[n], state = done ? 'done' : locked ? 'locked' : 'cur';
        station(st, state, now);
        if (cur && st.name) banners.push(st);
        plaque(n, nd, done, cur, locked, w, now);
        const rw = D.reward(n);
        if (rw) reward(rw, n, nd.x + (nd.x > W / 2 ? -58 : 58), nd.y - 4, now, front);
      }
      return banners;
    }
    function plaque(n, nd, done, cur, locked, w, now) {
      const ice = isIce(w);
      g.save(); g.translate(nd.x, nd.y + 13);
      const pw = n >= 100 ? 36 : 32, ph = 15;
      const gem = () => { g.beginPath(); g.moveTo(-pw / 2, 0); g.lineTo(-pw / 2 + 6, -ph / 2); g.lineTo(pw / 2 - 6, -ph / 2); g.lineTo(pw / 2, 0); g.lineTo(pw / 2 - 6, ph / 2); g.lineTo(-pw / 2 + 6, ph / 2); g.closePath(); };
      g.scale(1.12, 1.12); gem(); g.fillStyle = INK; g.fill();
      g.scale(1 / 1.12, 1 / 1.12); gem();
      g.fillStyle = !locked ? '#1d2340' : ice ? '#9fc3d6' : '#2c2440'; g.fill();
      if (!locked) { g.strokeStyle = w.theme.accent + 'b0'; g.lineWidth = 1.2; g.stroke(); }
      g.fillStyle = !locked ? (ice ? '#bff3ff' : GOLD) : 'rgba(255,255,255,.5)';
      g.font = '900 11px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 0, 1);
      g.restore();
      if (!cur) return;
      // Oyna düğmesi (dokunma DOM düğmesinde)
      const by = nd.y + 46, bw = 84, bh = 30, pulse = reduced() ? 1 : 1 + Math.sin(now / 420) * 0.025;
      S.playRect = { x: nd.x - bw / 2, y: by - bh / 2, w: bw, h: bh };
      add(() => glow(nd.x, by, 64, 'rgba(255,201,74,.26)'));
      g.save(); g.translate(nd.x, by); g.scale(pulse, pulse);
      g.fillStyle = 'rgba(8,10,20,.45)'; rr(-bw / 2, -bh / 2 + 6, bw, bh, 12); g.fill();
      g.fillStyle = '#c98a12'; rr(-bw / 2, -bh / 2 + 3, bw, bh, 12); g.fill();
      const bg = g.createLinearGradient(0, -bh / 2, 0, bh / 2); bg.addColorStop(0, '#ffe07a'); bg.addColorStop(1, '#f5b52e');
      g.fillStyle = bg; rr(-bw / 2, -bh / 2, bw, bh, 12); g.fill();
      g.save(); rr(-bw / 2, -bh / 2, bw, bh, 12); g.clip();
      if (!reduced()) { const sx = -bw + ((now / 2600) % 1) * bw * 2.2; g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(sx, -bh / 2); g.lineTo(sx + 14, -bh / 2); g.lineTo(sx + 4, bh / 2); g.lineTo(sx - 10, bh / 2); g.closePath(); g.fill(); }
      g.restore();
      g.font = '900 15px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#3a2400'; g.fillText(tr('Oyna'), 0, 1);
      g.restore();
    }
    function station(st, state, now) {
      const { x, y, kind, w } = st, on = state !== 'locked', t = reduced() ? 0 : now, ice = isIce(w);
      g.save();
      shadow(x + 5, y + 16, 30, 8, 0.45);
      if (!on) g.filter = 'grayscale(0.85) brightness(0.55)';
      g.fillStyle = ice ? '#bfe0f0' : shade(w.theme.bottom, 1.2); g.beginPath(); g.ellipse(x, y + 12, 28, 9, 0, 0, TAU); g.fill();
      g.fillStyle = ice ? '#e6f5fc' : shade(w.theme.bottom, 2.2); g.beginPath(); g.ellipse(x, y + 9, 28, 9, 0, 0, TAU); g.fill();
      g.translate(x, y + 8); g.scale(1.2, 1.2);
      (STATION_ART[kind] || STATION_ART.beacon)(on, t, state, st);
      g.restore();
      if (on) add(() => glow(x, y - 10, 46, ice ? 'rgba(160,230,255,.22)' : w.theme.accent + '38'));
      if (state === 'done') { g.fillStyle = '#fff'; g.fillRect(x + 22, y - 30, 1.6, 22); g.fillStyle = w.theme.accent; const wv = reduced() ? 0 : Math.sin(now / 200 + x) * 2; g.beginPath(); g.moveTo(x + 23.6, y - 30); g.quadraticCurveTo(x + 30, y - 28 + wv, x + 36, y - 26 + wv); g.lineTo(x + 23.6, y - 21); g.fill(); }
    }
    function nameBanner(st, now) {
      const nd = NODES[st.n], name = tr(st.name);
      const y = st.y - 90 + (reduced() ? 0 : Math.sin(now / 500) * 2), side = st.x > nd.x ? 1 : -1;
      g.save();
      g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = g.measureText(name).width + 26, x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, st.x + side * (w / 2 - 22)));
      g.fillStyle = 'rgba(20,8,24,.55)'; rr(x - w / 2 + 2, y - 8, w, 22, 11); g.fill();
      const gr = g.createLinearGradient(0, y - 11, 0, y + 11); gr.addColorStop(0, '#fff1d6'); gr.addColorStop(1, '#ffd38a');
      g.fillStyle = gr; rr(x - w / 2, y - 11, w, 22, 11); g.fill();
      g.fillStyle = '#5a2a10'; g.fillText(name, x, y + 1);
      g.fillStyle = '#ffd38a'; g.beginPath(); g.moveTo(st.x - 6, y + 11); g.lineTo(st.x, y + 18); g.lineTo(st.x + 6, y + 11); g.fill();
      g.restore();
    }
    const STATION_ART = {
      // Sahnesi henüz çizilmemiş dünyalar: temanın renginde ışık yayan küçük bir taş fener
      beacon(on, t, state, st) {
        const acc = st.w.theme.accent;
        g.fillStyle = shade(st.w.theme.bottom, 1.6); g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -26); g.lineTo(6, -26); g.lineTo(9, 0); g.closePath(); g.fill();
        g.fillStyle = shade(st.w.theme.bottom, 2.6); g.fillRect(-8, -30, 16, 5);
        g.fillStyle = on ? acc : '#5a5f74'; g.beginPath(); g.arc(0, -36, 5.5, 0, TAU); g.fill();
        if (on) light(0, -36, 18 + Math.sin(t / 400) * 2, acc + 'aa');
      },
      // ---- Başlangıç Vadisi: kapı 1-6 ----
      cimen(on, t) {
        for (let i = -3; i <= 3; i++) { const sw = Math.sin(t / 700 + i) * 2; g.strokeStyle = i % 2 ? '#3fa86a' : '#5cc27f'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(i * 4, 0); g.quadraticCurveTo(i * 5, -14, i * 7 + sw, -26 - Math.abs(i) * -2); g.stroke(); }
        if (on) { g.fillStyle = '#e8fbff'; for (const [x, y] of [[-9, -20], [6, -24], [13, -14]]) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); light(x, y, 6, 'rgba(200,240,255,.7)'); } }
      },
      cesme(on, t) {
        g.fillStyle = '#7d8590'; g.beginPath(); g.ellipse(0, -4, 20, 7, 0, 0, TAU); g.fill(); g.fillStyle = '#9aa3ad'; g.fillRect(-20, -10, 40, 6);
        g.fillStyle = '#5aa8e0'; g.beginPath(); g.ellipse(0, -10, 17, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#8a929c'; g.fillRect(-3, -30, 6, 20); g.beginPath(); g.arc(0, -31, 5, 0, TAU); g.fill();
        if (on) { g.strokeStyle = 'rgba(160,220,255,.9)'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -33); g.quadraticCurveTo(s * 10, -40 + Math.sin(t / 200) * 1.5, s * 13, -12); g.stroke(); } }
      },
      papatya(on, t) {
        for (const [x, h, s] of [[-12, 22, 1], [0, 30, 1.15], [12, 20, 0.9]]) {
          g.strokeStyle = '#3fa86a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.sin(t / 900 + x) * 2, -h); g.stroke();
          g.save(); g.translate(x + Math.sin(t / 900 + x) * 2, -h); g.scale(s, s);
          g.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(Math.cos(i * TAU / 8) * 5, Math.sin(i * TAU / 8) * 5, 3.4, 1.8, i * TAU / 8, 0, TAU); g.fill(); }
          g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(0, 0, 2.8, 0, TAU); g.fill(); g.restore();
        }
      },
      kelebek(on, t) {
        g.fillStyle = '#2d7d4f'; g.beginPath(); g.ellipse(0, -8, 20, 10, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#ff8fab'; for (const x of [-11, 0, 10]) { g.beginPath(); g.arc(x, -14, 3, 0, TAU); g.fill(); }
        const fx = Math.sin(t / 600) * 10, fy = -34 + Math.cos(t / 450) * 5, fl = Math.abs(Math.sin(t / 90));
        g.save(); g.translate(fx, fy); g.fillStyle = '#ffc94a';
        for (const s of [-1, 1]) { g.save(); g.scale(s * (0.3 + fl * 0.7), 1); g.beginPath(); g.ellipse(4, -2, 5, 4, -0.4, 0, TAU); g.ellipse(3, 3, 3.5, 3, 0.4, 0, TAU); g.fill(); g.restore(); }
        g.fillStyle = INK; g.fillRect(-0.8, -4, 1.6, 8); g.restore();
      },
      sogut(on, t) {
        g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(-2, -30); g.lineTo(2, -30); g.lineTo(4, 0); g.fill();
        g.fillStyle = '#2d7d4f'; g.beginPath(); g.ellipse(0, -36, 20, 12, 0, 0, TAU); g.fill();
        for (let i = -4; i <= 4; i++) { const sw = Math.sin(t / 800 + i) * 2; g.strokeStyle = i % 2 ? '#5cc27f' : '#3fa86a'; g.lineWidth = 2; g.beginPath(); g.moveTo(i * 4.5, -32); g.quadraticCurveTo(i * 5 + sw, -18, i * 4.8 + sw * 1.5, -8 + Math.abs(i)); g.stroke(); }
      },
      kovan(on, t) {
        for (let i = 0; i < 4; i++) { const w = 16 - i * 2.5; g.fillStyle = i % 2 ? '#c98a2a' : '#e0a83c'; g.beginPath(); g.ellipse(0, -5 - i * 8, w, 6, 0, 0, TAU); g.fill(); }
        g.fillStyle = '#3a2410'; g.beginPath(); g.arc(0, -6, 3.5, Math.PI, 0); g.fill();
        if (on) for (let i = 0; i < 3; i++) { const a = t / 300 + i * 2.1; g.fillStyle = '#ffd34a'; g.beginPath(); g.ellipse(Math.cos(a) * 18, -22 + Math.sin(a * 1.3) * 10, 2.4, 1.6, 0, 0, TAU); g.fill(); g.fillStyle = INK; g.fillRect(Math.cos(a) * 18 - 0.5, -23.5 + Math.sin(a * 1.3) * 10, 1, 3); }
      },
      yuva(on, t) {
        g.fillStyle = '#6b4a2a'; g.fillRect(-10, -18, 20, 18); g.fillStyle = '#8a643a'; g.beginPath(); g.ellipse(0, -18, 10, 3.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#9a7040'; g.beginPath(); g.ellipse(0, -22, 13, 6, 0, 0, Math.PI); g.fill();
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-12, -21 + i); g.lineTo(12, -23 - i); g.stroke(); }
        const b = Math.sin(t / 300) * 1.2; g.fillStyle = '#4cc9f0'; g.beginPath(); g.arc(2, -29 + b, 5, 0, TAU); g.fill(); g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(6, -30 + b); g.lineTo(10, -29 + b); g.lineTo(6, -27 + b); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(3.5, -30.5 + b, 1.2, 0, TAU); g.fill();
      },
      dere(on, t) {
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.moveTo(-26, -2); g.quadraticCurveTo(-6, -12, 4, -4); g.quadraticCurveTo(14, 4, 26, -6); g.lineTo(26, 2); g.quadraticCurveTo(14, 10, 4, 4); g.quadraticCurveTo(-6, -4, -26, 6); g.closePath(); g.fill();
        if (on) { g.strokeStyle = 'rgba(200,240,255,.7)'; g.lineWidth = 1.2; const o = (t / 60) % 20; g.beginPath(); g.moveTo(-20 + o, 0); g.lineTo(-14 + o, -1); g.stroke(); }
        g.strokeStyle = '#3fa86a'; g.lineWidth = 2; for (const x of [-18, -14, 18]) { g.beginPath(); g.moveTo(x, -4); g.lineTo(x + 1, -22); g.stroke(); }
        g.fillStyle = '#6b4a2a'; g.fillRect(-15, -26, 3, 7);
      },
      basamak() {
        for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#8a929c' : '#9ea7b2'; g.fillRect(-18 + i * 3, -7 - i * 8, 36 - i * 6, 8); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(-18 + i * 3, -7 - i * 8, 36 - i * 6, 2); }
        g.fillStyle = '#5cc27f'; g.beginPath(); g.ellipse(-15, -2, 5, 2, 0, 0, TAU); g.ellipse(12, -18, 4, 1.6, 0, 0, TAU); g.fill();
      },
      patika(on, t) {
        g.strokeStyle = '#a0784a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(10, -10, -6, -20); g.quadraticCurveTo(-18, -30, 6, -38); g.stroke();
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 2; for (const x of [-20, 18]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -18); g.stroke(); }
        g.strokeStyle = '#c9a774'; g.lineWidth = 1; g.beginPath(); g.moveTo(-20, -14); g.quadraticCurveTo(0, -10, 18, -14); g.stroke();
      },
      saz(on, t) {
        for (let i = -3; i <= 3; i++) { const x = i * 5, h = 24 + (i * 37 % 9), sw = Math.sin(t / 600 + i) * 2; g.strokeStyle = '#5a8a3a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, -h); g.stroke(); if (i % 2) { g.fillStyle = '#7a4a2a'; g.beginPath(); g.ellipse(x + sw, -h + 4, 2.2, 5, 0, 0, TAU); g.fill(); } }
      },
      nilufer(on, t) {
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -4, 24, 9, 0, 0, TAU); g.fill();
        g.fillStyle = '#3fa86a'; for (const [x, y] of [[-10, -5], [8, -2], [2, -8]]) { g.beginPath(); g.ellipse(x, y, 6, 3, 0, 0.3, TAU); g.lineTo(x, y); g.fill(); }
        g.fillStyle = '#ff9ec4'; g.save(); g.translate(2, -11); for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.beginPath(); g.ellipse(0, -3, 1.8, 3.6, 0, 0, TAU); g.fill(); } g.restore();
        if (on) light(2, -11, 10, 'rgba(255,170,210,.6)');
      },
      tas(on, t) {
        g.fillStyle = '#7d8590'; g.beginPath(); g.ellipse(0, -8, 20, 11, 0, Math.PI, 0); g.lineTo(20, -2); g.lineTo(-20, -2); g.fill();
        const b = on ? Math.max(0, Math.sin(t / 400)) * 4 : 0;
        g.fillStyle = '#4caf50'; g.beginPath(); g.ellipse(0, -20 - b, 8, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-4, -25 - b, 2.4, 0, TAU); g.arc(4, -25 - b, 2.4, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(-4, -25 - b, 1.1, 0, TAU); g.arc(4, -25 - b, 1.1, 0, TAU); g.fill();
      },
      cilek() {
        g.fillStyle = '#2d7d4f'; g.beginPath(); g.ellipse(0, -10, 22, 12, 0, Math.PI, 0); g.fill();
        for (const [x, y] of [[-12, -12], [-3, -17], [8, -13], [14, -8], [-6, -8]]) { g.fillStyle = '#e8463a'; g.beginPath(); g.moveTo(x - 3, y - 2); g.quadraticCurveTo(x, y + 6, x + 3, y - 2); g.closePath(); g.fill(); g.fillStyle = '#5cc27f'; g.fillRect(x - 2, y - 3, 4, 1.5); }
      },
      mantar(on, t) {
        for (const [x, h, r] of [[-12, 12, 7], [2, 18, 9], [14, 10, 6]]) {
          g.fillStyle = '#f2e6d4'; g.fillRect(x - 2.5, -h, 5, h);
          g.fillStyle = '#e8463a'; g.beginPath(); g.ellipse(x, -h, r, r * 0.65, 0, Math.PI, 0); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.35, -h - r * 0.3, 1.4, 0, TAU); g.arc(x + r * 0.3, -h - r * 0.2, 1.1, 0, TAU); g.fill();
        }
        if (on) light(2, -14, 26, 'rgba(255,140,160,.25)');
      },
      ruzgargulu(on, t) {
        g.strokeStyle = '#8a643a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -32); g.stroke();
        g.save(); g.translate(0, -34); g.rotate(on ? t / 250 : 0);
        ['#ff6b6b', '#ffc94a', '#4cc9f0', '#2dd4bf'].forEach((c, i) => { g.rotate(TAU / 4); g.fillStyle = c; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12); g.lineTo(9, -6); g.closePath(); g.fill(); });
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill(); g.restore();
      },
      iskele(on, t) {
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(6, -2, 22, 7, 0, 0, TAU); g.fill();
        g.fillStyle = '#9a6a3a'; g.fillRect(-22, -10, 34, 6); g.fillStyle = '#7a4e28'; for (let i = 0; i < 5; i++) g.fillRect(-22 + i * 7, -10, 1.2, 6);
        g.fillStyle = '#6b4a2a'; for (const x of [-20, -6, 8]) g.fillRect(x, -4, 3, 8);
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -10); g.lineTo(10, -24); g.stroke(); g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(10, -26, 3, 0, TAU); g.fill(); if (on) light(10, -26, 14, 'rgba(255,210,130,.7)');
      },
      tabela() {
        g.fillStyle = '#6b4a2a'; g.fillRect(-2, -40, 4, 40);
        [['#c98a2a', -36, 1], ['#a8743a', -27, -1], ['#c98a2a', -18, 1]].forEach(([c, y, d]) => { g.fillStyle = c; g.beginPath(); g.moveTo(-10 * d, y - 4); g.lineTo(14 * d, y - 4); g.lineTo(19 * d, y); g.lineTo(14 * d, y + 4); g.lineTo(-10 * d, y + 4); g.closePath(); g.fill(); });
      },
      elma() {
        g.fillStyle = '#5a3a24'; g.fillRect(-3, -22, 6, 22);
        g.fillStyle = '#2d7d4f'; g.beginPath(); g.arc(-8, -30, 12, 0, TAU); g.arc(8, -30, 12, 0, TAU); g.arc(0, -40, 12, 0, TAU); g.fill();
        g.fillStyle = '#e8463a'; for (const [x, y] of [[-10, -28], [6, -36], [10, -26], [-2, -42], [-6, -36]]) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
      },
      kuyu(on, t) {
        g.fillStyle = '#8a929c'; g.fillRect(-14, -16, 28, 16); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-14, -12 + i * 5); g.lineTo(14, -12 + i * 5); g.stroke(); }
        g.fillStyle = '#5a3a24'; g.fillRect(-14, -40, 3, 24); g.fillRect(11, -40, 3, 24);
        g.fillStyle = '#a0522d'; g.beginPath(); g.moveTo(-18, -38); g.lineTo(0, -48); g.lineTo(18, -38); g.closePath(); g.fill();
        const b = on ? Math.sin(t / 500) * 2 : 0; g.strokeStyle = '#c9a774'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -38); g.lineTo(0, -26 + b); g.stroke(); g.fillStyle = '#6b4a2a'; g.fillRect(-3, -26 + b, 6, 5);
      },
      cit() {
        g.fillStyle = '#9a6a3a'; for (const x of [-20, -12, 12, 20]) { g.beginPath(); g.moveTo(x - 2.5, 0); g.lineTo(x - 2.5, -20); g.lineTo(x, -24); g.lineTo(x + 2.5, -20); g.lineTo(x + 2.5, 0); g.fill(); }
        g.fillRect(-22, -16, 12, 3); g.fillRect(10, -16, 12, 3); g.fillRect(-22, -7, 12, 3); g.fillRect(10, -7, 12, 3);
        g.save(); g.translate(-9, 0); g.rotate(-0.3); g.fillStyle = '#b8824a'; g.fillRect(0, -20, 17, 3); g.fillRect(0, -9, 17, 3); g.fillRect(1, -22, 3, 22); g.fillRect(14, -22, 3, 22); g.restore();
      },
      saman() {
        g.fillStyle = '#d9b24a'; g.beginPath(); g.ellipse(0, -12, 18, 14, 0, Math.PI, 0); g.lineTo(18, 0); g.lineTo(-18, 0); g.fill();
        g.strokeStyle = '#b8902a'; g.lineWidth = 1.2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 5, -2); g.quadraticCurveTo(i * 5.5, -14, i * 4, -24 + Math.abs(i) * 2); g.stroke(); }
        g.strokeStyle = '#7a4e28'; g.lineWidth = 2; g.beginPath(); g.moveTo(-17, -10); g.lineTo(17, -10); g.stroke();
      },
      cicek(on, t) {
        g.fillStyle = '#6b4a2a'; g.fillRect(-20, -6, 40, 6);
        const cols = ['#ff6b6b', '#ffc94a', '#b388ff', '#ff8fab', '#4cc9f0'];
        for (let i = 0; i < 7; i++) { const x = -17 + i * 5.7, h = 10 + (i * 7 % 5) * 2; g.strokeStyle = '#3fa86a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, -6); g.lineTo(x, -6 - h); g.stroke(); g.fillStyle = cols[i % 5]; g.beginPath(); g.arc(x, -7 - h, 3.2, 0, TAU); g.fill(); }
        if (on) { const a = t / 260; g.fillStyle = '#ffd34a'; g.beginPath(); g.ellipse(Math.cos(a) * 14, -30 + Math.sin(a * 1.4) * 5, 2.2, 1.5, 0, 0, TAU); g.fill(); }
      },
      kirfeneri(on, t) {
        g.fillStyle = '#4a3a2a'; g.fillRect(-2, -36, 4, 36); g.fillRect(-2, -36, 12, 3);
        const fl = 0.85 + 0.15 * Math.sin(t / 120);
        g.fillStyle = '#2a2a30'; g.fillRect(5, -34, 8, 3); g.fillStyle = on ? '#ffd27a' : '#6a6050'; g.fillRect(5.5, -31, 7, 9); g.fillStyle = '#2a2a30'; g.fillRect(5, -22, 8, 2);
        if (on) light(9, -27, 26 * fl, 'rgba(255,200,110,.8)');
      },
      orman(on, t) {
        for (const [x, s] of [[-12, 0.9], [12, 0.8], [0, 1.1]]) { g.save(); g.translate(x, 0); g.scale(s, s); g.fillStyle = '#4a3328'; g.fillRect(-2, -8, 4, 8); g.fillStyle = '#1f4a3a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-14 + i * 3, -6 - i * 10); g.lineTo(0, -24 - i * 10); g.lineTo(14 - i * 3, -6 - i * 10); g.closePath(); g.fill(); } g.restore(); }
        if (on && Math.sin(t / 1300) > -0.4) { g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(-3, -26, 1.6, 0, TAU); g.arc(3, -26, 1.6, 0, TAU); g.fill(); light(0, -26, 10, 'rgba(255,220,120,.6)'); }
      },
      mese() {
        g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-4, -26); g.lineTo(4, -26); g.lineTo(7, 0); g.fill();
        g.strokeStyle = '#5a3a24'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -22); g.lineTo(-12, -30); g.moveTo(0, -24); g.lineTo(12, -32); g.stroke();
        g.fillStyle = '#2d6a3f'; for (const [x, y, r] of [[-14, -34, 11], [14, -34, 11], [0, -44, 14], [-6, -36, 10], [8, -38, 10]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        g.fillStyle = '#c98a2a'; for (const [x, y] of [[-10, -30], [12, -30]]) { g.beginPath(); g.ellipse(x, y, 2, 2.6, 0, 0, TAU); g.fill(); }
      },
      bambu(on, t) {
        for (const [x, h] of [[-12, 38], [-4, 46], [5, 40], [13, 34]]) { const sw = Math.sin(t / 900 + x) * 2; g.strokeStyle = '#7fb35a'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, -h); g.stroke(); g.strokeStyle = '#4f7a34'; g.lineWidth = 3.6; for (let y = -10; y > -h; y -= 10) { g.beginPath(); g.moveTo(x - 2 + sw * (-y / h), y); g.lineTo(x + 2 + sw * (-y / h), y); g.stroke(); } g.fillStyle = '#5cc27f'; g.beginPath(); g.ellipse(x + sw + 4, -h + 4, 5, 1.6, -0.5, 0, TAU); g.fill(); }
      },
      sincap(on, t) {
        g.fillStyle = '#5a3a24'; g.fillRect(-8, -40, 16, 40); g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(0, -26, 4, 5, 0, 0, TAU); g.fill();
        const b = on ? Math.sin(t / 500) * 3 : 0;
        g.fillStyle = '#c0703a'; g.beginPath(); g.ellipse(12, -34 + b, 5, 9, 0.4, 0, TAU); g.fill(); g.beginPath(); g.arc(9, -24 + b, 4, 0, TAU); g.fill();
        g.fillStyle = INK; g.beginPath(); g.arc(8, -25 + b, 0.9, 0, TAU); g.fill();
        g.fillStyle = '#2d6a3f'; g.beginPath(); g.ellipse(0, -44, 18, 8, 0, 0, TAU); g.fill();
      },
      kokmagara() {
        g.fillStyle = '#6b4a2a'; g.beginPath(); g.ellipse(0, -4, 26, 20, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#1a1008'; g.beginPath(); g.ellipse(0, -4, 10, 12, 0, Math.PI, 0); g.fill();
        g.strokeStyle = '#8a643a'; g.lineWidth = 2.4; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 10, -14); g.quadraticCurveTo(s * 22, -16, s * 26, -2); g.moveTo(s * 6, -20); g.quadraticCurveTo(s * 14, -26, s * 20, -14); g.stroke(); }
        g.fillStyle = '#2d6a3f'; g.beginPath(); g.ellipse(0, -24, 18, 6, 0, Math.PI, 0); g.fill();
      },
      yosun() {
        g.fillStyle = '#6a7380'; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-16, -16); g.lineTo(-2, -24); g.lineTo(14, -18); g.lineTo(20, 0); g.closePath(); g.fill();
        g.fillStyle = '#4f9a5a'; g.beginPath(); g.moveTo(-17, -12); g.quadraticCurveTo(-8, -26, 4, -24); g.quadraticCurveTo(14, -22, 15, -14); g.quadraticCurveTo(0, -18, -17, -12); g.fill();
        g.fillStyle = '#7fd28a'; for (const [x, y] of [[-8, -18], [2, -21], [9, -18]]) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
      },
      ag(on, t) {
        g.strokeStyle = '#5a3a24'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-14, -40); g.moveTo(18, 0); g.lineTo(14, -40); g.stroke();
        g.strokeStyle = 'rgba(230,240,255,.75)'; g.lineWidth = 0.8;
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(0, -22); g.lineTo(Math.cos(a) * 15, -22 + Math.sin(a) * 15); g.stroke(); }
        for (const r of [5, 9, 13]) { g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i * TAU / 8; g.lineTo(Math.cos(a) * r, -22 + Math.sin(a) * r); } g.stroke(); }
        if (on) { g.fillStyle = 'rgba(200,240,255,.9)'; g.beginPath(); g.arc(7, -27, 1.2, 0, TAU); g.arc(-9, -18, 1.2, 0, TAU); g.fill(); }
      },
      salincak(on, t) {
        g.fillStyle = '#5a3a24'; g.fillRect(-22, -46, 44, 4);
        const sw = on ? Math.sin(t / 500) * 0.35 : 0;
        g.save(); g.translate(0, -44); g.rotate(sw);
        g.strokeStyle = '#c9a774'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-8, 30); g.moveTo(8, 0); g.lineTo(8, 30); g.stroke();
        g.fillStyle = '#5cc27f'; g.beginPath(); g.ellipse(0, 32, 13, 4, 0, 0, TAU); g.fill(); g.strokeStyle = '#2d7d4f'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12, 32); g.lineTo(12, 32); g.stroke();
        g.restore();
      },
      yaprak(on, t) {
        g.save(); g.rotate(-0.3); g.fillStyle = '#4f9a5a'; g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(0, -26, 22, -8); g.quadraticCurveTo(0, 8, -22, 0); g.fill();
        g.strokeStyle = '#2d6a3f'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, -8); g.stroke(); g.restore();
        const x = on ? -10 + ((t / 80) % 20) : -4;
        for (let i = 0; i < 5; i++) { g.fillStyle = i ? '#a6d65a' : '#7fb33a'; g.beginPath(); g.arc(x - i * 3.4, -12 + i * 1 + Math.sin(t / 150 + i) * 0.8, 2.6, 0, TAU); g.fill(); }
      },
      bostan() {
        g.fillStyle = '#5a3a24'; g.fillRect(-24, -10, 48, 10);
        for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { const x = -20 + i * 10, y = -3 - r * 3; g.fillStyle = '#5cc27f'; g.beginPath(); g.ellipse(x, y - 4, 2.4, 4, (i % 2 ? 0.3 : -0.3), 0, TAU); g.fill(); if (r === 0) { g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x, y + 4); g.lineTo(x + 1.6, y); g.fill(); } }
        g.fillStyle = '#7d8590'; g.fillRect(-26, -22, 3, 22); g.fillRect(23, -22, 3, 22); g.strokeStyle = '#9aa0b0'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-24, -20); for (let i = 0; i < 6; i++) g.arc(-20 + i * 8, -20, 4, Math.PI, 0, true); g.stroke();
      },
      kavak(on, t) {
        for (const [x, h] of [[-12, 40], [0, 50], [12, 42]]) { const sw = Math.sin(t / 1000 + x) * 1.5; g.fillStyle = '#5a3a24'; g.fillRect(x - 1.5, -8, 3, 8); g.fillStyle = x ? '#3f8a52' : '#2d6a3f'; g.beginPath(); g.ellipse(x + sw, -8 - h / 2, 5.5, h / 2, 0, 0, TAU); g.fill(); }
      },
      gol(on, t) {
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -6, 26, 10, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(200,240,255,.5)'; g.lineWidth = 1.4; const r = on ? (t / 40) % 14 : 6; g.beginPath(); g.ellipse(6, -6, 4 + r, 1.6 + r * 0.35, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#5a8a3a'; g.lineWidth = 1.8; for (const x of [-22, -18, 20]) { g.beginPath(); g.moveTo(x, -6); g.lineTo(x + 1, -24); g.stroke(); }
      },
      tasdegirmen(on, t) {
        g.fillStyle = '#6a7380'; g.fillRect(-18, -8, 36, 8);
        g.save(); g.translate(0, -18); g.scale(1, 0.55); g.rotate(on ? t / 900 : 0);
        g.fillStyle = '#9ea7b2'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i * 1.05) * 18, Math.sin(i * 1.05) * 18); g.stroke(); }
        g.fillStyle = '#3a3a40'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.restore();
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -22); g.lineTo(22, -30); g.stroke();
      },
      pinar(on, t) {
        g.fillStyle = '#6a7380'; for (const [x, r] of [[-12, 9], [12, 8], [0, 7]]) { g.beginPath(); g.arc(x, -6, r, Math.PI, 0); g.fill(); }
        g.fillStyle = '#5aa8e0'; g.beginPath(); g.ellipse(0, -2, 14, 4, 0, 0, TAU); g.fill();
        if (on) for (let i = 0; i < 4; i++) { const ph = ((t / 500 + i * 0.25) % 1); g.fillStyle = `rgba(200,240,255,${1 - ph})`; g.beginPath(); g.arc(-4 + i * 3, -4 - ph * 14, 1.6, 0, TAU); g.fill(); }
      },
      tepe(on, t) {
        g.fillStyle = '#3f8a52'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-4, -40, 26, 0); g.fill();
        g.fillStyle = '#4f9a5a'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-10, -30, 4, -24); g.quadraticCurveTo(-6, -10, -26, 0); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2, -22); g.lineTo(-2, -42); g.stroke();
        const wv = Math.sin(t / 220) * 2; g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(-2, -42); g.quadraticCurveTo(5, -40 + wv, 12, -38 + wv); g.lineTo(-2, -34); g.fill();
      },
      kar() {
        g.fillStyle = '#e6f2fa'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-6, -38, 8, -30); g.quadraticCurveTo(20, -24, 26, 0); g.fill();
        g.fillStyle = 'rgba(150,190,220,.6)'; g.beginPath(); g.moveTo(8, -30); g.quadraticCurveTo(20, -24, 26, 0); g.lineTo(10, 0); g.quadraticCurveTo(14, -16, 8, -30); g.fill();
        g.fillStyle = '#1f5a5a'; g.beginPath(); g.moveTo(-16, -6); g.lineTo(-11, -22); g.lineTo(-6, -6); g.fill();
      },
      kumsal(on, t) {
        g.fillStyle = '#e8d29a'; g.beginPath(); g.ellipse(0, -4, 26, 9, 0, 0, TAU); g.fill();
        g.fillStyle = '#5aa8e0'; g.beginPath(); g.ellipse(18, -1, 10, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff9ec4'; g.beginPath(); g.ellipse(-14, -5, 3, 2, 0.5, 0, TAU); g.fill(); g.fillStyle = '#fff5ea'; g.beginPath(); g.ellipse(-8, -2, 2.4, 1.6, 0, 0, TAU); g.fill();
        const x = on ? -2 + Math.sin(t / 1500) * 6 : 0;
        g.fillStyle = '#5a8a3a'; g.beginPath(); g.ellipse(x, -9, 7, 5, 0, Math.PI, 0); g.fill(); g.fillStyle = '#7fb35a'; g.beginPath(); g.arc(x + 8, -9, 2.6, 0, TAU); g.fill();
      },
      kopru(on, t) {
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-24, -26); g.moveTo(24, 0); g.lineTo(24, -26); g.stroke();
        const sag = on ? 6 + Math.sin(t / 700) * 1.5 : 6;
        g.strokeStyle = '#c9a774'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-24, -24); g.quadraticCurveTo(0, -24 + sag * 2, 24, -24); g.stroke();
        for (let i = -4; i <= 4; i++) { const y = -10 + sag * (1 - (i / 5) * (i / 5)) * 1.2; g.fillStyle = '#9a6a3a'; g.fillRect(i * 5 - 2, y - 1.5, 4, 3); g.strokeStyle = '#c9a774'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(i * 5, y); g.lineTo(i * 5, -24 + sag * 2 * (1 - (i / 5) * (i / 5)) * 0.6); g.stroke(); }
      },
      selale(on, t) {
        g.fillStyle = '#6a7380'; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-20, -40); g.lineTo(-6, -46); g.lineTo(-6, 0); g.moveTo(6, 0); g.lineTo(6, -46); g.lineTo(20, -42); g.lineTo(24, 0); g.fill();
        g.fillStyle = '#5aa8e0'; g.fillRect(-6, -46, 12, 46);
        if (on) { g.fillStyle = 'rgba(230,248,255,.7)'; for (let i = 0; i < 3; i++) { const y = -46 + ((t / 12 + i * 15) % 46); g.fillRect(-5 + i * 3.5, y, 1.6, 8); } light(0, -4, 16, 'rgba(180,230,255,.5)'); }
        g.fillStyle = '#e6f2fa'; g.beginPath(); g.ellipse(0, -2, 12, 4, 0, 0, TAU); g.fill();
      },
      gecit() {
        g.fillStyle = '#6a6070'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-22, -38); g.lineTo(-10, -42); g.lineTo(-6, 0); g.fill(); g.beginPath(); g.moveTo(6, 0); g.lineTo(10, -34); g.lineTo(22, -40); g.lineTo(26, 0); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(-22, -38); g.lineTo(-10, -42); g.lineTo(-12, -20); g.fill();
        g.fillStyle = '#a0784a'; g.fillRect(-6, -4, 12, 4);
      },
      savana(on, t) {
        for (let i = -5; i <= 5; i++) { const sw = Math.sin(t / 600 + i) * 2.5; g.strokeStyle = i % 2 ? '#d9b24a' : '#c99a3a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(i * 4, 0); g.quadraticCurveTo(i * 4.4, -14, i * 4.6 + sw, -24 - (i * 13 % 6)); g.stroke(); }
      },
      akasya() {
        g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(-1, -28); g.lineTo(-10, -36); g.lineTo(-8, -37); g.lineTo(0, -31); g.lineTo(9, -38); g.lineTo(10, -36); g.lineTo(2, -28); g.lineTo(3, 0); g.fill();
        g.fillStyle = '#3f6a3a'; g.beginPath(); g.ellipse(0, -42, 26, 6, 0, 0, TAU); g.fill(); g.fillStyle = '#4f7a44'; g.beginPath(); g.ellipse(-4, -44, 18, 4, 0, 0, TAU); g.fill();
      },
      birikinti(on, t) {
        g.fillStyle = '#3a6a90'; g.beginPath(); g.ellipse(0, -4, 22, 8, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-6, -6, 8, 2, 0, 0, TAU); g.fill();
        if (on) for (let i = 0; i < 2; i++) { const r = ((t / 900 + i * 0.5) % 1); g.strokeStyle = `rgba(200,240,255,${1 - r})`; g.lineWidth = 1; g.beginPath(); g.ellipse(4 - i * 10, -4, 3 + r * 10, 1 + r * 3.5, 0, 0, TAU); g.stroke(); }
      },
      aslankayasi(on) {
        g.fillStyle = '#8a7060'; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-18, -24); g.lineTo(-4, -34); g.lineTo(18, -36); g.lineTo(22, -30); g.lineTo(10, -26); g.lineTo(14, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(-4, -34); g.lineTo(18, -36); g.lineTo(22, -30); g.lineTo(4, -30); g.fill();
        if (on) light(10, -34, 24, 'rgba(255,200,110,.45)');
      },
      // ---- Atölye: kapı 7-8 ----
      tezgah(on, t) {
        g.fillStyle = '#8a5a34'; g.fillRect(-24, -20, 48, 6); g.fillStyle = '#6b4226'; g.fillRect(-22, -14, 4, 14); g.fillRect(18, -14, 4, 14);
        g.fillStyle = '#9aa0b0'; g.fillRect(-14, -26, 14, 6); g.fillStyle = '#c0703a'; g.fillRect(4, -24, 14, 4);
        g.save(); g.translate(10, -30); g.rotate(on ? Math.sin(t / 300) * 0.3 : 0); g.fillStyle = '#7a4e28'; g.fillRect(-1.5, -10, 3, 12); g.fillStyle = '#5a5f74'; g.fillRect(-5, -13, 10, 5); g.restore();
      },
      mengene(on, t) {
        g.fillStyle = '#5a6a8a'; g.fillRect(-16, -14, 12, 14); g.fillRect(4, -14, 12, 14); g.fillStyle = '#7a8aaa'; g.fillRect(-16, -18, 32, 5);
        const k = on ? Math.sin(t / 500) * 3 : 0; g.fillStyle = '#c0703a'; g.fillRect(-4 + k, -26, 8 - k * 2 + 0, 8);
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(16, -10); g.lineTo(28, -10); g.stroke(); g.fillStyle = '#9aa0b0'; g.beginPath(); g.arc(28, -10, 3, 0, TAU); g.fill();
      },
      talas() {
        g.fillStyle = '#d9a86a'; g.beginPath(); g.moveTo(-24, 0); g.quadraticCurveTo(-6, -24, 2, -22); g.quadraticCurveTo(14, -18, 24, 0); g.fill();
        g.strokeStyle = '#b8824a'; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-12 + i * 5, -8 - (i % 3) * 3, 3, 0.5, 2.6); g.stroke(); }
        g.fillStyle = '#8a5a34'; g.save(); g.translate(14, -14); g.rotate(-0.6); g.fillRect(-2, -14, 4, 18); g.fillStyle = '#9aa0b0'; g.fillRect(-7, -18, 14, 5); g.restore();
      },
      pano(on, t) {
        g.fillStyle = '#7a4e28'; g.fillRect(-22, -44, 44, 40); g.fillStyle = '#5a3a20'; g.fillRect(-20, -42, 40, 36);
        g.fillStyle = '#9aa0b0'; g.fillRect(-16, -38, 3, 16); g.fillRect(-18, -40, 7, 4);
        g.strokeStyle = '#c0703a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-4, -38); g.lineTo(-4, -20); g.stroke(); g.fillStyle = '#9aa0b0'; g.fillRect(-8, -40, 8, 4);
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 2; g.beginPath(); g.arc(10, -30, 6, 0.6, TAU - 0.6); g.stroke(); g.beginPath(); g.moveTo(14, -24); g.lineTo(16, -14); g.stroke();
        g.fillStyle = '#5a3a20'; g.fillRect(-2, -4, 4, 4);
      },
      rende(on, t) {
        g.fillStyle = '#8a5a34'; g.fillRect(-24, -14, 48, 5); g.fillStyle = '#6b4226'; g.fillRect(-20, -9, 4, 9); g.fillRect(16, -9, 4, 9);
        const x = on ? Math.sin(t / 400) * 10 : 0; g.fillStyle = '#c0703a'; g.fillRect(-10 + x, -22, 20, 8); g.fillStyle = '#7a4e28'; g.beginPath(); g.arc(-4 + x, -24, 3, Math.PI, 0); g.fill();
        if (on) { g.strokeStyle = '#e8c08a'; g.lineWidth = 1.4; g.beginPath(); g.arc(12 + x, -24, 4, 0.5, 4); g.stroke(); }
      },
      tutkal(on, t) { cauldron('#e8d29a', 'rgba(240,230,200,A)', on, t); },
      civi() {
        g.fillStyle = '#8a5a34'; g.fillRect(-18, -14, 36, 14); g.fillStyle = '#6b4226'; g.fillRect(-18, -14, 36, 3);
        g.strokeStyle = '#b8bec8'; g.lineWidth = 1.6; for (let i = 0; i < 8; i++) { const x = -14 + i * 4; g.beginPath(); g.moveTo(x, -14); g.lineTo(x + (i % 2 ? 2 : -2), -24 - (i % 3) * 2); g.stroke(); g.fillStyle = '#d0d6e0'; g.beginPath(); g.arc(x + (i % 2 ? 2 : -2), -24 - (i % 3) * 2, 1.6, 0, TAU); g.fill(); }
      },
      aski(on, t) {
        g.fillStyle = '#6b4226'; g.fillRect(-22, -42, 44, 4); g.fillRect(-22, -42, 3, 42); g.fillRect(19, -42, 3, 42);
        const sw = on ? Math.sin(t / 700) * 0.08 : 0; g.save(); g.translate(0, -38); g.rotate(sw);
        g.strokeStyle = '#4cc9f0'; g.lineWidth = 2.4; g.beginPath(); g.arc(-9, 22, 8, 0, TAU); g.arc(9, 22, 8, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(-9, 22); g.lineTo(0, 12); g.lineTo(9, 22); g.moveTo(0, 12); g.lineTo(0, 2); g.stroke(); g.restore();
      },
      disli(on, t) { gear(0, -22, 16, 10, on ? -t / 600 : 0, '#c0882a'); gear(14, -8, 9, 7, on ? t / 340 : 0, '#9aa0b0'); },
      kasnak(on, t) {
        for (const [x, r] of [[-12, 10], [12, 7]]) { g.save(); g.translate(x, -24); g.rotate(on ? t / 400 * (x < 0 ? 1 : 1.4) : 0); g.fillStyle = '#7a8aaa'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.fillStyle = '#4a5068'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.fillStyle = '#9aa0b0'; g.fillRect(-1, -r, 2, r); g.restore(); }
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-12, -34); g.lineTo(12, -31); g.moveTo(-12, -14); g.lineTo(12, -17); g.stroke();
        g.fillStyle = '#5a5f74'; g.fillRect(-2, -14, 4, 14);
      },
      torna(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-24, -16, 48, 8); g.fillStyle = '#3a3f54'; g.fillRect(-20, -8, 6, 8); g.fillRect(14, -8, 6, 8);
        g.fillStyle = '#5a6a8a'; g.fillRect(-24, -28, 10, 12); g.fillRect(16, -26, 8, 10);
        g.save(); g.translate(0, -22); g.scale(1, 0.4 + (on ? Math.abs(Math.sin(t / 60)) * 0.2 : 0)); g.fillStyle = '#d9a86a'; g.fillRect(-14, -6, 30, 12); g.restore();
        if (on) { g.fillStyle = '#e8c08a'; g.beginPath(); g.arc(6, -14, 1.4, 0, TAU); g.arc(9, -12, 1.2, 0, TAU); g.fill(); }
      },
      firca(on, t) {
        g.fillStyle = '#7a4e28'; g.fillRect(-16, -10, 32, 8);
        g.strokeStyle = '#c99a6a'; g.lineWidth = 1.4; for (let i = 0; i < 12; i++) { const x = -14 + i * 2.6; g.beginPath(); g.moveTo(x, -10); g.lineTo(x + Math.sin(i) * 2, -22 - (i % 3) * 2); g.stroke(); }
        g.fillStyle = '#5a3a20'; g.fillRect(-4, -2, 8, 2);
      },
      boya() {
        for (const [x, c] of [[-14, '#ff6b6b'], [0, '#4cc9f0'], [14, '#ffc94a']]) { g.fillStyle = '#9aa0b0'; g.beginPath(); g.moveTo(x - 7, -18); g.lineTo(x + 7, -18); g.lineTo(x + 6, 0); g.lineTo(x - 6, 0); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(x, -18, 7, 2.6, 0, 0, TAU); g.fill(); g.fillRect(x - 6.5, -18, 3, 8); }
      },
      testere(on, t) {
        g.fillStyle = '#6b4226'; g.fillRect(-22, -10, 44, 10);
        g.save(); g.translate(0, -16); g.rotate(on ? t / 120 : 0); g.fillStyle = '#c8ced8'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 11 : 13; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = '#5a5f74'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.restore();
      },
      rampa() {
        g.fillStyle = '#7a4e28'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(18, -24); g.lineTo(26, -24); g.lineTo(26, 0); g.closePath(); g.fill();
        g.strokeStyle = '#5a3a20'; g.lineWidth = 1.4; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-20 + i * 9, -3 - i * 4.6); g.lineTo(-20 + i * 9, 0); g.stroke(); }
        g.fillStyle = '#ffc94a'; g.fillRect(18, -32, 8, 8); g.fillStyle = INK; g.font = '900 7px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 22, -28);
      },
      yukleme(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-24, -40, 48, 40); g.fillStyle = '#ffc94a'; for (let i = 0; i < 6; i++) g.fillRect(-24 + i * 8, -40, 4, 4);
        const up = on ? 6 + Math.sin(t / 900) * 4 : 0; g.fillStyle = '#7a8aaa'; g.fillRect(-18, -32 + up, 36, 32 - up); g.strokeStyle = '#5a6a8a'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-18, -28 + up + i * 5); g.lineTo(18, -28 + up + i * 5); g.stroke(); }
        g.fillStyle = '#8a5a34'; g.fillRect(-8, -10, 16, 10);
      },
      // ---- Saat Kulesi: kapı 9-10 ----
      merdiven() {
        for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#c99a3a' : '#e0b24a'; g.fillRect(-20 + i * 6, -6 - i * 8, 18, 6); }
        g.strokeStyle = '#8a6a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, -10); g.lineTo(10, -46); g.stroke();
      },
      kumsaati(on, t) {
        g.fillStyle = '#8a5a34'; g.fillRect(-12, -42, 24, 4); g.fillRect(-12, -4, 24, 4); g.fillRect(-11, -38, 2, 34); g.fillRect(9, -38, 2, 34);
        g.fillStyle = 'rgba(200,230,255,.35)'; g.beginPath(); g.moveTo(-8, -38); g.lineTo(8, -38); g.lineTo(1, -21); g.lineTo(8, -4); g.lineTo(-8, -4); g.lineTo(-1, -21); g.closePath(); g.fill();
        const f = on ? (t / 4000) % 1 : 0.5; g.fillStyle = '#e8c06a';
        g.beginPath(); g.moveTo(-8 + f * 7, -38 + f * 15); g.lineTo(8 - f * 7, -38 + f * 15); g.lineTo(1, -21); g.lineTo(-1, -21); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-8, -4); g.lineTo(8, -4); g.lineTo(8 - (1 - f) * 0, -4 - f * 12); g.lineTo(-8, -4 - f * 12); g.closePath(); g.fill();
        if (on) g.fillRect(-0.6, -21, 1.2, 17);
      },
      sarkac(on, t) {
        g.fillStyle = '#5a3a24'; g.fillRect(-14, -48, 28, 48); g.fillStyle = '#3a2416'; g.fillRect(-10, -26, 20, 24);
        g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(0, -38, 8, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -38); g.lineTo(0, -43); g.moveTo(0, -38); g.lineTo(4, -38); g.stroke();
        const a = on ? Math.sin(t / 500) * 0.4 : 0; g.save(); g.translate(0, -26); g.rotate(a); g.strokeStyle = '#c99a3a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16); g.stroke(); g.fillStyle = '#e0b24a'; g.beginPath(); g.arc(0, 18, 4, 0, TAU); g.fill(); g.restore();
      },
      kadran(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-20, -46, 40, 46); g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(0, -26, 15, 0, TAU); g.fill();
        g.strokeStyle = INK; g.lineWidth = 1.2; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.beginPath(); g.moveTo(Math.cos(a) * 12, -26 + Math.sin(a) * 12); g.lineTo(Math.cos(a) * 14, -26 + Math.sin(a) * 14); g.stroke(); }
        const m = on ? t / 1000 : 1; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -26); g.lineTo(Math.cos(m - Math.PI / 2) * 11, -26 + Math.sin(m - Math.PI / 2) * 11); g.moveTo(0, -26); g.lineTo(Math.cos(m / 12 - Math.PI / 2) * 7, -26 + Math.sin(m / 12 - Math.PI / 2) * 7); g.stroke();
        if (on) light(0, -26, 22, 'rgba(255,230,170,.45)');
      },
      can(on, t) {
        g.fillStyle = '#5a3a24'; g.fillRect(-20, -48, 4, 48); g.fillRect(16, -48, 4, 48); g.fillRect(-22, -50, 44, 5);
        const a = on ? Math.sin(t / 400) * 0.3 : 0; g.save(); g.translate(0, -45); g.rotate(a);
        g.fillStyle = '#e0b24a'; g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(-7, 18, -13, 24); g.lineTo(13, 24); g.quadraticCurveTo(7, 18, 6, 4); g.closePath(); g.fill(); g.fillStyle = '#8a6a2a'; g.beginPath(); g.arc(0, 25, 3, 0, TAU); g.fill(); g.restore();
      },
      guguk(on, t) {
        g.fillStyle = '#7a4e28'; g.beginPath(); g.moveTo(-16, 0); g.lineTo(-16, -30); g.lineTo(0, -44); g.lineTo(16, -30); g.lineTo(16, 0); g.closePath(); g.fill();
        g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(0, -16, 8, 0, TAU); g.fill(); g.fillStyle = '#3a2416'; g.fillRect(-4, -36, 8, 8);
        const out = on ? Math.max(0, Math.sin(t / 700)) * 8 : 0;
        if (out > 1) { g.fillStyle = '#4cc9f0'; g.beginPath(); g.arc(0, -32 + 0, 3.6, 0, TAU); g.fill(); g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(3, -32); g.lineTo(3 + out * 0.8, -31); g.lineTo(3, -30); g.fill(); }
      },
      yelkovan(on, t) {
        const a = on ? Math.sin(t / 1500) * 0.15 : 0; g.save(); g.translate(0, -22); g.rotate(-0.15 + a);
        g.fillStyle = '#2a2a34'; g.beginPath(); g.moveTo(-28, -3); g.lineTo(22, -3); g.lineTo(30, 0); g.lineTo(22, 3); g.lineTo(-28, 3); g.closePath(); g.fill(); g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(-28, 0, 5, 0, TAU); g.fill(); g.restore();
        g.fillStyle = '#5a5f74'; g.fillRect(-30, -20, 4, 20);
      },
      raf(on, t) {
        g.fillStyle = '#6b4226'; g.fillRect(-24, -30, 48, 3); g.fillRect(-24, -14, 48, 3); g.fillRect(-24, -30, 3, 30); g.fillRect(21, -30, 3, 30);
        for (const [x, y, r] of [[-12, -21, 6], [6, -22, 5], [-4, -6, 5], [12, -6, 4]]) { g.fillStyle = '#e0b24a'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(x, y, r - 1.6, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; const a = on ? t / (300 + r * 80) : 0; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); g.stroke(); }
      },
      zemberek(on, t) {
        const k = on ? 1 + Math.sin(t / 300) * 0.08 : 1; g.save(); g.translate(0, -22); g.scale(k, k);
        g.strokeStyle = '#c0c6d0'; g.lineWidth = 2.2; g.beginPath(); for (let a = 0; a < TAU * 3.2; a += 0.15) { const r = 2 + a * 1.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); g.restore();
        g.fillStyle = '#5a5f74'; g.fillRect(-2, -8, 4, 8);
      },
      disliduvar(on, t) {
        g.fillStyle = '#3a3f54'; g.fillRect(-24, -46, 48, 46);
        gear(-10, -32, 9, 8, on ? t / 500 : 0, '#c0882a'); gear(8, -22, 11, 9, on ? -t / 600 : 0, '#e0b24a'); gear(-8, -10, 7, 7, on ? -t / 400 : 0, '#9aa0b0');
      },
      mekanikkus(on, t) {
        g.fillStyle = '#5a3a24'; g.fillRect(-2, -20, 4, 20); g.fillRect(-12, -22, 24, 3);
        const fl = on ? Math.sin(t / 120) * 0.5 : 0; g.fillStyle = '#c99a3a';
        for (const s of [-1, 1]) { g.save(); g.translate(0, -32); g.rotate(s * (0.4 + fl)); g.beginPath(); g.ellipse(s * 10, 0, 10, 4, 0, 0, TAU); g.fill(); g.restore(); }
        g.fillStyle = '#e0b24a'; g.beginPath(); g.ellipse(0, -30, 7, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#9aa0b0'; g.beginPath(); g.arc(0, -30, 3, 0, TAU); g.fill();
        g.fillStyle = INK; g.beginPath(); g.arc(-2.4, -35, 1.2, 0, TAU); g.arc(2.4, -35, 1.2, 0, TAU); g.fill();
      },
      ray(on, t) {
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-26, -2); g.lineTo(26, -2); g.moveTo(-26, -8); g.lineTo(26, -8); g.stroke();
        g.fillStyle = '#6b4226'; for (let i = 0; i < 7; i++) g.fillRect(-24 + i * 8, -10, 3, 10);
        const x = on ? -16 + ((t / 120) % 32) : 0;
        g.fillStyle = '#e0b24a'; g.beginPath(); for (let a = 0; a < TAU * 2; a += 0.3) { const r = 1 + a * 0.9; g.lineTo(x + Math.cos(a) * r, -18 + Math.sin(a) * r); } g.fill(); g.fillStyle = '#a6d65a'; g.beginPath(); g.ellipse(x - 2, -11, 9, 3, 0, 0, TAU); g.fill();
      },
      cark(on, t) { gear(0, -26, 20, 14, on ? t / 900 : 0, '#e0b24a'); g.fillStyle = '#5a5f74'; g.fillRect(-2, -6, 4, 6); },
      kurma(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-14, -16, 28, 16);
        g.save(); g.translate(0, -26); g.rotate(on ? t / 500 : 0); g.fillStyle = '#c99a3a'; g.fillRect(-2, -2, 4, 14);
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 7, -4, 7, 4.5, 0, 0, TAU); g.fill(); g.fillStyle = '#3a3f54'; g.beginPath(); g.ellipse(s * 7, -4, 3, 2, 0, 0, TAU); g.fill(); g.fillStyle = '#c99a3a'; }
        g.restore();
      },
      istasyon(on, t) {
        g.fillStyle = '#7a4e28'; g.fillRect(-22, -30, 44, 30); g.fillStyle = '#a0522d'; g.beginPath(); g.moveTo(-26, -30); g.lineTo(0, -44); g.lineTo(26, -30); g.closePath(); g.fill();
        g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(0, -34, 5, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -34); g.lineTo(0, -37); g.moveTo(0, -34); g.lineTo(2.4, -34); g.stroke();
        g.fillStyle = on ? '#ffd27a' : '#5a5040'; g.fillRect(-14, -22, 8, 10); g.fillRect(6, -22, 8, 10); g.fillStyle = '#3a2416'; g.fillRect(-4, -18, 8, 18);
      },
      peron(on, t) {
        g.fillStyle = '#8a929c'; g.fillRect(-26, -6, 52, 6);
        g.fillStyle = '#3a3f54'; g.fillRect(-18, -24, 30, 16); g.fillStyle = '#2a2e40'; g.fillRect(8, -34, 8, 12); g.fillStyle = '#c0392b'; g.fillRect(-20, -12, 36, 4);
        g.fillStyle = INK; for (const x of [-12, 0, 10]) { g.beginPath(); g.arc(x, -6, 4, 0, TAU); g.fill(); }
        if (on) smoke(12, -38, t, 1.1);
      },
      // ---- Zindan: kapı 11-12 ----
      hucre(on, t) {
        g.fillStyle = '#4a4650'; g.fillRect(-22, -44, 44, 44); g.fillStyle = '#16141a'; g.fillRect(-14, -36, 28, 36);
        g.strokeStyle = '#7a7480'; g.lineWidth = 2.4; for (let x = -10; x <= 10; x += 5) { g.beginPath(); g.moveTo(x, -36); g.lineTo(x, 0); g.stroke(); }
        if (on) { g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(-3, -20, 1.4, 0, TAU); g.arc(3, -20, 1.4, 0, TAU); g.fill(); }
      },
      mesale(on, t) { g.fillStyle = '#4a4650'; g.fillRect(-20, -40, 40, 40); torch(-10, -26, t); torch(10, -26, t + 300); },
      zincir(on, t) {
        g.fillStyle = '#3a3640'; g.fillRect(-20, -50, 40, 5);
        const h = on ? 20 + Math.sin(t / 900) * 8 : 24; g.strokeStyle = '#9aa0b0'; g.lineWidth = 1.8;
        for (const x of [-10, 10]) for (let y = -45; y < -45 + h; y += 5) { g.beginPath(); g.ellipse(x, y + 2.5, 2, 3, 0, 0, TAU); g.stroke(); }
        g.fillStyle = '#6b4a2a'; g.fillRect(-14, -45 + h, 28, 6);
      },
      magara(on, t) {
        g.fillStyle = '#4a4650'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-22, -40, 0, -42); g.quadraticCurveTo(22, -40, 26, 0); g.fill();
        g.fillStyle = '#0e0c12'; g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(0, -30, 13, 0); g.fill();
        if (on) for (let i = 0; i < 2; i++) { const a = t / 400 + i * 3, x = Math.cos(a) * 14, y = -30 + Math.sin(a * 2) * 6, f = Math.sin(t / 60 + i) * 0.6; g.fillStyle = '#3a3048'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 7, y - 3 - f * 3); g.lineTo(x + s * 4, y + 2); g.fill(); } }
      },
      gizli(on, t) {
        g.fillStyle = '#5a5664'; g.fillRect(-22, -42, 44, 42); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2;
        for (let r2 = 0; r2 < 6; r2++) { g.beginPath(); g.moveTo(-22, -42 + r2 * 7); g.lineTo(22, -42 + r2 * 7); g.stroke(); }
        const o = on ? 4 + Math.sin(t / 800) * 3 : 0; g.fillStyle = '#0e0c12'; g.fillRect(-4, -28, 8 + o, 28);
        g.fillStyle = '#6a6674'; g.fillRect(-4 + o, -28, 14, 28); if (on) light(0, -14, 14, 'rgba(180,140,255,.5)');
      },
      madenrayi(on, t) { railCart(on, t, '#ffd34a'); },
      ejderhayuvasi(on, t) {
        g.fillStyle = '#c99a2a'; g.beginPath(); g.ellipse(0, -4, 24, 9, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#ffd34a'; for (const [x, y] of [[-12, -6], [-4, -10], [6, -8], [14, -5], [0, -4]]) { g.beginPath(); g.ellipse(x, y, 3, 1.6, 0, 0, TAU); g.fill(); }
        const blink = on && Math.sin(t / 900) > -0.8; if (blink) { g.fillStyle = '#ff6b3d'; g.beginPath(); g.ellipse(-6, -26, 3, 1.6, 0, 0, TAU); g.ellipse(6, -26, 3, 1.6, 0, 0, TAU); g.fill(); light(0, -26, 20, 'rgba(255,100,50,.6)'); }
      },
      fici() { barrel(-10, 0, 1); barrel(10, 0, 1); barrel(0, -22, 0.9); },
      anahtar(on, t) {
        g.strokeStyle = '#c99a3a'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, -30, 8, 0, TAU); g.stroke();
        for (let i = 0; i < 3; i++) { g.save(); g.translate(0, -30); g.rotate(-0.6 + i * 0.6 + (on ? Math.sin(t / 500 + i) * 0.1 : 0)); g.fillStyle = ['#e0b24a', '#9aa0b0', '#c0703a'][i]; g.fillRect(-1.4, 8, 2.8, 18); g.fillRect(-1.4, 22, 6, 2.6); g.beginPath(); g.arc(0, 8, 3.4, 0, TAU); g.fill(); g.restore(); }
      },
      kafes(on, t) {
        g.fillStyle = '#5a5664'; g.fillRect(-2, -50, 4, 6);
        const sw = on ? Math.sin(t / 900) * 0.08 : 0; g.save(); g.translate(0, -44); g.rotate(sw);
        g.strokeStyle = '#8a5a3a'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 4, 14, 5, 0, Math.PI, 0); for (let x = -12; x <= 12; x += 6) { g.moveTo(x, 4 - Math.sqrt(Math.max(0, 1 - (x / 14) ** 2)) * 5); g.lineTo(x, 34); } g.moveTo(-14, 34); g.lineTo(14, 34); g.stroke(); g.restore();
      },
      hazine(on, t) { g.save(); g.translate(0, -10); g.scale(1.3, 1.3); chest(on ? 0.6 + Math.sin(t / 700) * 0.1 : 0); g.restore(); if (on) light(0, -18, 26, 'rgba(255,210,90,.6)'); },
      altinkapi(on, t) {
        g.fillStyle = '#c99a2a'; g.beginPath(); g.moveTo(-16, 0); g.lineTo(-16, -30); g.quadraticCurveTo(0, -48, 16, -30); g.lineTo(16, 0); g.fill();
        g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-12, -28); g.quadraticCurveTo(0, -42, 12, -28); g.lineTo(12, 0); g.fill();
        g.fillStyle = '#8a6a1a'; g.fillRect(-0.8, -36, 1.6, 36); g.beginPath(); g.arc(-4, -16, 1.6, 0, TAU); g.arc(4, -16, 1.6, 0, TAU); g.fill();
        if (on) light(0, -20, 30, 'rgba(255,220,120,.5)');
      },
      // ---- Şehir: kapı 13-14 ----
      firin(on) { shop('#c0703a', on, () => { g.fillStyle = '#c98a4a'; g.beginPath(); g.ellipse(0, 2, 7, 3.6, 0, 0, TAU); g.fill(); }); },
      cicekci(on) { shop('#ff8fab', on, () => { for (let i = -1; i <= 1; i++) { g.fillStyle = ['#ff6b6b', '#ffc94a', '#b388ff'][i + 1]; g.beginPath(); g.arc(i * 5, -1, 2.6, 0, TAU); g.fill(); } }); },
      kitapci(on) { shop('#4895ef', on, () => { for (let i = 0; i < 5; i++) { g.fillStyle = ['#c0392b', '#2d7d4f', '#ffc94a', '#4895ef', '#b388ff'][i]; g.fillRect(-9 + i * 3.8, -4 + (i % 2), 3, 8); } }); },
      postane(on) { shop('#ffc94a', on, () => { g.fillStyle = '#fff5ea'; g.fillRect(-6, -3, 12, 8); g.strokeStyle = '#c0392b'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, -3); g.lineTo(0, 2); g.lineTo(6, -3); g.stroke(); }); },
      vitrin(on) { shop('#2dd4bf', on, () => { g.fillStyle = '#ff6fb5'; g.beginPath(); g.moveTo(-4, 5); g.lineTo(-6, -4); g.lineTo(6, -4); g.lineTo(4, 5); g.fill(); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(0, -5, 2.4, 0, TAU); g.fill(); }); },
      sinema(on, t) { shop('#c0392b', on, () => { g.fillStyle = '#16141a'; g.fillRect(-8, -4, 16, 9); if (on) { g.fillStyle = `rgba(160,220,255,${0.5 + 0.4 * Math.sin(t / 150)})`; g.fillRect(-7, -3, 14, 7); } }); },
      garaj(on) { shop('#9aa0b0', on, () => { g.fillStyle = '#4cc9f0'; g.fillRect(-8, -1, 16, 5); g.fillRect(-5, -4, 9, 4); g.fillStyle = INK; g.beginPath(); g.arc(-5, 4, 2, 0, TAU); g.arc(5, 4, 2, 0, TAU); g.fill(); }); },
      tramvay(on, t) {
        g.strokeStyle = '#3a3640'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-26, -46); g.lineTo(26, -46); g.stroke();
        const x = on ? Math.sin(t / 1600) * 6 : 0; g.save(); g.translate(x, 0);
        g.strokeStyle = '#3a3640'; g.beginPath(); g.moveTo(0, -34); g.lineTo(6, -46); g.stroke();
        g.fillStyle = '#c0392b'; rr(-20, -34, 40, 28, 5); g.fill(); g.fillStyle = '#fff5ea'; g.fillRect(-20, -14, 40, 4);
        g.fillStyle = on ? '#ffd98a' : '#4a4050'; for (let i = 0; i < 4; i++) g.fillRect(-17 + i * 9, -30, 7, 9);
        g.fillStyle = INK; g.beginPath(); g.arc(-11, -4, 4, 0, TAU); g.arc(11, -4, 4, 0, TAU); g.fill(); g.restore();
      },
      bank() {
        g.fillStyle = '#6b4a2a'; for (let i = 0; i < 3; i++) g.fillRect(-20, -16 + i * 5, 40, 3);
        g.fillStyle = '#2a2630'; g.fillRect(-18, -16, 3, 16); g.fillRect(15, -16, 3, 16); g.fillRect(-18, -7, 36, 2);
      },
      cati(on, t) {
        g.fillStyle = '#5a3040'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(0, -34); g.lineTo(26, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(-26 + i * 5, -i * 6.8 + 0); g.lineTo(26 - i * 5, -i * 6.8); g.stroke(); }
        g.fillStyle = on ? '#ffd98a' : '#4a4050'; g.beginPath(); g.arc(0, -14, 6, 0, TAU); g.fill(); g.strokeStyle = '#3a2430'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-6, -14); g.lineTo(6, -14); g.moveTo(0, -20); g.lineTo(0, -8); g.stroke();
        if (on) light(0, -14, 16, 'rgba(255,210,130,.6)');
      },
      baca(on, t) {
        DECOR_ART.house({ x: 0, y: 0, s: 0.9, c: '#7a4a5a', ph: 0.15 });
        g.fillStyle = '#5a3040'; g.fillRect(8, -50, 7, 14);
        if (on) smoke(12, -54, t);
      },
      guvercin(on, t) {
        g.fillStyle = '#e8e0d0'; g.fillRect(-10, -40, 20, 40); g.fillStyle = '#a0522d'; g.beginPath(); g.moveTo(-14, -40); g.lineTo(0, -52); g.lineTo(14, -40); g.closePath(); g.fill();
        g.fillStyle = '#2a2230'; for (const [x, y] of [[-5, -32], [5, -32], [-5, -22], [5, -22]]) { g.beginPath(); g.arc(x, y, 2.4, Math.PI, 0); g.fill(); g.fillRect(x - 2.4, y, 4.8, 3); }
        if (on) { const a = t / 500; g.fillStyle = '#c8ced8'; for (let i = 0; i < 2; i++) { const x = Math.cos(a + i * 3) * 20, y = -46 + Math.sin(a * 2 + i) * 6, f = Math.sin(t / 80 + i) * 4; g.beginPath(); g.moveTo(x - 6, y - f); g.lineTo(x, y); g.lineTo(x + 6, y - f); g.lineTo(x, y + 2); g.fill(); } }
      },
      pazar(on, t) { DECOR_ART.stall({ x: 0, y: -14, c: '#4cc9f0' }, t); },
      benzin(on) {
        g.fillStyle = '#c0392b'; rr(-10, -32, 20, 32, 3); g.fill(); g.fillStyle = on ? '#ffd98a' : '#4a4050'; g.fillRect(-6, -27, 12, 8);
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -18); g.quadraticCurveTo(22, -16, 18, -2); g.stroke(); g.fillStyle = '#9aa0b0'; g.fillRect(15, -4, 6, 4);
      },
      otoyol(on, t) {
        g.fillStyle = '#6a7380'; g.fillRect(-26, -26, 52, 8); g.fillRect(-22, -18, 6, 18); g.fillRect(16, -18, 6, 18);
        g.fillStyle = '#ffc94a'; for (let x = -22; x < 26; x += 10) g.fillRect(x, -23, 5, 1.6);
        if (on) { const x = -26 + ((t / 20) % 52); g.fillStyle = '#4cc9f0'; g.fillRect(x, -32, 10, 6); light(x + 10, -29, 8, 'rgba(255,240,180,.8)'); }
      },
      // ---- Fabrika: kapı 15-16 ----
      tasiyici(on, t) {
        g.fillStyle = '#3a3f54'; g.fillRect(-24, -14, 48, 8); g.fillStyle = INK; g.beginPath(); g.arc(-24, -10, 4, 0, TAU); g.arc(24, -10, 4, 0, TAU); g.fill();
        g.fillStyle = '#5a5f74'; g.fillRect(-20, -6, 4, 6); g.fillRect(16, -6, 4, 6);
        const o = on ? (t / 40) % 16 : 0; for (let x = -22 + o; x < 22; x += 16) { g.fillStyle = '#c0703a'; g.fillRect(x, -22, 10, 8); }
      },
      kaynak(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-22, -16, 44, 5); g.fillRect(-18, -11, 4, 11); g.fillRect(14, -11, 4, 11); g.fillStyle = '#7a8aaa'; g.fillRect(-8, -22, 18, 6);
        if (on) { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + Math.sin(t / 90 + i * 2) * 1.2, d = 6 + ((t / 30 + i * 9) % 12); g.fillStyle = i % 2 ? '#ffd34a' : '#fff'; g.fillRect(2 + Math.cos(a) * d, -22 + Math.sin(a) * d, 2, 2); } light(2, -22, 18, 'rgba(160,220,255,.9)'); }
      },
      vinc(on, t) {
        lattice(-14, 0, 8, 46, '#e0b02a'); g.fillStyle = '#e0b02a'; g.fillRect(-20, -48, 46, 4);
        const h = on ? 18 + Math.sin(t / 800) * 6 : 18; g.strokeStyle = '#9aa0b0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(18, -44); g.lineTo(18, -44 + h); g.stroke();
        g.fillStyle = '#c0703a'; g.fillRect(12, -44 + h, 12, 9);
      },
      robotkovan(on, t) {
        g.fillStyle = '#9aa0b0'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; g.lineTo(Math.cos(a) * 16, -20 + Math.sin(a) * 16); } g.closePath(); g.fill();
        g.fillStyle = '#e0b02a'; g.beginPath(); g.arc(0, -20, 6, 0, TAU); g.fill(); g.fillStyle = on ? '#4cc9f0' : '#3a3f54'; g.beginPath(); g.arc(-3, -21, 1.6, 0, TAU); g.arc(3, -21, 1.6, 0, TAU); g.fill();
        if (on) { const a = t / 250; g.fillStyle = '#ffd34a'; g.beginPath(); g.ellipse(Math.cos(a) * 22, -26 + Math.sin(a * 1.5) * 6, 2.4, 1.6, 0, 0, TAU); g.fill(); }
      },
      pres(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-18, -46, 6, 46); g.fillRect(12, -46, 6, 46); g.fillRect(-20, -48, 40, 6); g.fillRect(-14, -6, 28, 6);
        const d = on ? Math.max(0, Math.sin(t / 350)) * 14 : 0; g.fillStyle = '#7a8aaa'; g.fillRect(-10, -42 + d, 20, 10); g.fillStyle = '#c0703a'; g.fillRect(-8, -10, 16, 4);
      },
      civata() {
        g.fillStyle = '#4a5068'; g.beginPath(); g.moveTo(-18, -18); g.lineTo(18, -18); g.lineTo(14, 0); g.lineTo(-14, 0); g.closePath(); g.fill();
        for (const [x, y] of [[-10, -20], [-2, -23], [7, -20], [12, -24], [2, -27]]) { g.fillStyle = '#c8ced8'; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(x + Math.cos(i * TAU / 6) * 3.4, y + Math.sin(i * TAU / 6) * 3.4); g.fill(); g.fillStyle = '#5a5f74'; g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill(); }
      },
      kontrol(on, t) {
        g.fillStyle = '#3a3f54'; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-20, -20); g.lineTo(20, -20); g.lineTo(24, 0); g.closePath(); g.fill();
        for (const x of [-12, 12]) { g.fillStyle = INK; g.fillRect(x - 9, -42, 18, 16); g.fillStyle = on ? '#2dd4bf' : '#2a3a40'; g.fillRect(x - 7, -40, 14, 12); if (on) { g.strokeStyle = '#d0fff6'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 14; i++) g.lineTo(x - 7 + i, -34 + Math.sin(t / 150 + i * 0.8 + x) * 3); g.stroke(); } }
        gauge(0, -12, 5, t); for (const [x, c] of [[-14, '#ff6b6b'], [14, '#5cc27f']]) { g.fillStyle = c; g.beginPath(); g.arc(x, -12, 2.6, 0, TAU); g.fill(); }
      },
      robotkol(on, t) {
        g.fillStyle = '#4a5068'; g.fillRect(-12, -8, 24, 8);
        const a1 = -1.2 + (on ? Math.sin(t / 700) * 0.4 : 0), a2 = 0.9 + (on ? Math.sin(t / 500) * 0.5 : 0);
        g.save(); g.translate(0, -8); g.rotate(a1); g.fillStyle = '#e0b02a'; g.fillRect(-3, -3, 24, 6); g.translate(22, 0); g.fillStyle = '#5a5f74'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.rotate(a2); g.fillStyle = '#e0b02a'; g.fillRect(-2.4, -2.4, 18, 5); g.fillStyle = '#9aa0b0'; g.fillRect(16, -5, 3, 10); g.restore();
      },
      kazan(on, t) {
        g.fillStyle = '#7a4a2a'; rr(-18, -34, 36, 34, 10); g.fill(); g.fillStyle = '#9a6a3a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-12 + i * 8, -28, 1.4, 0, TAU); g.arc(-12 + i * 8, -6, 1.4, 0, TAU); g.fill(); }
        gauge(0, -18, 7, t); g.fillStyle = '#5a5f74'; g.fillRect(10, -44, 5, 12); if (on) smoke(12, -46, t, 0.8);
      },
      manometre(on, t) { g.fillStyle = '#5a5f74'; g.fillRect(-2, -20, 4, 20); gauge(0, -30, 13, t); },
      boru(on, t) { DECOR_ART.pipe({ x: -2, y: -6 }); DECOR_ART.pipe({ x: 10, y: -20 }); if (on) smoke(26, -48, t, 0.7); },
      depo(on, t) {
        lattice(0, 0, 26, 18, '#5a5f74'); g.fillStyle = '#4a7aa0'; rr(-18, -44, 36, 26, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-14, -40, 6, 18);
        g.fillStyle = 'rgba(160,220,255,.6)'; const h = on ? 10 + Math.sin(t / 900) * 3 : 10; g.fillRect(10, -44 + 26 - h, 4, h);
      },
      bacafabrika(on, t) {
        g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-5, -46); g.lineTo(5, -46); g.lineTo(8, 0); g.fill();
        g.fillStyle = '#e8e0d0'; g.fillRect(-6, -38, 12, 3); g.fillRect(-6.5, -28, 13, 3); if (on) smoke(0, -50, t, 1.3);
      },
      komur(on, t) { railCart(on, t, '#2a2a30'); },
      tersane(on, t) {
        lattice(-20, 0, 6, 40, '#5a5f74'); lattice(20, 0, 6, 40, '#5a5f74'); g.fillStyle = '#5a5f74'; g.fillRect(-23, -42, 46, 3);
        g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(-16, -22); g.lineTo(16, -22); g.lineTo(11, -8); g.lineTo(-11, -8); g.closePath(); g.fill(); g.fillStyle = '#e8e0d0'; g.fillRect(-6, -30, 12, 8);
        if (on) light(0, -16, 12, 'rgba(160,220,255,.7)');
      },
      rihtim(on, t) {
        g.fillStyle = '#2f6fa0'; g.fillRect(-26, -6, 52, 6); g.fillStyle = '#6a7380'; g.fillRect(-26, -8, 18, 8); g.fillStyle = INK; g.beginPath(); g.arc(-17, -10, 3, 0, TAU); g.fill();
        const b = on ? Math.sin(t / 700) * 1.5 : 0; g.fillStyle = '#3a4a6a'; g.beginPath(); g.moveTo(-4, -10 + b); g.lineTo(26, -10 + b); g.lineTo(22, -2 + b); g.lineTo(0, -2 + b); g.closePath(); g.fill();
        g.fillStyle = '#e8e0d0'; g.fillRect(8, -20 + b, 10, 10); g.fillStyle = '#c0392b'; g.fillRect(12, -26 + b, 3, 6);
      },
      // ---- Uzay: kapı 17-18 ----
      firlatma(on, t, state) { lattice(-16, 0, 8, 50, '#9aa0b0'); g.save(); g.translate(6, 0); STATION_ART.rocket(on, t, state); g.restore(); },
      uydu(on, t) {
        g.save(); g.translate(0, -26); g.rotate(on ? Math.sin(t / 1500) * 0.2 : 0);
        g.fillStyle = '#c8ced8'; g.fillRect(-6, -6, 12, 12); g.fillStyle = '#2a4a8a'; for (const s of [-1, 1]) { g.fillRect(s * 8 - (s < 0 ? 16 : 0), -4, 16, 8); g.strokeStyle = '#8ab0ff'; g.lineWidth = 0.6; g.strokeRect(s * 8 - (s < 0 ? 16 : 0), -4, 16, 8); }
        g.strokeStyle = '#c8ced8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, -12); g.stroke(); if (on) light(0, -13, 6, 'rgba(255,100,100,.9)');
        g.restore();
      },
      goktasi(on, t) {
        g.save(); g.translate(0, -18 + (on ? Math.sin(t / 900) * 2 : 0)); g.rotate(on ? t / 4000 : 0);
        g.fillStyle = '#6a6070'; g.beginPath(); g.moveTo(-16, 2); g.lineTo(-10, -12); g.lineTo(6, -14); g.lineTo(16, -2); g.lineTo(8, 12); g.lineTo(-10, 10); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(-4, -2, 4, 0, TAU); g.arc(7, 4, 2.6, 0, TAU); g.fill(); g.restore();
      },
      ayussu(on, t) {
        g.fillStyle = '#9aa0b0'; g.beginPath(); g.ellipse(0, -2, 24, 6, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(160,220,255,.55)'; g.beginPath(); g.arc(-4, -4, 14, Math.PI, 0); g.fill(); g.strokeStyle = '#c8ced8'; g.lineWidth = 1; for (const a of [0.6, 1.2, 1.9, 2.5]) { g.beginPath(); g.moveTo(-4, -4); g.lineTo(-4 + Math.cos(Math.PI + a) * 14, -4 + Math.sin(Math.PI + a) * 14); g.stroke(); }
        g.strokeStyle = '#c8ced8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(16, -4); g.lineTo(16, -26); g.stroke(); if (on) light(16, -27, 7, 'rgba(255,220,120,.9)');
      },
      kuyruklu(on, t) {
        const x = on ? Math.sin(t / 2000) * 4 : 0;
        add(() => { const gr = g.createLinearGradient(x + 10, -34, x - 26, -12); gr.addColorStop(0, 'rgba(180,230,255,.9)'); gr.addColorStop(1, 'rgba(180,230,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x + 10, -38); g.lineTo(x - 26, -12); g.lineTo(x + 10, -30); g.closePath(); g.fill(); glow(x + 10, -34, 10, 'rgba(230,250,255,1)'); });
      },
      uzaybahce(on, t) {
        g.fillStyle = '#9aa0b0'; g.fillRect(-20, -6, 40, 6);
        for (const [x, h, c] of [[-10, 16, '#5cc27f'], [0, 22, '#2dd4bf'], [10, 14, '#b388ff']]) { g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(x, -6); g.quadraticCurveTo(x + Math.sin(t / 800 + x) * 3, -6 - h / 2, x, -6 - h); g.stroke(); g.fillStyle = c; g.beginPath(); g.arc(x, -6 - h, 3, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(160,220,255,.25)'; g.beginPath(); g.arc(0, -6, 20, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(200,240,255,.6)'; g.lineWidth = 1.2; g.stroke();
      },
      yercekimsiz(on, t) {
        g.fillStyle = '#3a3f54'; rr(-22, -40, 44, 40, 8); g.fill(); g.fillStyle = '#1a1e2e'; rr(-18, -36, 36, 32, 6); g.fill();
        for (const [i, c] of [[0, '#ffc94a'], [1, '#ff6b6b'], [2, '#4cc9f0']]) { const a = t / 1200 + i * 2.1; g.fillStyle = c; g.beginPath(); g.arc(Math.cos(a) * 9, -20 + Math.sin(a * 1.3) * 8, 3, 0, TAU); g.fill(); }
      },
      hangar(on, t, state) {
        g.fillStyle = '#4a5068'; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-24, -26); g.quadraticCurveTo(0, -48, 24, -26); g.lineTo(24, 0); g.fill();
        g.fillStyle = '#1a1e2e'; g.fillRect(-14, -28, 28, 28); g.save(); g.translate(0, -2); g.scale(0.6, 0.6); STATION_ART.rocket(on, t, 'cur'); g.restore();
      },
      'satürn'(on, t) { planet(0, -24, 13, '#f2d08a', '#b8823a', '#e8c890'); },
      karadelik(on, t) {
        g.save(); g.translate(0, -24); g.rotate(on ? -t / 900 : 0);
        for (let i = 0; i < 3; i++) { g.strokeStyle = ['rgba(255,170,90,.8)', 'rgba(200,120,255,.6)', 'rgba(120,180,255,.4)'][i]; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, 0, 18 - i * 3, 7 - i, i * 0.6, 0, TAU); g.stroke(); }
        g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.restore();
      },
      toz(on, t) { add(() => { for (let i = 0; i < 9; i++) { const a = i * 0.7 + t / 3000, d = 6 + i * 2; g.fillStyle = `rgba(255,${200 + i * 5},150,${0.4 + 0.5 * Math.abs(Math.sin(t / 400 + i))})`; star(Math.cos(a) * d, -22 + Math.sin(a) * d * 0.6, 2.4); } }); },
      bulutsu(on, t) { add(() => { glow(-6, -24, 22, 'rgba(255,90,180,.55)'); glow(8, -20, 18, 'rgba(90,140,255,.55)'); glow(0, -30, 12, 'rgba(255,230,150,.6)'); }); },
      istasyonuzay(on, t) {
        g.save(); g.translate(0, -24); g.rotate(on ? t / 6000 : 0);
        g.strokeStyle = '#c8ced8'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke(); g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i * TAU / 4) * 16, Math.sin(i * TAU / 4) * 16); g.stroke(); }
        g.fillStyle = '#9aa0b0'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.restore();
        if (on) light(0, -24, 22, 'rgba(160,220,255,.35)');
      },
      hubble(on, t) { STATION_ART.uydu(on, t); g.fillStyle = '#c8ced8'; g.fillRect(-4, -38, 8, 8); g.fillStyle = INK; g.beginPath(); g.arc(0, -38, 3, 0, TAU); g.fill(); },
      mars(on, t) { planet(0, -24, 14, '#ff9a6a', '#a8402a'); g.fillStyle = 'rgba(120,40,20,.4)'; g.beginPath(); g.arc(-4, -26, 3, 0, TAU); g.arc(5, -20, 2, 0, TAU); g.fill(); },
      dunya(on, t) {
        planet(0, -24, 15, '#6ac0ff', '#1a5aa0');
        g.save(); g.beginPath(); g.arc(0, -24, 15, 0, TAU); g.clip(); const o = on ? (t / 120) % 40 : 0; g.fillStyle = '#4caf50'; for (const x of [-20, 20]) { g.beginPath(); g.ellipse(x - o, -28, 7, 5, 0.4, 0, TAU); g.ellipse(x - o + 8, -18, 5, 4, 0, 0, TAU); g.fill(); } g.restore();
      },
      // ---- Büyük Usta: kapı 19-20 ----
      sutun() {
        for (const x of [-12, 12]) { g.fillStyle = '#d8d0c0'; g.fillRect(x - 5, -40, 10, 40); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 1, -40, 2, 40); g.fillStyle = '#c99a3a'; g.fillRect(x - 7, -44, 14, 4); g.fillRect(x - 7, -2, 14, 2); }
        g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(-22, -44); g.lineTo(0, -54); g.lineTo(22, -44); g.closePath(); g.fill();
      },
      heykel(on, t) {
        g.fillStyle = '#8a8478'; g.fillRect(-10, -12, 20, 12); g.fillStyle = '#c8c0b0';
        g.beginPath(); g.arc(0, -36, 6, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-8, -12); g.lineTo(-6, -30); g.lineTo(6, -30); g.lineTo(8, -12); g.fill();
        g.strokeStyle = '#c8c0b0'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(5, -27); g.lineTo(13, -38); g.stroke();
        g.strokeStyle = GOLD; g.lineWidth = 1.8; g.beginPath(); g.arc(13, -42, 4, 0.7, TAU + 0.2); g.stroke();
      },
      kutuphane() {
        g.fillStyle = '#5a3a24'; g.fillRect(-22, -46, 44, 46);
        for (let r2 = 0; r2 < 3; r2++) for (let i = 0; i < 7; i++) { g.fillStyle = ['#c0392b', '#2d7d4f', '#ffc94a', '#4895ef', '#b388ff'][(i + r2) % 5]; g.fillRect(-19 + i * 5.4, -42 + r2 * 14, 4, 11 - (i % 3)); }
      },
      ayna(on, t) {
        g.fillStyle = '#c99a3a'; rr(-12, -46, 24, 44, 12); g.fill();
        const gr = g.createLinearGradient(-9, -42, 9, -6); gr.addColorStop(0, '#d8f0ff'); gr.addColorStop(1, '#6a8ab0'); g.fillStyle = gr; rr(-9, -43, 18, 38, 9); g.fill();
        if (on) { g.fillStyle = 'rgba(255,255,255,.6)'; const y = -40 + ((t / 30) % 40); g.beginPath(); g.moveTo(-9, y); g.lineTo(9, y - 8); g.lineTo(9, y - 4); g.lineTo(-9, y + 4); g.fill(); }
      },
      taht(on, t) {
        g.fillStyle = '#7a1f3a'; rr(-14, -46, 28, 34, 6); g.fill(); g.fillStyle = '#c99a3a'; g.fillRect(-16, -14, 32, 6); g.fillRect(-14, -8, 4, 8); g.fillRect(10, -8, 4, 8);
        g.fillStyle = GOLD; for (const x of [-10, 0, 10]) { g.beginPath(); g.moveTo(x - 3, -46); g.lineTo(x, -54); g.lineTo(x + 3, -46); g.fill(); }
        if (on) light(0, -34, 26, 'rgba(255,210,120,.45)');
      },
      kivilcim(on, t) {
        g.fillStyle = '#3a3f54'; rr(-18, -40, 36, 40, 6); g.fill(); g.fillStyle = '#1a1e2e'; rr(-14, -36, 28, 30, 4); g.fill();
        if (on) add(() => { for (let i = 0; i < 5; i++) { const a = t / 300 + i * 1.3, r2 = 4 + (i % 3) * 3; g.fillStyle = ['#ffd34a', '#ff8a4c', '#4cc9f0'][i % 3]; star(Math.cos(a) * r2, -21 + Math.sin(a) * r2, 2.6); } glow(0, -21, 18, 'rgba(255,220,140,.8)'); });
      },
      asansor(on, t) { liftTower(on, t, '#e0b02a', false); },
      kol(on, t) {
        g.fillStyle = '#4a5068'; rr(-14, -12, 28, 12, 3); g.fill();
        const a = on ? -0.5 + Math.sin(t / 900) * 0.5 : -0.5; g.save(); g.translate(0, -10); g.rotate(a); g.strokeStyle = '#9aa0b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke(); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, -28, 5, 0, TAU); g.fill(); g.restore();
      },
      kalp(on, t) {
        gear(0, -26, 20, 14, on ? t / 1600 : 0, '#c99a3a');
        const k = on ? 1 + Math.max(0, Math.sin(t / 220)) * 0.18 : 1; g.save(); g.translate(0, -27); g.scale(k, k);
        g.fillStyle = '#ff4f6d'; g.beginPath(); g.moveTo(0, 7); g.bezierCurveTo(-12, -2, -6, -12, 0, -5); g.bezierCurveTo(6, -12, 12, -2, 0, 7); g.fill(); g.restore();
        if (on) light(0, -27, 26 * k, 'rgba(255,100,130,.6)');
      },
      // ---- Lunapark: kapı 21-23 ----
      gise(on) { shop('#ff6fb5', on, () => { g.fillStyle = '#ffc94a'; g.fillRect(-6, -3, 12, 7); g.fillStyle = '#c0392b'; g.fillRect(-1, -3, 1.4, 7); }); },
      pamuk(on, t) { standStall('#ff8fab', () => { g.fillStyle = '#ffc0dc'; for (const [x, y] of [[-3, -4], [3, -5], [0, -9]]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); } g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 8); g.stroke(); }, t); },
      muz(on, t) { standStall('#ffc94a', () => { g.strokeStyle = '#ffd34a'; g.lineWidth = 3.4; g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 4, -2, 6, 0.2, 2.2); g.stroke(); } }, t); },
      halkaatma(on, t) { standStall('#2dd4bf', () => { for (let i = -1; i <= 1; i++) { g.fillStyle = '#c8ced8'; g.fillRect(i * 8 - 1, -10, 2, 10); g.strokeStyle = ['#ff6b6b', '#ffc94a', '#4cc9f0'][i + 1]; g.lineWidth = 2; g.beginPath(); g.ellipse(i * 8, -3 - (i === 0 && on ? Math.abs(Math.sin(t / 300)) * 8 : 0), 5, 2, 0, 0, TAU); g.stroke(); } }, t); },
      trambolin(on, t) {
        const b = on ? Math.abs(Math.sin(t / 300)) : 0;
        g.fillStyle = '#3a3f54'; g.fillRect(-20, -8, 3, 8); g.fillRect(17, -8, 3, 8); g.fillStyle = '#4cc9f0'; g.beginPath(); g.ellipse(0, -9 + b * 2, 22, 5 - b * 2, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff8fab'; g.beginPath(); g.arc(0, -16 - b * 22, 5, 0, TAU); g.fill();
      },
      ip(on, t) {
        g.fillStyle = '#c0392b'; g.fillRect(-24, -44, 4, 44); g.fillRect(20, -44, 4, 44);
        g.strokeStyle = '#e8d29a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-22, -40); g.quadraticCurveTo(0, -36, 22, -40); g.stroke();
        const x = on ? Math.sin(t / 1300) * 14 : 0, w = on ? Math.sin(t / 250) * 0.15 : 0; g.save(); g.translate(x, -38); g.rotate(w);
        g.strokeStyle = '#c99a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-12, -6); g.lineTo(12, -6); g.stroke(); g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(0, -10, 4, 0, TAU); g.fill(); g.restore();
      },
      palyaco(on, t) {
        const b = on ? Math.abs(Math.sin(t / 200)) * 2 : 0; g.save(); g.translate(0, -b);
        g.fillStyle = '#ff6b6b'; rr(-16, -18, 32, 12, 5); g.fill(); g.fillStyle = '#ffc94a'; rr(-8, -26, 16, 9, 4); g.fill();
        g.fillStyle = INK; g.beginPath(); g.arc(-9, -5, 4, 0, TAU); g.arc(9, -5, 4, 0, TAU); g.fill(); g.restore();
        g.fillStyle = '#ff4f4f'; g.beginPath(); g.arc(0, -30 - b, 3, 0, TAU); g.fill();
      },
      carpisan(on, t) {
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 1; g.strokeRect(-24, -20, 48, 18);
        for (const [i, c] of [[0, '#4cc9f0'], [1, '#ff6fb5']]) { const x = on ? Math.cos(t / 700 + i * 2.6) * 12 : (i ? 8 : -8); g.fillStyle = c; rr(x - 7, -16, 14, 10, 4); g.fill(); g.strokeStyle = '#3a3f54'; g.beginPath(); g.moveTo(x, -16); g.lineTo(x, -30); g.stroke(); }
        g.strokeStyle = '#ffc94a'; g.beginPath(); g.moveTo(-24, -30); g.lineTo(24, -30); g.stroke();
      },
      kaydirak(on, t) {
        g.fillStyle = '#9aa0b0'; g.fillRect(16, -44, 4, 44); g.strokeStyle = '#4cc9f0'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(18, -42); g.bezierCurveTo(-10, -40, 20, -16, -22, -4); g.stroke();
        if (on) { const p2 = (t / 1100) % 1; g.fillStyle = 'rgba(220,245,255,.9)'; g.beginPath(); g.arc(18 - p2 * 40, -42 + p2 * 38, 2.4, 0, TAU); g.fill(); }
        g.fillStyle = '#5aa8e0'; g.beginPath(); g.ellipse(-20, -2, 10, 3, 0, 0, TAU); g.fill();
      },
      carouselSt(on, t) { DECOR_ART.carousel({ x: 0, y: -24 }, t); },
      muzikkutusu(on, t) {
        g.fillStyle = '#7a1f3a'; rr(-16, -18, 32, 18, 3); g.fill(); g.fillStyle = '#c99a3a'; g.fillRect(-16, -18, 32, 3);
        g.save(); g.translate(-16, -18); g.rotate(-0.7); g.fillStyle = '#9a2f4a'; g.fillRect(0, -2, 32, 3); g.restore();
        g.save(); g.translate(0, -22); g.rotate(on ? t / 600 : 0); g.fillStyle = '#ffc0dc'; g.beginPath(); g.ellipse(0, -4, 3, 6, 0, 0, TAU); g.fill(); g.restore();
        if (on) for (let i = 0; i < 2; i++) { const ph = (t / 1500 + i / 2) % 1; g.fillStyle = `rgba(255,230,160,${1 - ph})`; g.font = '900 10px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('♪', 10 + ph * 10, -26 - ph * 20); }
      },
      hiztreni(on, t) {
        g.strokeStyle = '#c0392b'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-26, -4); g.bezierCurveTo(-14, -60, 6, -60, 12, -20); g.quadraticCurveTo(18, -4, 26, -10); g.stroke();
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 1.4; for (const x of [-18, -6, 6, 18]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -30 + Math.abs(x) * 0.6); g.stroke(); }
        if (on) { const u = (t / 1600) % 1, x = -26 + u * 52; g.fillStyle = '#ffc94a'; rr(x - 5, -30 - Math.sin(u * Math.PI) * 14, 10, 6, 2); g.fill(); }
      },
      korku(on, t) {
        g.fillStyle = '#2a1e3a'; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-24, -26); g.quadraticCurveTo(0, -44, 24, -26); g.lineTo(24, 0); g.fill();
        g.fillStyle = '#0e0a16'; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(0, -30, 12, 0); g.fill();
        if (on) { const y = -30 + Math.sin(t / 500) * 4, a = 0.5 + 0.4 * Math.sin(t / 300); g.fillStyle = `rgba(230,240,255,${a})`; g.beginPath(); g.arc(14, y, 6, Math.PI, 0); g.lineTo(20, y + 8); g.lineTo(14, y + 5); g.lineTo(8, y + 8); g.closePath(); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(12, y - 1, 1, 0, TAU); g.arc(16, y - 1, 1, 0, TAU); g.fill(); }
      },
      fincan(on, t) {
        g.fillStyle = '#5a3a6a'; g.beginPath(); g.ellipse(0, -4, 24, 6, 0, 0, TAU); g.fill();
        for (let i = 0; i < 3; i++) { const a = (on ? t / 900 : 0) + i * TAU / 3, x = Math.cos(a) * 14, y = -8 + Math.sin(a) * 3; g.fillStyle = ['#ff8fab', '#4cc9f0', '#ffc94a'][i]; g.beginPath(); g.moveTo(x - 6, y - 8); g.lineTo(x + 6, y - 8); g.quadraticCurveTo(x + 6, y, x, y); g.quadraticCurveTo(x - 6, y, x - 6, y - 8); g.fill(); }
      },
      serbest(on, t) { liftTower(on, t, '#ff6b6b', true); },
      // ---- Santral: kapı 24-25 ----
      salter(on, t) {
        g.fillStyle = '#4a5068'; rr(-16, -42, 32, 42, 4); g.fill(); g.fillStyle = '#2a2e40'; rr(-12, -38, 24, 26, 3); g.fill();
        const up = on && Math.sin(t / 900) > 0; g.fillStyle = '#9aa0b0'; g.fillRect(-2, up ? -34 : -24, 4, 10); g.fillStyle = '#c0392b'; g.fillRect(-4, up ? -36 : -16, 8, 4);
        g.fillStyle = up ? '#5cc27f' : '#ff6b6b'; g.beginPath(); g.arc(0, -6, 3, 0, TAU); g.fill(); if (on) light(0, -6, 8, up ? 'rgba(90,220,120,.8)' : 'rgba(255,100,100,.8)');
      },
      trafo(on, t) {
        g.fillStyle = '#5a6a5a'; rr(-16, -30, 32, 30, 3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.4; for (let x = -12; x <= 12; x += 4) { g.beginPath(); g.moveTo(x, -26); g.lineTo(x, -4); g.stroke(); }
        g.fillStyle = '#c8ced8'; for (const x of [-8, 0, 8]) { g.fillRect(x - 2, -42, 4, 12); g.beginPath(); g.arc(x, -42, 3, 0, TAU); g.fill(); }
        if (on && Math.sin(t / 150) > 0.6) { g.strokeStyle = '#a0e8ff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-8, -44); g.lineTo(-3, -48); g.lineTo(0, -44); g.lineTo(4, -49); g.lineTo(8, -44); g.stroke(); light(0, -46, 12, 'rgba(160,230,255,.9)'); }
      },
      makara(on, t) {
        g.save(); g.translate(0, -16); g.rotate(on ? t / 1500 : 0); g.fillStyle = '#8a5a34'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill(); g.fillStyle = '#2a2a34'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
        g.strokeStyle = '#c0392b'; g.lineWidth = 2; for (let r2 = 4; r2 < 11; r2 += 2.4) { g.beginPath(); g.arc(0, 0, r2, 0, TAU); g.stroke(); } g.fillStyle = '#8a5a34'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.restore();
      },
      direk() {
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-3, -52); g.lineTo(3, -52); g.lineTo(12, 0);
        for (let k = 0; k < 4; k++) { const y1 = -k * 12, w1 = 12 - k * 2.2, y2 = y1 - 12, w2 = 12 - (k + 1) * 2.2; g.moveTo(-w1, y1); g.lineTo(w2, y2); g.moveTo(w1, y1); g.lineTo(-w2, y2); }
        g.moveTo(-18, -40); g.lineTo(18, -40); g.moveTo(-14, -30); g.lineTo(14, -30); g.stroke();
      },
      aku(on, t) {
        for (const x of [-11, 11]) { g.fillStyle = '#3a3f54'; rr(x - 9, -26, 18, 26, 3); g.fill(); g.fillStyle = '#9aa0b0'; g.fillRect(x - 5, -30, 4, 4); g.fillRect(x + 1, -30, 4, 4);
          const lvl = on ? 0.4 + 0.6 * ((t / 2500 + (x > 0 ? 0.5 : 0)) % 1) : 0.6; g.fillStyle = '#5cc27f'; g.fillRect(x - 6, -4 - 18 * lvl, 12, 18 * lvl); }
      },
      lamba(on, t) { shop('#ffc94a', on, () => { g.fillStyle = on ? '#fff2b0' : '#8a8070'; g.beginPath(); g.arc(0, -2, 5, 0, TAU); g.fill(); g.fillStyle = '#9aa0b0'; g.fillRect(-2.4, 3, 4.8, 3); }); },
      turbin(on, t) {
        g.fillStyle = '#6a7380'; rr(-18, -22, 36, 22, 4); g.fill(); g.save(); g.translate(0, -11); g.rotate(on ? t / 160 : 0);
        g.fillStyle = '#c8ced8'; for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.beginPath(); g.ellipse(5, 0, 6, 2.2, 0, 0, TAU); g.fill(); } g.restore();
        g.fillStyle = '#5aa8e0'; g.fillRect(-24, -6, 8, 6);
      },
      sualti(on, t) {
        g.fillStyle = '#1e4f78'; g.fillRect(-26, -24, 52, 24); g.fillStyle = 'rgba(160,220,255,.25)'; g.fillRect(-26, -24, 52, 3);
        g.strokeStyle = '#ffc94a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-26, -6); g.bezierCurveTo(-8, -14, 8, 0, 26, -8); g.stroke();
        if (on) { const x = -26 + ((t / 30) % 52); light(x, -6 - Math.sin(x / 10) * 4, 8, 'rgba(255,230,120,.9)'); }
      },
      ruzgarturbini(on, t) {
        g.fillStyle = '#e8ecf2'; g.beginPath(); g.moveTo(-2.4, 0); g.lineTo(-1.2, -44); g.lineTo(1.2, -44); g.lineTo(2.4, 0); g.fill();
        g.save(); g.translate(0, -44); g.rotate(on ? t / 500 : 0.3); g.fillStyle = '#e8ecf2'; for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.beginPath(); g.ellipse(0, -11, 2.4, 11, 0, 0, TAU); g.fill(); } g.fillStyle = '#9aa0b0'; g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill(); g.restore();
      },
      gunes(on, t) {
        g.fillStyle = '#5a5f74'; g.fillRect(-2, -14, 4, 14);
        g.save(); g.translate(0, -18); g.transform(1, 0, -0.5, 0.6, 0, 0); g.fillStyle = '#1f3a7a'; g.fillRect(-18, -12, 36, 24);
        g.strokeStyle = '#8ab0ff'; g.lineWidth = 0.8; for (let x = -12; x <= 12; x += 6) { g.beginPath(); g.moveTo(x, -12); g.lineTo(x, 12); g.stroke(); } g.beginPath(); g.moveTo(-18, 0); g.lineTo(18, 0); g.stroke(); g.restore();
        if (on) light(6, -22, 10, 'rgba(200,230,255,.6)');
      },
      kunduzseti() {
        g.fillStyle = '#2f6fa0'; g.fillRect(-26, -6, 52, 6);
        for (let r2 = 0; r2 < 3; r2++) for (let i = 0; i < 4 - r2; i++) { const x = -18 + r2 * 6 + i * 12, y = -10 - r2 * 7; g.fillStyle = '#7a4e28'; rr(x - 7, y - 3.5, 14, 7, 3.5); g.fill(); g.fillStyle = '#c99a6a'; g.beginPath(); g.arc(x + 6, y, 3, 0, TAU); g.fill(); }
      },
      // ---- Deniz Feneri: kapı 26-28 ----
      agtamir(on, t) {
        g.fillStyle = '#6b4a2a'; g.fillRect(-22, -36, 3, 36); g.fillRect(19, -36, 3, 36);
        g.strokeStyle = 'rgba(220,210,180,.8)'; g.lineWidth = 0.9; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-19, -32 + k * 5); g.quadraticCurveTo(0, -28 + k * 5, 19, -32 + k * 5); g.stroke(); g.beginPath(); g.moveTo(-17 + k * 7, -34); g.lineTo(-17 + k * 7, -8); g.stroke(); }
        g.fillStyle = '#ff8a4c'; g.beginPath(); g.arc(-12, -10, 2.4, 0, TAU); g.arc(10, -14, 2.4, 0, TAU); g.fill();
      },
      marti(on, t) {
        g.fillStyle = '#6b4a2a'; g.fillRect(-2, -26, 4, 26);
        g.fillStyle = '#f2f4f8'; g.beginPath(); g.ellipse(0, -30, 8, 4.5, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(6, -33, 3.2, 0, TAU); g.fill();
        g.fillStyle = '#9aa0b0'; g.beginPath(); g.ellipse(-2, -31, 6, 2.4, -0.2, 0, TAU); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(9, -33); g.lineTo(13, -32); g.lineTo(9, -31); g.fill();
        if (on) { const a = t / 600; g.strokeStyle = '#f2f4f8'; g.lineWidth = 1.4; g.beginPath(); const x = Math.cos(a) * 18, y = -46 + Math.sin(a * 2) * 4, f = Math.sin(t / 90) * 3; g.moveTo(x - 6, y - f); g.quadraticCurveTo(x - 3, y - 2, x, y); g.quadraticCurveTo(x + 3, y - 2, x + 6, y - f); g.stroke(); }
      },
      kumkale() {
        g.fillStyle = '#e8d29a'; g.fillRect(-18, -14, 36, 14); g.fillRect(-14, -26, 10, 12); g.fillRect(4, -26, 10, 12); g.fillRect(-4, -34, 8, 20);
        g.fillStyle = '#d0b47a'; for (const x of [-14, -9, 4, 9]) g.fillRect(x, -29, 4, 3); g.fillStyle = '#2a2230'; g.beginPath(); g.arc(0, -4, 4, Math.PI, 0); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -34); g.lineTo(0, -42); g.stroke(); g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(0, -42); g.lineTo(6, -40); g.lineTo(0, -38); g.fill();
      },
      kayikhane(on, t) {
        g.fillStyle = '#2f6fa0'; g.fillRect(-26, -4, 52, 4); g.fillStyle = '#6b4a2a'; for (const x of [-20, 18]) g.fillRect(x, -10, 3, 10);
        DECOR_ART.house({ x: 0, y: -8, s: 0.8, c: '#5a7a8a', ph: 0.15 });
        g.fillStyle = '#c0703a'; g.beginPath(); g.moveTo(-8, -6); g.lineTo(8, -6); g.lineTo(6, -2); g.lineTo(-6, -2); g.closePath(); g.fill();
      },
      samandira(on, t) {
        const b = on ? Math.sin(t / 500) * 2 : 0; g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -2, 18, 4, 0, 0, TAU); g.fill();
        g.save(); g.translate(0, b); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(-8, -4); g.lineTo(-5, -24); g.lineTo(5, -24); g.lineTo(8, -4); g.closePath(); g.fill(); g.fillStyle = '#f2ece0'; g.fillRect(-6.5, -16, 13, 4);
        g.fillStyle = '#2a2a34'; g.fillRect(-1, -32, 2, 8); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(0, -33, 2.6, 0, TAU); g.fill(); g.restore();
        if (on && Math.sin(t / 400) > 0) light(0, -33 + b, 12, 'rgba(255,240,170,.9)');
      },
      dalgakiran(on, t) {
        g.fillStyle = '#6a7380'; for (const [x, y, r2] of [[-16, -8, 9], [-2, -12, 11], [14, -8, 9]]) { g.beginPath(); g.arc(x, y, r2, Math.PI, 0); g.fill(); }
        if (on) { const ph = (t / 1400) % 1; g.fillStyle = `rgba(230,245,255,${1 - ph})`; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-12 + i * 6, -20 - ph * 14 - (i % 2) * 4, 2.4, 0, TAU); g.fill(); } }
      },
      denizmagara(on, t) {
        g.fillStyle = '#4a5664'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-22, -42, 0, -44); g.quadraticCurveTo(22, -42, 26, 0); g.fill();
        g.fillStyle = '#0a1a2a'; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, -32, 14, 0); g.fill();
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -2, 16, 4, 0, 0, TAU); g.fill(); if (on) light(0, -10, 14, 'rgba(120,220,255,.5)');
      },
      mercan(on, t) {
        for (const [x, c, h] of [[-12, '#ff6b6b', 22], [0, '#ff8fab', 30], [12, '#ffb347', 20]]) {
          g.strokeStyle = c; g.lineWidth = 3; g.lineCap = 'round'; const sw = on ? Math.sin(t / 900 + x) * 2 : 0;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, -h); g.moveTo(x, -h * 0.4); g.lineTo(x - 6 + sw, -h * 0.75); g.moveTo(x, -h * 0.55); g.lineTo(x + 6 + sw, -h * 0.9); g.stroke();
        }
      },
      balinakoyu(on, t) {
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -4, 24, 7, 0, 0, TAU); g.fill();
        const up = on ? Math.max(0, Math.sin(t / 1000)) : 1; g.save(); g.translate(4, -6); g.scale(1, up);
        g.fillStyle = '#3a5a8a'; g.beginPath(); g.moveTo(-3, 0); g.lineTo(-2, -16); g.quadraticCurveTo(-12, -24, -14, -18); g.quadraticCurveTo(-6, -20, 0, -14); g.quadraticCurveTo(6, -20, 14, -18); g.quadraticCurveTo(12, -24, 2, -16); g.lineTo(3, 0); g.fill(); g.restore();
      },
      batik(on, t) {
        g.fillStyle = '#1e4f78'; g.fillRect(-26, -10, 52, 10);
        g.save(); g.translate(0, -8); g.rotate(-0.25); g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(-20, 0); g.lineTo(18, 0); g.lineTo(12, -12); g.lineTo(-16, -12); g.closePath(); g.fill();
        g.strokeStyle = '#5a3a24'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, -32); g.stroke(); g.fillStyle = 'rgba(230,220,200,.55)'; g.beginPath(); g.moveTo(1, -30); g.lineTo(12, -20); g.lineTo(1, -16); g.closePath(); g.fill(); g.restore();
        if (on) chest(0);
      },
      yelkenli(on, t) {
        const b = on ? Math.sin(t / 600) * 0.06 : 0; g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -2, 22, 4, 0, 0, TAU); g.fill();
        g.save(); g.translate(0, -6); g.rotate(b); g.fillStyle = '#f2ece0'; g.beginPath(); g.moveTo(-16, 0); g.lineTo(16, 0); g.lineTo(11, 6); g.lineTo(-11, 6); g.closePath(); g.fill();
        g.fillStyle = '#5a3a24'; g.fillRect(-1, -34, 2, 34); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(1, -32); g.lineTo(16, -4); g.lineTo(1, -4); g.closePath(); g.fill(); g.fillStyle = '#4cc9f0'; g.beginPath(); g.moveTo(-1, -28); g.lineTo(-12, -4); g.lineTo(-1, -4); g.closePath(); g.fill(); g.restore();
      },
      duduk(on, t) {
        g.fillStyle = '#5a5f74'; g.fillRect(-3, -18, 6, 18); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(-4, -26); g.lineTo(14, -34); g.lineTo(14, -14); g.lineTo(-4, -22); g.closePath(); g.fill();
        if (on && (t / 1000) % 3 < 1) for (let i = 1; i <= 3; i++) { g.strokeStyle = `rgba(230,240,255,${0.8 - i * 0.2})`; g.lineWidth = 1.6; g.beginPath(); g.arc(14, -24, i * 6, -0.6, 0.6); g.stroke(); }
      },
      mercek(on, t) {
        g.fillStyle = '#2a2a34'; g.fillRect(-12, -6, 24, 6);
        const a = on ? t / 900 : 0; g.save(); g.translate(0, -26); g.scale(Math.abs(Math.cos(a)) * 0.6 + 0.4, 1);
        g.fillStyle = '#ffe9a0'; rr(-12, -18, 24, 36, 8); g.fill(); g.strokeStyle = 'rgba(160,120,40,.5)'; g.lineWidth = 1.2; for (let y = -12; y <= 12; y += 6) { g.beginPath(); g.moveTo(-12, y); g.lineTo(12, y); g.stroke(); } g.restore();
        if (on) light(0, -26, 30, 'rgba(255,240,170,.75)');
      },
      kulube() { DECOR_ART.house({ x: 0, y: 0, s: 0.85, c: '#e8e0d0', ph: 0.15 }); },
      yunuskoyu(on, t) {
        g.fillStyle = '#2f6fa0'; g.beginPath(); g.ellipse(0, -2, 24, 6, 0, 0, TAU); g.fill();
        const ph = on ? (t / 1800) % 1 : 0.5, x = -18 + ph * 36, y = -4 - Math.sin(ph * Math.PI) * 26;
        g.save(); g.translate(x, y); g.rotate(-Math.cos(ph * Math.PI) * 0.9); g.fillStyle = '#6a9ac8'; g.beginPath(); g.ellipse(0, 0, 10, 4, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-8, 0); g.lineTo(-14, -4); g.lineTo(-14, 4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0, -3); g.lineTo(-3, -8); g.lineTo(3, -3); g.fill(); g.restore();
      },
      lighthouseSt(on, t) { lighthouse(0, 0, 0.75, t); },
      // ---- Rasathane: kapı 29-30 ----
      gunessaati(on, t) {
        g.fillStyle = '#9aa0b0'; g.beginPath(); g.ellipse(0, -6, 20, 7, 0, 0, TAU); g.fill(); g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(0, -8, 18, 6, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.8; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.beginPath(); g.moveTo(Math.cos(a) * 14, -8 + Math.sin(a) * 4.6); g.lineTo(Math.cos(a) * 17, -8 + Math.sin(a) * 5.6); g.stroke(); }
        g.fillStyle = '#c99a3a'; g.beginPath(); g.moveTo(0, -8); g.lineTo(0, -24); g.lineTo(8, -8); g.closePath(); g.fill();
        const a = on ? t / 4000 : 1; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(0, -8); g.lineTo(Math.cos(a) * 16, -8 + Math.sin(a) * 5); g.lineTo(Math.cos(a + 0.2) * 16, -8 + Math.sin(a + 0.2) * 5); g.closePath(); g.fill();
      },
      gokkure(on, t) {
        g.fillStyle = '#6a5a4a'; g.fillRect(-2, -16, 4, 16); g.fillRect(-10, -2, 20, 2);
        g.save(); g.translate(0, -28); g.rotate(on ? t / 2000 : 0.3); g.strokeStyle = '#c99a3a'; g.lineWidth = 1.6;
        for (const [rx, ry] of [[14, 14], [14, 5], [5, 14]]) { g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke(); }
        g.restore(); g.fillStyle = '#4895ef'; g.beginPath(); g.arc(0, -28, 4, 0, TAU); g.fill();
      },
      donertabla(on, t) {
        g.fillStyle = '#4a5068'; g.beginPath(); g.ellipse(0, -6, 22, 7, 0, 0, TAU); g.fill();
        for (let i = 0; i < 3; i++) { const a = (on ? t / 1400 : 0) + i * TAU / 3, x = Math.cos(a) * 15, y = -8 + Math.sin(a) * 4.6; planet(x, y - 6, 4 + i, ['#ffc94a', '#4cc9f0', '#ff8a4c'][i], ['#a07a1a', '#1a6aa0', '#a0401a'][i]); }
        g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(0, -14, 5, 0, TAU); g.fill(); if (on) light(0, -14, 14, 'rgba(255,230,150,.8)');
      },
      pusula(on, t) {
        g.fillStyle = '#5a3a24'; g.fillRect(-20, -18, 40, 5); g.fillRect(-17, -13, 4, 13); g.fillRect(13, -13, 4, 13);
        g.fillStyle = '#e8d29a'; g.save(); g.translate(0, -20); g.scale(1, 0.45); g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
        g.rotate(on ? Math.sin(t / 900) * 0.4 : 0); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(0, -10); g.lineTo(2.4, 0); g.lineTo(-2.4, 0); g.fill(); g.fillStyle = '#5a5f74'; g.beginPath(); g.moveTo(0, 10); g.lineTo(2.4, 0); g.lineTo(-2.4, 0); g.fill(); g.restore();
      },
      evre(on, t) {
        for (let i = 0; i < 4; i++) { const x = -18 + i * 12, k = i / 3; g.fillStyle = '#e8e0c8'; g.beginPath(); g.arc(x, -24, 5, 0, TAU); g.fill(); g.fillStyle = '#0c1024'; g.beginPath(); g.ellipse(x + 5 * k * 2 - 5, -24, 5 * (1 - k * 0.9), 5, 0, 0, TAU); g.fill(); }
        if (on) light(18, -24, 12, 'rgba(240,235,210,.6)');
      },
      takimyildiz(on, t) { constellation([[-16, -14], [-8, -30], [2, -24], [10, -38], [18, -20]], t); },
      devteleskop(on, t) { telescope(0, 0, 1.4, -0.7 + (on ? Math.sin(t / 2500) * 0.15 : 0)); },
      harita(on, t) {
        g.fillStyle = '#e8d29a'; g.fillRect(-18, -40, 36, 32); g.fillStyle = '#c9a774'; g.beginPath(); g.arc(-18, -24, 3, 0, TAU); g.arc(18, -24, 3, 0, TAU); g.fill();
        constellation([[-12, -16], [-4, -30], [6, -22], [12, -34]], t);
      },
      gozlemevi(on, t) { observatory(0, 0, 1.1, t); },
      // ---- Havai Fişek: eksik istasyonlar (kapı 31-33) ----
      fitil(on, t) {
        barrel(-12, 0, 0.9); g.strokeStyle = '#d9b48a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, -18); g.bezierCurveTo(4, -30, 10, -6, 20, -20); g.stroke();
        if (on) { const u = (t / 2500) % 1, x = 20 - u * 26, y = -20 + Math.sin(u * 6) * 4; light(x, y, 10, 'rgba(255,200,90,.95)'); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill(); }
      },
      kibrit(on, t) {
        for (let r2 = 0; r2 < 5; r2++) { const y = -r2 * 7, w = 16 - r2 * 2.5; g.fillStyle = '#e0b24a'; g.fillRect(-w, y - 3, w * 2, 2.6); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(-w, y - 1.7, 1.8, 0, TAU); g.arc(w, y - 1.7, 1.8, 0, TAU); g.fill(); }
        if (on) { g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-3, -36); g.quadraticCurveTo(0, -46 - Math.sin(t / 80) * 2, 3, -36); g.fill(); light(0, -38, 14, 'rgba(255,170,80,.8)'); }
      },
      kivilcimyagmuru(on, t) {
        g.fillStyle = '#5a3a58'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-4, -14); g.lineTo(4, -14); g.lineTo(6, 0); g.fill();
        if (on) add(() => { for (let i = 0; i < 14; i++) { const ph = ((t / 900) + i / 14) % 1, a = -Math.PI / 2 + Math.sin(i * 2.3) * 0.7, d = ph * 34; g.fillStyle = `rgba(255,${200 + (i % 3) * 20},120,${1 - ph})`; g.beginPath(); g.arc(Math.cos(a) * d, -14 + Math.sin(a) * d + ph * ph * 20, 1.4, 0, TAU); g.fill(); } glow(0, -16, 14, 'rgba(255,230,150,.9)'); });
      },
      horozkule(on, t) {
        g.fillStyle = '#7a5a6a'; g.fillRect(-7, -30, 14, 30); g.fillStyle = '#a0522d'; g.beginPath(); g.moveTo(-10, -30); g.lineTo(0, -40); g.lineTo(10, -30); g.closePath(); g.fill();
        g.save(); g.translate(0, -46); g.rotate(on ? Math.sin(t / 1300) * 0.5 : 0); g.fillStyle = '#e0b24a';
        g.beginPath(); g.ellipse(0, 0, 6, 4, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(5, -4, 2.6, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-5, -1); g.lineTo(-11, -8); g.lineTo(-8, 1); g.fill(); g.fillStyle = '#c0392b'; g.fillRect(4, -8, 2.4, 2.4); g.restore();
        g.strokeStyle = '#e0b24a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -40); g.lineTo(0, -44); g.stroke();
      },
      tavusbahce(on, t) {
        const open = on ? 0.7 + 0.3 * Math.sin(t / 1500) : 0.6;
        for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28 * open; g.strokeStyle = '#2d8a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -10); g.lineTo(Math.cos(a) * 30, -10 + Math.sin(a) * 30); g.stroke(); g.fillStyle = '#2dd4bf'; g.beginPath(); g.arc(Math.cos(a) * 30, -10 + Math.sin(a) * 30, 4, 0, TAU); g.fill(); g.fillStyle = '#4895ef'; g.beginPath(); g.arc(Math.cos(a) * 30, -10 + Math.sin(a) * 30, 1.8, 0, TAU); g.fill(); }
        g.fillStyle = '#2a5ad0'; g.beginPath(); g.ellipse(0, -8, 4, 7, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -17, 3, 0, TAU); g.fill();
      },
      ucanfener(on, t) { g.save(); g.scale(0.6, 0.6); for (let i = 0; i < 3; i++) { const ph = on ? ((t / 5000) + i / 3) % 1 : 0.3 + i * 0.2; g.save(); g.translate(-20 + i * 20, 0); g.globalAlpha = 1 - ph * 0.6; skyLantern(-20 - ph * 50, '#ffd27a', '#ff8a3c', t / 1000); g.restore(); } g.restore(); },
      atescambazi(on, t) {
        g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-3, -18); g.lineTo(3, -18); g.lineTo(5, 0); g.fill(); g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(0, -22, 4, 0, TAU); g.fill();
        if (on) for (let i = 0; i < 3; i++) { const a = t / 260 + i * TAU / 3, x = Math.cos(a) * 12, y = -34 + Math.sin(a) * 9; g.fillStyle = '#ffb347'; g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); light(x, y, 8, 'rgba(255,170,80,.8)'); }
      },
      // ---- Buzul: eksik istasyonlar (kapı 34-35) ----
      buzbalikci(on, t) {
        g.fillStyle = '#bfe0f0'; g.beginPath(); g.ellipse(0, -2, 22, 6, 0, 0, TAU); g.fill(); g.fillStyle = '#1e4f78'; g.beginPath(); g.ellipse(6, -2, 6, 2.4, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8463a'; g.beginPath(); g.arc(-10, -16, 6, 0, TAU); g.fill(); g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(-10, -24, 4.6, 0, TAU); g.fill();
        const b = on ? Math.max(0, Math.sin(t / 700)) * 3 : 0; g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, -18); g.lineTo(10, -32 + b); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(10, -32 + b); g.lineTo(6, -3); g.stroke();
      },
      cam(on, t) { for (const [x, k] of [[-12, 0.7], [12, 0.6], [0, 0.85]]) DECOR_ART.pine({ x, y: -14 * k, s: k }); },
      sarkit(on, t) {
        g.fillStyle = '#9fc3d6'; g.fillRect(-24, -46, 48, 6);
        for (let i = 0; i < 7; i++) { const x = -21 + i * 7, h = 10 + ((i * 37) % 4) * 6; g.fillStyle = 'rgba(200,236,255,.9)'; g.beginPath(); g.moveTo(x - 3, -40); g.lineTo(x + 3, -40); g.lineTo(x, -40 + h); g.closePath(); g.fill(); }
        if (on) { const ph = (t / 900) % 1; g.fillStyle = `rgba(200,236,255,${1 - ph})`; g.beginPath(); g.arc(0, -24 + ph * 22, 1.6, 0, TAU); g.fill(); }
      },
      donmusselale(on, t) { STATION_ART.selale(false, t); g.fillStyle = 'rgba(230,248,255,.55)'; g.fillRect(-6, -46, 12, 46); },
      // ---- Değirmen: kapı 36-38 ----
      sucarki(on, t) { g.fillStyle = '#2f6fa0'; g.fillRect(-26, -6, 52, 6); waterWheel(-6, -20, 16, t); g.fillStyle = '#e8e0d0'; g.fillRect(8, -34, 16, 34); g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(6, -34); g.lineTo(16, -42); g.lineTo(26, -34); g.closePath(); g.fill(); },
      kumes(on, t) {
        g.fillStyle = '#c99a5a'; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-18, -20); g.lineTo(0, -32); g.lineTo(18, -20); g.lineTo(18, 0); g.closePath(); g.fill();
        g.fillStyle = '#5a3a24'; g.beginPath(); g.arc(0, -12, 5, Math.PI, 0); g.fill(); g.fillRect(-5, -12, 10, 12); g.strokeStyle = '#8a643a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-24, -10); g.stroke();
        if (on) { const x = 14 + Math.sin(t / 700) * 6; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, -4, 3.4, 0, TAU); g.fill(); g.fillStyle = '#e8463a'; g.fillRect(x - 1, -9, 2, 2); }
      },
      sepet() {
        g.fillStyle = '#b8824a'; g.beginPath(); g.moveTo(-16, -14); g.lineTo(16, -14); g.lineTo(12, 0); g.lineTo(-12, 0); g.closePath(); g.fill();
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 1; for (let y = -11; y < 0; y += 3) { g.beginPath(); g.moveTo(-15, y); g.lineTo(15, y); g.stroke(); }
        g.fillStyle = '#fff5e6'; for (const [x, y] of [[-8, -16], [0, -18], [8, -16], [-4, -20], [4, -21]]) { g.beginPath(); g.ellipse(x, y, 3.4, 4.4, 0, 0, TAU); g.fill(); }
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -14, 14, Math.PI, 0); g.stroke();
      },
      bentkapak(on, t) {
        g.fillStyle = '#2f6fa0'; g.fillRect(-26, -8, 52, 8); g.fillStyle = '#6b4a2a'; g.fillRect(-14, -40, 4, 40); g.fillRect(10, -40, 4, 40); g.fillRect(-16, -42, 32, 4);
        const up = on ? 6 + Math.sin(t / 1200) * 5 : 0; g.fillStyle = '#8a643a'; g.fillRect(-10, -30 - up, 20, 24); g.strokeStyle = '#5a3a24'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-10, -26 - up + k * 6); g.lineTo(10, -26 - up + k * 6); g.stroke(); }
        if (on && up > 3) { g.fillStyle = 'rgba(200,240,255,.8)'; g.fillRect(-9, -6, 18, 2); }
      },
      yeldegirmeni(on, t) { windmill(0, 0, 1.15, t); },
      yun(on, t) {
        g.fillStyle = '#6b4a2a'; g.fillRect(-18, -4, 30, 4); g.fillRect(-14, -24, 3, 20);
        g.save(); g.translate(-12, -24); g.rotate(on ? t / 500 : 0); g.strokeStyle = '#8a643a'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 13); g.stroke(); } g.restore();
        g.fillStyle = '#f2ece0'; for (const [x, y, r2] of [[10, -14, 7], [16, -10, 5], [6, -8, 5]]) { g.beginPath(); g.arc(x, y, r2, 0, TAU); g.fill(); }
      },
      ambar(on) { barn(0, 0, 1, on); },
      sut() { g.fillStyle = '#b8bec8'; g.beginPath(); g.moveTo(-10, -22); g.lineTo(10, -22); g.lineTo(8, 0); g.lineTo(-8, 0); g.closePath(); g.fill(); g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(0, -22, 10, 3, 0, 0, TAU); g.fill(); g.strokeStyle = '#8a929c'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -22, 10, Math.PI, 0); g.stroke(); },
      peynir() {
        g.fillStyle = '#6b4a2a'; g.fillRect(-20, -6, 40, 6);
        g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(-16, -6); g.lineTo(-16, -18); g.lineTo(14, -24); g.lineTo(14, -6); g.closePath(); g.fill(); g.fillStyle = '#e0b02a'; for (const [x, y, r2] of [[-8, -12, 2.4], [2, -16, 1.8], [8, -10, 2]]) { g.beginPath(); g.arc(x, y, r2, 0, TAU); g.fill(); }
      },
      bugday(on, t) {
        for (let i = -4; i <= 4; i++) { const sw = on ? Math.sin(t / 700 + i * 0.6) * 3 : 0, x = i * 5; g.strokeStyle = '#c99a3a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, -26); g.stroke(); g.fillStyle = '#e8c06a'; g.beginPath(); g.ellipse(x + sw, -30, 2, 5, sw * 0.05, 0, TAU); g.fill(); }
      },
      aycicegi(on, t) {
        for (const [x, h] of [[-12, 26], [2, 34], [14, 24]]) {
          g.strokeStyle = '#3f8a52'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -h); g.stroke(); g.fillStyle = '#5cc27f'; g.beginPath(); g.ellipse(x + 4, -h / 2, 5, 2.4, -0.5, 0, TAU); g.fill();
          g.save(); g.translate(x, -h); g.rotate(on ? Math.sin(t / 3000) * 0.3 : 0); g.fillStyle = '#ffc94a'; for (let i = 0; i < 10; i++) { g.rotate(TAU / 10); g.beginPath(); g.ellipse(0, -7, 2.4, 4.4, 0, 0, TAU); g.fill(); } g.fillStyle = '#6b4226'; g.beginPath(); g.arc(0, 0, 4.6, 0, TAU); g.fill(); g.restore();
        }
      },
      // ---- Büyü Kulesi: kapı 39-40 ----
      kitaplar(on, t) {
        for (let i = 0; i < 3; i++) { const y = -18 - i * 12 + (on ? Math.sin(t / 700 + i * 2) * 4 : 0), x = -8 + i * 8; g.save(); g.translate(x, y); g.rotate(on ? Math.sin(t / 900 + i) * 0.3 : 0.2);
          g.fillStyle = ['#c0392b', '#4895ef', '#2d7d4f'][i]; g.fillRect(-9, -3, 18, 6); g.fillStyle = '#f2ece0'; g.fillRect(-8, -2, 16, 3); g.restore(); }
        if (on) light(0, -30, 20, 'rgba(200,160,255,.4)');
      },
      iksir(on, t) { cauldron('#b388ff', 'rgba(200,160,255,A)', on, t); if (on) light(0, -26, 18, 'rgba(180,120,255,.7)'); },
      run(on, t) {
        for (const [x, h] of [[-14, 22], [0, 30], [14, 20]]) { g.fillStyle = '#5a5464'; g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x - 5, -h); g.quadraticCurveTo(x, -h - 5, x + 5, -h); g.lineTo(x + 6, 0); g.closePath(); g.fill();
          g.strokeStyle = on ? `rgba(180,140,255,${0.6 + 0.4 * Math.sin(t / 400 + x)})` : '#3a3444'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 2, -h + 6); g.lineTo(x + 2, -h + 10); g.lineTo(x - 2, -h + 14); g.moveTo(x + 2, -h + 6); g.lineTo(x + 2, -h + 14); g.stroke(); }
      },
      buyucu(on, t) {
        g.fillStyle = '#5a3a6a'; g.fillRect(-16, -12, 32, 4); g.fillRect(-13, -8, 3, 8); g.fillRect(10, -8, 3, 8);
        g.fillStyle = '#3a2a8a'; g.beginPath(); g.moveTo(-10, -12); g.lineTo(2, -44); g.lineTo(10, -12); g.closePath(); g.fill(); g.fillStyle = '#ffd34a'; star(-1, -26, 2.4); star(4, -18, 1.8);
        g.fillStyle = '#8a643a'; g.save(); g.translate(16, -14); g.rotate(-0.6); g.fillRect(-1, -16, 2, 16); g.restore(); if (on) light(22, -26, 8, 'rgba(255,230,150,.9)');
      },
      gokkusagi(on, t) { ['#ff6b6b', '#ffb347', '#ffd34a', '#5cc27f', '#4cc9f0', '#b388ff'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 2.6; g.beginPath(); g.arc(0, 0, 24 - i * 2.8, Math.PI, 0); g.stroke(); }); },
      portal(on, t) { portalRing(-10, -22, 9, '#4cc9f0', t); portalRing(10, -22, 9, '#ff6fb5', t + 300); },
      hali(on, t) {
        const b = on ? Math.sin(t / 600) * 3 : 0; g.save(); g.translate(0, -20 + b);
        g.fillStyle = '#a8322a'; g.beginPath(); g.moveTo(-20, 0); for (let x = -20; x <= 20; x += 5) g.lineTo(x, Math.sin(x / 6 + t / 300) * 2); g.lineTo(20, 8); for (let x = 20; x >= -20; x -= 5) g.lineTo(x, 8 + Math.sin(x / 6 + t / 300) * 2); g.closePath(); g.fill();
        g.strokeStyle = '#ffd34a'; g.lineWidth = 1.4; g.strokeRect(-16, 1, 32, 5); g.restore();
      },
      cember(on, t) { const pts = []; for (let i = 0; i <= 8; i++) { const a = i * TAU / 8; pts.push([Math.cos(a) * 16, -24 + Math.sin(a) * 12]); } constellation(pts, t); },
      kul(on, t) {
        g.fillStyle = '#5a5060'; g.beginPath(); g.ellipse(0, -6, 18, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#8a8090'; g.beginPath(); g.ellipse(0, -8, 12, 4, 0, 0, TAU); g.fill();
        if (on) { const k = 0.6 + 0.4 * Math.sin(t / 300); g.fillStyle = `rgba(255,${120 + 60 * k},60,${k})`; for (const [x, y] of [[-4, -9], [3, -8], [0, -10]]) { g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); } light(0, -9, 14 * k, 'rgba(255,140,60,.7)'); }
      },
      ateskuyusu(on, t) { STATION_ART.kuyu(on, t); if (on) { g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-8, -16); g.quadraticCurveTo(0, -36 - Math.sin(t / 90) * 3, 8, -16); g.fill(); light(0, -20, 20, 'rgba(255,150,60,.8)'); } },
      tunek(on, t) {
        g.strokeStyle = '#5a3a24'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(0, -30); g.lineTo(-14, -40); g.moveTo(0, -30); g.lineTo(16, -36); g.stroke();
        if (on) add(() => { for (let i = 0; i < 3; i++) { const ph = (t / 1200 + i / 3) % 1; g.fillStyle = `rgba(255,${160 + i * 30},80,${1 - ph})`; star(-6 + i * 6, -40 - ph * 20, 2.4); } glow(0, -36, 24, 'rgba(255,150,70,.6)'); });
      },
      // Şekil bölümü: şeklin resmi bir şövalede; kapı finali (Dev Halka) altın çerçevede, daha büyük
      portrait(on, t, state, st) { portraitArt(st, on, false); },
      finalPortrait(on, t, state, st) { portraitArt(st, on, true); },
      lanternStall(on, t) {
        g.fillStyle = '#6b3a2a'; g.fillRect(-18, -18, 36, 18); g.fillStyle = '#4a2418'; g.fillRect(-18, -4, 36, 4);
        for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ff6b6b' : '#fff5ea'; g.fillRect(-22 + i * 8.8, -30, 8.8, 10); }
        for (let i = 0; i < 3; i++) { const fl = 0.8 + 0.2 * Math.sin(t / 120 + i); g.fillStyle = ['#ffd34a', '#ff8fab', '#4cc9f0'][i]; g.beginPath(); g.ellipse(-12 + i * 12, -12, 4, 5, 0, 0, TAU); g.fill(); if (on) light(-12 + i * 12, -12, 10 * fl, 'rgba(255,220,150,.7)'); }
      },
      rocket(on, t, state) {
        g.strokeStyle = '#8a7a90'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-4, -16); g.moveTo(12, 0); g.lineTo(4, -16); g.stroke();
        const lift = state === 'done' ? -6 + Math.sin(t / 200) * 2 : 0;
        g.save(); g.translate(0, lift);
        g.fillStyle = '#e8eaf6'; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(9, -34, 7, -14); g.lineTo(-7, -14); g.quadraticCurveTo(-9, -34, 0, -46); g.fill();
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(5, -40, 6, -36); g.lineTo(-6, -36); g.quadraticCurveTo(-5, -40, 0, -46); g.fill();
        g.fillStyle = '#4cc9f0'; g.beginPath(); g.arc(0, -28, 3.2, 0, TAU); g.fill();
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(-7, -18); g.lineTo(-12, -10); g.lineTo(-7, -14); g.fill(); g.beginPath(); g.moveTo(7, -18); g.lineTo(12, -10); g.lineTo(7, -14); g.fill();
        if (on) { const fl = 0.7 + 0.3 * Math.sin(t / 50); g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(-4, -14); g.lineTo(0, -14 + 10 * fl); g.lineTo(4, -14); g.fill(); light(0, -10, 14, 'rgba(255,180,80,.8)'); }
        g.restore();
      },
      cannon(on, t) {
        g.fillStyle = '#6b3a2a'; g.beginPath(); g.arc(-8, -6, 7, 0, TAU); g.arc(8, -6, 7, 0, TAU); g.fill();
        g.fillStyle = '#c0882a'; g.beginPath(); g.arc(-8, -6, 3, 0, TAU); g.arc(8, -6, 3, 0, TAU); g.fill();
        g.save(); g.translate(0, -12); g.rotate(-0.7); g.fillStyle = '#5a4a6a'; g.fillRect(-6, -26, 12, 26); g.fillStyle = '#7a6a8a'; g.fillRect(-7, -28, 14, 5); g.restore();
        if (on) for (let i = 0; i < 6; i++) { const a = -2.3 + i * 0.12, d = 26 + ((t / 30 + i * 13) % 18); g.fillStyle = ['#ff6fb5', '#ffd34a', '#4cc9f0'][i % 3]; g.fillRect(Math.cos(a) * d - 2, -12 + Math.sin(a) * d, 4, 2.5); }
      },
      balloonStand(on, t) {
        g.fillStyle = '#6b3a2a'; g.fillRect(-14, -10, 28, 10); g.fillStyle = '#ff8fab'; g.fillRect(-16, -14, 32, 5);
        const cols = ['#ff6b6b', '#ffc94a', '#4cc9f0', '#b388ff', '#2dd4bf'];
        for (let i = 0; i < 5; i++) { const bx = -16 + i * 8 + Math.sin(t / 600 + i) * 2, by = -34 - (i % 2) * 8; g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -14); g.lineTo(bx, by + 7); g.stroke(); g.fillStyle = cols[i]; g.beginPath(); g.ellipse(bx, by, 5, 6.5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(bx - 1.5, by - 2.5, 1.3, 0, TAU); g.fill(); }
      },
      parrot(on, t) {
        g.strokeStyle = '#8a5a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-14, -26); g.moveTo(14, 0); g.lineTo(14, -26); g.moveTo(-18, -26); g.lineTo(18, -26); g.stroke();
        const b = Math.sin(t / 300) * 1.5;
        g.fillStyle = '#ffc94a'; g.beginPath(); g.ellipse(0, -36 + b, 7, 9, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.arc(0, -46 + b, 6.5, 0, TAU); g.fill();
        g.fillStyle = '#4895ef'; g.beginPath(); g.ellipse(-5, -35 + b, 3, 7, 0.4, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(2, -47 + b, 2, 0, TAU); g.fill(); g.fillStyle = '#2a1030'; g.beginPath(); g.arc(2.4, -47 + b, 1, 0, TAU); g.fill();
        g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(5, -46 + b); g.lineTo(10, -44 + b); g.lineTo(5, -42 + b); g.fill();
        g.fillStyle = '#2dd4bf'; g.beginPath(); g.moveTo(-2, -28 + b); g.lineTo(-6, -16 + b); g.lineTo(2, -27 + b); g.fill();
      },
      drumStage(on, t) {
        g.fillStyle = '#4a2a4a'; g.fillRect(-22, -6, 44, 6);
        const hit = on ? Math.max(0, Math.sin(t / 180)) * 2 : 0;
        g.fillStyle = '#ff6b6b'; g.fillRect(-11, -24, 22, 18); g.fillStyle = '#fff5ea'; g.beginPath(); g.ellipse(0, -24, 11, 4 + hit * 0.3, 0, 0, TAU); g.fill();
        g.strokeStyle = '#ffd34a'; g.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-11, -20 + i * 4); g.lineTo(11, -10 + i * 4); g.stroke(); }
        g.strokeStyle = '#d9b48a'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-16, -38 - hit); g.lineTo(-4, -26); g.moveTo(16, -38 + hit); g.lineTo(4, -26); g.stroke();
      },
      sparkTent(on, t) {
        for (let i = -2; i < 2; i++) { g.fillStyle = i % 2 ? '#b388ff' : '#fff5ea'; g.beginPath(); g.moveTo(0, -36); g.lineTo(i * 11, 0); g.lineTo((i + 1) * 11, 0); g.closePath(); g.fill(); }
        g.fillStyle = '#2a0f2a'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -12); g.lineTo(6, 0); g.fill();
        if (on) { for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t / 400, d = 6 + ((t / 40 + i * 5) % 8); g.strokeStyle = '#ffe9a8'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -40); g.lineTo(Math.cos(a) * d, -40 + Math.sin(a) * d); g.stroke(); } light(0, -40, 12, 'rgba(255,240,180,.8)'); }
      },
      barrel(on, t) {
        g.fillStyle = '#8a4a1a'; g.beginPath(); g.ellipse(0, -16, 13, 17, 0, 0, TAU); g.fill();
        g.strokeStyle = '#3a1a0a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-12, -24); g.lineTo(12, -24); g.moveTo(-12, -8); g.lineTo(12, -8); g.stroke();
        g.fillStyle = '#2a1030'; g.font = '900 9px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('TNT', 0, -13);
        g.strokeStyle = '#d9b48a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -33); g.quadraticCurveTo(6, -40, 10, -38); g.stroke();
        if (on) { const fl = 0.7 + 0.3 * Math.sin(t / 50) * Math.sin(t / 77); light(10, -38, 10 * fl, 'rgba(255,200,90,.95)'); }
      },
      wheel(on, t) {
        g.strokeStyle = '#6a4a7a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, -24); g.lineTo(12, 0); g.stroke();
        const rot = on ? t / 1500 : 0;
        g.strokeStyle = '#ffd34a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -26, 18, 0, TAU); g.stroke();
        for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6; g.beginPath(); g.moveTo(0, -26); g.lineTo(Math.cos(a) * 18, -26 + Math.sin(a) * 18); g.stroke(); g.fillStyle = ['#ff6b6b', '#4cc9f0', '#2dd4bf'][i % 3]; g.fillRect(Math.cos(a) * 18 - 3, -26 + Math.sin(a) * 18, 6, 5); if (on) light(Math.cos(a) * 18, -26 + Math.sin(a) * 18, 5, 'rgba(255,230,150,.8)'); }
      },
      arena(on) {
        g.fillStyle = '#563058'; g.fillRect(-24, -18, 48, 18);
        for (let i = 0; i < 5; i++) g.fillRect(-24 + i * 11, -24, 7, 7);
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.ellipse(0, -30, 14, 5, 0, 0, TAU); g.fill(); g.fillRect(-14, -30, 28, 12);
        g.fillStyle = '#fff5ea'; g.beginPath(); g.ellipse(0, -30, 14, 5, 0, 0, TAU); g.fill();
        g.strokeStyle = '#9aa6bd'; g.lineWidth = 3; g.beginPath(); g.arc(0, -25, 18, Math.PI * 0.9, Math.PI * 2.1); g.stroke();
        if (on) light(0, -30, 30, 'rgba(255,120,90,.5)');
      },
      igloo(on) {
        g.fillStyle = '#f4fbff'; g.beginPath(); g.arc(0, 0, 20, Math.PI, 0); g.fill();
        g.strokeStyle = 'rgba(120,170,210,.6)'; g.lineWidth = 1; for (const r of [8, 14]) { g.beginPath(); g.arc(0, 0, r + 6, Math.PI, 0); g.stroke(); }
        g.fillStyle = '#1a3a52'; g.beginPath(); g.arc(-4, 0, 7, Math.PI, 0); g.fill();
        if (on) light(-4, -3, 14, 'rgba(255,200,120,.8)');
      },
      snowman() {
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, -8, 10, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -24, 7.5, 0, TAU); g.fill();
        g.fillStyle = '#2a1030'; g.beginPath(); g.arc(-2.5, -26, 1.2, 0, TAU); g.arc(2.5, -26, 1.2, 0, TAU); g.fill();
        g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(0, -24); g.lineTo(7, -23); g.lineTo(0, -22); g.fill();
        g.fillStyle = '#e8463a'; g.fillRect(-7, -18, 14, 3);
        g.fillStyle = '#2a1030'; g.fillRect(-6, -36, 12, 6); g.fillRect(-9, -31, 18, 2);
      },
      penguins(on, t) {
        for (const [px, s] of [[-9, 1], [8, 0.8]]) {
          const b = on ? Math.sin(t / 250 + px) * 1.5 : 0;
          g.save(); g.translate(px, b); g.scale(s, s);
          g.fillStyle = '#24203a'; g.beginPath(); g.ellipse(0, -14, 8, 13, 0, 0, TAU); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -11, 5, 9, 0, 0, TAU); g.fill();
          g.beginPath(); g.arc(-2.5, -21, 1.6, 0, TAU); g.arc(2.5, -21, 1.6, 0, TAU); g.fill();
          g.fillStyle = '#ffa62b'; g.beginPath(); g.moveTo(-2, -19); g.lineTo(0, -16); g.lineTo(2, -19); g.fill();
          g.restore();
        }
      },
      rink(on, t) {
        g.fillStyle = 'rgba(120,200,240,.8)'; g.beginPath(); g.ellipse(0, -4, 24, 9, 0, 0, TAU); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
        const a = on ? t / 700 : 0; g.strokeStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(0, -4, 14, 5, 0, a, a + 2); g.stroke();
        g.fillStyle = '#e8463a'; g.beginPath(); g.ellipse(Math.cos(a + 2) * 14, -4 + Math.sin(a + 2) * 5 - 6, 3, 5, 0, 0, TAU); g.fill();
      },
      bearCave() {
        g.fillStyle = '#e8f4fb'; g.beginPath(); g.moveTo(-24, 0); g.quadraticCurveTo(-20, -34, 0, -36); g.quadraticCurveTo(20, -34, 24, 0); g.fill();
        g.fillStyle = '#1a3a52'; g.beginPath(); g.moveTo(-11, 0); g.quadraticCurveTo(0, -24, 11, 0); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, -8, 6, 0, TAU); g.fill(); g.beginPath(); g.arc(-4, -13, 2.2, 0, TAU); g.arc(4, -13, 2.2, 0, TAU); g.fill();
        g.fillStyle = '#2a1030'; g.beginPath(); g.arc(-2, -9, 0.9, 0, TAU); g.arc(2, -9, 0.9, 0, TAU); g.arc(0, -6.5, 1.2, 0, TAU); g.fill();
      },
      sled(on, t) {
        g.fillStyle = '#dff2fb'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(18, -26); g.lineTo(24, 0); g.fill();
        g.save(); g.translate(on ? -4 + ((t / 40) % 30) : 0, on ? -((t / 40) % 30) * 0.6 : 0);
        g.fillStyle = '#e8463a'; g.fillRect(-8, -12, 16, 5); g.strokeStyle = '#8a5a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-10, -6); g.lineTo(10, -6); g.quadraticCurveTo(13, -6, 12, -9); g.stroke();
        g.restore();
      },
      crystal(on) {
        const cols = ['#9be7ff', '#c9a7ff', '#7fe3ff'];
        for (let i = 0; i < 3; i++) { const h = 30 - i * 6, x = -9 + i * 9; g.fillStyle = cols[i]; g.beginPath(); g.moveTo(x - 5, 0); g.lineTo(x, -h); g.lineTo(x + 5, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(x - 2, -2); g.lineTo(x, -h + 4); g.lineTo(x + 1, -2); g.fill(); if (on) light(x, -h / 2, 12, 'rgba(180,230,255,.6)'); }
      },
      seal(on, t) {
        g.fillStyle = '#a9bfd0'; g.beginPath(); g.ellipse(0, -6, 22, 8, 0, Math.PI, 0); g.fill();
        const b = on ? Math.sin(t / 300) * 2 : 0;
        g.fillStyle = '#8d99ae'; g.beginPath(); g.ellipse(2, -14, 12, 6, -0.3, 0, TAU); g.fill(); g.beginPath(); g.arc(-8, -20, 6, 0, TAU); g.fill();
        g.fillStyle = '#2a1030'; g.beginPath(); g.arc(-10, -21, 1, 0, TAU); g.arc(-6.5, -21.5, 1, 0, TAU); g.fill();
        g.fillStyle = ['#ff6b6b', '#ffc94a', '#4cc9f0'][Math.floor(t / 800) % 3]; g.beginPath(); g.arc(-8, -30 + b, 4, 0, TAU); g.fill();
      },
      tower(on, t) {
        g.fillStyle = '#dff2fb'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-7, -38); g.lineTo(7, -38); g.lineTo(10, 0); g.fill();
        g.fillStyle = '#2a4a6a'; g.fillRect(-9, -44, 18, 6); g.beginPath(); g.moveTo(-10, -44); g.lineTo(0, -54); g.lineTo(10, -44); g.fill();
        g.fillStyle = on ? '#ffe7a0' : '#5a6a7a'; g.fillRect(-3, -30, 6, 8);
        if (on) add(() => { g.globalAlpha = 0.35; const gr = g.createLinearGradient(0, -48, 0, -120); gr.addColorStop(0, '#59ffc8'); gr.addColorStop(1, 'rgba(89,255,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-3, -48); g.lineTo(-18 + Math.sin(t / 900) * 6, -120); g.lineTo(18 + Math.sin(t / 900) * 6, -120); g.lineTo(3, -48); g.fill(); g.globalAlpha = 1; });
      },
      palace(on) {
        g.fillStyle = '#e6f5fc'; g.fillRect(-22, -20, 44, 20);
        for (const [x, h] of [[-18, 34], [0, 44], [18, 34]]) { g.fillStyle = '#d0ecf8'; g.fillRect(x - 5, -h, 10, h); g.fillStyle = '#7fe3ff'; g.beginPath(); g.moveTo(x - 7, -h); g.lineTo(x, -h - 12); g.lineTo(x + 7, -h); g.fill(); }
        g.fillStyle = '#1a3a52'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-6, -10); g.quadraticCurveTo(0, -16, 6, -10); g.lineTo(6, 0); g.fill();
        if (on) light(0, -24, 30, 'rgba(160,230,255,.5)');
      },
    };
    // İstasyonlar: yolun dış tarafında
    const STATIONS = [];
    for (let n = 1; n <= N; n++) {
      const nd = NODES[n], side = nd.x > W / 2 ? 1 : -1, w = worldOf(n), shp = D.shape(n);
      const stop = (J.STOPS[gateOf(n)] || [])[(n - 1) % GS] || null;
      const kind = shp ? (shp.final ? 'finalPortrait' : 'portrait') : stop && STATION_ART[stop[1]] ? stop[1] : 'beacon';
      const name = shp ? shp.name : stop ? stop[0] : null;
      STATIONS[n] = { n, x: Math.max(36, Math.min(W - 36, nd.x + side * 58)), y: nd.y - 4, kind, name, travel: stop ? TRAVEL_OF[stop[2]] : null, w };
    }

    // Dekor: dünyanın kendi takımından, yola ve istasyonlara değmeyen yerlerde (tohumlu)
    const nearPath = (x, y, m) => {
      for (const s of stonesNear(y)) if (Math.abs(s.y - y) < m && Math.hypot(s.x - x, s.y - y) < m) return true;
      const n0 = Math.max(1, Math.min(N, Math.round(y))); // aşağıdaki döngü yalnız yakın istasyonlara bakar
      for (const st of STATIONS) if (st && Math.abs(st.y - y) < m + 40 && Math.hypot(st.x - x, st.y - y) < m + 6) return true;
      return n0 < 0;
    };
    const DECOR_KINDS = {
      fisek: ['tent', 'tent', 'lamp', 'stall', 'balloons', 'lamp', 'tent', 'carousel'],
      buzul: ['pine', 'pine', 'ice', 'pine', 'lake', 'ice'],
      vadi: ['tree', 'flowers', 'bush', 'tree', 'mushroom', 'flowers', 'mossRock', 'bush'],
      atolye: ['crate', 'hangLamp', 'sawhorse', 'crate', 'toolbox', 'hangLamp', 'planks'],
      saat: ['clockFace', 'cogStack', 'hangLamp', 'clockFace', 'pipe', 'cogStack'],
      zindan: ['torchPost', 'barrels', 'web', 'rock', 'torchPost', 'barrels'],
      sehir: ['house', 'lamp', 'tree', 'house', 'bench', 'lamp'],
      fabrika: ['crate', 'pipe', 'barrels', 'hangLamp', 'cogStack', 'pipe'],
      uzay: ['asteroid', 'ringPlanet', 'probe', 'asteroid', 'comet'],
      usta: ['statue', 'column', 'cogStack', 'hangLamp', 'statue', 'column'],
      lunapark: ['tent', 'balloons', 'lamp', 'carousel', 'stall', 'tent'],
      santral: ['pylon', 'reel', 'hangLamp', 'solar', 'crate', 'pylon'],
      fener: ['buoy', 'rock', 'gull', 'smallLight', 'buoy', 'rock'],
      rasathane: ['smallDome', 'scope', 'globe', 'rock', 'constel', 'scope'],
      degirmen: ['tree', 'smallMill', 'hay', 'flowers', 'fence', 'bush'],
      buyu: ['crystalD', 'books', 'rune', 'smallPortal', 'crystalD', 'books'],
    };
    const DECOR = [];
    REGIONS.forEach((r, ri) => {
      const R = rng(31 + ri * 101), kinds = DECOR_KINDS[r.world.id] || ['rock', 'glowLamp', 'rock', 'mote'];
      const span = r.bottom - r.top, want = Math.round(span / 78), cols = ['#ff6b6b', '#ffc94a', '#b388ff', '#2dd4bf', '#ff8fab'];
      let made = 0;
      for (let k = 0; k < want * 6 && made < want; k++) {
        const y = r.top + 60 + R() * (span - 120), x = 24 + R() * (W - 48);
        if (nearPath(x, y, 66)) continue;
        if (GATE_Y.some(gy => gy && Math.abs(y - gy + 60) < 190)) continue;
        if (DECOR.some(d => Math.abs(d.y - y) < 74 && Math.hypot(d.x - x, d.y - y) < 74)) continue;
        DECOR.push({ world: r.world, kind: kinds[made % kinds.length], x, y, c: cols[Math.floor(R() * 5)], ph: R() * TAU, s: 0.8 + R() * 0.5 });
        made++;
      }
    });
    DECOR.sort((a, b) => a.y - b.y);

    function portraitArt(st, on, final) {
      const img = D.shapeImage(st.n, D.stars(st.n) > 0);
      const s = final ? 30 : 24, top = -s * 2 - 6;
      // şövale ayakları
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(-s * 0.35, top + s); g.moveTo(s * 0.7, 0); g.lineTo(s * 0.35, top + s); g.moveTo(0, -4); g.lineTo(0, top + s); g.stroke();
      // çerçeve
      g.fillStyle = final ? '#c98a12' : '#7a5230'; rr(-s - 4, top - 4, s * 2 + 8, s * 2 + 8, 5); g.fill();
      if (final) { g.strokeStyle = '#ffe07a'; g.lineWidth = 1.6; rr(-s - 2, top - 2, s * 2 + 4, s * 2 + 4, 4); g.stroke(); }
      g.fillStyle = '#161b2e'; rr(-s, top, s * 2, s * 2, 3); g.fill();
      if (img && img.complete && img.naturalWidth) g.drawImage(img, -s + 2, top + 2, s * 2 - 4, s * 2 - 4);
      if (final && on) light(0, top + s, s * 2, 'rgba(255,201,74,.35)');
    }

    // İleri ödüller: kaidelerinde, arkalarında dönen ışık hüzmeleri; yaklaştıkça parlar
    function reward(kind, n, x, y, now, front) {
      const ahead = n - front, near = ahead <= 3 ? 1 : 0.5, bob = reduced() ? 0 : Math.sin(now / 420 + x) * 3;
      const col = kind === 'mystery' ? '#c9a7ff' : kind === 'piece' ? '#ff8fab' : kind === 'bulb' ? '#9be7ff' : '#ffd34a';
      shadow(x + 3, y + 14, 18, 5, 0.4);
      g.fillStyle = 'rgba(40,30,60,.9)'; g.beginPath(); g.ellipse(x, y + 8, 18, 7, 0, 0, TAU); g.fill();
      add(() => {
        g.save(); g.translate(x, y - 6 + bob); g.rotate(reduced() ? 0 : now / 1600);
        g.globalAlpha = 0.35 + 0.35 * near;
        for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); const gr = g.createLinearGradient(0, 0, 0, -44); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-4, 0); g.lineTo(0, -44); g.lineTo(4, 0); g.fill(); }
        g.restore(); glow(x, y - 6 + bob, 26, col + 'aa', near);
      });
      g.save(); g.translate(x, y - 6 + bob);
      if (kind === 'chest') chest(0);
      else if (kind === 'mystery') {
        const gr = g.createRadialGradient(-3, -3, 1, 0, 0, 12); gr.addColorStop(0, '#e9dcff'); gr.addColorStop(1, '#7a52d6');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.font = '900 15px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1);
      } else if (kind === 'gold') {
        g.fillStyle = '#d98f12'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(0, 0, 9.5, 0, TAU); g.fill();
        g.fillStyle = '#7a4a00'; g.font = '900 10px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×2', 0, 1);
      } else if (kind === 'bulb') {
        g.fillStyle = '#e8fbff'; g.beginPath(); g.arc(0, -3, 9, 0, TAU); g.fill(); g.fillStyle = '#8a95a8'; g.fillRect(-4.5, 5, 9, 6);
        light(0, -3, 16, 'rgba(180,240,255,.7)');
      } else {
        g.fillStyle = '#ff8fab'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 13, -Math.PI / 2, Math.PI / 6); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      }
      g.restore();
    }

    // ---- kapı yapıları ----
    const CASTLE_STONES = (() => { const R = rng(404), out = []; for (let r = 0; r < 7; r++) for (let x = -(r % 2) * 13; x < W; x += 26) out.push({ r, x, tone: R() * 0.16 - 0.08, crack: R() < 0.08 }); return out; })();
    function gates(now, top, bot) {
      for (let gt = 2; gt <= L.gates; gt++) {
        const y = GATE_Y[gt];
        if (y < top - 120 || y - 260 > bot) continue;
        const w = worldOfGate(gt), open = openAmount(gt, now);
        if (w.id === 'fisek') castle(gt, y, open, now);
        else if (THEMED_GATES[gt]) themedGate(gt, y, open, now);
        else archGate(gt, y, open, w, now);
      }
      // Yolun başı: kapı 1'in kemeri
      const y1 = GATE_Y[1];
      if (y1 - 260 < bot && y1 > top - 120) { if (THEMED_GATES[1]) themedGate(1, y1, 1, now); else archGate(1, y1, 1, worldOfGate(1), now); }
    }
    // Havai Fişek: kesme taşlı, kuleli, parmaklıklı kale
    function castle(gt, y, open, now) {
      const top = y - 96;
      g.fillStyle = 'rgba(10,4,16,.5)'; g.beginPath(); g.ellipse(W / 2 + 10, y + 14, 230, 18, 0, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.rect(0, top, W, y - top + 4); g.clip();
      g.fillStyle = '#2e1830'; g.fillRect(0, top, W, y - top + 4);
      for (const s of CASTLE_STONES) {
        const sy = top + s.r * 14;
        g.fillStyle = shade('#6e4a6a', s.tone + (s.r === 0 ? 0.08 : 0) - s.r * 0.015); g.fillRect(s.x + 1, sy + 1, 24, 12);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(s.x + 1, sy + 1, 24, 2);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(s.x + 1, sy + 11, 24, 2);
        if (s.crack) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(s.x + 8, sy + 2); g.lineTo(s.x + 12, sy + 7); g.lineTo(s.x + 10, sy + 12); g.stroke(); }
      }
      const dk = g.createLinearGradient(0, top, 0, y + 4); dk.addColorStop(0.6, 'rgba(10,4,16,0)'); dk.addColorStop(1, 'rgba(10,4,16,.5)');
      g.fillStyle = dk; g.fillRect(0, top, W, y - top + 4);
      g.restore();
      for (let x = 4; x < W; x += 30) { g.fillStyle = '#5a3a58'; g.fillRect(x, top - 15, 18, 16); g.fillStyle = '#8a6688'; g.fillRect(x, top - 15, 18, 3); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 14, top - 12, 4, 13); }
      g.fillStyle = '#7a5878'; g.fillRect(0, top - 1, W, 4);
      g.strokeStyle = 'rgba(90,150,90,.75)'; g.lineWidth = 1.6;
      for (const vx of [36, W - 40]) { g.beginPath(); g.moveTo(vx, top); for (let i = 1; i <= 6; i++) g.lineTo(vx + Math.sin(i * 1.7) * 6, top + i * 11); g.stroke(); g.fillStyle = 'rgba(110,180,100,.8)'; for (let i = 1; i <= 6; i++) { g.beginPath(); g.ellipse(vx + Math.sin(i * 1.7) * 6 + 3, top + i * 11, 3, 2, 0.6, 0, TAU); g.fill(); } }
      for (const sx of [-1, 1]) tower(W / 2 + sx * 98, y, sx, now);
      door(gt, y, open, now, '#7e5a7c');
      g.fillStyle = '#3a1a30'; g.fillRect(W / 2 - 38, top - 4, 76, 18); g.strokeStyle = '#c0882a'; g.lineWidth = 1.5; g.strokeRect(W / 2 - 38, top - 4, 76, 18);
      g.fillStyle = '#ffd36b'; g.font = '900 11px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tr('Kapı {n}', { n: gt }).toLocaleUpperCase(), W / 2, top + 5);
      for (const bx of [W / 2 - 74, W / 2 + 74]) {
        const sway = reduced() ? 0 : Math.sin(now / 700 + bx) * 1.5;
        g.fillStyle = bx < W / 2 ? '#c0392b' : '#d68910';
        g.beginPath(); g.moveTo(bx - 9, top + 4); g.lineTo(bx + 9, top + 4); g.lineTo(bx + 9 + sway, top + 44); g.lineTo(bx + sway, top + 36); g.lineTo(bx - 9 + sway, top + 44); g.closePath(); g.fill();
        g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(bx + sway * 0.5, top + 20, 4, 0, TAU); g.fill();
        g.fillStyle = '#c0882a'; g.fillRect(bx - 11, top + 2, 22, 3);
      }
    }
    function tower(tx, y, sx, now) {
      const tw = 30, tt = y - 150;
      g.fillStyle = 'rgba(10,4,16,.45)'; g.beginPath(); g.ellipse(tx + 8, y + 6, 36, 9, 0, 0, TAU); g.fill();
      const body = g.createLinearGradient(tx - tw, 0, tx + tw, 0); body.addColorStop(0, '#5a3a58'); body.addColorStop(0.35, '#86638a'); body.addColorStop(1, '#3a2240');
      g.fillStyle = body; g.fillRect(tx - tw, tt, tw * 2, y - tt + 4);
      g.strokeStyle = 'rgba(20,8,24,.35)'; g.lineWidth = 1;
      for (let r = 0; r * 13 < y - tt; r++) { const yy = tt + r * 13; g.beginPath(); g.moveTo(tx - tw, yy); g.quadraticCurveTo(tx, yy + 4, tx + tw, yy); g.stroke(); for (let i = 0; i < 4; i++) { const xx = tx - tw + 8 + i * 15 + (r % 2) * 7; g.beginPath(); g.moveTo(xx, yy + 1); g.lineTo(xx, yy + 13); g.stroke(); } }
      const fl = reduced() ? 1 : 0.85 + 0.15 * Math.sin(now / 300 + sx);
      g.fillStyle = '#2a1430'; g.beginPath(); g.moveTo(tx - 7, tt + 60); g.lineTo(tx - 7, tt + 44); g.quadraticCurveTo(tx, tt + 34, tx + 7, tt + 44); g.lineTo(tx + 7, tt + 60); g.fill();
      g.fillStyle = `rgba(255,214,120,${fl})`; g.beginPath(); g.moveTo(tx - 5, tt + 58); g.lineTo(tx - 5, tt + 45); g.quadraticCurveTo(tx, tt + 38, tx + 5, tt + 45); g.lineTo(tx + 5, tt + 58); g.fill();
      g.strokeStyle = '#2a1430'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(tx, tt + 40); g.lineTo(tx, tt + 58); g.moveTo(tx - 5, tt + 50); g.lineTo(tx + 5, tt + 50); g.stroke();
      add(() => glow(tx, tt + 50, 26 * fl, 'rgba(255,200,110,.45)'));
      for (let i = 0; i < 4; i++) { const xx = tx - tw + 2 + i * 16; g.fillStyle = '#6a4868'; g.fillRect(xx, tt - 10, 11, 11); g.fillStyle = '#9a789a'; g.fillRect(xx, tt - 10, 11, 2.5); }
      const rt = tt - 62, rb = tt - 8;
      const roof = g.createLinearGradient(tx - tw - 6, 0, tx + tw + 6, 0); roof.addColorStop(0, '#7a2a3a'); roof.addColorStop(0.4, '#b84a5a'); roof.addColorStop(1, '#5a1a2a');
      g.fillStyle = roof; g.beginPath(); g.moveTo(tx - tw - 6, rb); g.lineTo(tx, rt); g.lineTo(tx + tw + 6, rb); g.quadraticCurveTo(tx, rb + 8, tx - tw - 6, rb); g.fill();
      g.strokeStyle = 'rgba(40,8,16,.4)'; g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { const f = i / 5, yy = rt + (rb - rt) * f, hw = (tw + 6) * f; g.beginPath(); g.moveTo(tx - hw, yy); g.quadraticCurveTo(tx, yy + 4 * f, tx + hw, yy); g.stroke(); }
      g.strokeStyle = '#c0882a'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, rt); g.lineTo(tx, rt - 22); g.stroke();
      const wave = reduced() ? 0 : Math.sin(now / 220 + sx) * 4;
      g.fillStyle = sx < 0 ? '#e74c3c' : '#f1c40f'; g.beginPath(); g.moveTo(tx, rt - 22); g.quadraticCurveTo(tx + 12, rt - 20 + wave, tx + 24, rt - 17 + wave); g.lineTo(tx, rt - 11); g.fill();
      torch(tx - sx * (tw + 2), y - 50, now);
    }
    // Kapı ağzı: kemer taşları, açılınca ışık hüzmeleri; parmaklık kalkar, ahşap kanatlar içe katlanır
    function door(gt, y, open, now, stone) {
      const gx = W / 2, gw = 50, gtop = y - 76;
      const mouth = () => { g.beginPath(); g.moveTo(gx - gw, y + 4); g.lineTo(gx - gw, gtop + 26); g.quadraticCurveTo(gx, gtop - 16, gx + gw, gtop + 26); g.lineTo(gx + gw, y + 4); };
      g.fillStyle = '#1a0c1a'; mouth(); g.fill();
      if (open > 0) add(() => {
        glow(gx, y - 30, 160 * open, `rgba(255,230,170,${0.9 * open})`);
        if (S.opening[gt] != null && open < 1 || S.opening[gt] != null && now - S.opening[gt] < 3000) {
          g.save(); g.translate(gx, y - 30); g.globalAlpha = Math.max(0, 1 - (now - S.opening[gt] - 1200) / 1800) * 0.45;
          for (let i = 0; i < 10; i++) { g.rotate(TAU / 10 + now / 4000); const gr = g.createLinearGradient(0, 0, 0, -260); gr.addColorStop(0, '#fff2c8'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, -260); g.lineTo(10, 0); g.fill(); }
          g.restore();
        }
      });
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI, rx = gw + 9, ry = 46, cx = gx + Math.cos(a) * rx, cy = gtop + 30 + Math.sin(a) * ry;
        g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2);
        g.fillStyle = i === 5 ? shade(stone, 0.25) : shade(stone, ((i * 37) % 10) / 60 - 0.08); g.fillRect(-6, -8, 12, 16);
        g.strokeStyle = 'rgba(20,8,24,.6)'; g.lineWidth = 1; g.strokeRect(-6, -8, 12, 16);
        g.restore();
      }
      g.save(); mouth(); g.clip();
      const lift = open * 90;
      g.strokeStyle = '#3a3440'; g.lineWidth = 3;
      for (let x = gx - gw + 8; x < gx + gw; x += 12) { g.beginPath(); g.moveTo(x, gtop - 20 - lift); g.lineTo(x, y + 2 - lift); g.stroke(); }
      for (let yy = gtop; yy < y; yy += 14) { g.beginPath(); g.moveTo(gx - gw, yy - lift); g.lineTo(gx + gw, yy - lift); g.stroke(); }
      for (const sx of [-1, 1]) {
        const fw = (gw - 2) * (1 - open * 0.9), x0 = sx < 0 ? gx - gw + 2 : gx + gw - 2 - fw;
        const wd = g.createLinearGradient(x0, 0, x0 + fw, 0); wd.addColorStop(0, '#8a4a2a'); wd.addColorStop(1, '#6a3420');
        g.fillStyle = wd; g.fillRect(x0, gtop - 20, fw, y - gtop + 24);
        g.strokeStyle = 'rgba(40,16,8,.7)'; g.lineWidth = 1.4;
        for (let i = 1; i < 5; i++) { const xx = x0 + i * fw / 5; g.beginPath(); g.moveTo(xx, gtop - 20); g.lineTo(xx, y + 4); g.stroke(); }
        for (const by of [gtop + 18, y - 22]) { g.fillStyle = '#3a3440'; g.fillRect(x0, by, fw, 5); for (let i = 0; i < 4 && fw > 10; i++) { g.fillStyle = '#9aa0b0'; g.beginPath(); g.arc(x0 + 5 + i * (fw - 10) / 3, by + 2.5, 1.4, 0, TAU); g.fill(); } }
      }
      g.restore();
      if (!open) { g.fillStyle = '#c0882a'; g.beginPath(); g.arc(gx - 8, y - 30, 3.5, 0, TAU); g.arc(gx + 8, y - 30, 3.5, 0, TAU); g.fill(); g.strokeStyle = '#c0882a'; g.lineWidth = 2; g.beginPath(); g.arc(gx - 8, y - 25, 4, 0, Math.PI); g.arc(gx + 8, y - 25, 4, 0, Math.PI); g.stroke(); }
    }
    // Sahnesi henüz çizilmemiş dünyaların kapısı: iki taş sütun, temanın renginde fenerler, kemer ve ad tabelası
    function archGate(gt, y, open, w, now) {
      const acc = w.theme.accent, base = shade(w.theme.bottom, 1.8);
      g.fillStyle = 'rgba(10,4,16,.45)'; g.beginPath(); g.ellipse(W / 2 + 8, y + 12, 150, 14, 0, 0, TAU); g.fill();
      for (const sx of [-1, 1]) {
        const px = W / 2 + sx * 78;
        const col = g.createLinearGradient(px - 18, 0, px + 18, 0); col.addColorStop(0, shade(base, 0.2)); col.addColorStop(0.4, shade(base, 0.6)); col.addColorStop(1, shade(base, -0.3));
        g.fillStyle = col; g.fillRect(px - 18, y - 128, 36, 132);
        g.fillStyle = shade(base, 0.8); g.fillRect(px - 22, y - 136, 44, 10); g.fillRect(px - 22, y - 4, 44, 8);
        const fl = reduced() ? 1 : 0.85 + 0.15 * Math.sin(now / 260 + sx);
        g.fillStyle = acc; g.beginPath(); g.arc(px, y - 150, 7, 0, TAU); g.fill();
        add(() => glow(px, y - 150, 34 * fl, acc + 'aa'));
      }
      g.fillStyle = shade(base, 0.4); g.beginPath(); g.moveTo(W / 2 - 96, y - 120); g.quadraticCurveTo(W / 2, y - 196, W / 2 + 96, y - 120); g.lineTo(W / 2 + 96, y - 104); g.quadraticCurveTo(W / 2, y - 176, W / 2 - 96, y - 104); g.closePath(); g.fill();
      door(gt, y, open, now, base.startsWith('rgb') ? '#6e5a7a' : base);
      const label = tr('Kapı {n}', { n: gt }).toLocaleUpperCase();
      g.font = '900 11px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lw = g.measureText(label).width + 22;
      g.fillStyle = 'rgba(14,16,30,.9)'; rr(W / 2 - lw / 2, y - 190, lw, 20, 8); g.fill();
      g.strokeStyle = acc; g.lineWidth = 1.4; rr(W / 2 - lw / 2, y - 190, lw, 20, 8); g.stroke();
      g.fillStyle = acc; g.fillText(label, W / 2, y - 180);
    }

    // Kapı tabelası: yapının tepesinde kapının numarası
    function gateSign(gt, y, acc) {
      const label = tr('Kapı {n}', { n: gt }).toLocaleUpperCase();
      g.font = '900 11px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lw = g.measureText(label).width + 22;
      g.fillStyle = 'rgba(14,16,30,.92)'; rr(W / 2 - lw / 2, y - 10, lw, 20, 8); g.fill();
      g.strokeStyle = acc; g.lineWidth = 1.4; rr(W / 2 - lw / 2, y - 10, lw, 20, 8); g.stroke();
      g.fillStyle = acc; g.fillText(label, W / 2, y);
    }
    // Senaryodaki kapı yapıları (journey.js GATES): her biri kapı ağzını (door) kendi yapısıyla çerçeveler
    const THEMED_GATES = { 1: 'flowerArch', 2: 'stoneBridge', 3: 'gardenGate', 4: 'rootTree', 5: 'chainGate', 6: 'valleyArch',
      7: 'workDoor', 8: 'gearGate', 9: 'pendulumGate', 10: 'springCage', 11: 'cellGate', 12: 'cryptGate', 13: 'streetArch', 14: 'townTower',
      15: 'factoryGate', 16: 'boilerHatch', 17: 'launchTower', 18: 'airlock',
      19: 'mastersHall', 20: 'machineGate', 21: 'funArch', 22: 'funArch', 23: 'coasterTunnel',
      24: 'substation', 25: 'damGate', 26: 'harborLights', 27: 'seaCave', 28: 'lighthouseDoor', 29: 'domeGate', 30: 'starGate',
      34: 'iceArch', 35: 'iceCave', 36: 'sluiceGate', 37: 'millGate', 38: 'barnGate', 39: 'mirrorGate', 40: 'phoenixPortal' };
    function themedGate(gt, y, open, now) {
      const kind = THEMED_GATES[gt], cx = W / 2, acc = worldOfGate(gt).theme.accent;
      g.fillStyle = 'rgba(6,14,12,.5)'; g.beginPath(); g.ellipse(cx + 8, y + 12, 170, 16, 0, 0, TAU); g.fill();
      if (kind === 'stoneBridge') {
        // dere yatağı boydan boya akar, taş köprü üstünden geçer
        g.fillStyle = '#1e4f78'; g.fillRect(0, y - 14, W, 26);
        g.fillStyle = 'rgba(160,220,255,.35)'; for (let x = (now / 40) % 40 - 40; x < W; x += 40) g.fillRect(x, y - 4, 16, 2);
      }
      if (kind === 'flowerArch' || kind === 'gardenGate' || kind === 'chainGate' || kind === 'stoneBridge') {
        // iki sütun: çiçekli çit, tuğla direk, ahşap direk ya da köprü ayağı
        for (const sx of [-1, 1]) {
          const px = cx + sx * 76;
          if (kind === 'flowerArch') { g.fillStyle = '#21543a'; rr(px - 16, y - 120, 32, 124, 14); g.fill(); g.fillStyle = '#2d6a46'; rr(px - 12, y - 116, 14, 116, 8); g.fill(); }
          else if (kind === 'gardenGate') { g.fillStyle = '#7a3a2a'; g.fillRect(px - 16, y - 130, 32, 134); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let k = 0; k < 13; k++) { g.beginPath(); g.moveTo(px - 16, y - 126 + k * 10); g.lineTo(px + 16, y - 126 + k * 10); g.stroke(); } g.fillStyle = '#9a4a34'; g.fillRect(px - 20, y - 138, 40, 10); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(px, y - 146, 6, 0, TAU); g.fill(); add(() => glow(px, y - 146, 30, 'rgba(255,210,120,.6)')); }
          else if (kind === 'chainGate') { g.fillStyle = '#6b4a2a'; g.fillRect(px - 10, y - 124, 20, 128); g.fillStyle = '#8a643a'; g.fillRect(px - 10, y - 124, 6, 128); g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(px - 12, y - 124); g.lineTo(px, y - 136); g.lineTo(px + 12, y - 124); g.fill(); }
          else { g.fillStyle = '#7d8590'; g.fillRect(px - 18, y - 70, 36, 74); g.strokeStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(px - 18, y - 64 + k * 10); g.lineTo(px + 18, y - 64 + k * 10); g.stroke(); } }
        }
      }
      if (kind === 'flowerArch') {
        g.strokeStyle = '#21543a'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.arc(cx, y - 110, 76, Math.PI, 0); g.stroke();
        const cols = ['#ff8fab', '#ffffff', '#ffc94a', '#b388ff'];
        for (let k = 0; k <= 16; k++) { const a = Math.PI + (k / 16) * Math.PI, fx = cx + Math.cos(a) * 76, fy = y - 110 + Math.sin(a) * 76; g.fillStyle = cols[k % 4]; g.beginPath(); g.arc(fx, fy, 3.6, 0, TAU); g.fill(); }
        for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) { g.fillStyle = cols[(k + (sx > 0 ? 1 : 0)) % 4]; g.beginPath(); g.arc(cx + sx * 76 + (k % 2 ? 6 : -6), y - 104 + k * 18, 3, 0, TAU); g.fill(); }
      } else if (kind === 'stoneBridge') {
        g.fillStyle = '#8a929c'; g.beginPath(); g.moveTo(cx - 120, y - 70); g.quadraticCurveTo(cx, y - 120, cx + 120, y - 70); g.lineTo(cx + 120, y - 54); g.quadraticCurveTo(cx, y - 100, cx - 120, y - 54); g.closePath(); g.fill();
        g.fillStyle = '#9ea7b2'; for (let k = -5; k <= 5; k++) { const bx = cx + k * 20, by = y - 104 + Math.pow(k / 5, 2) * 36; g.fillRect(bx - 6, by - 10, 12, 10); }
      } else if (kind === 'gardenGate') {
        g.strokeStyle = '#2a2a34'; g.lineWidth = 3; for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const x = cx + sx * (100 + k * 14); g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y - 70); g.stroke(); g.fillStyle = '#2a2a34'; g.beginPath(); g.moveTo(x - 3, y - 70); g.lineTo(x, y - 78); g.lineTo(x + 3, y - 70); g.fill(); }
        g.strokeStyle = '#3f8a52'; g.lineWidth = 2; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 66, y); for (let k = 1; k <= 8; k++) g.lineTo(cx + sx * (66 + Math.sin(k * 1.7) * 8), y - k * 15); g.stroke(); g.fillStyle = '#5cc27f'; for (let k = 1; k <= 8; k++) { g.beginPath(); g.ellipse(cx + sx * (66 + Math.sin(k * 1.7) * 8) + 3, y - k * 15, 3.4, 2, 0.6, 0, TAU); g.fill(); } }
        g.strokeStyle = '#2a2a34'; g.lineWidth = 4; g.beginPath(); g.arc(cx, y - 112, 64, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      } else if (kind === 'rootTree') {
        // yaşlı ağaç: gövdenin dibinde köklerin arasından tünel, üstte geniş tepe
        g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(cx - 96, y + 4); g.quadraticCurveTo(cx - 70, y - 40, cx - 60, y - 150); g.lineTo(cx + 60, y - 150); g.quadraticCurveTo(cx + 70, y - 40, cx + 96, y + 4); g.closePath(); g.fill();
        g.strokeStyle = '#5a3a24'; g.lineWidth = 5; g.lineCap = 'round';
        for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx + sx * (30 + k * 16), y - 40 - k * 20); g.bezierCurveTo(cx + sx * (70 + k * 10), y - 30, cx + sx * (40 + k * 30), y - 6, cx + sx * (100 + k * 20), y + 4); g.stroke(); }
        g.strokeStyle = 'rgba(30,18,10,.45)'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(cx - 50 + k * 20, y - 150); g.quadraticCurveTo(cx - 54 + k * 21, y - 100, cx - 46 + k * 18, y - 80); g.stroke(); }
        g.fillStyle = '#1f4a34'; for (const [dx, dy, r] of [[-90, -170, 46], [90, -170, 46], [0, -200, 60], [-46, -210, 40], [46, -210, 40]]) { g.beginPath(); g.arc(cx + dx, y + dy, r, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(120,210,150,.15)'; g.beginPath(); g.arc(cx - 20, y - 220, 30, 0, TAU); g.fill();
      } else if (kind === 'chainGate') {
        g.fillStyle = '#6b4a2a'; g.fillRect(cx - 90, y - 128, 180, 10);
        g.strokeStyle = '#9aa0b0'; g.lineWidth = 2;
        for (const sx of [-1, 1]) { for (let k = 0; k < 9; k++) { const t = k / 8, x = cx + sx * (12 + t * 64), yy = y - 118 + Math.sin(t * Math.PI) * 26; g.beginPath(); g.ellipse(x, yy, 4, 2.6, sx * 0.5, 0, TAU); g.stroke(); } }
        g.fillStyle = '#c0882a'; g.beginPath(); g.arc(cx, y - 112, 7, 0, TAU); g.fill(); g.strokeStyle = '#c0882a'; g.lineWidth = 2.4; g.beginPath(); g.arc(cx, y - 120, 5, Math.PI, 0); g.stroke();
      } else if (kind === 'valleyArch') {
        // vadinin çıkışı: iki yanda kayalık, ortada kilit taşlı büyük kemer, tepesinde aslan başı
        for (const sx of [-1, 1]) { g.fillStyle = '#5a5464'; g.beginPath(); g.moveTo(cx + sx * 60, y + 4); g.lineTo(cx + sx * 70, y - 160); g.lineTo(cx + sx * 130, y - 200); g.lineTo(cx + sx * 200, y - 150); g.lineTo(cx + sx * 210, y + 4); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(cx + sx * 70, y - 160); g.lineTo(cx + sx * 130, y - 200); g.lineTo(cx + sx * 110, y - 120); g.closePath(); g.fill(); }
        g.fillStyle = '#7a7280'; g.beginPath(); g.moveTo(cx - 76, y - 70); g.quadraticCurveTo(cx, y - 190, cx + 76, y - 70); g.lineTo(cx + 64, y - 70); g.quadraticCurveTo(cx, y - 170, cx - 64, y - 70); g.closePath(); g.fill();
        g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(cx, y - 146, 16, 0, TAU); g.fill(); g.fillStyle = '#8a5a1a'; for (let k = 0; k < 10; k++) { const a = k * TAU / 10; g.beginPath(); g.arc(cx + Math.cos(a) * 15, y - 146 + Math.sin(a) * 15, 4, 0, TAU); g.fill(); }
        g.fillStyle = '#e0b24a'; g.beginPath(); g.arc(cx, y - 146, 10, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(cx - 4, y - 148, 1.4, 0, TAU); g.arc(cx + 4, y - 148, 1.4, 0, TAU); g.fill();
      }
      if (kind === 'workDoor') {
        // atölyenin ahşap cephesi: tahta kaplama, üçgen alınlık, iki yanda pencere ve asılı tabela
        g.fillStyle = '#5a3a24'; g.fillRect(cx - 150, y - 150, 300, 154);
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.4; for (let k = 0; k < 15; k++) { g.beginPath(); g.moveTo(cx - 150, y - 146 + k * 10); g.lineTo(cx + 150, y - 146 + k * 10); g.stroke(); }
        g.fillStyle = '#7a4e28'; g.beginPath(); g.moveTo(cx - 170, y - 150); g.lineTo(cx, y - 220); g.lineTo(cx + 170, y - 150); g.closePath(); g.fill();
        g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(cx - 150, y - 156); g.lineTo(cx, y - 210); g.lineTo(cx + 150, y - 156); g.closePath(); g.fill();
        for (const sx of [-1, 1]) { const wx = cx + sx * 104; g.fillStyle = '#2a1a10'; g.fillRect(wx - 22, y - 120, 44, 40); g.fillStyle = 'rgba(255,200,120,.75)'; g.fillRect(wx - 19, y - 117, 17, 16); g.fillRect(wx + 2, y - 117, 17, 16); g.fillRect(wx - 19, y - 98, 17, 15); g.fillRect(wx + 2, y - 98, 17, 15); add(() => glow(wx, y - 100, 40, 'rgba(255,190,110,.4)')); }
        gear(cx, y - 180, 16, 10, reduced() ? 0 : now / 1500, '#c0882a');
      } else if (kind === 'gearGate' || kind === 'machineGate') {
        // dev çark: kapı çarkın ortasından açılır, çevresinde dişliler döner; Büyük Makine altın ve kalbi ışıl ışıl
        const rot = reduced() ? 0 : now / 3000, gold = kind === 'machineGate';
        if (gold) add(() => glow(cx, y - 70, 200, 'rgba(255,200,110,.25)'));
        gear(cx, y - 70, 120, 20, rot, gold ? '#8a6a20' : '#6a5030'); gear(cx, y - 70, 100, 18, rot, gold ? '#c99a3a' : '#8a6a3a');
        gear(cx - 128, y - 150, 34, 10, -rot * 3.5, '#9aa0b0'); gear(cx + 132, y - 140, 28, 9, -rot * 4, '#c0882a');
        g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(cx, y - 70, 70, 0, TAU); g.fill();
      } else if (kind === 'pendulumGate') {
        // kule kapısı: taş cephe, tepede kadran, önünde sallanan sarkaç
        g.fillStyle = '#2a2e48'; g.fillRect(cx - 110, y - 220, 220, 224);
        g.fillStyle = '#3a3f60'; g.beginPath(); g.moveTo(cx - 124, y - 220); g.lineTo(cx, y - 290); g.lineTo(cx + 124, y - 220); g.closePath(); g.fill();
        clock(cx, y - 168, 36, now);
        const a = reduced() ? 0 : Math.sin(now / 800) * 0.35;
        for (const sx of [-1, 1]) { g.save(); g.translate(cx + sx * 140, y - 210); g.rotate(a * sx); g.strokeStyle = '#c99a3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 120); g.stroke(); g.fillStyle = '#e0b24a'; g.beginPath(); g.arc(0, 128, 14, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(-4, 124, 5, 0, TAU); g.fill(); g.restore(); }
      } else if (kind === 'springCage') {
        // zemberek kafesi: pirinç parmaklıklar, ortada gerilip gevşeyen dev yay
        g.strokeStyle = '#c99a3a'; g.lineWidth = 4;
        for (let k = -6; k <= 6; k++) { if (Math.abs(k) < 2) continue; const x = cx + k * 22; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y - 170); g.stroke(); }
        g.beginPath(); g.ellipse(cx, y - 170, 140, 30, 0, Math.PI, 0); g.stroke(); g.fillStyle = '#c99a3a'; g.fillRect(cx - 140, y - 4, 280, 8);
        const k2 = reduced() ? 1 : 1 + Math.sin(now / 600) * 0.06; g.save(); g.translate(cx, y - 196); g.scale(k2, k2);
        g.strokeStyle = '#d0d6e0'; g.lineWidth = 3; g.beginPath(); for (let a2 = 0; a2 < TAU * 3.6; a2 += 0.12) { const rr3 = 3 + a2 * 2.6; g.lineTo(Math.cos(a2) * rr3, Math.sin(a2) * rr3 * 0.6); } g.stroke(); g.restore();
      } else if (kind === 'cellGate' || kind === 'cryptGate') {
        // zindan duvarı: kaba taş blokları, iki yanda parmaklıklı hücre pencereleri ve meşaleler;
        // mahzende üstte ejderha başlı kemer, gözleri kor gibi yanar
        g.fillStyle = '#3a3640'; g.fillRect(cx - 170, y - 170, 340, 174);
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(cx - 170, y - 166 + k * 24); g.lineTo(cx + 170, y - 166 + k * 24); g.stroke(); for (let x = cx - 170 + (k % 2) * 24; x < cx + 170; x += 48) { g.beginPath(); g.moveTo(x, y - 166 + k * 24); g.lineTo(x, y - 142 + k * 24); g.stroke(); } }
        for (const sx of [-1, 1]) {
          const wx = cx + sx * 116; g.fillStyle = '#0e0c12'; g.fillRect(wx - 18, y - 130, 36, 40); g.strokeStyle = '#7a7480'; g.lineWidth = 2.4; for (let x = wx - 12; x <= wx + 12; x += 8) { g.beginPath(); g.moveTo(x, y - 130); g.lineTo(x, y - 90); g.stroke(); }
          torch(cx + sx * 70, y - 120, now);
        }
        if (kind === 'cryptGate') {
          g.fillStyle = '#4a4650'; g.beginPath(); g.moveTo(cx - 80, y - 90); g.quadraticCurveTo(cx, y - 200, cx + 80, y - 90); g.lineTo(cx + 64, y - 90); g.quadraticCurveTo(cx, y - 176, cx - 64, y - 90); g.closePath(); g.fill();
          g.fillStyle = '#5a5664'; g.beginPath(); g.moveTo(cx - 26, y - 156); g.lineTo(cx, y - 186); g.lineTo(cx + 26, y - 156); g.lineTo(cx + 14, y - 140); g.lineTo(cx - 14, y - 140); g.closePath(); g.fill();
          g.fillStyle = '#ff6b3d'; g.beginPath(); g.ellipse(cx - 8, y - 160, 4, 2, 0.3, 0, TAU); g.ellipse(cx + 8, y - 160, 4, 2, -0.3, 0, TAU); g.fill(); add(() => glow(cx, y - 160, 30, 'rgba(255,100,50,.6)'));
        }
      } else if (kind === 'streetArch') {
        // şehrin girişi: iki sokak lambası, aralarında ışıklı demir kemer
        for (const sx of [-1, 1]) { const px = cx + sx * 80; g.fillStyle = '#2a2630'; g.fillRect(px - 4, y - 150, 8, 154); g.fillRect(px - 9, y - 4, 18, 6); g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(px, y - 158, 9, 0, TAU); g.fill(); add(() => glow(px, y - 158, 60, 'rgba(255,220,150,.55)')); }
        g.strokeStyle = '#2a2630'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 80, y - 130); g.quadraticCurveTo(cx, y - 200, cx + 80, y - 130); g.stroke();
        for (let k = 1; k < 10; k++) { const t2 = k / 10, x = cx - 80 + 160 * t2, yy = y - 130 - Math.sin(t2 * Math.PI) * 36; g.fillStyle = ['#ffc94a', '#ff8fab', '#4cc9f0'][k % 3]; g.beginPath(); g.arc(x, yy + 6, 3, 0, TAU); g.fill(); }
        DECOR_ART.house({ x: cx - 150, y, s: 1.2, c: '#5a4a6e', ph: 0.15 }); DECOR_ART.house({ x: cx + 150, y, s: 1.2, c: '#6e4a5a', ph: 0.25 });
      } else if (kind === 'townTower') {
        // meydanın saat kulesi: kule gövdesi, tepede kadran ve çan, iki yanda evler
        DECOR_ART.house({ x: cx - 140, y, s: 1.4, c: '#5a4a6e', ph: 0.15 }); DECOR_ART.house({ x: cx + 140, y, s: 1.4, c: '#6e4a5a', ph: 0.25 });
        g.fillStyle = '#6e5a7a'; g.fillRect(cx - 70, y - 240, 140, 244); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx + 30, y - 240, 40, 244);
        g.fillStyle = '#5a3040'; g.beginPath(); g.moveTo(cx - 82, y - 240); g.lineTo(cx, y - 310); g.lineTo(cx + 82, y - 240); g.closePath(); g.fill();
        clock(cx, y - 190, 32, now);
      } else if (kind === 'mastersHall') {
        // ustaların salonu: mermer basamaklar, altı sütun, altın kakmalı alınlık
        g.fillStyle = '#b8b0a0'; for (let k = 0; k < 3; k++) g.fillRect(cx - 160 + k * 8, y - 4 - k * 6, 320 - k * 16, 6);
        for (let k = 0; k < 6; k++) { if (k === 2 || k === 3) continue; const x = cx - 135 + k * 54; g.fillStyle = '#e8e0d0'; g.fillRect(x - 11, y - 170, 22, 152); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + 3, y - 170, 4, 152); g.fillStyle = '#c99a3a'; g.fillRect(x - 14, y - 176, 28, 6); }
        g.fillStyle = '#ece4d4'; g.beginPath(); g.moveTo(cx - 170, y - 176); g.lineTo(cx, y - 236); g.lineTo(cx + 170, y - 176); g.closePath(); g.fill();
        g.strokeStyle = '#c99a3a'; g.lineWidth = 3; g.stroke(); gear(cx, y - 198, 14, 10, reduced() ? 0 : now / 2000, '#c99a3a');
      } else if (kind === 'funArch' || kind === 'coasterTunnel') {
        // lunapark girişi: çizgili sütunlar, ampullü kemer; hız treninde kemerin üstünden geçen ray ve tünel ağzı
        const c = gt % 2 ? '#ff6fb5' : '#4cc9f0';
        for (const sx of [-1, 1]) { const px = cx + sx * 84; for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? c : '#fff5ea'; g.fillRect(px - 12, y - 160 + k * 20, 24, 20); } g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(px, y - 168, 12, 0, TAU); g.fill(); add(() => glow(px, y - 168, 40, 'rgba(255,220,120,.5)')); }
        g.strokeStyle = c; g.lineWidth = 16; g.beginPath(); g.arc(cx, y - 150, 84, Math.PI, 0); g.stroke();
        for (let k = 0; k <= 14; k++) { const a = Math.PI + (k / 14) * Math.PI, on2 = reduced() || Math.floor(now / 250 + k) % 2; g.fillStyle = on2 ? '#fff2b0' : '#8a7a50'; g.beginPath(); g.arc(cx + Math.cos(a) * 84, y - 150 + Math.sin(a) * 84, 3.4, 0, TAU); g.fill(); }
        if (kind === 'coasterTunnel') { g.strokeStyle = '#c0392b'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 200, y - 60); g.bezierCurveTo(cx - 120, y - 330, cx + 120, y - 330, cx + 200, y - 120); g.stroke(); g.strokeStyle = '#9aa0b0'; g.lineWidth = 2; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(cx + k * 50, y - 240 + Math.abs(k) * 40); g.lineTo(cx + k * 50, y); g.stroke(); } }
      } else if (kind === 'substation') {
        // trafo istasyonu: tel örgü çit, trafolar, aralarında çakan elektrik
        g.strokeStyle = 'rgba(180,190,200,.6)'; g.lineWidth = 1; for (let x = cx - 170; x < cx + 170; x += 10) { if (Math.abs(x - cx) < 60) continue; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y - 90); g.moveTo(x + 10, y); g.lineTo(x, y - 90); g.stroke(); }
        for (const sx of [-1, 1]) { g.save(); g.translate(cx + sx * 120, y - 90); g.scale(2.2, 2.2); STATION_ART.trafo(true, reduced() ? 0 : now); g.restore(); g.save(); g.translate(cx + sx * 70, y); g.scale(1.6, 3.2); STATION_ART.direk(); g.restore(); }
      } else if (kind === 'damGate') {
        // baraj: arkada göl, beton duvar, iki kanaldan aşağı akan su
        g.fillStyle = '#1e4f78'; g.fillRect(0, y - 200, W, 30);
        g.fillStyle = '#7a8088'; g.beginPath(); g.moveTo(cx - 200, y - 170); g.lineTo(cx + 200, y - 170); g.lineTo(cx + 220, y + 4); g.lineTo(cx - 220, y + 4); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.4; for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(cx - 200 - k * 2.5, y - 170 + k * 21); g.lineTo(cx + 200 + k * 2.5, y - 170 + k * 21); g.stroke(); }
        g.fillStyle = 'rgba(160,220,255,.55)'; for (const x of [cx - 140, cx + 120]) { g.fillRect(x, y - 170, 20, 170); if (!reduced()) { g.fillStyle = 'rgba(230,248,255,.8)'; for (let i = 0; i < 3; i++) g.fillRect(x + 3 + i * 6, y - 170 + ((now / 10 + i * 60) % 170), 2, 14); g.fillStyle = 'rgba(160,220,255,.55)'; } }
      } else if (kind === 'harborLights' || kind === 'lighthouseDoor') {
        // liman: iki iskele feneri arasından geçiş; son kapı dev deniz fenerinin kapısı
        g.fillStyle = '#6a7380'; g.fillRect(0, y - 6, W, 14);
        if (kind === 'harborLights') { for (const sx of [-1, 1]) lighthouse(cx + sx * 110, y - 4, 1.9, now + sx * 400); }
        else lighthouse(cx, y + 4, 3, now);
      } else if (kind === 'seaCave') {
        // kayalıklarda deniz mağarası: dalgalar mağaranın ağzına vurur
        g.fillStyle = '#3e4a58'; g.beginPath(); g.moveTo(cx - 220, y + 4); g.lineTo(cx - 190, y - 130); g.lineTo(cx - 90, y - 180); g.lineTo(cx + 40, y - 190); g.lineTo(cx + 170, y - 160); g.lineTo(cx + 220, y + 4); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(cx - 190, y - 130); g.lineTo(cx - 90, y - 180); g.lineTo(cx - 80, y - 110); g.closePath(); g.fill();
        if (!reduced()) { const ph = (now / 1600) % 1; g.fillStyle = `rgba(230,245,255,${0.8 * (1 - ph)})`; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(cx - 70 + i * 20, y - 20 - ph * 40 - (i % 3) * 8, 3, 0, TAU); g.fill(); } }
      } else if (kind === 'domeGate' || kind === 'starGate') {
        // gözlemevi: kapı kubbenin dibinde; Yıldız Haritası'nda kubbenin üstünde takımyıldız kemeri
        observatory(cx, y + 4, 5, now);
        if (kind === 'starGate') { const pts = []; for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI; pts.push([cx + Math.cos(a) * 150, y - 120 + Math.sin(a) * 100 + (k % 2) * 10]); } constellation(pts, now); }
      } else if (kind === 'iceArch' || kind === 'iceCave') {
        // buz blokları kemeri, sarkıtlar; mağarada iki yanda buz yığınları ve parlayan kristaller
        if (kind === 'iceCave') { g.fillStyle = '#9fc3d6'; g.beginPath(); g.moveTo(cx - 220, y + 4); g.quadraticCurveTo(cx - 160, y - 210, cx, y - 200); g.quadraticCurveTo(cx + 160, y - 210, cx + 220, y + 4); g.closePath(); g.fill(); for (const sx of [-1, 1]) { g.save(); g.translate(cx + sx * 140, y); g.scale(1.6, 1.6); STATION_ART.crystal(true); g.restore(); } }
        for (let k = 0; k <= 12; k++) { const a = Math.PI + (k / 12) * Math.PI, bx = cx + Math.cos(a) * 96, by = y - 70 + Math.sin(a) * 110; g.save(); g.translate(bx, by); g.rotate(a + Math.PI / 2); g.fillStyle = k % 2 ? '#d8eef8' : '#bfe0f0'; g.fillRect(-14, -12, 28, 24); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-14, -12, 28, 4); g.restore(); }
        for (let k = 0; k < 8; k++) { const x = cx - 56 + k * 16; g.fillStyle = 'rgba(220,245,255,.9)'; g.beginPath(); g.moveTo(x - 4, y - 154); g.lineTo(x + 4, y - 154); g.lineTo(x, y - 136 - (k % 3) * 6); g.closePath(); g.fill(); }
      } else if (kind === 'sluiceGate') {
        // bent: ark boydan boya akar, bir yanda dönen su çarkı, öbür yanda değirmen evi
        g.fillStyle = '#2f6fa0'; g.fillRect(0, y - 20, W, 26);
        g.fillStyle = '#e8e0d0'; g.fillRect(cx + 70, y - 130, 90, 130); g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(cx + 60, y - 130); g.lineTo(cx + 115, y - 170); g.lineTo(cx + 170, y - 130); g.closePath(); g.fill();
        waterWheel(cx - 110, y - 50, 50, now);
      } else if (kind === 'millGate') {
        windmill(cx, y + 4, 4, now);
      } else if (kind === 'barnGate') {
        barn(cx, y + 4, 5.6, true); for (const sx of [-1, 1]) { g.save(); g.translate(cx + sx * 160, y); g.scale(1.6, 1.6); STATION_ART.saman(); g.restore(); }
      } else if (kind === 'mirrorGate') {
        // ayna salonu: kristal çerçeveli kemer, iki yanda ikiz portallar
        for (const sx of [-1, 1]) { portalRing(cx + sx * 140, y - 80, 34, sx < 0 ? '#4cc9f0' : '#ff6fb5', now + sx * 400); g.save(); g.translate(cx + sx * 80, y); g.scale(1.8, 1.8); STATION_ART.crystal(true); g.restore(); }
        g.strokeStyle = '#c8b4ff'; g.lineWidth = 10; g.beginPath(); g.arc(cx, y - 80, 74, Math.PI, 0); g.stroke(); add(() => glow(cx, y - 154, 40, 'rgba(200,170,255,.6)'));
      } else if (kind === 'phoenixPortal') {
        // Anka'nın portalı: dev ateş halkası ve iki yana açılan alev kanatları
        portalRing(cx, y - 90, 96, '#ff8a4c', now);
        add(() => { for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const a = -0.3 - i * 0.18 + (reduced() ? 0 : Math.sin(now / 500 + i) * 0.05), len = 150 - i * 14; g.strokeStyle = `rgba(255,${140 + i * 15},70,${0.75 - i * 0.08})`; g.lineWidth = 9 - i; g.beginPath(); g.moveTo(cx + sx * 70, y - 120); g.quadraticCurveTo(cx + sx * (70 + len * 0.6), y - 120 + Math.sin(a) * len, cx + sx * (70 + len * Math.cos(a)), y - 120 + Math.sin(a) * len * 0.9); g.stroke(); } });
      } else if (kind === 'factoryGate') {
        // fabrika cephesi: testere dişli çatı, bacalar, sarı-siyah bariyer
        g.fillStyle = '#3a3f54'; g.fillRect(cx - 170, y - 140, 340, 144);
        for (let k = 0; k < 6; k++) { const x = cx - 170 + k * 57; g.fillStyle = '#4a5068'; g.beginPath(); g.moveTo(x, y - 140); g.lineTo(x + 57, y - 140); g.lineTo(x + 57, y - 178); g.closePath(); g.fill(); g.fillStyle = 'rgba(160,220,255,.4)'; g.beginPath(); g.moveTo(x + 50, y - 142); g.lineTo(x + 54, y - 142); g.lineTo(x + 54, y - 170); g.closePath(); g.fill(); }
        for (const sx of [-1, 1]) { const bx = cx + sx * 130; g.fillStyle = '#7a3a2a'; g.fillRect(bx - 9, y - 240, 18, 70); g.fillStyle = '#e8e0d0'; g.fillRect(bx - 9, y - 228, 18, 4); smoke(bx, y - 246, now, 2); }
        for (let x = cx - 150; x < cx + 150; x += 20) { if (Math.abs(x + 10 - cx) < 60) continue; g.fillStyle = (x / 20) % 2 ? '#e0b02a' : '#1c2026'; g.fillRect(x, y - 30, 20, 8); }
      } else if (kind === 'boilerHatch') {
        // dev buhar kazanı: perçinli gövde, göstergeler, kapı kazanın kapağı
        g.fillStyle = '#6a3a22'; rr(cx - 140, y - 200, 280, 204, 90); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; rr(cx - 120, y - 190, 60, 180, 30); g.fill();
        g.fillStyle = '#9a6a3a'; for (let k = 0; k < 12; k++) { const a = Math.PI + (k / 11) * Math.PI; g.beginPath(); g.arc(cx + Math.cos(a) * 120, y - 90 + Math.sin(a) * 100, 3, 0, TAU); g.fill(); }
        gauge(cx - 90, y - 140, 16, now); gauge(cx + 90, y - 140, 16, now + 500); smoke(cx + 60, y - 210, now, 2.2);
      } else if (kind === 'launchTower') {
        // iki kafes kule ve aralarında bekleyen roket
        lattice(cx - 110, y, 22, 230, '#9aa0b0'); lattice(cx + 110, y, 22, 230, '#9aa0b0');
        g.save(); g.translate(cx + 160, y); g.scale(2.4, 2.4); STATION_ART.rocket(true, reduced() ? 0 : now, 'cur'); g.restore();
        add(() => glow(cx, y - 20, 120, 'rgba(255,170,90,.18)'));
      } else if (kind === 'airlock') {
        // uzay istasyonu: modüller, güneş panelleri, kapı hava kilidi
        for (const sx of [-1, 1]) { g.fillStyle = '#2a4a8a'; g.fillRect(cx + sx * 150 - 40, y - 160, 80, 40); g.strokeStyle = '#8ab0ff'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(cx + sx * 150 - 40 + k * 20, y - 160); g.lineTo(cx + sx * 150 - 40 + k * 20, y - 120); g.stroke(); } }
        g.fillStyle = '#9aa0b0'; g.fillRect(cx - 110, y - 146, 220, 12); g.fillStyle = '#c8ced8'; g.beginPath(); g.arc(cx, y - 80, 100, Math.PI, 0); g.lineTo(cx + 100, y + 4); g.lineTo(cx - 100, y + 4); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(cx, y - 80, 100, Math.PI * 1.5, 0); g.lineTo(cx + 100, y + 4); g.lineTo(cx, y + 4); g.closePath(); g.fill();
        for (const sx of [-1, 1]) light(cx + sx * 80, y - 150, 10, 'rgba(255,100,100,.9)');
      }
      door(gt, y, open, now, kind === 'valleyArch' ? '#7a7280' : kind === 'rootTree' || kind === 'workDoor' ? '#6b4a2a' : kind === 'gearGate' || kind === 'springCage' ? '#8a6a3a' : kind === 'pendulumGate' ? '#4a4f70' : '#8a929c');
      gateSign(gt, y - ({ rootTree: 132, valleyArch: 186, workDoor: 236, gearGate: 206, pendulumGate: 306, springCage: 236, cellGate: 186, cryptGate: 206, streetArch: 214, townTower: 326, factoryGate: 196, boilerHatch: 220, launchTower: 250, airlock: 196, mastersHall: 252, machineGate: 206, funArch: 284, coasterTunnel: 284, substation: 214, damGate: 222, harborLights: 176, seaCave: 212, lighthouseDoor: 236, domeGate: 236, starGate: 240, iceArch: 208, iceCave: 222, sluiceGate: 196, millGate: 262, barnGate: 236, mirrorGate: 186, phoenixPortal: 236 }[kind] || 158), acc);
    }

    // ---- sis: ulaşılmamış kapıların ötesi ----
    function fog(now, top, bot) {
      let gt = 0;
      for (let i = 2; i <= L.gates; i++) if (!gateShownOpen(i) || (S.fogT[i] != null && now - S.fogT[i] < 1700)) { gt = i; break; }
      if (!gt) return;
      const a = S.fogT[gt] != null ? Math.max(0, 1 - (now - S.fogT[gt]) / 1700) : 1;
      if (a <= 0) return;
      const edge = GATE_Y[gt] - 110;
      if (edge < top - 300) return;
      g.save(); g.globalAlpha = a;
      const gr = g.createLinearGradient(0, edge, 0, edge - 260);
      gr.addColorStop(0, 'rgba(18,20,40,0)'); gr.addColorStop(1, 'rgba(18,20,40,.97)');
      g.fillStyle = gr; g.fillRect(0, edge - 260, W, 262);
      g.fillStyle = 'rgba(18,20,40,.97)'; g.fillRect(0, top - 10, W, Math.max(0, edge - 258 - top + 10));
      for (let i = 0; i < 22; i++) {
        const x = ((i * 113 + now / (30 + (i % 3) * 12)) % (W + 240)) - 120, y = edge - 60 - (i % 7) * 160;
        if (y < top - 200 || y > bot + 200) continue;
        const b = g.createRadialGradient(x, y, 6, x, y, 130); b.addColorStop(0, 'rgba(150,160,210,.16)'); b.addColorStop(1, 'rgba(150,160,210,0)');
        g.fillStyle = b; g.beginPath(); g.arc(x, y, 130, 0, TAU); g.fill();
      }
      const w = worldOfGate(gt), cy = edge - 360;
      if (cy > top - 200 && cy < bot + 200) {
        g.fillStyle = '#e8eeff'; g.font = '800 22px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        const newWorld = worldOfGate(gt - 1).id !== w.id;
        g.fillText(newWorld ? tr('{name} seni bekliyor…', { name: tr(w.name) }) : tr('Kapı {n}', { n: gt }), W / 2, cy + 112);
        g.font = '800 13px Nunito, sans-serif'; g.fillStyle = '#b8c4ea';
        g.fillText(tr('{n}. bölümü bitir, sis kalksın', { n: gateStart(gt) - 1 }), W / 2, cy + 134);
      }
      g.restore();
    }

    // ---- kahraman: Halka ----
    // Oyunun kendisinden bir halka: döner, boşluğunu hizalar, serbest kalınca uçar (Döndür · Hizala · Serbest bırak).
    function hopState(now) {
      if (!S.hop) return null;
      const raw = now - S.hop.t0;
      if (raw < CROUCH) return { phase: 'crouch', c: raw / CROUCH, t: 0 };
      return { phase: 'air', t: Math.min(1, (raw - CROUCH) / S.hop.ms) };
    }
    function charPos(now) {
      const hs = hopState(now);
      if (hs && hs.phase === 'air') {
        const t = hs.t, md = S.hop.mode, A = tOf(S.hop.from), B = tOf(S.hop.to);
        const sm = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
        const at = u => {
          if (PATH_MODES.has(md)) { const q = pathPoint(A + (B - A) * sm(u)); return { x: q.x, y: q.y - (md === 'snowball' ? 76 : md === 'wheel' ? 22 : md === 'cart' ? 30 : 34), h: 0, gy: q.y + 2 }; }
          if (md === 'teleport') { const q = NODES[u < 0.5 ? S.hop.from : S.hop.to]; return { x: q.x, y: q.y - 24, h: 0, gy: q.y + 2 }; }
          const lift = { rocket: 170, balloon: 120, lantern: 120, cannon: 140, bird: 110, kite: 130, swing: 110, zip: 36 }[md] || (S.hop.big ? 120 : 80);
          let e = sm(u), h = Math.sin(Math.PI * u) * lift;
          if (md === 'cannon') e = u;
          else if (md === 'rocket') e = u * u * (3 - 2 * u);
          else if (md === 'bounce') { h = Math.abs(Math.sin(2 * Math.PI * u)) * (u < 0.5 ? 46 : 140); e = u < 0.5 ? u * 0.4 : 0.2 + (u - 0.5) * 1.6; }
          const q = pathPoint(A + (B - A) * e);
          let x = q.x;
          if (md === 'balloon' || md === 'lantern' || md === 'kite') x += Math.sin(u * TAU * 1.5) * 14 * Math.sin(Math.PI * u);
          else if (md === 'bird') x += Math.sin(u * TAU) * 18 * Math.sin(Math.PI * u);
          return { x, y: q.y - 24 - h, h, gy: q.y + 2 };
        };
        const a = at(t), b2 = at(Math.min(1, t + 0.02)), c = at(Math.max(0, t - 0.02));
        return { ...a, t, ang: Math.atan2(b2.y - c.y, b2.x - c.x) };
      }
      const n = NODES[hs ? S.hop.from : S.pos];
      const cheer = S.cheer ? Math.max(0, 1 - (now - S.cheer) / 520) : 0;
      const hop2 = cheer ? Math.sin((1 - cheer) * Math.PI) * 26 : 0;
      return { x: n.x, y: n.y - 24 - hop2 + (reduced() || hs ? 0 : Math.sin(now / 420) * 2), t: 1, h: hop2, gy: n.y + 2 };
    }
    function mood(now) {
      const hs = hopState(now);
      if (S.wow && now - S.wow < 2600) return 'wow';
      if (hs) return hs.phase === 'crouch' ? 'ready' : 'air';
      if (S.cheer && now - S.cheer < 900) return S.cheerStar ? 'star' : 'happy';
      if (S.land && now - S.land.t0 < 900) return 'happy';
      return 'idle';
    }
    function idleAct(m, now) {
      if (m !== 'idle' || reduced()) return 'look';
      const c = (now / 1000) % 11;
      return c < 3 ? 'look' : c < 4.2 ? 'twirl' : c < 6.8 ? 'call' : 'look';
    }
    function hero(now) {
      const p = charPos(now), hs = hopState(now), next = NODES[Math.min(S.pos + 1, N)], m = mood(now);
      const w = worldOf(S.hop ? S.hop.to : S.pos), icy = isIce(w);
      const air = !!(hs && hs.phase === 'air'), md = air ? S.hop.mode : null, onPath = PATH_MODES.has(md);
      const vis = md === 'teleport' ? (hs.t < 0.4 ? 1 - hs.t / 0.4 : hs.t > 0.6 ? (hs.t - 0.6) / 0.4 : 0) : 1;
      if (air && !onPath && md !== 'teleport' && !reduced()) S.trail.push({ x: p.x, y: p.y, t: now });
      S.trail = S.trail.filter(q => now - q.t < 260);
      if (S.trail.length > 1) add(() => {
        for (let i = 1; i < S.trail.length; i++) {
          const a = S.trail[i - 1], b = S.trail[i], f = i / S.trail.length;
          g.strokeStyle = icy ? `rgba(140,230,255,${0.4 * f})` : `rgba(255,201,74,${0.4 * f})`; g.lineWidth = 10 * f; g.lineCap = 'round';
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
      });
      const sh = Math.max(vis, 0.25);
      shadow(p.x, p.gy, (md === 'snowball' ? 30 : 17 - p.h * 0.09) * sh, (5 - p.h * 0.025) * sh, (0.45 - p.h * 0.003) * sh);
      if (vis < 0.02) { travelFx(md, p, now, w); return; }
      const R = HERO.r, act = air || hs ? 'look' : idleAct(m, now);
      let sx = 1, sy = 1, lift = 0;
      const land = S.land ? Math.max(0, 1 - (now - S.land.t0) / 300) : 0;
      if (hs && hs.phase === 'crouch') { const c = Math.max(0, (hs.c - 0.55) / 0.45); sx = 1 + 0.16 * c; sy = 1 - 0.18 * c; }
      else if (air && !onPath) { const v = Math.cos(Math.PI * hs.t); sx = 1 - 0.1 * Math.abs(v); sy = 1 + 0.12 * Math.abs(v); }
      else if (land) { const q = Math.sin(land * Math.PI) * land; sx = 1 + 0.25 * q; sy = 1 - 0.22 * q; }
      else if (!reduced()) { const b = Math.sin(now / 420) * 0.025; sx = 1 - b; sy = 1 + b; }
      const tw = act === 'twirl' ? ((now / 1000) % 11 - 3) / 1.2 : -1;
      if (tw >= 0 && tw <= 1) lift = Math.sin(Math.PI * tw) * 12;
      const tdir = S.hop && NODES[S.hop.to].x >= NODES[S.hop.from].x ? 1 : -1;
      let rot = air && !reduced() && !onPath ? Math.sin(Math.PI * hs.t) * 0.15 * tdir : 0;
      if (air && !reduced()) {
        if (md === 'cannon') rot = hs.t * TAU * 2 * tdir;
        else if (md === 'wheel') rot = hs.t * TAU * 3 * tdir;
        else if (md === 'snowball') rot = -hs.t * TAU * 2 * tdir;
        else if (md === 'rocket') rot = Math.max(-1.1, Math.min(1.1, p.ang + Math.PI / 2));
      }
      const tgt = NODES[S.hop ? S.hop.to : Math.min(S.pos + 1, N)];
      const aim = Math.atan2(tgt.y - 24 - p.y, tgt.x - p.x);
      const rest = 0.75 + (reduced() ? 0 : Math.sin(now / 900) * 0.12);
      let gapW = rest;
      if (act === 'call') gapW = Math.PI / 2;
      if (tw >= 0 && tw <= 1) gapW = rest + (tw < 0.5 ? 2 * tw * tw : 1 - Math.pow(-2 * tw + 2, 2) / 2) * TAU;
      if (hs && hs.phase === 'crouch') { const c = Math.min(1, hs.c / 0.55), e = 1 - Math.pow(1 - c, 3); gapW = rest + angDiff(rest, aim) * e; }
      else if (air) gapW = md === 'wheel' || md === 'cannon' || md === 'snowball' ? aim : p.ang;
      const spinsWithBody = md === 'wheel' || md === 'cannon' || md === 'snowball';
      const gapA = spinsWithBody ? gapW : gapW - rot;
      g.save(); g.translate(p.x, p.y - lift + R * (1 - sy)); g.scale(sx * vis, sy * vis); g.rotate(rot);
      add(() => glow(0, 0, 40, icy ? 'rgba(140,220,255,.22)' : 'rgba(255,201,74,.22)'));
      vehicle(md, 'back', now, hs, tdir, icy);
      const glass = g.createRadialGradient(-5, -6, 2, 0, 0, R); glass.addColorStop(0, '#2b3355'); glass.addColorStop(1, '#161b2e');
      g.fillStyle = glass; g.beginPath(); g.arc(0, 0, R - HERO.band / 2 + 1, 0, TAU); g.fill();
      const gap = 0.7;
      g.lineCap = 'round';
      g.strokeStyle = INK; g.lineWidth = HERO.band + 4; g.beginPath(); g.arc(0, 0, R, gapA + gap / 2, gapA + TAU - gap / 2); g.stroke();
      const body = g.createLinearGradient(0, -R, 0, R); body.addColorStop(0, '#ffd86b'); body.addColorStop(1, '#f0a92a');
      g.strokeStyle = body; g.lineWidth = HERO.band; g.beginPath(); g.arc(0, 0, R, gapA + gap / 2, gapA + TAU - gap / 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R + 1.5, Math.PI * 1.12, Math.PI * 1.48); g.stroke();
      if (hs && hs.phase === 'crouch' && hs.c > 0.5) add(() => glow(Math.cos(gapA) * R, Math.sin(gapA) * R, 16 * (1 - Math.abs(hs.c - 0.75) * 2), 'rgba(255,240,190,.9)'));
      g.save(); g.rotate(spinsWithBody && air ? 0 : -rot * 0.6);
      face(m, next, p, now, act);
      g.restore();
      vehicle(md, 'top', now, hs, tdir, icy);
      if (icy) scarf(now);
      g.restore();
      if (act === 'call' && !S.hop) bubble(p, now);
      travelFx(md, p, now, w, rot);
    }
    function travelFx(md, p, now, w, rot = 0) {
      const hs = hopState(now);
      if (reduced() || !hs || hs.phase !== 'air') return;
      if (md === 'rocket') {
        const bx = p.x - Math.sin(rot) * 70, by = p.y + Math.cos(rot) * 70;
        for (let i = 0; i < 2; i++) S.fx.push({ k: 'spark', x: bx + (Math.random() - 0.5) * 8, y: by, vx: (Math.random() - 0.5) * 1.4 - Math.sin(rot) * 2, vy: Math.cos(rot) * 2.4, life: 1, c: i ? '#ffd34a' : '#ff6b3d' });
        if (Math.random() < 0.6) S.fx.push({ k: 'puff', x: bx, y: by + 6, vx: (Math.random() - 0.5) * 0.8, vy: 0.6, life: 1, r: 4, c: '225,210,235' });
      } else if (md === 'boat') {
        if (Math.random() < 0.8) S.fx.push({ k: 'puff', x: p.x + (Math.random() - 0.5) * 50, y: p.gy - 4, vx: (Math.random() - 0.5) * 1.2, vy: -0.5 - Math.random(), life: 1, r: 2, c: '190,230,255' });
      } else if (PATH_MODES.has(md) && md !== 'wheel') {
        if (Math.random() < 0.8) S.fx.push({ k: 'puff', x: p.x + (Math.random() - 0.5) * 24, y: p.gy - 2, vx: (Math.random() - 0.5) * 1.6, vy: -0.6 - Math.random(), life: 1, r: 2.5, c: '255,255,255' });
      } else if (md === 'wheel') {
        if (Math.random() < 0.5) S.fx.push({ k: 'spark', x: p.x + (Math.random() - 0.5) * 16, y: p.gy - 2, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random(), life: 1, c: '#ffd34a' });
      } else if (md === 'teleport') {
        const q = hs.t < 0.5 ? NODES[S.hop.from] : NODES[S.hop.to];
        for (let i = 0; i < 2; i++) { const a = Math.random() * TAU, d = 10 + Math.random() * 26; S.fx.push({ k: 'spark', x: q.x + Math.cos(a) * d, y: q.y - 24 + Math.sin(a) * d, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.6 - 0.6, life: 1, c: ['#b8f3ff', '#e0b8ff', '#ffffff'][i % 3] }); }
      } else if (md === 'cannon') {
        if (Math.random() < 0.5) S.fx.push({ k: 'conf', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 2, vy: Math.random(), life: 0.6, r: 0, vr: 0.2, c: ['#ffd34a', '#ff6fb5', '#4cc9f0', '#b388ff'][Math.floor(Math.random() * 4)] });
      } else if (Math.random() < 0.7) S.fx.push({ k: 'spark', x: p.x + (Math.random() - 0.5) * 20, y: p.y + 10, vx: (Math.random() - 0.5) * 0.9, vy: 0.5 + Math.random() * 0.6, life: 1, c: w.theme.accent });
    }
    function vehicle(md, layer, now, hs, tdir, icy) {
      if (!md) return;
      const R = HERO.r, t = now / 1000, u = hs ? hs.t : 0;
      if (layer === 'back') {
        if (md === 'rocket') {
          g.save(); g.translate(0, 10); g.scale(1.6, 1.6);
          const fl = 10 + Math.sin(t * 60) * 4;
          add(() => glow(0, 40, 26, 'rgba(255,170,80,.7)'));
          g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(-7, 30); g.quadraticCurveTo(0, 30 + fl * 2.6, 7, 30); g.fill();
          g.fillStyle = '#fff5ea'; g.beginPath(); g.moveTo(-3.5, 30); g.quadraticCurveTo(0, 30 + fl * 1.4, 3.5, 30); g.fill();
          g.fillStyle = INK; g.beginPath(); g.moveTo(-11, 2); g.lineTo(-20, 32); g.lineTo(-8, 26); g.closePath(); g.moveTo(11, 2); g.lineTo(20, 32); g.lineTo(8, 26); g.closePath(); g.fill();
          g.fillStyle = '#4cc9f0'; g.beginPath(); g.moveTo(-10, 6); g.lineTo(-17.5, 29); g.lineTo(-9, 24.5); g.closePath(); g.moveTo(10, 6); g.lineTo(17.5, 29); g.lineTo(9, 24.5); g.closePath(); g.fill();
          g.fillStyle = INK; g.beginPath(); g.moveTo(-12, 30); g.lineTo(-12, -30); g.quadraticCurveTo(0, -62, 12, -30); g.lineTo(12, 30); g.closePath(); g.fill();
          const rb = g.createLinearGradient(-10, 0, 10, 0); rb.addColorStop(0, '#fff'); rb.addColorStop(1, '#d9d2e6');
          g.fillStyle = rb; g.beginPath(); g.moveTo(-10, 28); g.lineTo(-10, -30); g.quadraticCurveTo(0, -58, 10, -30); g.lineTo(10, 28); g.closePath(); g.fill();
          g.fillStyle = '#ff4f6d'; g.beginPath(); g.moveTo(-10, -30); g.quadraticCurveTo(0, -58, 10, -30); g.closePath(); g.fill(); g.fillRect(-10, 20, 20, 5);
          g.restore();
        } else if (md === 'snowball') {
          g.save(); g.translate(0, 54);
          g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
          const sb = g.createRadialGradient(-8, -9, 3, 0, 0, 25); sb.addColorStop(0, '#ffffff'); sb.addColorStop(1, '#bfdcef');
          g.fillStyle = sb; g.beginPath(); g.arc(0, 0, 24.5, 0, TAU); g.fill();
          g.rotate(u * TAU * 2.4 * tdir); g.fillStyle = 'rgba(120,170,205,.55)';
          for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.ellipse(Math.cos(a) * 14, Math.sin(a) * 14, 4, 2.4, a, 0, TAU); g.fill(); }
          g.restore();
        } else if (md === 'skate') {
          g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, R + 8); g.lineTo(12, R + 8); g.quadraticCurveTo(17, R + 8, 15, R + 3); g.stroke();
          g.strokeStyle = '#e6f5fc'; g.lineWidth = 2; g.stroke();
        } else if (md === 'boat') {
          // küçük kayık: Halka içinde oturur, dalgada sallanır
          g.save(); g.translate(0, R + 6); g.rotate(Math.sin(t * 5) * 0.08); g.scale(1.45, 1.45);
          g.fillStyle = INK; g.beginPath(); g.moveTo(-30, -6); g.quadraticCurveTo(0, 22, 30, -6); g.closePath(); g.fill();
          g.fillStyle = '#c0703a'; g.beginPath(); g.moveTo(-27, -4); g.quadraticCurveTo(0, 18, 27, -4); g.closePath(); g.fill();
          g.fillStyle = '#e8eef8'; g.fillRect(-27, -6, 54, 3);
          g.restore();
        } else if (md === 'cart') {
          // maden vagonu: tahta kasa, dönen tekerlekler
          g.save(); g.translate(0, R + 2); cart(u * TAU * 3 * tdir); g.restore();
        } else if (md === 'sled' || md === 'slide') {
          g.save(); g.translate(0, R + 11);
          if (md === 'sled') {
            g.strokeStyle = INK; g.lineWidth = 4.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-22, 6); g.lineTo(18, 6); g.quadraticCurveTo(27, 6, 25, -3); g.stroke();
            g.strokeStyle = '#c9d6e3'; g.lineWidth = 2.2; g.stroke();
            g.fillStyle = INK; g.fillRect(-20, -3.5, 38, 7.5); g.fillStyle = '#c0703a'; g.fillRect(-19, -2.5, 36, 5.5);
            g.fillStyle = '#8a4a22'; for (let i = 0; i < 4; i++) g.fillRect(-14 + i * 9, -2.5, 1.4, 5.5);
          } else {
            g.fillStyle = INK; g.beginPath(); g.ellipse(0, 1, 23, 7, 0, 0, TAU); g.fill();
            g.fillStyle = '#4cc9f0'; g.beginPath(); g.ellipse(0, 0, 21.5, 5.6, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-7, -1.5, 8, 1.6, 0, 0, TAU); g.fill();
          }
          g.restore();
        }
        return;
      }
      const hx = 6, hy = -R - 4;
      if (md === 'zip') {
        // teleferik: gidiş yönünde gerili ip, makaradan sarkan Halka
        const a = tdir > 0 ? -0.35 : 0.35;
        g.save(); g.translate(0, -R - 14); g.rotate(a);
        g.strokeStyle = 'rgba(30,30,40,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-160, 0); g.lineTo(160, 0); g.stroke();
        g.restore();
        g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -R - 3); g.lineTo(0, -R - 12); g.stroke();
        g.fillStyle = '#9aa0b0'; g.beginPath(); g.arc(0, -R - 14, 4.5, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(0, -R - 14, 1.6, 0, TAU); g.fill();
      } else if (md === 'kite') {
        // uçurtma: renkli baklava, dalgalı kuyruk, ip Halka'nın tepesine
        const ky = -86 + Math.sin(t * 2.2) * 4, kx = Math.sin(t * 1.6) * 8;
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, hy); g.quadraticCurveTo(kx * 0.3, (hy + ky) / 2 + 10, kx, ky + 18); g.stroke();
        g.save(); g.translate(kx, ky); g.rotate(Math.sin(t * 2) * 0.15);
        g.fillStyle = INK; g.beginPath(); g.moveTo(0, -22); g.lineTo(16, 0); g.lineTo(0, 20); g.lineTo(-16, 0); g.closePath(); g.fill();
        g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(0, -19); g.lineTo(13, 0); g.lineTo(0, 0); g.closePath(); g.fill();
        g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(0, -19); g.lineTo(-13, 0); g.lineTo(0, 0); g.closePath(); g.fill();
        g.fillStyle = '#4cc9f0'; g.beginPath(); g.moveTo(0, 17); g.lineTo(13, 0); g.lineTo(0, 0); g.closePath(); g.fill();
        g.fillStyle = '#2dd4bf'; g.beginPath(); g.moveTo(0, 17); g.lineTo(-13, 0); g.lineTo(0, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 20);
        for (let i = 1; i <= 4; i++) g.quadraticCurveTo(Math.sin(t * 6 + i) * 6, 20 + i * 7 - 3, Math.sin(t * 6 + i + 1) * 4, 20 + i * 7); g.stroke();
        g.restore();
      } else if (md === 'swing') {
        // sarkaç: yukarıda bir dala bağlı ip; Halka ucunda sallanıp bırakır
        const sw = (u - 0.5) * 1.4 * tdir;
        g.save(); g.rotate(sw);
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -R - 3); g.lineTo(0, -R - 110); g.stroke();
        g.restore();
      } else if (md === 'balloon') {
        const cols = ['#ff4f6d', '#ffd34a', '#2dd4bf', '#b388ff'], pos = [[-12, -64], [11, -66], [0, -80], [-2, -56]];
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1;
        pos.forEach(([bx, by], i) => { const sw = Math.sin(t * 3 + i) * 3; g.beginPath(); g.moveTo(i % 2 ? hx : -hx, hy); g.quadraticCurveTo(bx * 0.5, (hy + by) / 2, bx + sw, by + 12); g.stroke(); });
        pos.forEach(([bx, by], i) => {
          const sw = Math.sin(t * 3 + i) * 3;
          g.fillStyle = INK; g.beginPath(); g.ellipse(bx + sw, by, 11.5, 13.5, 0, 0, TAU); g.fill();
          g.fillStyle = cols[i]; g.beginPath(); g.ellipse(bx + sw, by, 10, 12, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(bx + sw - 3.5, by - 4.5, 2.4, 4, -0.4, 0, TAU); g.fill();
        });
      } else if (md === 'lantern') {
        const c1 = icy ? '#9ff0ff' : '#ffd27a', c2 = icy ? '#2dd4bf' : '#ff8a3c', ly = -64 + Math.sin(t * 2) * 2;
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-hx, hy); g.lineTo(-9, ly + 14); g.moveTo(hx, hy); g.lineTo(9, ly + 14); g.stroke();
        skyLantern(ly, c1, c2, t);
      } else if (md === 'bird') {
        const by = -R - 26, fl = Math.sin(t * 22);
        g.save(); g.translate(0, by);
        for (const s of [-1, 1]) {
          g.save(); g.rotate(s * (0.5 + fl * 0.55));
          g.fillStyle = INK; g.beginPath(); g.ellipse(s * 20, -2, 20, 8, 0, 0, TAU); g.fill();
          g.fillStyle = '#2dd4bf'; g.beginPath(); g.ellipse(s * 20, -2, 18.5, 6.6, 0, 0, TAU); g.fill();
          g.fillStyle = '#ffd34a'; g.beginPath(); g.ellipse(s * 28, -2, 9, 4.6, 0, 0, TAU); g.fill();
          g.fillStyle = '#4895ef'; g.beginPath(); g.ellipse(s * 34, -2, 5, 3.4, 0, 0, TAU); g.fill();
          g.restore();
        }
        g.fillStyle = INK; g.beginPath(); g.moveTo(-4, 8); g.lineTo(0, 26); g.lineTo(4, 8); g.closePath(); g.fill();
        g.fillStyle = '#4895ef'; g.beginPath(); g.moveTo(-2.6, 9); g.lineTo(0, 23); g.lineTo(2.6, 9); g.closePath(); g.fill();
        g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, 11, 13, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff4f4f'; g.beginPath(); g.ellipse(0, 0, 9.6, 11.6, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-3.6, -4, 3, 0, TAU); g.arc(3.6, -4, 3, 0, TAU); g.fill();
        g.fillStyle = INK; g.beginPath(); g.arc(-3.2, -3.6, 1.5, 0, TAU); g.arc(3.2, -3.6, 1.5, 0, TAU); g.fill();
        g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(0, 7, 3, 0); g.closePath(); g.fill();
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, 11); g.lineTo(-hx, -by + hy); g.moveTo(4, 11); g.lineTo(hx, -by + hy); g.stroke();
        g.restore();
      }
    }
    function bubble(p, now) {
      const n = NODES[S.pos], side = n.x > W / 2 ? -1 : 1, txt = tr('Hadi oynayalım!');
      g.save(); g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const bw = g.measureText(txt).width + 22, pop = reduced() ? 1 : Math.max(0.05, Math.min(1, ((now / 1000) % 11 - 4.2) / 0.18));
      const x = Math.max(bw / 2 + 6, Math.min(W - bw / 2 - 6, p.x + side * (bw / 2 + 24))), y = p.y - 36;
      g.translate(x, y); g.scale(pop, pop);
      g.fillStyle = 'rgba(255,201,74,.55)'; rr(-bw / 2 - 1.5, -13.5, bw + 3, 27, 13); g.fill();
      g.fillStyle = '#1d2340'; rr(-bw / 2, -12, bw, 24, 12); g.fill();
      g.beginPath(); g.moveTo(-side * (bw / 2 - 18), 10); g.lineTo(-side * (bw / 2 - 4), 20); g.lineTo(-side * (bw / 2 - 28), 11); g.fill();
      g.fillStyle = GOLD; g.fillText(txt, 0, 1);
      g.restore();
    }
    function face(m, next, p, now, act) {
      const blink = m === 'idle' && (now / 1000) % 3.4 < 0.12 ? 0.12 : 1;
      const look = Math.atan2(next.y - p.y, next.x - p.x);
      let lx = m === 'idle' ? Math.cos(look) * 1.8 : 0, ly = m === 'idle' ? Math.sin(look) * 1.4 : 0;
      if (act === 'call') { lx = 0; ly = 1.8; }
      const ink = '#ffe7a8';
      g.fillStyle = 'rgba(255,150,110,.22)'; g.beginPath(); g.ellipse(-9.5, 4.5, 3.6, 2.2, 0, 0, TAU); g.ellipse(9.5, 4.5, 3.6, 2.2, 0, 0, TAU); g.fill();
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 5.6, -2.5);
        if (m === 'happy') { g.strokeStyle = ink; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.arc(0, 1.5, 3.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
        else if (m === 'star') { g.fillStyle = GOLD; star(0, 0, 5); g.fillStyle = '#fff'; g.beginPath(); g.arc(-1.2, -1.4, 1.1, 0, TAU); g.fill(); }
        else {
          const big = m === 'air' || m === 'wow' ? 1.18 : 1;
          g.scale(big, big * blink);
          g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 4.2, 5, 0, 0, TAU); g.fill();
          g.fillStyle = INK; g.beginPath(); g.ellipse(lx, ly + 0.6, 2.7, 3.3, 0, 0, TAU); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(lx - 1.1, ly - 0.9, 1.15, 0, TAU); g.fill(); g.beginPath(); g.arc(lx + 1, ly + 1.4, 0.55, 0, TAU); g.fill();
        }
        g.restore();
        g.strokeStyle = ink; g.lineCap = 'round';
        if (m === 'idle') { const up = s > 0 ? -1.6 : 0; g.lineWidth = 1.8; g.beginPath(); g.moveTo(s * 3, -9.6 + up); g.quadraticCurveTo(s * 5.6, -11 + up * 1.3, s * 8.2, -9.8 + up); g.stroke(); }
        if (m === 'ready') { g.lineWidth = 1.8; g.beginPath(); g.moveTo(s * 2.6, -9.6); g.lineTo(s * 8.2, -10.8); g.stroke(); }
        if (m === 'wow' || m === 'air') { g.lineWidth = 1.6; g.beginPath(); g.arc(s * 5.6, -9, 3, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
      }
      g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1.9; g.lineCap = 'round';
      if (m === 'air' || m === 'wow') { g.beginPath(); g.ellipse(0, 6.6, 2.4, m === 'wow' ? 3.2 : 2.6, 0, 0, TAU); g.fill(); g.fillStyle = '#ff7aa2'; g.beginPath(); g.ellipse(0, 7.8, 1.4, 1, 0, 0, TAU); g.fill(); }
      else if (m === 'happy' || m === 'star' || act === 'call') { g.beginPath(); g.moveTo(-4.4, 4.6); g.quadraticCurveTo(0, 11, 4.4, 4.6); g.closePath(); g.fill(); g.fillStyle = '#ff7aa2'; g.beginPath(); g.ellipse(0, 8, 2.2, 1.3, 0, 0, TAU); g.fill(); }
      else if (m === 'ready') { g.beginPath(); g.moveTo(-2.6, 6.4); g.lineTo(2.6, 6.4); g.stroke(); }
      else { g.beginPath(); g.arc(0, 4.4, 3, Math.PI * 0.18, Math.PI * 0.82); g.stroke(); }
    }
    // Buzul'da rüzgârda uçuşan turkuaz atkı
    function scarf(now) {
      const R = HERO.r, fl = reduced() ? 0 : Math.sin(now / 160) * 3;
      g.fillStyle = '#2dd4bf'; g.strokeStyle = INK; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(8, R - 4); g.quadraticCurveTo(20, R + fl, 26, R + 6 + fl); g.lineTo(22, R + 10 + fl); g.quadraticCurveTo(16, R + 4, 5, R + 1); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e6fffb'; g.fillRect(19, R + 3 + fl, 4, 2);
    }

    // ---- efektler ----
    function effects(now, top) {
      S.fireworks = S.fireworks.filter(f => now - f.t0 < 1600);
      add(() => {
        for (const f of S.fireworks) {
          const u = (now - f.t0) / 1600, e = 1 - Math.pow(1 - u, 3);
          if (u < 0.08) glow(f.x, f.y, 60, 'rgba(255,255,255,.6)', 1 - u / 0.08);
          for (let i = 0; i < 22; i++) {
            const a = i * TAU / 22, d = 56 * e, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d + 26 * u * u;
            g.strokeStyle = f.c; g.globalAlpha = 0.9 * (1 - u); g.lineWidth = 2;
            g.beginPath(); g.moveTo(f.x + Math.cos(a) * d * 0.7, f.y + Math.sin(a) * d * 0.7 + 20 * u * u); g.lineTo(x, y); g.stroke();
            g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        }
      });
      S.fx = S.fx.filter(p => p.life > 0);
      if (S.fx.length > 600) S.fx.splice(0, S.fx.length - 600);
      for (const p of S.fx) {
        p.x += p.vx; p.y += p.vy; p.life -= p.k === 'conf' ? 0.008 : 0.03;
        if (p.k === 'conf') { p.vy += 0.12; p.vx *= 0.99; p.r += p.vr; g.save(); g.globalAlpha = Math.min(1, p.life * 2); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-4, -2, 8, 4); g.restore(); }
        else if (p.k === 'coin') { p.vy += 0.2; g.save(); g.globalAlpha = Math.min(1, p.life * 2); g.translate(p.x, p.y); g.scale(Math.abs(Math.cos(now / 90 + p.r)), 1); g.fillStyle = '#d98f12'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(0, 0, 4.6, 0, TAU); g.fill(); g.restore(); }
        else if (p.k === 'shard') { p.vy += 0.15; g.save(); g.globalAlpha = Math.max(0, p.life); g.translate(p.x, p.y); g.rotate(p.r += 0.2); g.fillStyle = 'rgba(210,240,255,.85)'; g.beginPath(); g.moveTo(0, -4); g.lineTo(3, 3); g.lineTo(-3, 2); g.closePath(); g.fill(); g.restore(); }
        else if (p.k === 'puff') { p.vx *= 0.94; p.vy *= 0.94; p.r += 0.25; g.fillStyle = `rgba(${p.c},${0.45 * p.life})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
        else add(() => { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; star(p.x, p.y, 3.4); g.globalAlpha = 1; });
      }
      // yıldızlar ekranın sağ üstüne (yıldız sayacına) uçar
      S.flyStars = S.flyStars.filter(s => now < s.t0 + 700);
      for (const s of S.flyStars) {
        if (now < s.t0) continue;
        const t = (now - s.t0) / 700, e = t * t, tx = W - 30, ty = top + 6;
        const x = s.x + (tx - s.x) * e, y = s.y + (ty - s.y) * e - Math.sin(Math.PI * t) * 60;
        add(() => glow(x, y, 16, 'rgba(255,210,100,.8)'));
        g.fillStyle = GOLD; star(x, y, 8 * (1 - 0.4 * t));
      }
    }
    function dust(n) {
      if (reduced()) return;
      const nd = NODES[n], snow = isIce(worldOf(n));
      for (let i = 0; i < 12; i++) { const a = Math.PI + (i / 11) * Math.PI, sp = 1 + Math.random() * 1.6; S.fx.push({ k: 'puff', x: nd.x + Math.cos(a) * 14, y: nd.y + 2, vx: Math.cos(a) * sp, vy: -0.3 - Math.random() * 0.5, life: 1, r: 3 + Math.random() * 3, c: snow ? '255,255,255' : '255,220,200' }); }
    }
    function confetti(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 2 + Math.random() * 5; S.fx.push({ k: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 1, r: 0, vr: (Math.random() - 0.5) * 0.3, c: ['#ffd34a', '#ff6fb5', '#4cc9f0', '#ff7a45', '#b388ff'][i % 5] }); } }

    // ---- akış ----
    // Kazanılan bölümden sonrakine yolculuk; kapı geçişinde büyük zıplayış. done(): Halka indikten sonra
    function travel(from, to, stars, done) {
      if (S.hop) { S.pos = to; done && done(); return; }
      const crossGate = gateOf(to) !== gateOf(from);
      const mode = crossGate ? null : STATIONS[from].travel;
      const ms = reduced() ? 1 : crossGate ? 1100 : TRAVEL_MS[mode] || 720;
      S.pos = from; S.follow = true;
      S.hop = { from, to, t0: performance.now(), ms, mode, big: crossGate };
      const nd = NODES[from];
      for (let i = 0; i < stars; i++) S.flyStars.push({ x: nd.x - 15 + i * 15, y: nd.y - 20, t0: performance.now() + 150 + i * 140 });
      for (let i = 0; i < stars; i++) setTimeout(() => snd.tone([1047, 1319, 1568][i] || 1568, 0.22, 'triangle', 0.06), 850 + i * 140);
      if (!reduced()) setTimeout(() => { snd.tone(2400, 0.035, 'square', 0.025); snd.tone(1600, 0.05, 'triangle', 0.04, null, 0.02); }, CROUCH * 0.6);
      setTimeout(() => launch(mode, from), reduced() ? 0 : CROUCH);
      setTimeout(() => {
        S.hop = null; S.pos = to; S.land = { n: to, t0: performance.now() };
        snd.tone(160, 0.12, 'sine', 0.12, 90); snd.tone(1320, 0.18, 'sine', 0.035, null, 0.02);
        dust(to);
        if (stars === 3 && !reduced()) setTimeout(() => { S.cheer = performance.now(); S.cheerStar = true; snd.tone(1568, 0.15, 'triangle', 0.05); snd.tone(2093, 0.2, 'triangle', 0.05, null, 0.08); }, 320);
        else S.cheerStar = false;
        setTimeout(() => { S.follow = false; }, 900);
        done && done();
      }, reduced() ? 10 : CROUCH + ms + 20);
    }
    function launch(mode, n) {
      const st = STATIONS[n], nd = NODES[n];
      const smoke = (x, y, c, cnt) => { if (!reduced()) for (let j = 0; j < cnt; j++) { const a = Math.random() * TAU, sp = 0.6 + Math.random() * 1.8; S.fx.push({ k: 'puff', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, life: 1, r: 4 + Math.random() * 4, c }); } };
      if (mode === 'rocket') { snd.noise(0.9, 0.22, 500, 2600); snd.tone(220, 0.8, 'sawtooth', 0.03, 880); smoke(nd.x, nd.y, '230,215,240', 16); }
      else if (mode === 'cannon') { snd.noise(0.35, 0.3, 1800, 200); snd.tone(140, 0.25, 'sine', 0.15, 60); if (!reduced()) confetti(st.x, st.y - 20, 24); smoke(st.x, st.y - 10, '240,230,245', 8); }
      else if (mode === 'bounce') { snd.tone(150, 0.2, 'sine', 0.16, 70); snd.tone(260, 0.4, 'sine', 0.08, 780, 0.5); }
      else if (mode === 'boat') { snd.noise(1.1, 0.12, 900, 300); snd.tone(392, 0.4, 'sine', 0.05, 330); }
      else if (mode === 'cart') { snd.noise(0.9, 0.14, 1800, 600); for (let i = 0; i < 4; i++) snd.tone(180, 0.05, 'square', 0.03, null, i * 0.12); }
      else if (mode === 'zip') { snd.noise(1, 0.1, 3000, 5000); snd.tone(880, 0.9, 'sine', 0.03, 1320); }
      else if (mode === 'kite') { snd.noise(1.2, 0.08, 500, 1500); snd.tone(659, 0.5, 'sine', 0.04, 988); }
      else if (mode === 'swing') { snd.tone(220, 0.5, 'sine', 0.06, 440); snd.tone(330, 0.3, 'triangle', 0.04, null, 0.35); }
      else if (mode === 'balloon' || mode === 'lantern') { snd.tone(523, 0.6, 'sine', 0.05, 1046); snd.tone(784, 0.5, 'triangle', 0.03, null, 0.15); }
      else if (mode === 'bird') [1800, 2200, 1900, 2400].forEach((f, i) => snd.tone(f, 0.07, 'sine', 0.05, f * 1.2, i * 0.09));
      else if (mode === 'teleport') [1047, 1319, 1568, 2093].forEach((f, i) => snd.tone(f, 0.25, 'triangle', 0.045, null, i * 0.05));
      else if (PATH_MODES.has(mode)) { snd.noise(0.9, 0.12, 2400, 900); snd.tone(330, 0.5, 'triangle', 0.04, 660); }
      else snd.tone(440, 0.22, 'triangle', 0.08, 880);
    }
    // Seyrek kutlama (her 5. bölüm, kusursuz seri): iki yandan konfeti, istasyonun üstünde üç fişek
    function celebrate(n) {
      if (reduced()) return;
      const nd = NODES[n];
      for (const s of [-1, 1]) for (let i = 0; i < 22; i++) { const a = -Math.PI / 2 + s * (0.35 + Math.random() * 0.5), sp = 4 + Math.random() * 5; S.fx.push({ k: 'conf', x: nd.x + s * 30, y: nd.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: 0, vr: (Math.random() - 0.5) * 0.3, c: ['#ffc94a', '#ff6b6b', '#2dd4bf', '#4cc9f0', '#b388ff'][i % 5] }); }
      [0, 260, 520].forEach((d, i) => setTimeout(() => { S.fireworks.push({ x: nd.x + (i - 1) * 70, y: nd.y - 170 - (i % 2) * 40, t0: performance.now(), c: ['#ffc94a', '#4cc9f0', '#ff6b6b'][i] }); snd.tone(1200 + i * 250, 0.25, 'triangle', 0.04); snd.noise(0.3, 0.1, 3000, 800); }, d));
      [523, 659, 784, 1047].forEach((f, i) => snd.tone(f, 0.35, 'triangle', 0.05, null, i * 0.08));
    }
    // Kapı açılışı: kanatlar açılır, ışık hüzmeleri, fişekler; ardından sis kalkar
    function openGate(gt) {
      const now = performance.now();
      S.opening[gt] = now; S.wow = now;
      snd.noise(0.6, 0.35, 2200, 140); snd.tone(90, 0.4, 'sine', 0.2, 40);
      if (!reduced()) {
        confetti(W / 2, GATE_Y[gt] - 40, 90);
        for (let i = 0; i < 6; i++) setTimeout(() => S.fireworks.push({ x: 60 + Math.random() * (W - 120), y: GATE_Y[gt] - 220 - Math.random() * 120, t0: performance.now(), c: ['#ffd34a', '#ff6fb5', '#4cc9f0', '#ff7a45'][i % 4] }), i * 180);
      }
      setTimeout(() => { S.fogT[gt] = performance.now(); snd.noise(1.6, 0.2, 600, 2400); snd.tone(320, 1.4, 'sine', 0.03, 900); }, reduced() ? 0 : 1300);
    }

    // ---- kapı kumbarası ----
    function jarAt(x, y, stars, max, now, scale = 1, alpha = 1) {
      const f = Math.min(1, stars / max), r = 22;
      g.save(); g.translate(x, y); g.scale(scale, scale); g.globalAlpha = alpha;
      g.fillStyle = 'rgba(14,16,30,.7)'; g.beginPath(); g.arc(0, 0, r + 6, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
      g.fillStyle = 'rgba(160,200,255,.12)'; g.fillRect(-r, -r, 2 * r, 2 * r);
      const lvl = r - f * 2 * r, wv = reduced() ? 0 : 2;
      g.fillStyle = '#f5b52e'; g.beginPath(); g.moveTo(-r, r); for (let i = 0; i <= 10; i++) g.lineTo(-r + i * r / 5, lvl + Math.sin(now / 300 + i) * wv); g.lineTo(r, r); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,170,.8)'; for (let i = 0; i < Math.round(f * 6); i++) star(-12 + (i % 3) * 12, r - 6 - Math.floor(i / 3) * 10, 3.4);
      g.restore();
      g.strokeStyle = 'rgba(220,240,255,.85)'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(-6, -7, 10, 3.6, 4.6); g.stroke();
      // dolmaya yaklaşınca çatlar
      if (f > 0.7) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(8, -18); g.lineTo(4, -9); g.lineTo(10, -3); if (f > 0.85) { g.moveTo(-16, 8); g.lineTo(-9, 4); g.lineTo(-11, -4); } g.stroke(); }
      if (f > 0.85 && !reduced()) add(() => glow(0, 0, 40, `rgba(255,210,100,${0.25 + 0.15 * Math.sin(now / 200)})`));
      g.fillStyle = GOLD; g.font = '900 11px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${stars}/${max}`, 0, r + 14);
      g.restore();
    }
    function hudJar(now, top) {
      const x = 34, y = top + 44, b = S.jarBurst;
      if (b && now - b.t0 < 900) { const u = (now - b.t0) / 900; jarAt(x, y, b.stars, b.max, now, 1 + u * 0.6, 1 - u); return; }
      const j = D.jar();
      jarAt(x, y, j.stars, j.max, now);
    }
    function burstJar(stars, max) {
      const now = performance.now(), x = 34, y = sc.scrollTop / k + 44;
      S.jarBurst = { t0: now, stars, max };
      snd.noise(0.3, 0.25, 4000, 1500); [1319, 1568, 2093, 2637].forEach((f, i) => snd.tone(f, 0.12, 'triangle', 0.06, null, 0.15 + i * 0.07));
      if (reduced()) return;
      for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, sp = 2 + Math.random() * 3; S.fx.push({ k: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: Math.random() * 3 }); }
      for (let i = 0; i < Math.min(30, stars); i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 3 + Math.random() * 4; S.fx.push({ k: 'coin', x, y, vx: Math.cos(a) * sp + 1.5, vy: Math.sin(a) * sp, life: 1, r: Math.random() * 6 }); }
    }

    // ---- çizim döngüsü ----
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      return dpr;
    }
    function draw(now) {
      const dpr = resize();
      if (!cv.width || !k) return;
      const vh = cv.clientHeight / k;
      if (S.follow) {
        const want = Math.max(0, (charPos(now).y - vh * 0.62) * k);
        sc.scrollTop += (want - sc.scrollTop) * (reduced() ? 1 : 0.1);
      }
      const camY = sc.scrollTop / k, top = camY, bot = camY + vh;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, -camY * dpr * k);
      g.clearRect(0, top, W + 60, vh);
      for (const r of REGIONS) if (r.bottom > top && r.top < bot) ground(r, Math.max(top, r.top), Math.min(bot, r.bottom), now);
      const lit = S.hop ? tOf(S.hop.from) + (tOf(S.hop.to) - tOf(S.hop.from)) * Math.max(0, Math.min(1, (now - S.hop.t0 - CROUCH) / S.hop.ms)) : tOf(Math.max(1, D.frontier()));
      road(lit, top, bot);
      for (const d of DECOR) { if (d.y < top - 80) continue; if (d.y > bot + 80) break; (DECOR_ART[d.kind] || DECOR_ART.rock)(d, now); }
      gates(now, top, bot);
      const banners = pedestals(now, top, bot);
      fog(now, top, bot);
      hero(now);
      for (const st of banners) nameBanner(st, now);
      effects(now, top);
      if (D.jar) hudJar(now, top);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const vg = g.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.height * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,2,10,.4)'); g.fillStyle = vg; g.fillRect(0, 0, cv.width, cv.height);
    }
    // Düzen piksel cinsinden (DOM düğmeleri ve kaydırma için)
    function measure(width) {
      k = width / W; S.k = k;
      return {
        k, height: H * k,
        node: n => ({ x: NODES[n].x * k, y: NODES[n].y * k }),
        gate: gt => ({ x: (W / 2) * k, y: (GATE_Y[gt] - 90) * k }),
        play: n => ({ x: NODES[n].x * k, y: (NODES[n].y + 46) * k, w: 84 * k, h: 30 * k }),
      };
    }
    // Kullanıcı kaydırınca kamera Halka'yı izlemeyi bırakır
    const stopFollow = () => { if (!S.hop) S.follow = false; };
    sc.addEventListener('wheel', stopFollow, { passive: true });
    sc.addEventListener('touchstart', stopFollow, { passive: true });

    return {
      draw, measure, travel, celebrate, openGate, burstJar,
      place(n) { if (!S.hop) S.pos = n; },
      busy: () => !!S.hop,
      heroY: () => charPos(performance.now()).y * k,
      state: S,
    };
  }

  const api = { create, layout, TRAVEL_OF };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingAdventure = api;
})(this);
