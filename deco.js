// Halka içi süsler: hayvan yüzleri, göz bebekleri, gaga, karın; eşyalar (tekerlek, pencere, saat...).
// Tüm ölçüler halka yarıçapına (r) göre; çizim halkanın merkezinde (0,0) yapılır.
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#24203a';
  const PINK = '#ff7aa2';
  const BLUSH = 'rgba(255, 122, 162, .38)';

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${a})`;
  }
  function circle(g, x, y, rad, fill) {
    g.fillStyle = fill;
    g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  }
  function ellipse(g, x, y, rx, ry, rot, fill) {
    g.fillStyle = fill;
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
  }
  function line(g, pts, width, color) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.stroke();
  }

  // ~4 saniyede bir kısa göz kırpma
  function blink(now) {
    const t = (now / 1000) % 4.2;
    return t < 0.13 ? 0.15 : 1;
  }

  function eye(g, x, y, s, now) {
    g.save();
    g.translate(x, y);
    g.scale(1, blink(now));
    circle(g, 0, 0, s, INK);
    circle(g, -s * 0.32, -s * 0.36, s * 0.36, '#fff');
    g.restore();
  }

  function cheeks(g, r, y = 0.2, x = 0.52) {
    ellipse(g, -x * r, y * r, 0.13 * r, 0.08 * r, 0, BLUSH);
    ellipse(g, x * r, y * r, 0.13 * r, 0.08 * r, 0, BLUSH);
  }

  function smallMouth(g, r, y) {
    const w = Math.max(1.6, r * 0.03);
    g.strokeStyle = INK;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath(); g.arc(-0.07 * r, y * r, 0.07 * r, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    g.beginPath(); g.arc(0.07 * r, y * r, 0.07 * r, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  }

  function fillFace(g, r, color, a = 0.38) {
    circle(g, 0, 0, r - 7, hexA(color, a));
  }

  const FACES = {
    cat(g, r, now, color) {
      fillFace(g, r, color);
      eye(g, -0.32 * r, -0.06 * r, 0.1 * r, now);
      eye(g, 0.32 * r, -0.06 * r, 0.1 * r, now);
      g.fillStyle = PINK;
      g.beginPath();
      g.moveTo(-0.07 * r, 0.1 * r); g.lineTo(0.07 * r, 0.1 * r); g.lineTo(0, 0.18 * r);
      g.closePath(); g.fill();
      smallMouth(g, r, 0.2);
      const wc = 'rgba(255,255,255,.75)', ww = Math.max(1.5, r * 0.022);
      for (const sx of [-1, 1]) {
        line(g, [[sx * 0.24 * r, 0.12 * r], [sx * 0.62 * r, 0.04 * r]], ww, wc);
        line(g, [[sx * 0.24 * r, 0.18 * r], [sx * 0.64 * r, 0.2 * r]], ww, wc);
      }
      cheeks(g, r, 0.26, 0.48);
    },
    bear(g, r, now, color) {
      fillFace(g, r, color);
      ellipse(g, 0, 0.3 * r, 0.32 * r, 0.24 * r, 0, '#f3dcc0');
      eye(g, -0.3 * r, -0.1 * r, 0.09 * r, now);
      eye(g, 0.3 * r, -0.1 * r, 0.09 * r, now);
      ellipse(g, 0, 0.2 * r, 0.11 * r, 0.08 * r, 0, INK);
      line(g, [[0, 0.26 * r], [0, 0.34 * r]], Math.max(1.6, r * 0.03), INK);
      smallMouth(g, r, 0.34);
      cheeks(g, r, 0.18, 0.56);
    },
    bunny(g, r, now, color) {
      fillFace(g, r, color, 0.3);
      eye(g, -0.3 * r, -0.04 * r, 0.1 * r, now);
      eye(g, 0.3 * r, -0.04 * r, 0.1 * r, now);
      ellipse(g, 0, 0.16 * r, 0.07 * r, 0.05 * r, 0, PINK);
      smallMouth(g, r, 0.22);
      g.fillStyle = '#fff';
      g.fillRect(-0.06 * r, 0.29 * r, 0.12 * r, 0.1 * r);
      line(g, [[0, 0.29 * r], [0, 0.39 * r]], 1.2, 'rgba(36,32,58,.4)');
      cheeks(g, r, 0.2, 0.5);
    },
    panda(g, r, now, color) {
      fillFace(g, r, color, 0.3);
      ellipse(g, -0.32 * r, -0.02 * r, 0.19 * r, 0.14 * r, 0.6, '#2b2f45');
      ellipse(g, 0.32 * r, -0.02 * r, 0.19 * r, 0.14 * r, -0.6, '#2b2f45');
      for (const sx of [-1, 1]) {
        g.save();
        g.translate(sx * 0.3 * r, -0.04 * r);
        g.scale(1, blink(now));
        circle(g, 0, 0, 0.065 * r, '#fff');
        circle(g, 0.01 * r, 0.01 * r, 0.035 * r, INK);
        g.restore();
      }
      ellipse(g, 0, 0.2 * r, 0.1 * r, 0.07 * r, 0, INK);
      smallMouth(g, r, 0.27);
      cheeks(g, r, 0.26, 0.54);
    },
    pig(g, r, now, color) {
      fillFace(g, r, color);
      eye(g, -0.32 * r, -0.14 * r, 0.085 * r, now);
      eye(g, 0.32 * r, -0.14 * r, 0.085 * r, now);
      ellipse(g, 0, 0.2 * r, 0.27 * r, 0.19 * r, 0, '#ff8fab');
      ellipse(g, -0.09 * r, 0.2 * r, 0.04 * r, 0.07 * r, 0, '#a0405c');
      ellipse(g, 0.09 * r, 0.2 * r, 0.04 * r, 0.07 * r, 0, '#a0405c');
      cheeks(g, r, 0.12, 0.58);
    },
    frog(g, r, now, color) {
      fillFace(g, r, color);
      g.strokeStyle = INK;
      g.lineWidth = Math.max(2, r * 0.045);
      g.lineCap = 'round';
      g.beginPath(); g.arc(0, -0.05 * r, 0.5 * r, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke();
      circle(g, -0.12 * r, -0.1 * r, 0.03 * r, 'rgba(36,32,58,.55)');
      circle(g, 0.12 * r, -0.1 * r, 0.03 * r, 'rgba(36,32,58,.55)');
      cheeks(g, r, 0.22, 0.58);
    },
    caterpillar(g, r, now, color) {
      for (const sx of [-1, 1]) {
        line(g, [[sx * 0.28 * r, -0.88 * r], [sx * 0.42 * r, -1.25 * r], [sx * 0.56 * r, -1.42 * r]], Math.max(2, r * 0.05), INK);
        circle(g, sx * 0.58 * r, -1.46 * r, 0.1 * r, '#ff7aa2');
      }
      fillFace(g, r, color, 0.4);
      eye(g, -0.3 * r, -0.08 * r, 0.12 * r, now);
      eye(g, 0.3 * r, -0.08 * r, 0.12 * r, now);
      g.strokeStyle = INK;
      g.lineWidth = Math.max(2, r * 0.045);
      g.beginPath(); g.arc(0, 0.12 * r, 0.2 * r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      cheeks(g, r, 0.22, 0.52);
    },
    penguin(g, r, now, color) {
      fillFace(g, r, color, 0.4);
      ellipse(g, 0, 0.14 * r, 0.6 * r, 0.56 * r, 0, '#eef0ff');
      eye(g, -0.24 * r, 0.02 * r, 0.1 * r, now);
      eye(g, 0.24 * r, 0.02 * r, 0.1 * r, now);
      g.fillStyle = '#ff9f1c';
      g.beginPath();
      g.moveTo(-0.11 * r, 0.18 * r); g.lineTo(0.11 * r, 0.18 * r); g.lineTo(0, 0.32 * r);
      g.closePath(); g.fill();
      cheeks(g, r, 0.24, 0.42);
    },
    lion(g, r, now, color) {
      fillFace(g, r, color, 0.42);
      eye(g, -0.3 * r, -0.1 * r, 0.1 * r, now);
      eye(g, 0.3 * r, -0.1 * r, 0.1 * r, now);
      g.fillStyle = '#8a4b2a';
      g.beginPath();
      g.moveTo(-0.1 * r, 0.1 * r); g.lineTo(0.1 * r, 0.1 * r); g.lineTo(0, 0.2 * r);
      g.closePath(); g.fill();
      smallMouth(g, r, 0.23);
      for (const sx of [-1, 1]) {
        for (const [dx, dy] of [[0.2, 0.3], [0.28, 0.24], [0.28, 0.36]]) {
          circle(g, sx * dx * r, dy * r, 0.022 * r, 'rgba(138,75,42,.7)');
        }
      }
      cheeks(g, r, 0.18, 0.56);
    },
  };

  // ---- Ayarlanabilir yüz (yeni hayvanlar) ----
  // { type: 'face', look: { eyes, nose, mouth, extras, fill, eyeY, eyeX, eyeS, noseColor, tint } }
  // eyes: round | big | happy | visor | three   nose: triangle | oval | snout | beak | duck | trunk | none
  // mouth: smile | w | open | fangs | tongue | grill | none
  // extras: whiskers, cheeks, antennae, spots, stripes, mask, horns, freckles, brows, muzzle, bandit
  // (2.4: nose hook (flamingo) ve tube (denizatı), mouth buckteeth (kunduz) ve howl (uluyan kurt))
  function drawLook(g, r, now, color, L) {
    const ex = new Set(L.extras || []);
    const ey = (L.eyeY ?? -0.08) * r, exx = (L.eyeX ?? 0.3) * r, es = (L.eyeS ?? 0.1) * r;
    const lw = Math.max(1.8, r * 0.035);
    if (ex.has('horns')) {
      for (const sx of [-1, 1]) {
        g.fillStyle = '#f3e3c3';
        g.beginPath();
        g.moveTo(sx * 0.3 * r, -0.72 * r); g.quadraticCurveTo(sx * 0.62 * r, -1.08 * r, sx * 0.5 * r, -1.25 * r);
        g.quadraticCurveTo(sx * 0.42 * r, -0.98 * r, sx * 0.14 * r, -0.8 * r); g.closePath(); g.fill();
      }
    }
    if (ex.has('antennae')) {
      for (const sx of [-1, 1]) {
        line(g, [[sx * 0.2 * r, -0.85 * r], [sx * 0.34 * r, -1.2 * r], [sx * 0.46 * r, -1.36 * r]], lw, INK);
        circle(g, sx * 0.48 * r, -1.4 * r, 0.1 * r, L.tint || '#ff7aa2');
      }
    }
    fillFace(g, r, color, L.fill ?? 0.46);
    if (ex.has('mask')) {
      // Tilki/rakun maskesi: göz çevresinde açık renkli yanaklar
      ellipse(g, -0.36 * r, 0.16 * r, 0.3 * r, 0.24 * r, 0.4, 'rgba(255,248,236,.85)');
      ellipse(g, 0.36 * r, 0.16 * r, 0.3 * r, 0.24 * r, -0.4, 'rgba(255,248,236,.85)');
    }
    if (ex.has('muzzle')) {
      // Maymun: alt yüzde açık renkli kalp biçimi ağız bölgesi
      ellipse(g, -0.2 * r, 0.22 * r, 0.3 * r, 0.26 * r, 0.3, 'rgba(255,240,220,.8)');
      ellipse(g, 0.2 * r, 0.22 * r, 0.3 * r, 0.26 * r, -0.3, 'rgba(255,240,220,.8)');
      ellipse(g, 0, -0.06 * r, 0.5 * r, 0.28 * r, 0, 'rgba(255,240,220,.55)');
    }
    if (ex.has('bandit')) {
      // Rakun: gözlerin üstünden geçen koyu bant
      ellipse(g, 0, (L.eyeY ?? -0.08) * r, 0.62 * r, 0.17 * r, 0, 'rgba(36,32,58,.75)');
    }
    if (ex.has('spots')) {
      for (const [x, y, s] of [[-0.5, -0.45, 0.13], [0.48, -0.5, 0.1], [0.55, 0.35, 0.12], [-0.6, 0.3, 0.09], [0.05, -0.68, 0.08]]) {
        circle(g, x * r, y * r, s * r, 'rgba(139, 84, 40, .55)');
      }
    }
    if (ex.has('stripes')) {
      g.save();
      g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.clip();
      for (const y of [-0.55, 0.45]) g.fillRect(-r, y * r, 2 * r, 0.16 * r);
      g.restore();
    }
    if (ex.has('freckles')) {
      for (const sx of [-1, 1]) for (const [x, y] of [[0.42, 0.2], [0.5, 0.28], [0.36, 0.3]]) circle(g, sx * x * r, y * r, 0.022 * r, 'rgba(36,32,58,.35)');
    }
    // Gözler
    const eyes = L.eyes || 'round';
    if (eyes === 'visor') {
      g.fillStyle = '#1d2238';
      g.beginPath();
      if (g.roundRect) g.roundRect(-0.55 * r, ey - 0.16 * r, 1.1 * r, 0.32 * r, 0.16 * r); else g.rect(-0.55 * r, ey - 0.16 * r, 1.1 * r, 0.32 * r);
      g.fill();
      const scan = Math.sin(now / 600) * 0.32 * r;
      for (const sx of [-1, 1]) circle(g, sx * 0.25 * r + scan * 0.2, ey, 0.09 * r * blink(now), '#5ef0ff');
    } else if (eyes === 'happy') {
      for (const sx of [-1, 1]) {
        g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = 'round';
        g.beginPath(); g.arc(sx * exx, ey + 0.04 * r, es * 0.9, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
      }
    } else if (eyes === 'three') {
      eye(g, 0, ey - 0.16 * r, es * 1.15, now);
      eye(g, -exx, ey + 0.04 * r, es * 0.85, now + 300);
      eye(g, exx, ey + 0.04 * r, es * 0.85, now + 600);
    } else {
      const s = eyes === 'big' ? es * 1.45 : es;
      if (eyes === 'big') for (const sx of [-1, 1]) circle(g, sx * exx, ey, s * 1.35, '#fff');
      eye(g, -exx, ey, s, now);
      eye(g, exx, ey, s, now);
    }
    if (ex.has('brows')) {
      for (const sx of [-1, 1]) line(g, [[sx * (exx - es), ey - es * 1.9], [sx * (exx + es * 0.9), ey - es * 2.4]], lw, INK);
    }
    // Burun
    const nc = L.noseColor || INK;
    switch (L.nose || 'oval') {
      case 'triangle':
        g.fillStyle = nc;
        g.beginPath(); g.moveTo(-0.08 * r, 0.1 * r); g.lineTo(0.08 * r, 0.1 * r); g.lineTo(0, 0.19 * r); g.closePath(); g.fill();
        break;
      case 'oval': ellipse(g, 0, 0.16 * r, 0.09 * r, 0.065 * r, 0, nc); break;
      case 'snout':
        ellipse(g, 0, 0.24 * r, 0.3 * r, 0.21 * r, 0, 'rgba(255,248,236,.8)');
        ellipse(g, 0, 0.16 * r, 0.1 * r, 0.07 * r, 0, nc);
        break;
      case 'beak':
        g.fillStyle = nc === INK ? '#ff9f1c' : nc;
        g.beginPath(); g.moveTo(-0.13 * r, 0.06 * r); g.lineTo(0.13 * r, 0.06 * r); g.lineTo(0, 0.3 * r); g.closePath(); g.fill();
        break;
      case 'hook':
        // Flamingo gagası: aşağı kıvrık, ucu koyu
        g.fillStyle = '#fff3e0';
        g.beginPath(); g.moveTo(-0.1 * r, 0.06 * r); g.quadraticCurveTo(0.34 * r, 0.02 * r, 0.3 * r, 0.36 * r);
        g.quadraticCurveTo(0.16 * r, 0.2 * r, -0.04 * r, 0.2 * r); g.closePath(); g.fill();
        g.fillStyle = INK;
        g.beginPath(); g.moveTo(0.2 * r, 0.22 * r); g.quadraticCurveTo(0.33 * r, 0.2 * r, 0.3 * r, 0.36 * r); g.quadraticCurveTo(0.24 * r, 0.28 * r, 0.16 * r, 0.27 * r); g.closePath(); g.fill();
        break;
      case 'tube':
        // Denizatı: halkanın dışına uzanan ince burun borusu
        g.strokeStyle = hexA(color, 0.95); g.lineWidth = 0.16 * r; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0.2 * r, 0.12 * r); g.lineTo(0.95 * r, 0.3 * r); g.stroke();
        break;
      case 'duck':
        ellipse(g, 0, 0.24 * r, 0.3 * r, 0.12 * r, 0, nc === INK ? '#ff9f1c' : nc);
        line(g, [[-0.22 * r, 0.24 * r], [0.22 * r, 0.24 * r]], Math.max(1.2, r * 0.018), 'rgba(140,70,0,.6)');
        break;
      case 'trunk': {
        // Fil hortumu halkanın dışına uzanır ve hafifçe sallanır
        const sw = Math.sin(now / 900) * 0.08;
        g.strokeStyle = hexA(color, 0.95);
        g.lineWidth = 0.2 * r; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0.1 * r);
        g.bezierCurveTo(0, 0.6 * r, (0.05 + sw) * r, 0.95 * r, (0.3 + sw) * r, 1.15 * r);
        g.stroke();
        break;
      }
      default: break;
    }
    // Ağız
    const my = L.mouth === 'grill' ? 0.38 : 0.3;
    switch (L.mouth || 'w') {
      case 'w': smallMouth(g, r, L.nose === 'snout' ? 0.33 : 0.24); break;
      case 'smile':
        g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = 'round';
        g.beginPath(); g.arc(0, 0.16 * r, 0.2 * r, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
        break;
      case 'open':
        ellipse(g, 0, my * r, 0.12 * r, 0.09 * r, 0, INK);
        ellipse(g, 0, (my + 0.04) * r, 0.07 * r, 0.04 * r, 0, PINK);
        break;
      case 'tongue':
        smallMouth(g, r, 0.33);
        ellipse(g, 0.02 * r, 0.44 * r, 0.07 * r, 0.1 * r, 0.1, PINK);
        break;
      case 'fangs':
        g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-0.2 * r, 0.3 * r); g.lineTo(0.2 * r, 0.3 * r); g.stroke();
        g.fillStyle = '#fff';
        for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 0.14 * r, 0.3 * r); g.lineTo(sx * 0.06 * r, 0.3 * r); g.lineTo(sx * 0.1 * r, 0.42 * r); g.closePath(); g.fill(); }
        break;
      case 'buckteeth':
        smallMouth(g, r, 0.24);
        g.fillStyle = '#fff'; g.strokeStyle = 'rgba(36,32,58,.5)'; g.lineWidth = Math.max(1, r * 0.015);
        for (const sx of [-1, 1]) { g.beginPath(); g.rect(sx === -1 ? -0.1 * r : 0.005 * r, 0.27 * r, 0.095 * r, 0.14 * r); g.fill(); g.stroke(); }
        break;
      case 'howl':
        // Uluyan ağız: yukarı açılmış yuvarlak
        ellipse(g, 0, 0.33 * r, 0.11 * r, 0.14 * r, 0, INK);
        ellipse(g, 0, 0.38 * r, 0.06 * r, 0.05 * r, 0, PINK);
        break;
      case 'grill':
        g.fillStyle = '#1d2238';
        g.fillRect(-0.24 * r, my * r - 0.06 * r, 0.48 * r, 0.12 * r);
        for (let k = -2; k <= 2; k++) g.fillRect(k * 0.09 * r - 0.01 * r, my * r - 0.06 * r, 0.02 * r, 0.12 * r);
        break;
      default: break;
    }
    if (ex.has('whiskers')) {
      const wc = 'rgba(255,255,255,.75)', ww = Math.max(1.4, r * 0.022);
      for (const sx of [-1, 1]) {
        line(g, [[sx * 0.24 * r, 0.14 * r], [sx * 0.62 * r, 0.06 * r]], ww, wc);
        line(g, [[sx * 0.24 * r, 0.2 * r], [sx * 0.64 * r, 0.22 * r]], ww, wc);
      }
    }
    if (ex.has('cheeks') || !L.extras) cheeks(g, r, 0.22, 0.52);
  }

  // ---- Eşya süsleri ----
  // Her biri halkanın merkezinde, halka yarıçapına göre çizilir. dx/dy/s: konum ve boyut (r cinsinden).
  function roundBox(g, x, y, w, h, rad) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h);
  }
  const OBJECTS = {
    // Tekerlek: lastik, jant telleri ve göbek; yavaşça döner
    wheel(g, r, now) {
      circle(g, 0, 0, r - 7, 'rgba(29, 34, 56, .85)');
      circle(g, 0, 0, r * 0.62, 'rgba(195, 202, 218, .9)');
      g.save(); g.rotate(now / 1400);
      for (let k = 0; k < 6; k++) { g.rotate(TAU / 6); line(g, [[0, 0], [r * 0.58, 0]], Math.max(1.6, r * 0.06), '#5d6488'); }
      g.restore();
      circle(g, 0, 0, r * 0.18, '#5d6488');
    },
    // Pencere: dört bölmeli, perdesi tatlı bir sarı ışık
    window(g, r, now, color, d) {
      const s = (d.s || 0.5) * r, x = (d.dx || 0) * r - s / 2, y = (d.dy || 0) * r - s / 2;
      g.fillStyle = '#ffe9a8'; roundBox(g, x, y, s, s, s * 0.12); g.fill();
      g.strokeStyle = 'rgba(60, 40, 20, .75)'; g.lineWidth = Math.max(2, s * 0.08); g.stroke();
      line(g, [[x + s / 2, y], [x + s / 2, y + s]], Math.max(1.5, s * 0.06), 'rgba(60,40,20,.7)');
      line(g, [[x, y + s / 2], [x + s, y + s / 2]], Math.max(1.5, s * 0.06), 'rgba(60,40,20,.7)');
    },
    // Saat kadranı: gerçek saati gösteren akrep ve yelkovan
    clock(g, r) {
      circle(g, 0, 0, r - 7, '#fff8e6');
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * TAU;
        line(g, [[Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66], [Math.cos(a) * r * (k % 3 ? 0.74 : 0.78), Math.sin(a) * r * (k % 3 ? 0.74 : 0.78)]], k % 3 ? 2 : 3.5, INK);
      }
      const t = new Date();
      const h = (t.getHours() % 12 + t.getMinutes() / 60) / 12 * TAU - Math.PI / 2;
      const m = (t.getMinutes() + t.getSeconds() / 60) / 60 * TAU - Math.PI / 2;
      line(g, [[0, 0], [Math.cos(h) * r * 0.38, Math.sin(h) * r * 0.38]], Math.max(3, r * 0.06), INK);
      line(g, [[0, 0], [Math.cos(m) * r * 0.58, Math.sin(m) * r * 0.58]], Math.max(2, r * 0.04), INK);
      circle(g, 0, 0, r * 0.06, '#ff6b6b');
    },
    // Baca dumanı: halkanın üstünden yükselen puflar
    smoke(g, r, now, color, d) {
      for (let k = 0; k < 3; k++) {
        const t = ((now / 1800) + k / 3) % 1;
        circle(g, (d.dx || 0) * r + Math.sin(t * 5 + k) * r * 0.12, (d.dy ?? -0.9) * r - t * r * 0.9, r * (0.16 + t * 0.22), `rgba(220, 226, 240, ${0.55 * (1 - t)})`);
      }
    },
    // Füze alevi: titreyen turuncu-sarı dil
    flame(g, r, now, color, d) {
      const y = (d.dy ?? 0.8) * r, fl = 1 + Math.sin(now / 70) * 0.12;
      g.fillStyle = '#ff9f1c';
      g.beginPath(); g.moveTo(-0.3 * r, y); g.quadraticCurveTo(0, y + 0.95 * r * fl, 0.3 * r, y); g.closePath(); g.fill();
      g.fillStyle = '#ffe066';
      g.beginPath(); g.moveTo(-0.15 * r, y); g.quadraticCurveTo(0, y + 0.55 * r * fl, 0.15 * r, y); g.closePath(); g.fill();
    },
    // Lomboz: kalın çerçeveli yuvarlak cam
    porthole(g, r, now, color, d) {
      const x = (d.dx || 0) * r, y = (d.dy || 0) * r, s = (d.s || 0.4) * r;
      circle(g, x, y, s, '#c3cada');
      circle(g, x, y, s * 0.74, '#7cc4ff');
      ellipse(g, x - s * 0.25, y - s * 0.25, s * 0.22, s * 0.12, -0.6, 'rgba(255,255,255,.7)');
    },
    // Gezegen: halkanın içinde bantlı bir küre ve krater
    planet(g, r) {
      g.save();
      g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.clip();
      circle(g, 0, 0, r, '#f4a261');
      for (const [y, c] of [[-0.45, '#e76f51'], [-0.05, '#f6c28b'], [0.35, '#e76f51']]) {
        g.fillStyle = c; g.fillRect(-r, y * r, 2 * r, 0.18 * r);
      }
      circle(g, 0.3 * r, 0.55 * r, 0.1 * r, 'rgba(120, 50, 30, .4)');
      g.restore();
    },
    // Ev: çatı, kapı ve pencere (halkanın içi bir ev resmi)
    house(g, r) {
      g.fillStyle = '#ffe0b5';
      g.fillRect(-0.48 * r, -0.12 * r, 0.96 * r, 0.62 * r);
      g.fillStyle = '#e76f51';
      g.beginPath(); g.moveTo(-0.62 * r, -0.1 * r); g.lineTo(0, -0.62 * r); g.lineTo(0.62 * r, -0.1 * r); g.closePath(); g.fill();
      g.fillStyle = '#8a5a3c'; roundBox(g, -0.14 * r, 0.12 * r, 0.28 * r, 0.38 * r, 0.12 * r); g.fill();
      OBJECTS.window(g, r, 0, null, { dx: 0.3, dy: 0.08, s: 0.22 });
    },
    // Tahta sandık (kamyon kasası) ya da hazine sandığı (gold: true)
    crate(g, r, now, color, d) {
      const w = 1.1 * r, h = 0.8 * r;
      g.fillStyle = d.gold ? '#a0632e' : '#c08552';
      roundBox(g, -w / 2, -h / 2, w, h, 0.08 * r); g.fill();
      g.strokeStyle = 'rgba(60, 35, 15, .7)'; g.lineWidth = Math.max(2, r * 0.04); g.stroke();
      if (d.gold) {
        g.fillStyle = '#ffc94a';
        g.fillRect(-w / 2, -0.08 * r, w, 0.12 * r);
        roundBox(g, -0.1 * r, -0.14 * r, 0.2 * r, 0.24 * r, 0.04 * r); g.fill();
        circle(g, 0, -0.04 * r, 0.035 * r, '#5a3a06');
        // Kapağın arasından taşan altın pırıltısı
        const tw = 0.5 + 0.5 * Math.sin(now / 300);
        circle(g, 0.3 * r, -0.42 * r, 0.06 * r * (0.6 + tw), `rgba(255, 236, 160, ${0.6 + 0.4 * tw})`);
      } else {
        line(g, [[-w / 2, -h / 2], [w / 2, h / 2]], Math.max(2, r * 0.04), 'rgba(60,35,15,.6)');
        line(g, [[-w / 2, h / 2], [w / 2, -h / 2]], Math.max(2, r * 0.04), 'rgba(60,35,15,.6)');
      }
    },
    // Kaplumbağa kabuğu: altıgen desen
    shell(g, r, now, color) {
      fillFace(g, r, color, 0.45);
      const hex = (x, y, s) => {
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * s, y + Math.sin(a) * s); }
        g.closePath(); g.stroke();
      };
      g.strokeStyle = 'rgba(40, 70, 30, .55)'; g.lineWidth = Math.max(2, r * 0.035);
      hex(0, 0, 0.28 * r);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + TAU / 12; hex(Math.cos(a) * 0.5 * r, Math.sin(a) * 0.5 * r, 0.2 * r); }
    },
    // Salyangoz kabuğu: sarmal
    spiral(g, r, now, color) {
      fillFace(g, r, color, 0.4);
      g.strokeStyle = 'rgba(90, 50, 20, .6)'; g.lineWidth = Math.max(2.5, r * 0.06); g.lineCap = 'round';
      g.beginPath();
      for (let t = 0; t <= 3.2 * TAU; t += 0.15) {
        const rr = 0.05 * r + t / (3.2 * TAU) * 0.62 * r;
        g[t ? 'lineTo' : 'moveTo'](Math.cos(t) * rr, Math.sin(t) * rr);
      }
      g.stroke();
    },
    // Kirpi dikenleri: halkanın üst yarısında dışa dönük
    spikes(g, r) {
      g.fillStyle = '#6d4c3d';
      for (let k = 0; k <= 9; k++) {
        const a = Math.PI + k / 9 * Math.PI;
        const c = Math.cos(a), s = Math.sin(a);
        g.beginPath();
        g.moveTo(c * r * 0.92 - s * 0.1 * r, s * r * 0.92 + c * 0.1 * r);
        g.lineTo(c * r * 1.32, s * r * 1.32);
        g.lineTo(c * r * 0.92 + s * 0.1 * r, s * r * 0.92 - c * 0.1 * r);
        g.closePath(); g.fill();
      }
    },
    // Dişli: halkanın içinde dönen dişli çark
    gear(g, r, now, color, d) {
      g.save();
      g.rotate((d.dir || 1) * now / 2200);
      const R = r * 0.62, teeth = 10;
      g.fillStyle = 'rgba(195, 202, 218, .92)';
      g.beginPath();
      for (let k = 0; k < teeth * 2; k++) {
        const a0 = k / (teeth * 2) * TAU, a1 = (k + 1) / (teeth * 2) * TAU;
        g.arc(0, 0, k % 2 ? R * 0.82 : R, a0, a1);
      }
      g.closePath(); g.fill();
      circle(g, 0, 0, R * 0.32, '#5d6488');
      g.restore();
    },
    // Far: arabanın önünde parlayan ışık
    headlight(g, r, now, color, d) {
      const x = (d.dx ?? 0.55) * r, y = (d.dy || 0) * r;
      circle(g, x, y, r * 0.16, '#fff3b0');
      const grd = g.createRadialGradient(x, y, 0, x + r * 0.4, y, r * 0.7);
      grd.addColorStop(0, 'rgba(255, 243, 176, .55)'); grd.addColorStop(1, 'rgba(255, 243, 176, 0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x + r * 0.4, y, r * 0.7, 0, TAU); g.fill();
    },
    // Araba kapısı: kapı çizgisi ve kolu
    door(g, r) {
      g.strokeStyle = 'rgba(40, 20, 30, .55)'; g.lineWidth = Math.max(2, r * 0.035);
      roundBox(g, -0.42 * r, -0.28 * r, 0.62 * r, 0.6 * r, 0.1 * r); g.stroke();
      line(g, [[-0.6 * r, 0.06 * r], [0.6 * r, 0.06 * r]], Math.max(2, r * 0.03), 'rgba(255,255,255,.35)');
      roundBox(g, 0.04 * r, -0.02 * r, 0.12 * r, 0.05 * r, 0.025 * r); g.fillStyle = 'rgba(40, 20, 30, .7)'; g.fill();
    },
    // Yıldız parıltısı (uzay şekilleri için)
    sparkle(g, r, now, color, d) {
      const x = (d.dx || 0) * r, y = (d.dy || 0) * r, s = (0.12 + 0.05 * Math.sin(now / 250)) * r;
      g.fillStyle = '#fff6c4';
      g.beginPath();
      g.moveTo(x, y - s); g.lineTo(x + s * 0.25, y - s * 0.25); g.lineTo(x + s, y); g.lineTo(x + s * 0.25, y + s * 0.25);
      g.lineTo(x, y + s); g.lineTo(x - s * 0.25, y + s * 0.25); g.lineTo(x - s, y); g.lineTo(x - s * 0.25, y - s * 0.25);
      g.closePath(); g.fill();
    },
    // Kanat zarı (yarasa, arı): halkanın içi yarı saydam
    // ---- 2.4: yeni şekillerin süsleri ----
    // Fokun burnundaki top: renkli dilimli, yavaşça döner
    ball(g, r, now) {
      g.save(); g.rotate(now / 1400);
      const cols = ['#ff6b6b', '#fff', '#4cc9f0', '#fff', '#ffc94a', '#fff'];
      for (let k = 0; k < 6; k++) { g.fillStyle = cols[k]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r - 7, k * TAU / 6, (k + 1) * TAU / 6); g.closePath(); g.fill(); }
      g.restore();
    },
    // Atlıkarınca çadır tepesi: dilimli şerit ve tepede bayrak
    canopy(g, r, now, color) {
      fillFace(g, r, color, 0.3);
      g.save(); g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.clip();
      for (let k = 0; k < 8; k += 2) { g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(0, -r); g.lineTo((k - 4) * 0.25 * r, r); g.lineTo((k - 3) * 0.25 * r, r); g.closePath(); g.fill(); }
      g.restore();
      const wv = Math.sin(now / 300) * 0.06 * r;
      line(g, [[0, -0.2 * r], [0, -0.75 * r]], Math.max(2, r * 0.03), INK);
      g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(0, -0.75 * r); g.lineTo(0.3 * r, -0.66 * r + wv); g.lineTo(0, -0.56 * r); g.closePath(); g.fill();
    },
    // Ateş böceğinin karnı: nabız gibi parlayan ışık
    glow(g, r, now) {
      const p = 0.8 + 0.2 * Math.sin(now / 420);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r - 7);
      gr.addColorStop(0, `rgba(255,250,200,${0.95 * p})`); gr.addColorStop(1, `rgba(255,224,102,${0.25 * p})`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.fill();
    },
    // Ampul teli: iki tel ve titreyen kıvrımlı filaman
    filament(g, r, now) {
      fillFace(g, r, '#fff3b0', 0.62);
      const fl = 0.8 + 0.2 * Math.sin(now / 90);
      line(g, [[-0.2 * r, 0.7 * r], [-0.2 * r, 0.05 * r]], Math.max(1.5, r * 0.025), 'rgba(36,32,58,.6)');
      line(g, [[0.2 * r, 0.7 * r], [0.2 * r, 0.05 * r]], Math.max(1.5, r * 0.025), 'rgba(36,32,58,.6)');
      g.save(); g.shadowColor = '#ffb347'; g.shadowBlur = 14 * fl;
      g.strokeStyle = `rgba(255,170,60,${fl})`; g.lineWidth = Math.max(2, r * 0.04); g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-0.2 * r, 0.05 * r);
      for (let k = 0; k <= 8; k++) g.lineTo(-0.2 * r + k * 0.05 * r, 0.05 * r + (k % 2 ? -0.1 : 0) * r);
      g.stroke(); g.restore();
    },
    // Yılan balığının şimşeği
    bolt(g, r, now) {
      const f = 0.7 + 0.3 * Math.abs(Math.sin(now / 160));
      g.fillStyle = `rgba(255,236,120,${f})`;
      g.beginPath();
      g.moveTo(0.1 * r, -0.6 * r); g.lineTo(-0.32 * r, 0.08 * r); g.lineTo(-0.02 * r, 0.08 * r);
      g.lineTo(-0.14 * r, 0.6 * r); g.lineTo(0.32 * r, -0.12 * r); g.lineTo(0.02 * r, -0.12 * r);
      g.closePath(); g.fill();
    },
    // Kunduz kuyruğu: çapraz çizgili yassı kuyruk
    tailx(g, r, now, color) {
      fillFace(g, r, '#5a3d2b', 0.6);
      g.save(); g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = Math.max(1.2, r * 0.04);
      for (let k = -4; k <= 4; k++) { line(g, [[k * 0.25 * r - r, -r], [k * 0.25 * r + r, r]], g.lineWidth, g.strokeStyle); line(g, [[k * 0.25 * r + r, -r], [k * 0.25 * r - r, r]], g.lineWidth, g.strokeStyle); }
      g.restore();
    },
    // Yengeç kıskacı: halkanın içinde açılıp kapanan iki çene
    pincer(g, r, now, color, d) {
      const open = 0.25 + 0.15 * Math.sin(now / 500), s = d.side || 1;
      g.fillStyle = 'rgba(255,240,235,.7)';
      for (const k of [-1, 1]) {
        g.beginPath(); g.moveTo(-s * 0.3 * r, 0);
        g.quadraticCurveTo(s * 0.2 * r, k * (open + 0.25) * r, s * 0.5 * r, k * open * 0.4 * r);
        g.quadraticCurveTo(s * 0.1 * r, k * 0.1 * r, -s * 0.3 * r, 0);
        g.fill();
      }
    },
    // Fener lambası: dönen ışık huzmesi ve sıcak parıltı
    lamp(g, r, now) {
      const a = now / 1200;
      g.save();
      g.fillStyle = 'rgba(255,226,160,.35)';
      for (const s of [0, Math.PI]) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 2.2, a + s - 0.2, a + s + 0.2); g.closePath(); g.fill(); }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r - 7);
      gr.addColorStop(0, 'rgba(255,250,215,1)'); gr.addColorStop(1, 'rgba(255,210,122,.4)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.fill();
      g.restore();
    },
    // Balinanın fıskiyesi: halkanın üstünden yükselen su damlaları
    spout(g, r, now) {
      for (let k = 0; k < 5; k++) {
        const t = ((now / 900) + k / 5) % 1, x = Math.sin(k * 2.1) * 0.5 * r * t, y = -t * 1.4 * r;
        circle(g, x, y, (0.16 - 0.1 * t) * r, `rgba(160,220,255,${1 - t})`);
      }
      fillFace(g, r, '#cfefff', 0.35);
    },
    // Teleskop merceği: cam ve parıltı çizgisi
    lens(g, r, now) {
      const gr = g.createRadialGradient(-0.2 * r, -0.2 * r, 1, 0, 0, r - 7);
      gr.addColorStop(0, 'rgba(220,240,255,.9)'); gr.addColorStop(1, 'rgba(90,120,220,.5)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.fill();
      const sh = ((now / 2600) % 1) * 2 - 0.5;
      line(g, [[(sh - 0.3) * r, -0.5 * r], [(sh + 0.1) * r, 0.5 * r]], Math.max(2, r * 0.08), 'rgba(255,255,255,.5)');
    },
    // Ay: hilal
    moon(g, r) {
      g.save(); g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.clip();
      circle(g, 0, 0, r - 7, '#fff3b0');
      circle(g, 0.38 * r, -0.2 * r, r - 7, 'rgba(36,32,58,.85)');
      g.restore();
      circle(g, -0.3 * r, 0.15 * r, 0.08 * r, 'rgba(200,180,110,.6)');
    },
    // Gözlemevi kubbesi: yarım küre, ortasında açılan yarık ve görünen yıldız
    dome(g, r, now, color) {
      fillFace(g, r, color, 0.35);
      g.fillStyle = 'rgba(36,32,58,.85)';
      roundBox(g, -0.12 * r, -0.75 * r, 0.24 * r, 0.9 * r, 0.1 * r); g.fill();
      const tw = 0.6 + 0.4 * Math.sin(now / 500);
      circle(g, 0, -0.45 * r, 0.05 * r * (1 + tw), `rgba(255,255,255,${tw})`);
      for (let k = -3; k <= 3; k++) line(g, [[k * 0.22 * r, 0.25 * r], [k * 0.22 * r, 0.7 * r]], Math.max(1, r * 0.02), 'rgba(255,255,255,.25)');
    },
    wing(g, r, now, color, d) {
      fillFace(g, r, d.light ? '#e8f4ff' : color, d.light ? 0.5 : 0.45);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1.4, r * 0.03);
      for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a + (d.side || 1) * Math.PI / 2) * r * 0.7, Math.sin(a + (d.side || 1) * Math.PI / 2) * r * 0.7); g.stroke(); }
    },
  };

  function draw(g, d, r, now, color) {
    if (d.type === 'face' && d.look) { drawLook(g, r, now, color, d.look); return; }
    if (OBJECTS[d.type]) { OBJECTS[d.type](g, r, now, color, d); return; }
    if (d.type === 'face' && FACES[d.kind]) {
      FACES[d.kind](g, r, now, color);
    } else if (d.type === 'pupil') {
      circle(g, 0, 0, r - 7, '#fff8e6');
      const look = Math.sin(now / 1300) * 0.12 * r;
      g.save();
      g.translate(look, 0.05 * r);
      g.scale(1, blink(now));
      circle(g, 0, 0, 0.42 * r, INK);
      circle(g, -0.14 * r, -0.15 * r, 0.13 * r, '#fff');
      g.restore();
    } else if (d.type === 'beak') {
      const y = (d.dy || 0) * r;
      g.fillStyle = '#ff9f1c';
      g.strokeStyle = '#b8620a';
      g.lineWidth = Math.max(1.5, r * 0.02);
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(-0.15 * r, y); g.lineTo(0.15 * r, y); g.lineTo(0, y + 0.26 * r);
      g.closePath(); g.fill(); g.stroke();
    } else if (d.type === 'fill') {
      fillFace(g, r, color, 0.32);
    } else if (d.type === 'belly') {
      ellipse(g, 0, 0.06 * r, 0.6 * r, 0.72 * r, 0, 'rgba(238,240,255,.92)');
    }
  }

  // Tanınan süs türleri (bölüm denetimi için)
  const TYPES = ['face', 'pupil', 'beak', 'fill', 'belly', ...Object.keys(OBJECTS)];
  root.Deco = { draw, TYPES, FACES: Object.keys(FACES) };
})(this);
