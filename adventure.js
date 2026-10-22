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
      if (id === 'vadi') {
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
      tutkal(on, t) {
        g.fillStyle = '#4a4a54'; g.beginPath(); g.moveTo(-14, -24); g.lineTo(14, -24); g.lineTo(11, 0); g.lineTo(-11, 0); g.closePath(); g.fill();
        g.fillStyle = '#e8d29a'; g.beginPath(); g.ellipse(0, -24, 14, 4, 0, 0, TAU); g.fill();
        g.strokeStyle = '#7a4e28'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(4, -24); g.lineTo(12, -40); g.stroke();
        if (on) for (let i = 0; i < 2; i++) { const ph = (t / 900 + i * 0.5) % 1; g.fillStyle = `rgba(240,230,200,${1 - ph})`; g.beginPath(); g.arc(-4 + i * 6, -26 - ph * 14, 2.4, 0, TAU); g.fill(); }
      },
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
        if (on) for (let i = 0; i < 3; i++) { const ph = (t / 1100 + i / 3) % 1; g.fillStyle = `rgba(230,230,240,${0.6 * (1 - ph)})`; g.beginPath(); g.arc(12 + ph * 6, -38 - ph * 22, 4 + ph * 6, 0, TAU); g.fill(); }
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
      if (kind === 'chest') {
        g.fillStyle = '#8a4a1a'; g.fillRect(-13, -4, 26, 15); g.fillStyle = '#5a2e10'; g.fillRect(-13, 8, 26, 3);
        g.fillStyle = '#b0622a'; g.beginPath(); g.moveTo(-13, -4); g.quadraticCurveTo(0, -18, 13, -4); g.closePath(); g.fill();
        g.fillStyle = '#ffd34a'; g.fillRect(-2.5, -6, 5, 11); g.fillRect(-13, 2, 26, 2.5);
      } else if (kind === 'mystery') {
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
      const mx = tx - sx * (tw + 2), my = y - 50, ff = reduced() ? 1 : 0.8 + 0.2 * Math.sin(now / 70 + sx) * Math.sin(now / 113);
      g.fillStyle = '#3a3440'; g.fillRect(mx - 3, my, 6, 10); g.fillStyle = '#5a3a20'; g.fillRect(mx - 1.5, my - 8, 3, 9);
      g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(mx - 4, my - 8); g.quadraticCurveTo(mx, my - 22 * ff, mx + 4, my - 8); g.fill();
      add(() => { glow(mx, my - 12, 42 * ff, 'rgba(255,150,60,.7)'); glow(mx, my - 12, 9 * ff, 'rgba(255,245,200,1)'); });
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
      7: 'workDoor', 8: 'gearGate', 9: 'pendulumGate', 10: 'springCage' };
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
      } else if (kind === 'gearGate') {
        // dev çark: kapı çarkın ortasından açılır, çevresinde dişliler döner
        const rot = reduced() ? 0 : now / 3000;
        gear(cx, y - 70, 120, 20, rot, '#6a5030'); gear(cx, y - 70, 100, 18, rot, '#8a6a3a');
        gear(cx - 128, y - 150, 34, 10, -rot * 3.5, '#9aa0b0'); gear(cx + 132, y - 140, 28, 9, -rot * 4, '#c0882a');
        g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(cx, y - 70, 70, 0, TAU); g.fill();
      } else if (kind === 'pendulumGate') {
        // kule kapısı: taş cephe, tepede kadran, önünde sallanan sarkaç
        g.fillStyle = '#2a2e48'; g.fillRect(cx - 110, y - 220, 220, 224);
        g.fillStyle = '#3a3f60'; g.beginPath(); g.moveTo(cx - 124, y - 220); g.lineTo(cx, y - 290); g.lineTo(cx + 124, y - 220); g.closePath(); g.fill();
        g.fillStyle = '#f2e6d0'; g.beginPath(); g.arc(cx, y - 168, 36, 0, TAU); g.fill(); g.strokeStyle = '#c99a3a'; g.lineWidth = 4; g.stroke();
        g.strokeStyle = INK; g.lineWidth = 3; const m = reduced() ? 1 : now / 1000; g.beginPath(); g.moveTo(cx, y - 168); g.lineTo(cx + Math.cos(m - Math.PI / 2) * 28, y - 168 + Math.sin(m - Math.PI / 2) * 28); g.moveTo(cx, y - 168); g.lineTo(cx + Math.cos(m / 12 - Math.PI / 2) * 18, y - 168 + Math.sin(m / 12 - Math.PI / 2) * 18); g.stroke();
        add(() => glow(cx, y - 168, 60, 'rgba(255,230,170,.3)'));
        const a = reduced() ? 0 : Math.sin(now / 800) * 0.35;
        for (const sx of [-1, 1]) { g.save(); g.translate(cx + sx * 140, y - 210); g.rotate(a * sx); g.strokeStyle = '#c99a3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 120); g.stroke(); g.fillStyle = '#e0b24a'; g.beginPath(); g.arc(0, 128, 14, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(-4, 124, 5, 0, TAU); g.fill(); g.restore(); }
      } else if (kind === 'springCage') {
        // zemberek kafesi: pirinç parmaklıklar, ortada gerilip gevşeyen dev yay
        g.strokeStyle = '#c99a3a'; g.lineWidth = 4;
        for (let k = -6; k <= 6; k++) { if (Math.abs(k) < 2) continue; const x = cx + k * 22; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y - 170); g.stroke(); }
        g.beginPath(); g.ellipse(cx, y - 170, 140, 30, 0, Math.PI, 0); g.stroke(); g.fillStyle = '#c99a3a'; g.fillRect(cx - 140, y - 4, 280, 8);
        const k2 = reduced() ? 1 : 1 + Math.sin(now / 600) * 0.06; g.save(); g.translate(cx, y - 196); g.scale(k2, k2);
        g.strokeStyle = '#d0d6e0'; g.lineWidth = 3; g.beginPath(); for (let a2 = 0; a2 < TAU * 3.6; a2 += 0.12) { const rr3 = 3 + a2 * 2.6; g.lineTo(Math.cos(a2) * rr3, Math.sin(a2) * rr3 * 0.6); } g.stroke(); g.restore();
      }
      door(gt, y, open, now, kind === 'valleyArch' ? '#7a7280' : kind === 'rootTree' || kind === 'workDoor' ? '#6b4a2a' : kind === 'gearGate' || kind === 'springCage' ? '#8a6a3a' : kind === 'pendulumGate' ? '#4a4f70' : '#8a929c');
      gateSign(gt, y - ({ rootTree: 132, valleyArch: 186, workDoor: 236, gearGate: 206, pendulumGate: 306, springCage: 236 }[kind] || 158), acc);
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
          g.save(); g.translate(0, R + 2);
          for (const wx of [-14, 14]) { g.save(); g.translate(wx, 10); g.rotate(u * TAU * 3 * tdir); g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill(); g.strokeStyle = '#9aa0b0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.moveTo(0, -5); g.lineTo(0, 5); g.stroke(); g.restore(); }
          g.fillStyle = INK; g.beginPath(); g.moveTo(-25, -10); g.lineTo(25, -10); g.lineTo(21, 8); g.lineTo(-21, 8); g.closePath(); g.fill();
          g.fillStyle = '#8a5a34'; g.beginPath(); g.moveTo(-23, -8); g.lineTo(23, -8); g.lineTo(19.5, 6); g.lineTo(-19.5, 6); g.closePath(); g.fill();
          g.fillStyle = '#5a3a20'; g.fillRect(-22, -3, 44, 2);
          g.restore();
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
        add(() => glow(0, ly, 46, icy ? 'rgba(140,240,255,.55)' : 'rgba(255,200,110,.6)'));
        g.fillStyle = INK; g.beginPath(); g.moveTo(-15, ly - 18); g.lineTo(15, ly - 18); g.lineTo(11, ly + 15); g.lineTo(-11, ly + 15); g.closePath(); g.fill();
        const lg = g.createLinearGradient(0, ly - 17, 0, ly + 14); lg.addColorStop(0, c1); lg.addColorStop(1, c2);
        g.fillStyle = lg; g.beginPath(); g.moveTo(-13.5, ly - 16.5); g.lineTo(13.5, ly - 16.5); g.lineTo(9.8, ly + 13.5); g.lineTo(-9.8, ly + 13.5); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-4, ly - 15, 2, 27); g.fillRect(4, ly - 15, 2, 27);
        g.fillStyle = '#fff5c0'; g.beginPath(); g.ellipse(0, ly + 9, 3, 4 + Math.sin(t * 20), 0, 0, TAU); g.fill();
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
      draw, measure, travel, celebrate, openGate,
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
