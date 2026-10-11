// Halka içi süsler: hayvan yüzleri, göz bebekleri, gaga, karın.
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

  function draw(g, d, r, now, color) {
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

  root.Deco = { draw };
})(this);
