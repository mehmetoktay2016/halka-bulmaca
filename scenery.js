// Dünyaların görünüşü: oyun tahtasının dokusu (ahşap, taş, metal...) ve arka planda
// süzülen parçacıklar (kıvılcım, dişli, buhar, yıldız...). Yalnızca süs; oyunu etkilemez.
// Kural: doku, dünyanın tint rengini en fazla board.alpha opaklıkla kullanır
// (check_themes.js halkaların bu en açık zeminde de okunduğunu denetler).
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const PANEL_SHADE = 0.18; // tahta panelinin koyu tabanı (check_themes.js de kullanır)

  // Tohumlu rastgele: aynı dünya her açılışta aynı dokuyu çizer
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedOf = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

  function rgba(hex, al) {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${v >> 16 & 255}, ${v >> 8 & 255}, ${v & 255}, ${Math.max(0, al).toFixed(3)})`;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  // ---- Tahta dokuları: (g, w, h, ton, opaklık, rastgele) ----
  const TEXTURES = {
    // Çayır: dağınık ot öbekleri
    cayir(g, w, h, c, a, R) {
      g.lineCap = 'round';
      for (let k = 0; k < (w * h) / 900; k++) {
        const x = R() * w, y = R() * h, s = 5 + R() * 7;
        g.strokeStyle = rgba(c, a * (0.35 + R() * 0.65));
        g.lineWidth = 1.2;
        for (let b = -1; b <= 1; b++) {
          g.beginPath();
          g.moveTo(x + b * 2, y);
          g.quadraticCurveTo(x + b * 3, y - s * 0.6, x + b * 5 + (R() - 0.5) * 3, y - s);
          g.stroke();
        }
      }
    },
    // Ahşap: yatay tahtalar, damar çizgileri, budaklar
    ahsap(g, w, h, c, a, R) {
      const ph = 46;
      for (let y = -R() * ph, row = 0; y < h; y += ph, row++) {
        let x = -R() * 120;
        while (x < w) {
          const len = 140 + R() * 160;
          g.fillStyle = rgba(c, a * (0.45 + R() * 0.45));
          g.fillRect(x, y, len, ph);
          g.strokeStyle = rgba(c, a * 0.9);
          g.lineWidth = 1;
          const f = 0.01 + R() * 0.02, phase = R() * TAU;
          for (let l = 0; l < 6; l++) {
            const yl = y + 5 + l * (ph - 10) / 5 + (R() - 0.5) * 3;
            g.beginPath();
            for (let xx = x; xx <= x + len; xx += 8) {
              const yy = yl + Math.sin(xx * f + phase + l * 0.7) * 2.5;
              if (xx === x) g.moveTo(xx, yy); else g.lineTo(xx, yy);
            }
            g.stroke();
          }
          if (R() < 0.35) {
            const kx = x + 20 + R() * (len - 40), ky = y + ph / 2;
            for (let r = 3; r <= 11; r += 4) {
              g.beginPath(); g.ellipse(kx, ky, r * 1.8, r * 0.7, 0, 0, TAU); g.stroke();
            }
          }
          g.fillStyle = 'rgba(0,0,0,.35)';
          g.fillRect(x + len - 1, y, 2, ph);
          x += len;
        }
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.fillRect(0, y + ph - 1.5, w, 3);
      }
    },
    // Saat kadranı: iç içe çemberler ve dakika çizgileri
    kadran(g, w, h, c, a) {
      const cx = w / 2, cy = h / 2, R0 = Math.hypot(w, h) / 2;
      g.strokeStyle = rgba(c, a * 0.8);
      for (let r = 30; r < R0; r += 34) {
        g.lineWidth = r % 68 < 34 ? 1 : 2;
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      }
      for (let k = 0; k < 60; k++) {
        const ang = k / 60 * TAU, big = k % 5 === 0;
        const r1 = Math.min(w, h) * 0.47, r2 = r1 - (big ? 16 : 7);
        g.lineWidth = big ? 3 : 1.5;
        g.strokeStyle = rgba(c, a * (big ? 1 : 0.7));
        g.beginPath();
        g.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        g.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
        g.stroke();
      }
    },
    // Taş duvar: sıralar halinde kesme taşlar, aralarında harç
    tas(g, w, h, c, a, R) {
      const rh = 44;
      for (let y = 0, row = 0; y < h; y += rh, row++) {
        let x = row % 2 ? -40 : -R() * 30;
        while (x < w) {
          const bw = 56 + R() * 54;
          roundRect(g, x + 2.5, y + 2.5, bw - 5, rh - 5, 6);
          g.fillStyle = rgba(c, a * (0.4 + R() * 0.6));
          g.fill();
          g.fillStyle = rgba(c, a * 0.5);
          for (let s = 0; s < 5; s++) {
            g.beginPath(); g.arc(x + 6 + R() * (bw - 12), y + 6 + R() * (rh - 12), 0.8 + R() * 1.4, 0, TAU); g.fill();
          }
          x += bw;
        }
      }
    },
    // Kaldırım: altıgen taşlar
    kaldirim(g, w, h, c, a, R) {
      const r = 24, dx = r * Math.sqrt(3), dy = r * 1.5;
      for (let row = -1, y = 0; y < h + r; row++, y = row * dy) {
        for (let x = (row % 2 ? dx / 2 : 0) - dx; x < w + dx; x += dx) {
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const ang = TAU / 6 * k + Math.PI / 6;
            const px = x + Math.cos(ang) * (r - 2.5), py = y + Math.sin(ang) * (r - 2.5);
            if (k) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.closePath();
          g.fillStyle = rgba(c, a * (0.3 + R() * 0.7));
          g.fill();
        }
      }
    },
    // Fabrika: kaymaz sac (baklava desen) ve kenarda perçinler
    metal(g, w, h, c, a) {
      g.fillStyle = rgba(c, a * 0.35);
      g.fillRect(0, 0, w, h);
      const s = 22;
      g.lineCap = 'round';
      for (let y = 0, row = 0; y < h + s; y += s, row++) {
        for (let x = (row % 2) * s / 2; x < w + s; x += s) {
          const tilt = ((x / s + row) % 2 ? 1 : -1) * 0.8;
          g.lineWidth = 3.4;
          g.strokeStyle = 'rgba(0,0,0,.35)';
          g.beginPath(); g.moveTo(x - Math.cos(tilt) * 6, y - Math.sin(tilt) * 6 + 1); g.lineTo(x + Math.cos(tilt) * 6, y + Math.sin(tilt) * 6 + 1); g.stroke();
          g.strokeStyle = rgba(c, a);
          g.beginPath(); g.moveTo(x - Math.cos(tilt) * 6, y - Math.sin(tilt) * 6); g.lineTo(x + Math.cos(tilt) * 6, y + Math.sin(tilt) * 6); g.stroke();
        }
      }
      for (const [x0, y0, x1, y1] of [[16, 16, w - 16, 16], [16, h - 16, w - 16, h - 16], [16, 16, 16, h - 16], [w - 16, 16, w - 16, h - 16]]) {
        const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 44);
        for (let k = 0; k <= n; k++) {
          const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
          g.fillStyle = 'rgba(0,0,0,.4)';
          g.beginPath(); g.arc(x + 1, y + 1.5, 4.5, 0, TAU); g.fill();
          g.fillStyle = rgba(c, a);
          g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
        }
      }
    },
    // Yıldız haritası: nokta ızgarası, dağınık yıldızlar ve birkaç takımyıldız
    yildiz(g, w, h, c, a, R) {
      g.fillStyle = rgba(c, a * 0.5);
      for (let y = 11; y < h; y += 22) for (let x = 11; x < w; x += 22) g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      const stars = [];
      for (let k = 0; k < 60; k++) {
        const s = { x: R() * w, y: R() * h, r: 0.6 + R() * 1.6 };
        stars.push(s);
        g.fillStyle = rgba(c, a * (0.5 + R() * 0.5));
        g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
      }
      g.strokeStyle = rgba(c, a * 0.6);
      g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        let p = stars[Math.floor(R() * stars.length)];
        g.beginPath(); g.moveTo(p.x, p.y);
        for (let j = 0; j < 4; j++) {
          const near = stars.filter(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 110);
          if (!near.length) break;
          p = near[Math.floor(R() * near.length)];
          g.lineTo(p.x, p.y);
        }
        g.stroke();
      }
    },
    // Mermer: yumuşak zemin, kıvrımlı damarlar ve kenarda ince kakma çizgisi
    mermer(g, w, h, c, a, R) {
      g.fillStyle = rgba(c, a * 0.3);
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 9; k++) {
        let x = R() * w, y = R() * h, ang = R() * TAU;
        g.lineWidth = 0.6 + R() * 2.2;
        g.strokeStyle = rgba(c, a * (0.5 + R() * 0.5));
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 40; s++) {
          ang += (R() - 0.5) * 0.6;
          x += Math.cos(ang) * 12; y += Math.sin(ang) * 12;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.strokeStyle = rgba(c, a);
      g.lineWidth = 1.5;
      for (const inset of [12, 18]) { roundRect(g, inset, inset, w - inset * 2, h - inset * 2, 26 - inset); g.stroke(); }
    },
  };

  // Tahtanın arkasındaki panel: koyu taban, üstüne dünyanın dokusu.
  // Kenarları CSS maskesiyle yumuşar (style.css #boardBg).
  function drawBoard(g, w, h, theme, worldId) {
    g.clearRect(0, 0, w, h);
    const b = theme.board;
    if (!b || !TEXTURES[b.kind]) return;
    g.save();
    roundRect(g, 0, 0, w, h, 30);
    g.fillStyle = `rgba(0,0,0,${PANEL_SHADE})`;
    g.fill();
    g.clip();
    TEXTURES[b.kind](g, w, h, b.tint, b.alpha, rng(seedOf(worldId)));
    g.restore();
  }

  // ---- Arka plan parçacıkları ----
  // Her tür: make(w, h, R, fresh) yeni parçacık; step(p, dt, w, h) günceller (false = öldü);
  // draw(g, p, now, accent). count: aynı anda kaç tane.
  const rand = Math.random;
  function gearPath(g, r, teeth) {
    g.beginPath();
    for (let k = 0; k < teeth * 2; k++) {
      const a0 = k / (teeth * 2) * TAU, a1 = (k + 1) / (teeth * 2) * TAU;
      const rr = k % 2 ? r * 0.82 : r;
      g.arc(0, 0, rr, a0, a1);
    }
    g.closePath();
  }

  const AIR = {
    // Vadi: yavaş süzülen, yanıp sönen polenler
    polen: {
      count: 22,
      make: (w, h, fresh) => ({ x: rand() * w, y: fresh ? rand() * h : h + 10, r: 1 + rand() * 2.2, v: 6 + rand() * 12, ph: rand() * TAU }),
      step: (p, dt, w, h) => { p.y -= p.v * dt; p.x += Math.sin(p.y / 60 + p.ph) * 8 * dt; return p.y > -10; },
      draw: (g, p, now, acc) => {
        g.globalAlpha = 0.25 + 0.3 * Math.sin(now / 700 + p.ph) ** 2;
        g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = 8;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Atölye: aşağıdan yükselen, kuyruklu kıvılcımlar
    kivilcim: {
      count: 26,
      make: (w, h) => ({ x: rand() * w, y: h + 5, vx: (rand() - 0.5) * 30, vy: -(40 + rand() * 70), life: 1, decay: 0.25 + rand() * 0.35 }),
      step: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx += (rand() - 0.5) * 60 * dt; p.life -= p.decay * dt; return p.life > 0; },
      draw: (g, p) => {
        g.globalAlpha = Math.min(1, p.life * 1.4) * 0.8;
        g.strokeStyle = p.life > 0.5 ? '#ffd27a' : '#ff8a3d';
        g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); g.stroke();
      },
    },
    // Saat kulesi: köşelerde yavaşça dönen büyük soluk dişliler ve toz
    disli: {
      count: 14,
      init: (w, h) => [
        { gear: true, x: -10, y: h * 0.18, r: 70, teeth: 14, spin: 0.08 },
        { gear: true, x: 92, y: h * 0.18 - 24, r: 34, teeth: 8, spin: -0.165 },
        { gear: true, x: w + 20, y: h * 0.78, r: 90, teeth: 18, spin: -0.06 },
        { gear: true, x: w - 92, y: h * 0.78 + 50, r: 40, teeth: 9, spin: 0.135 },
      ],
      make: (w, h, fresh) => ({ x: rand() * w, y: fresh ? rand() * h : h + 5, r: 0.8 + rand() * 1.4, v: 4 + rand() * 8, ph: rand() * TAU }),
      step: (p, dt) => { if (p.gear) return true; p.y -= p.v * dt; return p.y > -5; },
      draw: (g, p, now, acc) => {
        if (p.gear) {
          g.save(); g.translate(p.x, p.y); g.rotate(now / 1000 * p.spin);
          g.globalAlpha = 0.09; g.strokeStyle = acc; g.lineWidth = 3;
          gearPath(g, p.r, p.teeth); g.stroke();
          g.beginPath(); g.arc(0, 0, p.r * 0.3, 0, TAU); g.stroke();
          g.restore();
          return;
        }
        g.globalAlpha = 0.25; g.fillStyle = acc;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Zindan: titreyen korlar
    kor: {
      count: 18,
      make: (w, h) => ({ x: rand() * w, y: h + 5, vy: -(18 + rand() * 30), r: 1 + rand() * 1.8, life: 1, decay: 0.12 + rand() * 0.15, ph: rand() * TAU }),
      step: (p, dt) => { p.y += p.vy * dt; p.x += Math.sin(p.y / 30 + p.ph) * 14 * dt; p.life -= p.decay * dt; return p.life > 0; },
      draw: (g, p, now) => {
        g.globalAlpha = p.life * (0.5 + 0.4 * Math.sin(now / 90 + p.ph));
        g.fillStyle = '#ff9b45'; g.shadowColor = '#ff6a2a'; g.shadowBlur = 10;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Şehir: uzak ışıkların bulanık halkaları
    isik: {
      count: 12,
      make: (w, h, fresh) => ({ x: rand() * w, y: fresh ? rand() * h : h + 40, r: 10 + rand() * 26, v: 3 + rand() * 6,
        c: ['#ff8fab', '#ffb347', '#8a7cff'][Math.floor(rand() * 3)], ph: rand() * TAU }),
      step: (p, dt) => { p.y -= p.v * dt; return p.y > -50; },
      draw: (g, p, now) => {
        g.globalAlpha = 0.06 + 0.04 * Math.sin(now / 1500 + p.ph);
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Fabrika: alttan kabaran buhar bulutları
    buhar: {
      count: 10,
      make: (w, h) => ({ x: rand() * w, y: h + 30, vx: (rand() - 0.5) * 10, vy: -(14 + rand() * 16), r: 18 + rand() * 18, life: 1, decay: 0.08 + rand() * 0.06 }),
      step: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; p.r += 9 * dt; p.life -= p.decay * dt; return p.life > 0; },
      draw: (g, p) => {
        const al = 0.09 * Math.sin(Math.PI * p.life);
        const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grd.addColorStop(0, `rgba(205,215,228,${al.toFixed(3)})`);
        grd.addColorStop(1, 'rgba(205,215,228,0)');
        g.globalAlpha = 1; g.fillStyle = grd;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Uzay: göz kırpan yıldızlar, arada bir kayan yıldız
    yildiz: {
      count: 40,
      make: (w, h, fresh) => (rand() < 0.03 && !fresh
        ? { shoot: true, x: rand() * w, y: rand() * h * 0.4, vx: 260 + rand() * 120, vy: 90 + rand() * 60, life: 1 }
        : { x: rand() * w, y: rand() * h, r: 0.5 + rand() * 1.4, ph: rand() * TAU, life: 1, decay: 0.02 + rand() * 0.04 }),
      step: (p, dt) => {
        if (p.shoot) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 1.4 * dt; } else p.life -= p.decay * dt;
        return p.life > 0;
      },
      draw: (g, p, now) => {
        if (p.shoot) {
          g.globalAlpha = p.life * 0.7; g.strokeStyle = '#dcebff'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12); g.stroke();
          return;
        }
        g.globalAlpha = Math.sin(Math.PI * p.life) * (0.35 + 0.35 * Math.sin(now / 400 + p.ph) ** 2);
        g.fillStyle = '#dcebff';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Büyük Usta: yükselen altın tozu ve ara sıra parıltı
    altin: {
      count: 24,
      make: (w, h, fresh) => ({ x: rand() * w, y: fresh ? rand() * h : h + 10, r: 0.8 + rand() * 1.8, v: 8 + rand() * 14, ph: rand() * TAU }),
      step: (p, dt) => { p.y -= p.v * dt; p.x += Math.sin(p.y / 50 + p.ph) * 6 * dt; return p.y > -10; },
      draw: (g, p, now, acc) => {
        const tw = Math.sin(now / 600 + p.ph);
        g.globalAlpha = 0.25 + 0.35 * tw * tw;
        g.fillStyle = acc;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
        if (tw > 0.97) {
          g.strokeStyle = acc; g.lineWidth = 1;
          g.beginPath(); g.moveTo(p.x - 6, p.y); g.lineTo(p.x + 6, p.y); g.moveTo(p.x, p.y - 6); g.lineTo(p.x, p.y + 6); g.stroke();
        }
      },
    },
  };

  // Arka plan katmanı: bir canvas, o anki dünyanın parçacıkları
  function Backdrop(canvas) {
    const g = canvas.getContext('2d');
    let kind = null, accent = '#fff', pool = [], last = 0, w = 0, h = 0;
    function fit() {
      const dpr = root.devicePixelRatio || 1;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (cw !== w || ch !== h) {
        w = cw; h = ch;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (kind) seed();
      }
    }
    function seed() {
      const k = AIR[kind];
      pool = k.init ? k.init(w, h) : [];
      for (let i = 0; i < k.count; i++) pool.push(k.make(w, h, true));
      // Yükselen türler başta ekrana yayılsın
      for (const p of pool) if (p.life != null && !p.gear && p.y > h) { p.y = rand() * h; p.life = rand(); }
    }
    return {
      setWorld(world) {
        if (kind === world.theme.air && accent === world.theme.accent) return;
        kind = world.theme.air; accent = world.theme.accent;
        if (w) seed();
      },
      draw(now, on) {
        fit();
        g.clearRect(0, 0, w, h);
        if (!on || !kind || !w) { last = now; return; }
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        const k = AIR[kind];
        pool = pool.filter(p => k.step(p, dt, w, h));
        while (pool.filter(p => !p.gear).length < k.count) pool.push(k.make(w, h, false));
        for (const p of pool) {
          g.save();
          k.draw(g, p, now, accent);
          g.restore();
        }
      },
    };
  }

  const api = { PANEL_SHADE, TEXTURES, AIR, drawBoard, Backdrop };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingScenery = api;
})(this);
