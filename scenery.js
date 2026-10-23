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
    // Lunapark (2.4): çapraz çizgili çadır bezi, kenar boyunca ampul dizisi
    cadir(g, w, h, c, a) {
      const s = 34, D = Math.hypot(w, h);
      g.save();
      g.translate(w / 2, h / 2); g.rotate(-0.35);
      g.fillStyle = rgba(c, a * 0.5);
      for (let x = -D, k = 0; x < D; x += s, k++) if (k % 2 === 0) g.fillRect(x, -D, s, 2 * D);
      g.restore();
      for (const [x0, y0, x1, y1] of [[18, 18, w - 18, 18], [18, h - 18, w - 18, h - 18], [18, 18, 18, h - 18], [w - 18, 18, w - 18, h - 18]]) {
        const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 30);
        for (let k = 0; k <= n; k++) {
          const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
          const gr = g.createRadialGradient(x, y, 0, x, y, 9);
          gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
          g.fillStyle = rgba(c, a); g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill();
        }
      }
    },
    // Santral (2.4): devre kartı; dik açılı yollar, uçlarında lehim noktaları, birkaç yonga
    devre(g, w, h, c, a, R) {
      const s = 22;
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k = 0; k < 26; k++) {
        let x = Math.floor(R() * w / s) * s + s / 2, y = Math.floor(R() * h / s) * s + s / 2;
        g.strokeStyle = rgba(c, a * (0.5 + R() * 0.5)); g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y);
        let dir = R() < 0.5 ? 0 : 1;
        for (let st = 0; st < 4 + Math.floor(R() * 5); st++) {
          const len = (1 + Math.floor(R() * 4)) * s;
          if (dir === 0) x += R() < 0.5 ? len : -len; else y += R() < 0.5 ? len : -len;
          g.lineTo(x, y);
          dir = 1 - dir;
        }
        g.stroke();
        g.fillStyle = rgba(c, a);
        g.beginPath(); g.arc(x, y, 3.6, 0, TAU); g.fill();
      }
      for (let k = 0; k < 4; k++) {
        const cw = 36 + R() * 30, ch = 24 + R() * 16, x = R() * (w - cw), y = R() * (h - ch);
        roundRect(g, x, y, cw, ch, 4);
        g.fillStyle = rgba(c, a * 0.45); g.fill();
        g.fillStyle = rgba(c, a * 0.8);
        for (let px = x + 5; px < x + cw - 3; px += 7) { g.fillRect(px, y - 4, 3, 4); g.fillRect(px, y + ch, 3, 4); }
      }
    },
    // Deniz Feneri (2.4): üst üste dalga çizgileri, tepelerde köpük noktaları
    dalga(g, w, h, c, a, R) {
      g.lineCap = 'round';
      for (let y = 10, row = 0; y < h + 10; y += 20, row++) {
        const amp = 3 + R() * 3, len = 50 + R() * 30, ph = R() * TAU;
        g.strokeStyle = rgba(c, a * (0.45 + R() * 0.55)); g.lineWidth = 1.6;
        g.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const yy = y + Math.sin(x / len * TAU + ph) * amp;
          if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.stroke();
        g.fillStyle = rgba(c, a * 0.8);
        for (let x = (ph / TAU) * len; x < w; x += len) {
          if (R() < 0.5) continue;
          for (let d = 0; d < 3; d++) { g.beginPath(); g.arc(x + len / 4 + (R() - 0.5) * 8, y - amp - 2 - R() * 3, 0.8 + R(), 0, TAU); g.fill(); }
        }
      }
    },
    // Rasathane (2.4): gök haritası; merkez etrafında yörüngeler, açı çizgileri, yörüngede küçük gezegenler
    gokkure(g, w, h, c, a, R) {
      const cx = w * 0.5, cy = h * 0.55, R0 = Math.hypot(w, h) * 0.6;
      g.strokeStyle = rgba(c, a * 0.55); g.lineWidth = 1;
      for (let k = 0; k < 12; k++) {
        const ang = k / 12 * TAU;
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 30); g.lineTo(cx + Math.cos(ang) * R0, cy + Math.sin(ang) * R0); g.stroke();
      }
      for (let r = 46, k = 0; r < R0; r += 52, k++) {
        g.strokeStyle = rgba(c, a * (k % 2 ? 0.6 : 0.95)); g.lineWidth = k % 2 ? 1 : 1.8;
        g.setLineDash(k % 2 ? [3, 6] : []);
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
        g.setLineDash([]);
        const p = R() * TAU, pr = 2.5 + R() * 4;
        g.fillStyle = rgba(c, a);
        g.beginPath(); g.arc(cx + Math.cos(p) * r, cy + Math.sin(p) * r, pr, 0, TAU); g.fill();
      }
      g.fillStyle = rgba(c, a * 0.7);
      for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R() * 1.1, 0, TAU); g.fill(); }
    },
    // Havai Fişek (2.5): uzakta patlamış fişeklerin ışın demetleri ve aralarında kıvrılan noktalı fitiller
    barut(g, w, h, c, a, R) {
      g.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const x = R() * w, y = R() * h, rr = 26 + R() * 34, n = 12 + Math.floor(R() * 6);
        for (let s = 0; s < n; s++) {
          const ang = s / n * TAU + R() * 0.1, r0 = rr * 0.35, r1 = rr * (0.8 + R() * 0.25);
          g.strokeStyle = rgba(c, a * (0.5 + R() * 0.5)); g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); g.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); g.stroke();
          g.fillStyle = rgba(c, a);
          g.beginPath(); g.arc(x + Math.cos(ang) * (r1 + 4), y + Math.sin(ang) * (r1 + 4), 1.4, 0, TAU); g.fill();
        }
      }
      g.setLineDash([2, 6]); g.lineWidth = 1.4;
      for (let k = 0; k < 5; k++) {
        let x = R() * w, y = R() * h;
        g.strokeStyle = rgba(c, a * 0.7);
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 4; s++) { const nx = x + (R() - 0.5) * 160, ny = y + (R() - 0.5) * 120; g.quadraticCurveTo((x + nx) / 2 + (R() - 0.5) * 60, (y + ny) / 2 + (R() - 0.5) * 60, nx, ny); x = nx; y = ny; }
        g.stroke();
      }
      g.setLineDash([]);
    },
    // Buzul (2.5): kalın buz tabakası; kırık çatlak ağları ve kırağı parıltıları
    buz(g, w, h, c, a, R) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k = 0; k < 9; k++) {
        const crack = (x, y, ang, len, depth) => {
          let px = x, py = y;
          g.beginPath(); g.moveTo(px, py);
          for (let s = 0; s < 5; s++) { ang += (R() - 0.5) * 0.7; px += Math.cos(ang) * len / 5; py += Math.sin(ang) * len / 5; g.lineTo(px, py); }
          g.strokeStyle = rgba(c, a * (depth ? 0.55 : 0.95)); g.lineWidth = depth ? 1 : 1.8; g.stroke();
          if (depth < 2) for (let b = 0; b < 2; b++) crack(px, py, ang + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len * 0.55, depth + 1);
        };
        crack(R() * w, R() * h, R() * TAU, 60 + R() * 60, 0);
      }
      for (let k = 0; k < 26; k++) {
        const x = R() * w, y = R() * h, s = 2 + R() * 3;
        g.strokeStyle = rgba(c, a); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
      }
    },
    // Değirmen (2.5): değirmen taşının oluk deseni; merkezden kıvrılarak açılan kanallar ve iç halka
    tas_degirmen(g, w, h, c, a, R) {
      const cx = w * 0.5, cy = h * 0.5, R0 = Math.hypot(w, h) * 0.55;
      g.lineCap = 'round';
      for (let r = 40; r < R0; r += 70) { g.strokeStyle = rgba(c, a * 0.8); g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
      for (let k = 0; k < 16; k++) {
        const base = k / 16 * TAU;
        g.strokeStyle = rgba(c, a * (k % 2 ? 0.55 : 0.95)); g.lineWidth = k % 2 ? 1.2 : 2;
        g.beginPath();
        for (let r = 40; r < R0; r += 8) { const ang = base + (r - 40) / R0 * 0.9; const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r; if (r === 40) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = rgba(c, a * 0.6);
      for (let k = 0; k < 50; k++) { g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R() * 1.2, 0, TAU); g.fill(); }
    },
    // Büyü Kulesi (2.5): yere çizilmiş büyü çemberleri; iç içe halkalar, yıldız çizgileri ve rün çentikleri
    tilsim(g, w, h, c, a, R) {
      const circle = (cx, cy, r) => {
        g.strokeStyle = rgba(c, a); g.lineWidth = 1.8;
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
        g.strokeStyle = rgba(c, a * 0.7); g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, r * 0.82, 0, TAU); g.stroke();
        g.beginPath();
        for (let k = 0; k <= 5; k++) { const ang = -Math.PI / 2 + k * 2 * TAU / 5; const x = cx + Math.cos(ang) * r * 0.82, y = cy + Math.sin(ang) * r * 0.82; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        for (let k = 0; k < 18; k++) {
          const ang = k / 18 * TAU, r0 = r * 0.86, r1 = r * (k % 3 ? 0.94 : 0.98);
          g.beginPath(); g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); g.lineTo(cx + Math.cos(ang + 0.05) * r1, cy + Math.sin(ang + 0.05) * r1); g.stroke();
        }
      };
      circle(w * 0.5, h * 0.52, Math.min(w, h) * 0.42);
      for (let k = 0; k < 3; k++) circle(R() * w, R() * h, 30 + R() * 30);
      g.fillStyle = rgba(c, a * 0.8);
      for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R(), 0, TAU); g.fill(); }
    },
    // Şeker Diyarı (2.6): şeker ambalajı gibi çapraz şeritler, üstüne dağılmış serpinti ve küçük şeker topları
    seker(g, w, h, c, a, R) {
      g.save();
      g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
      const D = Math.hypot(w, h);
      g.fillStyle = rgba(c, a * 0.55);
      for (let x = -D / 2; x < D / 2; x += 56) g.fillRect(x, -D / 2, 22, D);
      g.fillStyle = rgba(c, a * 0.3);
      for (let x = -D / 2 + 30; x < D / 2; x += 56) g.fillRect(x, -D / 2, 5, D);
      g.restore();
      g.lineCap = 'round'; g.lineWidth = 3; g.strokeStyle = rgba(c, a);
      for (let k = 0; k < (w * h) / 2600; k++) {
        const x = R() * w, y = R() * h, ang = R() * TAU;
        g.beginPath(); g.moveTo(x - Math.cos(ang) * 4, y - Math.sin(ang) * 4); g.lineTo(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4); g.stroke();
      }
      g.fillStyle = rgba(c, a * 0.8);
      for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(R() * w, R() * h, 3 + R() * 4, 0, TAU); g.fill(); }
    },
    // Piramit (2.6): şaşırtmalı kumtaşı bloklar, derzlerde kum; bazı bloklarda oyma hiyeroglif (göz, ankh, su, kuş)
    piramit(g, w, h, c, a, R) {
      const bh = 46, bw = 92;
      g.strokeStyle = rgba(c, a * 0.9); g.lineWidth = 2;
      for (let y = 0, row = 0; y < h + bh; y += bh, row++) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (row % 2) * bw / 2; x < w + bw; x += bw) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke();
          // blok yüzeyinde aşınma lekesi
          g.fillStyle = rgba(c, a * 0.25);
          g.beginPath(); g.ellipse(x + bw * (0.3 + R() * 0.4), y + bh * (0.3 + R() * 0.4), 6 + R() * 12, 3 + R() * 6, 0, 0, TAU); g.fill();
          if (R() > 0.22) continue;
          const cx = x + bw / 2, cy = y + bh / 2, kind = Math.floor(R() * 4);
          g.save(); g.strokeStyle = rgba(c, a * 1.4); g.lineWidth = 2.2; g.lineCap = 'round';
          g.beginPath();
          if (kind === 0) { // göz
            g.ellipse(cx, cy, 11, 5, 0, 0, TAU); g.moveTo(cx + 3, cy); g.arc(cx, cy, 3, 0, TAU);
            g.moveTo(cx - 4, cy + 5); g.lineTo(cx - 7, cy + 12);
          } else if (kind === 1) { // ankh
            g.ellipse(cx, cy - 8, 4, 6, 0, 0, TAU); g.moveTo(cx, cy - 2); g.lineTo(cx, cy + 14); g.moveTo(cx - 8, cy + 2); g.lineTo(cx + 8, cy + 2);
          } else if (kind === 2) { // su
            for (const dy of [-5, 3]) { g.moveTo(cx - 14, cy + dy); for (let k = 1; k <= 7; k++) g.lineTo(cx - 14 + k * 4, cy + dy + (k % 2 ? -3 : 0)); }
          } else { // kuş
            g.moveTo(cx - 10, cy + 8); g.quadraticCurveTo(cx - 4, cy - 4, cx + 6, cy - 6); g.lineTo(cx + 11, cy - 3);
            g.moveTo(cx - 2, cy); g.lineTo(cx - 2, cy + 12); g.moveTo(cx + 3, cy - 2); g.lineTo(cx + 3, cy + 12);
          }
          g.stroke(); g.restore();
        }
      }
      g.fillStyle = rgba(c, a * 0.7);
      for (let k = 0; k < (w * h) / 1800; k++) g.fillRect(R() * w, R() * h, 1.2, 1.2);
    },
    // Mercan Resifi (2.6): su altından süzülen ışık ağı (dalgalı hücreler), yer yer dallanan mercan ve küçük deniz kabukları
    mercan(g, w, h, c, a, R) {
      g.strokeStyle = rgba(c, a * 0.9); g.lineWidth = 1.6; g.lineCap = 'round';
      // ışık ağı: kaydırılmış ızgaranın köşeleri arasında hafif kıvrık çizgiler
      const cell = 46, pts = [];
      for (let y = -cell, j = 0; y < h + cell; y += cell, j++) {
        const row = [];
        for (let x = -cell; x < w + cell; x += cell) row.push([x + (j % 2) * cell / 2 + (R() - 0.5) * 18, y + (R() - 0.5) * 18]);
        pts.push(row);
      }
      const bend = (p, q) => { g.moveTo(p[0], p[1]); g.quadraticCurveTo((p[0] + q[0]) / 2 + (R() - 0.5) * 14, (p[1] + q[1]) / 2 + (R() - 0.5) * 14, q[0], q[1]); };
      g.beginPath();
      pts.forEach((row, j) => row.forEach((p, k) => {
        if (row[k + 1]) bend(p, row[k + 1]);
        const nx = pts[j + 1];
        if (nx) bend(p, nx[k + (j % 2)] || nx[k]);
      }));
      g.stroke();
      // mercan dalları: kökten çatallanan kalın çizgiler
      const branch = (x, y, ang, len, wd, depth) => {
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        if (depth > 0) for (const d of [-0.5, 0.45]) branch(x2, y2, ang + d + (R() - 0.5) * 0.3, len * 0.72, wd * 0.7, depth - 1);
        else { g.beginPath(); g.arc(x2, y2, wd * 0.8, 0, TAU); g.fill(); }
      };
      g.strokeStyle = rgba(c, a * 1.3); g.fillStyle = rgba(c, a * 1.3);
      for (let k = 0; k < 4; k++) branch(R() * w, h * (0.5 + R() * 0.5), -Math.PI / 2 + (R() - 0.5) * 0.6, 22 + R() * 14, 5, 3);
      // deniz kabukları: yelpaze biçimli küçük taraklar
      for (let k = 0; k < 7; k++) {
        const x = R() * w, y = R() * h, s = 6 + R() * 5, rot = R() * TAU;
        g.save(); g.translate(x, y); g.rotate(rot);
        g.fillStyle = rgba(c, a); g.beginPath(); g.moveTo(0, s * 0.6); g.arc(0, 0, s, Math.PI * 1.1, Math.PI * 1.9); g.closePath(); g.fill();
        g.strokeStyle = rgba(c, a * 1.4); g.lineWidth = 1;
        for (let r = -2; r <= 2; r++) { g.beginPath(); g.moveTo(0, s * 0.6); g.lineTo(Math.cos(-Math.PI / 2 + r * 0.32) * s, Math.sin(-Math.PI / 2 + r * 0.32) * s); g.stroke(); }
        g.restore();
      }
    },
    // Bulut Krallığı (2.6): üst üste binen yumuşak bulut kümeleri ve yıldız serpintisi
    bulut(g, w, h, c, a, R) {
      for (let k = 0; k < 7; k++) {
        const x = R() * w, y = R() * h, s = 26 + R() * 30;
        g.fillStyle = rgba(c, a * 0.8);
        for (const [dx, dy, f] of [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.2, 0.75], [-0.4, -0.45, 0.65], [0.45, -0.35, 0.6]]) {
          g.beginPath(); g.arc(x + dx * s, y + dy * s, s * f, 0, TAU); g.fill();
        }
      }
      g.fillStyle = rgba(c, a * 1.6);
      for (let k = 0; k < (w * h) / 5000; k++) {
        const x = R() * w, y = R() * h, s = 1 + R() * 2.2;
        g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * 0.5, y); g.lineTo(x, y + s * 2); g.lineTo(x - s * 0.5, y); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x - s * 2, y); g.lineTo(x, y + s * 0.5); g.lineTo(x + s * 2, y); g.lineTo(x, y - s * 0.5); g.closePath(); g.fill();
      }
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
    // Lunapark (2.4): yavaşça düşen, dönen konfeti; arada bir yükselen balon
    konfeti: {
      count: 22,
      make: (w, h, fresh) => (rand() < 0.05 && !fresh
        ? { balloon: true, x: rand() * w, y: h + 40, v: 18 + rand() * 12, c: ['#ff6fb5', '#ffd34a', '#4cc9f0'][Math.floor(rand() * 3)], ph: rand() * TAU }
        : { x: rand() * w, y: fresh ? rand() * h : -10, vy: 16 + rand() * 22, ph: rand() * TAU, spin: 1 + rand() * 3,
            c: ['#ff6fb5', '#ffd34a', '#4cc9f0', '#90be6d', '#b388ff'][Math.floor(rand() * 5)] }),
      step: (p, dt, w, h) => {
        if (p.balloon) { p.y -= p.v * dt; p.x += Math.sin(p.y / 40 + p.ph) * 10 * dt; return p.y > -60; }
        p.y += p.vy * dt; p.x += Math.sin(p.y / 25 + p.ph) * 18 * dt; return p.y < h + 10;
      },
      draw: (g, p, now) => {
        if (p.balloon) {
          g.globalAlpha = 0.28;
          g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(p.x, p.y + 15); g.quadraticCurveTo(p.x + 5, p.y + 30, p.x - 2, p.y + 44); g.stroke();
          g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, 11, 14, 0, 0, TAU); g.fill();
          return;
        }
        g.globalAlpha = 0.45;
        g.translate(p.x, p.y); g.rotate(now / 1000 * p.spin + p.ph); g.scale(1, Math.abs(Math.cos(now / 400 + p.ph)) + 0.15);
        g.fillStyle = p.c; g.fillRect(-4, -2, 8, 4);
      },
    },
    // Santral (2.4): süzülen toz ve ara ara çakan küçük elektrik arkları
    elektrik: {
      count: 18,
      make: (w, h, fresh) => (rand() < 0.12 && !fresh
        ? { arc: true, x: rand() * w, y: rand() * h, len: 20 + rand() * 30, ang: rand() * TAU, life: 1, seed: rand() * 1000 }
        : { x: rand() * w, y: fresh ? rand() * h : h + 5, r: 0.8 + rand() * 1.4, v: 5 + rand() * 9, ph: rand() * TAU }),
      step: (p, dt) => {
        if (p.arc) { p.life -= 4 * dt; return p.life > 0; }
        p.y -= p.v * dt; p.x += Math.sin(p.y / 40 + p.ph) * 6 * dt; return p.y > -5;
      },
      draw: (g, p, now, acc) => {
        if (p.arc) {
          g.globalAlpha = p.life * 0.7; g.strokeStyle = acc; g.lineWidth = 1.6; g.shadowColor = acc; g.shadowBlur = 10;
          g.beginPath(); g.moveTo(p.x, p.y);
          for (let k = 1; k <= 6; k++) {
            const d = p.len * k / 6, j = Math.sin(p.seed + k * 7.1 + now / 30) * 5;
            g.lineTo(p.x + Math.cos(p.ang) * d - Math.sin(p.ang) * j, p.y + Math.sin(p.ang) * d + Math.cos(p.ang) * j);
          }
          g.stroke();
          return;
        }
        g.globalAlpha = 0.3; g.fillStyle = acc;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Deniz Feneri (2.4): sağ üstteki fenerden yavaşça tarayan ışık huzmesi ve yatay süzülen sis
    fener: {
      count: 9,
      init: (w, h) => [{ beam: true, x: w * 0.88, y: h * 0.06 }],
      make: (w, h, fresh) => ({ x: fresh ? rand() * w : -60, y: rand() * h, vx: 8 + rand() * 10, r: 30 + rand() * 30, ph: rand() * TAU }),
      step: (p, dt, w) => { if (p.beam) return true; p.x += p.vx * dt; return p.x < w + 70; },
      draw: (g, p, now, acc) => {
        if (p.beam) {
          const ang = Math.PI * 0.75 + Math.sin(now / 5200) * 0.55, L = 900, half = 0.13;
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, L);
          gr.addColorStop(0, 'rgba(255,226,160,.16)'); gr.addColorStop(1, 'rgba(255,226,160,0)');
          g.globalAlpha = 1; g.fillStyle = gr;
          g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, L, ang - half, ang + half); g.closePath(); g.fill();
          g.fillStyle = acc; g.globalAlpha = 0.8; g.shadowColor = acc; g.shadowBlur = 16;
          g.beginPath(); g.arc(p.x, p.y, 4, 0, TAU); g.fill();
          return;
        }
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gr.addColorStop(0, 'rgba(200,220,235,.06)'); gr.addColorStop(1, 'rgba(200,220,235,0)');
        g.globalAlpha = 1; g.fillStyle = gr;
        g.beginPath(); g.ellipse(p.x, p.y, p.r * 1.8, p.r, 0, 0, TAU); g.fill();
      },
    },
    // Rasathane (2.4): uzakta yavaşça dolanan üç gezegen ve göz kırpan yıldızlar
    gezegen: {
      count: 30,
      init: (w, h) => [
        { planet: true, cx: w * 0.15, cy: h * 0.2, R: 70, r: 7, sp: 0.12, ph: 0, c: '#ffb38a' },
        { planet: true, cx: w * 0.85, cy: h * 0.75, R: 90, r: 10, sp: -0.08, ph: 2, c: '#9cc8ff', ring: true },
        { planet: true, cx: w * 0.8, cy: h * 0.15, R: 40, r: 4, sp: 0.2, ph: 4, c: '#c3a6ff' },
      ],
      make: (w, h) => ({ x: rand() * w, y: rand() * h, r: 0.5 + rand() * 1.3, ph: rand() * TAU, life: 1, decay: 0.03 + rand() * 0.04 }),
      step: (p, dt) => { if (p.planet) return true; p.life -= p.decay * dt; return p.life > 0; },
      draw: (g, p, now, acc) => {
        if (p.planet) {
          const a = p.ph + now / 1000 * p.sp, x = p.cx + Math.cos(a) * p.R, y = p.cy + Math.sin(a) * p.R * 0.45;
          g.globalAlpha = 0.08; g.strokeStyle = acc; g.lineWidth = 1;
          g.beginPath(); g.ellipse(p.cx, p.cy, p.R, p.R * 0.45, 0, 0, TAU); g.stroke();
          g.globalAlpha = 0.35; g.fillStyle = p.c;
          g.beginPath(); g.arc(x, y, p.r, 0, TAU); g.fill();
          if (p.ring) { g.strokeStyle = p.c; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, p.r * 1.9, p.r * 0.6, -0.3, 0, TAU); g.stroke(); }
          return;
        }
        g.globalAlpha = Math.sin(Math.PI * p.life) * (0.3 + 0.35 * Math.sin(now / 450 + p.ph) ** 2);
        g.fillStyle = '#e8e0ff';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Havai Fişek (2.5): uzakta yükselip patlayan fişekler, sonra yavaşça süzülen duman
    fisek: {
      count: 14,
      make: (w, h, fresh) => (rand() < 0.3 && !fresh
        ? { rocket: true, x: w * (0.1 + rand() * 0.8), y: h + 10, top: h * (0.12 + rand() * 0.35), v: 260 + rand() * 120, t: 0,
            c: ['#ffd34a', '#ff6fb5', '#4cc9f0', '#ff7a45', '#b388ff'][Math.floor(rand() * 5)] }
        : { x: rand() * w, y: fresh ? rand() * h : h + 30, r: 24 + rand() * 30, v: 4 + rand() * 6, ph: rand() * TAU }),
      step: (p, dt, w, h) => {
        if (p.rocket) {
          if (p.y > p.top) { p.y -= p.v * dt; return true; }
          p.t += dt; return p.t < 1.6;
        }
        p.y -= p.v * dt; p.x += Math.sin(p.y / 60 + p.ph) * 4 * dt; return p.y > -p.r;
      },
      draw: (g, p) => {
        if (p.rocket) {
          if (p.y > p.top) {
            g.globalAlpha = 0.55; g.strokeStyle = p.c; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y + 16); g.stroke();
            return;
          }
          const u = p.t / 1.6, e = 1 - Math.pow(1 - Math.min(1, u * 1.6), 3);
          g.globalAlpha = 0.5 * (1 - u); g.fillStyle = p.c;
          for (let k = 0; k < 18; k++) {
            const ang = k / 18 * TAU, d = 46 * e;
            g.beginPath(); g.arc(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d + 18 * u * u, 1.8, 0, TAU); g.fill();
          }
          return;
        }
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gr.addColorStop(0, 'rgba(200,170,190,.05)'); gr.addColorStop(1, 'rgba(200,170,190,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Buzul (2.5): üstte dalgalanan kutup ışıkları ve yavaşça yağan kar
    kar: {
      count: 34,
      init: (w, h) => [{ aurora: true, w, h }],
      make: (w, h, fresh) => ({ x: rand() * w, y: fresh ? rand() * h : -8, r: 0.8 + rand() * 2, vy: 10 + rand() * 18, ph: rand() * TAU }),
      step: (p, dt, w, h) => { if (p.aurora) { p.w = w; p.h = h; return true; } p.y += p.vy * dt; p.x += Math.sin(p.y / 30 + p.ph) * 8 * dt; return p.y < h + 8; },
      draw: (g, p, now, acc) => {
        if (p.aurora) {
          for (let band = 0; band < 2; band++) {
            const y0 = p.h * (0.08 + band * 0.07);
            g.globalAlpha = 0.10 - band * 0.03;
            const gr = g.createLinearGradient(0, y0 - 40, 0, y0 + 60);
            gr.addColorStop(0, 'rgba(120,255,200,0)'); gr.addColorStop(0.5, band ? '#b388ff' : '#7fffd4'); gr.addColorStop(1, 'rgba(120,255,200,0)');
            g.fillStyle = gr;
            g.beginPath(); g.moveTo(0, y0 + 60);
            for (let x = 0; x <= p.w; x += 20) g.lineTo(x, y0 + Math.sin(x / 90 + now / 2400 + band * 2) * 18 + Math.sin(x / 37 + now / 1300) * 6);
            g.lineTo(p.w, y0 + 60); g.closePath(); g.fill();
          }
          return;
        }
        g.globalAlpha = 0.55; g.fillStyle = '#eef8ff';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Değirmen (2.5): köşede yavaşça dönen yel değirmeni kanatları ve süzülen un tozu, saman çöpleri
    yel: {
      count: 22,
      init: (w, h) => [{ mill: true, x: w * 0.9, y: h * 0.16 }],
      make: (w, h, fresh) => ({ x: fresh ? rand() * w : -10, y: rand() * h, vx: 10 + rand() * 16, ph: rand() * TAU, chaff: rand() < 0.35, len: 5 + rand() * 6, r: 0.8 + rand() * 1.4 }),
      step: (p, dt, w) => { if (p.mill) return true; p.x += p.vx * dt; p.y += Math.sin(p.x / 50 + p.ph) * 6 * dt; return p.x < w + 10; },
      draw: (g, p, now, acc) => {
        if (p.mill) {
          g.globalAlpha = 0.13; g.fillStyle = acc; g.strokeStyle = acc; g.lineWidth = 2;
          g.translate(p.x, p.y); g.rotate(now / 3000);
          for (let k = 0; k < 4; k++) {
            g.rotate(TAU / 4);
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -80); g.stroke();
            g.fillRect(2, -78, 16, 58);
          }
          g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
          return;
        }
        if (p.chaff) {
          g.globalAlpha = 0.35; g.strokeStyle = '#e8d38a'; g.lineWidth = 1.4; g.lineCap = 'round';
          const ang = now / 700 + p.ph;
          g.beginPath(); g.moveTo(p.x - Math.cos(ang) * p.len / 2, p.y - Math.sin(ang) * p.len / 2); g.lineTo(p.x + Math.cos(ang) * p.len / 2, p.y + Math.sin(ang) * p.len / 2); g.stroke();
          return;
        }
        g.globalAlpha = 0.3; g.fillStyle = '#fff8e6';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Büyü Kulesi (2.5): sarmal çizerek yükselen ışık zerreleri ve arada açılıp kapanan küçük rün çemberleri
    buyu: {
      count: 24,
      make: (w, h, fresh) => (rand() < 0.08 && !fresh
        ? { rune: true, x: rand() * w, y: rand() * h, r: 14 + rand() * 18, life: 1 }
        : { x0: rand() * w, y: fresh ? rand() * h : h + 6, v: 10 + rand() * 14, R: 6 + rand() * 14, ph: rand() * TAU, r: 0.8 + rand() * 1.6 }),
      step: (p, dt) => { if (p.rune) { p.life -= 0.5 * dt; return p.life > 0; } p.y -= p.v * dt; return p.y > -10; },
      draw: (g, p, now, acc) => {
        if (p.rune) {
          const a = Math.sin(Math.PI * p.life);
          g.globalAlpha = 0.22 * a; g.strokeStyle = acc; g.lineWidth = 1.4;
          g.translate(p.x, p.y); g.rotate(now / 2000);
          g.beginPath(); g.arc(0, 0, p.r, 0, TAU); g.stroke();
          g.beginPath();
          for (let k = 0; k <= 6; k++) { const ang = k * 2 * TAU / 6 + Math.PI / 6; const x = Math.cos(ang) * p.r * 0.8, y = Math.sin(ang) * p.r * 0.8; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
          g.stroke();
          return;
        }
        const x = p.x0 + Math.cos(p.y / 30 + p.ph) * p.R;
        g.globalAlpha = 0.5; g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = 8;
        g.beginPath(); g.arc(x, p.y, p.r, 0, TAU); g.fill();
      },
    },
    // Şeker Diyarı (2.6): dönerek düşen renkli serpinti; arada yukarı süzülen sarılı şeker
    seker: {
      count: 24,
      make: (w, h, fresh) => (rand() < 0.04 && !fresh
        ? { candy: true, x: rand() * w, y: h + 30, v: 14 + rand() * 10, ph: rand() * TAU, c: ['#ff6fc0', '#4fdcb0', '#ffd34a'][Math.floor(rand() * 3)] }
        : { x: rand() * w, y: fresh ? rand() * h : -10, vy: 14 + rand() * 18, ph: rand() * TAU, spin: 1 + rand() * 2.5,
            c: ['#ff6fc0', '#4fdcb0', '#ffd34a', '#ffffff', '#b388ff'][Math.floor(rand() * 5)] }),
      step: (p, dt, w, h) => {
        if (p.candy) { p.y -= p.v * dt; p.x += Math.sin(p.y / 45 + p.ph) * 10 * dt; return p.y > -40; }
        p.y += p.vy * dt; p.x += Math.sin(p.y / 30 + p.ph) * 12 * dt; return p.y < h + 10;
      },
      draw: (g, p, now) => {
        g.translate(p.x, p.y);
        if (p.candy) {
          g.globalAlpha = 0.3; g.rotate(Math.sin(now / 900 + p.ph) * 0.4); g.fillStyle = p.c;
          for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 7, 0); g.lineTo(d * 17, -7); g.lineTo(d * 17, 7); g.closePath(); g.fill(); }
          g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
          return;
        }
        g.globalAlpha = 0.5; g.rotate(now / 1000 * p.spin + p.ph);
        g.strokeStyle = p.c; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 0); g.stroke();
      },
    },
    // Piramit (2.6): rüzgârla yana savrulan kum taneleri; arada güneşte parlayan altın toz
    piramit: {
      count: 36,
      make: (w, h, fresh) => ({ x: fresh ? rand() * w : -10, y: rand() * h, vx: 30 + rand() * 40, ph: rand() * TAU, r: 1.1 + rand() * 1.6,
        gold: rand() < 0.08, c: ['#e8c88a', '#d9b070', '#f3dcae'][Math.floor(rand() * 3)] }),
      step: (p, dt, w) => { p.x += p.vx * dt; p.y += Math.sin(p.x / 40 + p.ph) * 14 * dt; return p.x < w + 10; },
      draw: (g, p, now) => {
        if (p.gold) {
          g.globalAlpha = 0.35 + 0.35 * Math.sin(now / 180 + p.ph); g.fillStyle = '#ffe08a';
          g.translate(p.x, p.y); g.rotate(now / 700 + p.ph);
          g.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? 1 : 3.5, a = k * Math.PI / 4; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill();
          return;
        }
        g.globalAlpha = 0.6; g.fillStyle = p.c;
        g.beginPath(); g.ellipse(p.x, p.y, p.r * 2.6, p.r * 1.1, 0, 0, TAU); g.fill();
      },
    },
    // Mercan Resifi (2.6): sallanarak yükselen kabarcıklar; arada yandan geçen küçük balık sürüsü
    mercan: {
      count: 26,
      make: (w, h, fresh) => (rand() < 0.05 && !fresh
        ? { fish: true, x: -30, y: h * (0.15 + rand() * 0.7), v: 30 + rand() * 25, ph: rand() * TAU, n: 3 + Math.floor(rand() * 3), c: ['#ff8a7a', '#ffcf7a', '#2dd4bf'][Math.floor(rand() * 3)] }
        : { x: rand() * w, y: fresh ? rand() * h : h + 10, vy: 16 + rand() * 22, ph: rand() * TAU, r: 1.5 + rand() * 3.5 }),
      step: (p, dt, w) => {
        if (p.fish) { p.x += p.v * dt; return p.x < w + 60; }
        p.y -= p.vy * dt; p.x += Math.sin(p.y / 22 + p.ph) * 10 * dt; return p.y > -10;
      },
      draw: (g, p, now) => {
        if (p.fish) {
          g.globalAlpha = 0.28; g.fillStyle = p.c;
          for (let k = 0; k < p.n; k++) {
            const x = p.x - k * 16, y = p.y + Math.sin(now / 300 + k + p.ph) * 5 + (k % 2) * 8, wag = Math.sin(now / 90 + k) * 2;
            g.beginPath(); g.ellipse(x, y, 7, 3.5, 0, 0, TAU); g.fill();
            g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 12, y - 4 + wag); g.lineTo(x - 12, y + 4 + wag); g.closePath(); g.fill();
          }
          return;
        }
        g.globalAlpha = 0.4; g.strokeStyle = '#bff3ff'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.3, 0, TAU); g.fill();
      },
    },
    // Bulut Krallığı (2.6): yavaşça süzülen bulut tutamları; arada çapraz kayan yıldız
    bulut: {
      count: 14,
      make: (w, h, fresh) => (rand() < 0.06 && !fresh
        ? { star: true, x: rand() * w * 0.6, y: -10, vx: 160 + rand() * 80, vy: 110 + rand() * 50 }
        : { x: fresh ? rand() * w : -60, y: rand() * h, vx: 6 + rand() * 10, s: 10 + rand() * 18, ph: rand() * TAU }),
      step: (p, dt, w, h) => {
        if (p.star) { p.x += p.vx * dt; p.y += p.vy * dt; return p.x < w + 40 && p.y < h + 40; }
        p.x += p.vx * dt; return p.x < w + 60;
      },
      draw: (g, p, now) => {
        if (p.star) {
          const len = 40, d = Math.hypot(p.vx, p.vy), ux = p.vx / d, uy = p.vy / d;
          const gr = g.createLinearGradient(p.x - ux * len, p.y - uy * len, p.x, p.y);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,246,214,.8)');
          g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x - ux * len, p.y - uy * len); g.lineTo(p.x, p.y); g.stroke();
          return;
        }
        g.globalAlpha = 0.1 + 0.04 * Math.sin(now / 1500 + p.ph); g.fillStyle = '#eef4ff';
        for (const [dx, dy, f] of [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.2, 0.7]]) { g.beginPath(); g.arc(p.x + dx * p.s, p.y + dy * p.s, p.s * f, 0, TAU); g.fill(); }
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
