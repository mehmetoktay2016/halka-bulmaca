// Seviyeler: ilk bölümler elle tasarlandı, sonrası tohumlu (seed) üreticiyle
// oluşturulur ve çözücüden geçmeyen seviye asla oyuncuya gösterilmez.
// Tahta boyutu: 400 x 560. Açılar derece; a = boşluğun başlangıç yönü.
(function (root) {
  'use strict';

  const Logic = root.RingLogic || (typeof require !== 'undefined' ? require('./logic.js') : null);

  const BOARD = { w: 400, h: 560 };

  const HAND_LEVELS = [
    { // 1: iki halka
      rings: [
        { x: 145, y: 280, r: 75, a: 180 },
        { x: 255, y: 280, r: 75, a: 0 },
      ],
    },
    { // 2: zincir
      rings: [
        { x: 105, y: 280, r: 62, a: 90 },
        { x: 200, y: 280, r: 62, a: 270 },
        { x: 295, y: 280, r: 62, a: 90 },
      ],
    },
    { // 3: üçgen
      rings: [
        { x: 200, y: 235, r: 72, a: 270 },
        { x: 247.6, y: 317.5, r: 72, a: 30 },
        { x: 152.4, y: 317.5, r: 72, a: 150 },
      ],
    },
    { // 4: kare döngü
      rings: [
        { x: 150, y: 230, r: 65, a: 225 },
        { x: 250, y: 230, r: 65, a: 315 },
        { x: 250, y: 330, r: 65, a: 45 },
        { x: 150, y: 330, r: 65, a: 135 },
      ],
    },
    { // 5: kilitli halka tanıtımı
      rings: [
        { x: 200, y: 175, r: 66, a: 270 },
        { x: 200, y: 280, r: 66, a: 0, fixed: true },
        { x: 200, y: 385, r: 66, a: 90 },
      ],
    },
    { // 6: kilitli merkez
      rings: [
        { x: 200, y: 280, r: 70, a: 0, fixed: true },
        { x: 200, y: 175, r: 62, a: 270 },
        { x: 305, y: 280, r: 62, a: 0 },
        { x: 200, y: 385, r: 62, a: 90 },
        { x: 95, y: 280, r: 62, a: 180 },
      ],
    },
    { // 7: birlikte dönen halkalar tanıtımı
      rings: [
        { x: 115, y: 230, r: 60, a: 180 },
        { x: 205, y: 230, r: 66, a: 270 },
        { x: 295, y: 230, r: 60, a: 0 },
        { x: 205, y: 330, r: 62, a: 90 },
      ],
      couples: [[0, 2]],
    },
    { // 8: çift boşluklu halka
      rings: [
        { x: 200, y: 280, r: 72, a: 90, gaps: [0, 180] },
        { x: 200, y: 172, r: 62, a: 270 },
        { x: 293.5, y: 334, r: 62, a: 30 },
        { x: 106.5, y: 334, r: 62, a: 150 },
      ],
      couples: [[1, 2]],
    },
    { // 9: düz çubuk tanıtımı
      rings: [
        { x: 120, y: 280, r: 62, a: 270 },
        { x: 280, y: 280, r: 62, a: 90 },
        { type: 'bar', x1: 30, y1: 280, x2: 370, y2: 280 },
      ],
    },
    { // 10: çubuk + zincir
      rings: [
        { x: 150, y: 220, r: 65, a: 0 },
        { x: 252, y: 220, r: 65, a: 0 },
        { x: 150, y: 385, r: 62, a: 0 },
        { type: 'bar', x1: 150, y1: 125, x2: 150, y2: 475 },
      ],
    },
  ];

  // Parçanın kapladığı alan (halka ya da çubuk)
  function extent(p) {
    if (p.type === 'bar') {
      return { x0: Math.min(p.x1, p.x2), x1: Math.max(p.x1, p.x2), y0: Math.min(p.y1, p.y2), y1: Math.max(p.y1, p.y2) };
    }
    return { x0: p.x - p.r, x1: p.x + p.r, y0: p.y - p.r, y1: p.y + p.r };
  }
  function bounds(pieces) {
    const e = pieces.map(extent);
    return {
      x0: Math.min(...e.map(b => b.x0)), x1: Math.max(...e.map(b => b.x1)),
      y0: Math.min(...e.map(b => b.y0)), y1: Math.max(...e.map(b => b.y1)),
    };
  }
  function movePiece(p, dx, dy, k = 1) {
    if (p.type === 'bar') {
      return { ...p, x1: p.x1 * k + dx, y1: p.y1 * k + dy, x2: p.x2 * k + dx, y2: p.y2 * k + dy };
    }
    return { ...p, x: p.x * k + dx, y: p.y * k + dy, r: p.r * k };
  }

  function segDist(px, py, b) {
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
  }
  function lineDist(px, py, b) {
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    return Math.abs((px - b.x1) * dy - (py - b.y1) * dx) / Math.hypot(dx, dy);
  }

  // Çubuk bir halkayla ya net kesişmeli (iki noktada, uçları dışarıda) ya da ondan uzak durmalı.
  // Dönüş: 'cross' | 'miss' | 'bad'
  function barVsRing(b, c) {
    if (segDist(c.x, c.y, b) > c.r + 14) return 'miss';
    const ends = [Math.hypot(b.x1 - c.x, b.y1 - c.y), Math.hypot(b.x2 - c.x, b.y2 - c.y)];
    if (lineDist(c.x, c.y, b) < c.r - 22 && ends.every(e => e > c.r + 16)) return 'cross';
    return 'bad';
  }

  function placeBars(rnd, rings, count) {
    const bars = [];
    // halka-halka kesişim noktaları: çubuk bunların üstünden geçmesin
    const ringPts = [];
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const pts = Logic.circleIntersections(rings[i], rings[j]);
        if (pts) ringPts.push(...pts);
      }
    }
    for (let tries = 0; bars.length < count && tries < 300; tries++) {
      const base = rings[Math.floor(rnd() * rings.length)];
      const ang = rnd() * Math.PI;
      const off = (rnd() - 0.5) * base.r * 0.7;
      const len = 210 + rnd() * 130;
      const cx = base.x - Math.sin(ang) * off, cy = base.y + Math.cos(ang) * off;
      const b = {
        type: 'bar',
        x1: Math.round((cx - Math.cos(ang) * len / 2) * 10) / 10, y1: Math.round((cy - Math.sin(ang) * len / 2) * 10) / 10,
        x2: Math.round((cx + Math.cos(ang) * len / 2) * 10) / 10, y2: Math.round((cy + Math.sin(ang) * len / 2) * 10) / 10,
      };
      const e = extent(b);
      if (e.x0 < 14 || e.x1 > BOARD.w - 14 || e.y0 < 14 || e.y1 > BOARD.h - 14) continue;
      const rel = rings.map(c => barVsRing(b, c));
      if (rel.includes('bad') || !rel.includes('cross')) continue;
      if (ringPts.some(p => segDist(p.x, p.y, b) < 18)) continue;
      if (bars.some(o => segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, b) < 50 ||
                         segDist(o.x1, o.y1, b) < 24 || segDist(o.x2, o.y2, b) < 24)) continue;
      bars.push(b);
    }
    return bars.length === count ? bars : null;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bölüm numarasına göre zorluk ayarları
  // Oyuncunun hamle hakkı en fazla 10 (game.js); en iyi çözüm en fazla 8 olur ki
  // en zor seviyede bile 2 hamlelik hata payı kalsın.
  const MAX_PAR = 8;
  function difficulty(levelNo) {
    const k = levelNo - HAND_LEVELS.length; // 1, 2, 3...
    return {
      count: Math.min(4 + Math.floor(k / 4), 8),
      fixed: k < 3 ? 0 : (k % 3 === 0 ? 1 : 0) + (k > 20 ? 1 : 0),
      couples: k < 2 ? 0 : Math.min(1 + Math.floor(k / 8), 3),
      doubleGap: k > 6 ? 0.2 : 0,
      bars: k < 2 ? 0 : (k % 2 === 0 ? 1 : 0) + (k > 24 && k % 3 === 0 ? 1 : 0),
      minPar: Math.min(3 + Math.floor(k / 6), 7),
    };
  }

  function placeRings(rnd, count) {
    const rand = (a, b) => a + rnd() * (b - a);
    const rings = [{ x: 200, y: 280, r: rand(58, 72) }];
    let tries = 0;
    while (rings.length < count && tries++ < 400) {
      const parent = rings[Math.floor(rnd() * rings.length)];
      const r = rand(52, 70);
      const d = rand(72, parent.r + r - 30);
      const ang = rnd() * Math.PI * 2;
      const c = { x: parent.x + Math.cos(ang) * d, y: parent.y + Math.sin(ang) * d, r };
      if (c.x - r < 12 || c.x + r > BOARD.w - 12 || c.y - r < 12 || c.y + r > BOARD.h - 12) continue;
      let ok = true;
      for (const o of rings) {
        const dd = Math.hypot(o.x - c.x, o.y - c.y);
        const crosses = dd < o.r + c.r;
        // kesişen halkalar net görünmeli, kesişmeyenler arasında boşluk kalmalı
        if (dd < 70) ok = false;
        else if (crosses && dd > o.r + c.r - 26) ok = false;
        else if (!crosses && dd < o.r + c.r + 10) ok = false;
        if (!ok) break;
      }
      if (ok) rings.push(c);
    }
    return rings.length === count ? rings : null;
  }

  function connected(L) {
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const i = stack.pop();
      for (const li of L.ringLinks[i]) {
        const k = L.links[li];
        const o = k.a === i ? k.b : k.a;
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    return seen.size === L.rings.length;
  }

  // Başlangıçta hiçbir halka kendiliğinden düşmemeli
  function noRingFreeAtStart(L) {
    return Logic.cascade(L, L.startAngles, 0).mask === 0;
  }

  function generate(levelNo) {
    const base = difficulty(levelNo);
    for (let relax = 0; relax <= 4; relax++) {
      const def = generateWith(levelNo, { ...base, minPar: Math.max(3, base.minPar - relax) }, relax);
      if (def) return def;
    }
    return null;
  }

  function generateWith(levelNo, p, relax) {
    const exactCap = p.count >= 9 ? 60000 : 150000;
    for (let attempt = 0; attempt < (relax ? 80 : 150); attempt++) {
      const rnd = mulberry32(levelNo * 7919 + attempt * 104729 + relax * 15485863);
      const pos = placeRings(rnd, p.count);
      if (!pos) continue;
      const order = pos.map((_, i) => i).sort(() => rnd() - 0.5);
      const fixedSet = new Set(order.slice(0, p.fixed));
      const movable = order.filter(i => !fixedSet.has(i));
      const couples = [];
      for (let c = 0; c < p.couples && movable.length >= 2 * (c + 1); c++) {
        couples.push([movable[2 * c], movable[2 * c + 1]]);
      }
      const bars = p.bars ? placeBars(rnd, pos, p.bars) : [];
      if (!bars) continue;
      const def = {
        rings: pos.map((c, i) => ({
          x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, r: Math.round(c.r),
          a: Math.round(rnd() * 360),
          fixed: fixedSet.has(i) || undefined,
          gaps: !fixedSet.has(i) && rnd() < p.doubleGap ? [0, 180] : undefined,
        })).concat(bars),
        couples,
      };
      let L = Logic.buildLevel(def);
      if (!connected(L)) continue;
      for (let re = 0; re < 20 && !noRingFreeAtStart(L); re++) {
        for (const r of def.rings) if (r.type !== 'bar') r.a = Math.round(rnd() * 360);
        L = Logic.buildLevel(def);
      }
      if (!noRingFreeAtStart(L)) continue;
      // Hızlı çözücü üst sınır verir: o bile çok kısaysa seviye fazla kolaydır
      const quick = Logic.solveFast(L, L.startAngles, 0, 20000);
      if (!quick || quick.moves < p.minPar) continue;
      const exact = Logic.solve(L, L.startAngles, 0, exactCap);
      if (exact && exact.moves < p.minPar) continue;
      def.par = exact ? exact.moves : quick.moves;
      if (def.par > MAX_PAR) continue;
      return def;
    }
    return null;
  }

  // Halkaları bütün olarak tahtanın ortasına kaydırır (kural değişmez, sadece görünüm)
  function centered(def) {
    const b = bounds(def.rings);
    const dx = BOARD.w / 2 - (b.x0 + b.x1) / 2;
    const dy = BOARD.h / 2 - (b.y0 + b.y1) / 2;
    return { ...def, rings: def.rings.map(r => movePiece(r, dx, dy)) };
  }

  // ---- Hayvan Dostlar bölümü ----
  // Halkalar bir hayvan şekli oluşturur. Konumlar kafa merkezine göre (y aşağı doğru).
  // Boşluk açıları üreticiye bırakılır: çözülebilir ve en az minPar hamle olacak şekilde seçilir.
  // deco: halkanın içine çizilen süsler (yüz, göz bebeği, gaga, karın); halkayla birlikte uçar.
  const MAIN_LEVELS = 50;    // 10 el yapımı + 40 üretilmiş
  const ANIMAL_LEVELS = 10;
  // Şekil planı: her şekil bölümünün kaynak numarası, kapısı ve rolü.
  // final: kapının 10. bölümü (kapının zor bölümleri kadar); mid: kapının 5. bölümü (nefes molası).
  // target: üreticinin hedeflediği zorluk puanı, bars: kafes çubuğu sayısı.
  // Kaynak numaraları oyuncu kaydında kimliktir; var olan bir şeklin numarası değiştirilmez.
  const SHAPE_PLAN = {
    51: { name: 'Kedi', gate: 2, role: 'mid', target: 4.3, bars: 0 },
    52: { name: 'Ayıcık', gate: 1, role: 'final', target: 3.6, bars: 0 },
    53: { name: 'Tavşan', gate: 2, role: 'final', target: 5.8, bars: 1 },
    54: { name: 'Panda', gate: 4, role: 'mid', target: 6.4, bars: 1 },
    55: { name: 'Baykuş', gate: 3, role: 'final', target: 8.3, bars: 2 },
    56: { name: 'Kurbağa', gate: 5, role: 'mid', target: 8.3, bars: 2 },
    57: { name: 'Tırtıl', gate: 4, role: 'final', target: 9.4, bars: 2 },
    58: { name: 'Domuzcuk', gate: 3, role: 'mid', target: 4.1, bars: 0 },
    59: { name: 'Penguen', gate: 5, role: 'final', target: 9.4, bars: 2 },
    60: { name: 'Aslan', gate: 6, role: 'final', target: 10.3, bars: 3 },
  };
  const ANIMALS = [
    { name: 'Kedi',
      rings: [
        { x: 0, y: 0, r: 86, color: '#ff9f43' },
        { x: -48.2, y: -68.8, r: 34, color: '#ffbe76' },
        { x: 48.2, y: -68.8, r: 34, color: '#ffbe76' },
        { x: 0, y: 122, r: 66, color: '#f6d6a8' },
      ],
      couples: [[1, 2]],
      deco: [{ ring: 0, type: 'face', kind: 'cat' }] },
    { name: 'Ayıcık',
      rings: [
        { x: 0, y: 0, r: 84, color: '#c98b5a' },
        { x: -60.8, y: -60.8, r: 36, color: '#c08552' },
        { x: 60.8, y: -60.8, r: 36, color: '#c08552' },
        { x: 0, y: 125, r: 70, color: '#ddb07f' },
      ],
      deco: [{ ring: 0, type: 'face', kind: 'bear' }] },
    { name: 'Tavşan',
      rings: [
        { x: 0, y: 0, r: 78, color: '#eef0ff' },
        { x: -24.8, y: -86.5, r: 40, color: '#ffc8dd' },
        { x: 24.8, y: -86.5, r: 40, color: '#ffc8dd' },
        { x: 0, y: 112, r: 64, color: '#d9dcf5' },
      ],
      couples: [[1, 2]],
      deco: [{ ring: 0, type: 'face', kind: 'bunny' }] },
    { name: 'Panda',
      rings: [
        { x: 0, y: 0, r: 86, color: '#eef0ff' },
        { x: -48.2, y: -68.8, r: 34, color: '#8790c4' },
        { x: 48.2, y: -68.8, r: 34, color: '#8790c4' },
        { x: 0, y: 124, r: 70, color: '#8790c4' },
      ],
      couples: [[1, 2]],
      deco: [{ ring: 0, type: 'face', kind: 'panda' }] },
    { name: 'Baykuş',
      rings: [
        { x: -42, y: 0, r: 56, color: '#ffd166' },
        { x: 42, y: 0, r: 56, color: '#ffd166' },
        { x: 0, y: 78, r: 96, color: '#c08552' },
        { x: -100, y: 100, r: 40, color: '#b8794a' },
        { x: 100, y: 100, r: 40, color: '#b8794a' },
      ],
      couples: [[0, 1], [3, 4]],
      deco: [{ ring: 2, type: 'fill', z: -1 }, { ring: 0, type: 'pupil' }, { ring: 1, type: 'pupil' },
             { ring: 2, type: 'beak', dy: -0.42, z: 1 }] },
    { name: 'Kurbağa',
      rings: [
        { x: 0, y: 0, r: 92, color: '#7bd389' },
        { x: -45, y: -77.9, r: 36, color: '#b5ecb0' },
        { x: 45, y: -77.9, r: 36, color: '#b5ecb0' },
        { x: -82.3, y: 47.5, r: 30, color: '#55b46a' },
        { x: 82.3, y: 47.5, r: 30, color: '#55b46a' },
      ],
      couples: [[1, 2], [3, 4]],
      deco: [{ ring: 0, type: 'face', kind: 'frog' }, { ring: 1, type: 'pupil' }, { ring: 2, type: 'pupil' }] },
    { name: 'Tırtıl',
      rings: [
        { x: 140, y: 0, r: 50, color: '#90be6d' },
        { x: 84, y: 24, r: 44, color: '#b5e48c' },
        { x: 28, y: 6, r: 44, color: '#90be6d' },
        { x: -28, y: 24, r: 44, color: '#b5e48c' },
        { x: -84, y: 6, r: 44, color: '#90be6d' },
        { x: -140, y: 24, r: 44, color: '#b5e48c' },
      ],
      couples: [[1, 3], [2, 4]],
      deco: [{ ring: 0, type: 'face', kind: 'caterpillar' }] },
    { name: 'Domuzcuk',
      rings: [
        { x: 0, y: 0, r: 84, color: '#ffafcc' },
        { x: -60.9, y: -54.9, r: 32, color: '#ff8fab' },
        { x: 60.9, y: -54.9, r: 32, color: '#ff8fab' },
        { x: 0, y: 120, r: 66, color: '#ffc8dd', gaps: [0, 180] },
      ],
      couples: [[1, 2]],
      deco: [{ ring: 0, type: 'face', kind: 'pig' }] },
    { name: 'Penguen',
      rings: [
        { x: 0, y: 0, r: 60, color: '#7d8ccc' },
        { x: 0, y: 118, r: 92, color: '#7d8ccc' },
        { x: -90, y: 128, r: 36, color: '#7684d0' },
        { x: 90, y: 128, r: 36, color: '#7684d0' },
        { x: -32, y: 200, r: 24, color: '#ff9f1c' },
        { x: 32, y: 200, r: 24, color: '#ff9f1c' },
      ],
      couples: [[2, 3], [4, 5]],
      deco: [{ ring: 0, type: 'face', kind: 'penguin' }, { ring: 1, type: 'belly' }] },
    { name: 'Aslan',
      rings: [
        { x: 0, y: 0, r: 74, color: '#ffd166' },
        ...[0, 60, 120, 180, 240, 300].map((deg, k) => ({
          x: Math.round(Math.cos(deg * Math.PI / 180) * 80 * 10) / 10,
          y: Math.round(Math.sin(deg * Math.PI / 180) * 80 * 10) / 10,
          r: 34,
          color: k % 2 ? '#e76f51' : '#f4a261',
        })),
      ],
      couples: [[1, 4], [2, 5], [3, 6]],
      deco: [{ ring: 0, type: 'face', kind: 'lion' }] },
  ];

  // Zorluk puanı: en az hamle esas; parça, eş, kilit, çubuk ve çift boşluk ek yük getirir.
  function difficultyScore(def) {
    const n = t => def.rings.filter(t).length;
    return def.par + 0.15 * def.rings.length + 0.3 * (def.couples || []).length +
      0.3 * n(r => r.fixed) + 0.3 * n(r => r.type === 'bar') + 0.2 * n(r => r.gaps && r.gaps.length > 1);
  }

  // Hayvan seviyesi: boşluk açılarını (ve varsa kafes çubuklarını) zorluk hedefine en yakın
  // olacak şekilde seçer.
  function finishAnimal(levelNo) {
    const plan = SHAPE_PLAN[levelNo];
    if (!plan) return null;
    const base = ANIMALS.find(a => a.name === plan.name);
    // Hedef zorluk, şeklin kapıdaki rolünden gelir; zorlaştıkça kafes çubukları eklenir
    const spec = { ...base, target: plan.target, bars: plan.bars };
    let best = null, bestErr = Infinity;
    for (let attempt = 0; attempt < 400 && bestErr > 0.4; attempt++) {
      const rnd = mulberry32(levelNo * 7919 + attempt * 104729);
      const rings = spec.rings.map(r => ({
        x: r.x + BOARD.w / 2, y: r.y + BOARD.h / 2, r: r.r,
        color: r.color, gaps: r.gaps, a: Math.round(rnd() * 360),
      }));
      const bars = spec.bars ? placeBars(rnd, rings, spec.bars) : [];
      if (!bars) continue;
      const def = { name: spec.name, couples: spec.couples || [], deco: spec.deco, rings: rings.concat(bars) };
      const L = Logic.buildLevel(def);
      if (!connected(L) || !noRingFreeAtStart(L)) continue;
      const quick = Logic.solveFast(L, L.startAngles, 0, 20000);
      if (!quick) continue;
      def.par = quick.moves;
      if (difficultyScore(def) < spec.target - 1.2) continue; // üst sınır bile hedefin çok altında
      const exact = Logic.solve(L, L.startAngles, 0, 150000);
      if (exact) def.par = exact.moves;
      const err = Math.abs(difficultyScore(def) - spec.target);
      if (err < bestErr) { best = def; bestErr = err; }
    }
    return best;
  }

  // İlk kez oynayanlar için rehberli deneme bölümleri (sayılmaz, skor vermez)
  const TUTORIAL = [
    { title: 'Halkayı çevir',
      text: 'Parmağını halkanın üstüne koy ve gösterilen yöne sürükle. Boşluk iki halkanın kesiştiği yere gelince halka kurtulur.',
      rings: [{ x: 140, y: 280, r: 80, a: 180 }, { x: 260, y: 280, r: 80, a: 0 }] },
    { title: 'Sırayla çöz',
      text: 'Bir halka, bağlı olduğu bütün halkalardan kurtulunca uçar. Uçtaki halkadan başla.',
      rings: [{ x: 105, y: 280, r: 62, a: 270 }, { x: 200, y: 280, r: 62, a: 90 }, { x: 295, y: 280, r: 62, a: 270 }] },
    { title: 'Çubuklar dönmez',
      text: 'Halkanın boşluğunu çubuğun geçtiği yere getir. Boşta kalan çubuk kayıp gider.',
      rings: [{ x: 200, y: 280, r: 80, a: 90 }, { type: 'bar', x1: 40, y1: 280, x2: 360, y2: 280 }] },
    { title: 'Birlikte dönenler',
      text: 'Noktalı çizgiyle bağlı halkalar aynı anda döner. Birini çevirirken diğerini de düşün.',
      rings: [
        { x: 130, y: 220, r: 62, a: 180 }, { x: 225, y: 220, r: 62, a: 0 },
        { x: 175, y: 365, r: 62, a: 180 }, { x: 270, y: 365, r: 62, a: 0 },
      ],
      couples: [[1, 2]] },
  ];
  function getTutorial(i) {
    const def = TUTORIAL[i];
    if (!def) return null;
    if (def.par == null) {
      const L = Logic.buildLevel(def);
      const sol = Logic.solve(L, L.startAngles, 0, 50000);
      def.par = sol ? sol.moves : null;
    }
    return def;
  }

  // Yeni mekaniklerin tanıtım bölümleri. Kaynak numaraları 1000'den başlar ki 61-200 arasında
  // üretilecek bölümlerle çakışmasın (kaynak numarası oyuncu kaydında kimliktir, değiştirilmez).
  // Kapılara Görev 13'te yerleşir; o zamana dek yalnızca ?src=1001 ile açılır.
  // Yerleşim: eşli iki halka (0 ve 2) birbirini keser, böylece dönüş yönü sonucu doğrudan belirler.
  // Kural doğru anlaşılınca 2 hamle; normal eş gibi düşünülürse en az 3 hamle (tools/check_levels.js).
  const CROSSED = [{ x: 145, y: 280, r: 66 }, { x: 200, y: 375, r: 60 }, { x: 255, y: 280, r: 66 }, { x: 200, y: 185, r: 60 }];
  const MECH_LEVELS = {
    1001: { title: 'Ters dişli', world: 'atolye', tip: 'Ters dişli: biri sağa dönerse eşi sola döner',
      rings: CROSSED.map((r, i) => ({ ...r, a: [150, 240, 330, 210][i] })), couples: [[0, 2, -1]] },
    1002: { title: 'Hızlı dişli', world: 'fabrika', tip: '×2 yazan halka, eşinin iki katı döner',
      rings: CROSSED.map((r, i) => ({ ...r, a: [180, 120, 30, 270][i] })), couples: [[0, 2, 2]] },
  };

  // Bir mekanik (kilit 5, eş 7, çift boşluk 8, çubuk 9, ters dişli 1001, hızlı dişli 1002)
  // tanıtılmadan onu kullanan bölüm gelemez.
  const INTRO = { fixed: 5, couple: 7, double: 8, bar: 9, reverse: 1001, fast: 1002 };
  function features(def) {
    const f = [];
    const ratios = (def.couples || []).map(c => (c[2] == null ? 1 : c[2]));
    if (def.rings.some(r => r.fixed)) f.push('fixed');
    if (ratios.includes(1)) f.push('couple');
    if (ratios.includes(-1)) f.push('reverse');
    if (ratios.some(r => Math.abs(r) === 2 || Math.abs(r) === 0.5)) f.push('fast');
    if (def.rings.some(r => r.gaps && r.gaps.length > 1)) f.push('double');
    if (def.rings.some(r => r.type === 'bar')) f.push('bar');
    return f;
  }

  // Oyuncunun gördüğü sıra: 10'ar bölümlük kapılar.
  // - Her kapının 10. bölümü bir şekil finalidir; bazı kapılarda 5. bölüm de ara şekildir (SHAPE_PLAN).
  // - Kapının içinde zorluk artar; yeni kapı bir öncekinin zirvesinin biraz altından başlar
  //   (testere dişi). Bunun için her yuvaya bir hedef sıra verilir ve bölümler zorluk sırasıyla
  //   bu yuvalara dağıtılır.
  const GATE_LEN = 10;
  const MID_POS = 4;    // ara şeklin kapı içindeki yeri (0'dan sayılır)
  const GATE_STEP = 6;  // yeni kapı, önceki kapının 7. bölümü kadar zor başlar
  function gateOrder(get) {
    const all = Array.from({ length: MAIN_LEVELS + ANIMAL_LEVELS }, (_, i) => i + 1);
    const D = new Map(all.map(s => [s, difficultyScore(get(s))]));
    const byD = (a, b) => D.get(a) - D.get(b) || a - b;
    const mains = all.filter(s => s <= MAIN_LEVELS).sort(byD);
    const shapes = all.filter(s => s > MAIN_LEVELS);
    const gates = all.length / GATE_LEN;
    // Şekillerin yeri şekil planından gelir: her kapının bir finali, bazılarının bir ara şekli var
    const finals = [], mids = [];
    for (const s of shapes) (SHAPE_PLAN[s].role === 'final' ? finals : mids)[SHAPE_PLAN[s].gate - 1] = s;
    const midGate = g => mids[g] != null;
    // Normal bölümlerin yuvaları ve hedef sıraları
    const slots = [];
    for (let g = 0; g < gates; g++) {
      const count = GATE_LEN - 1 - (midGate(g) ? 1 : 0);
      for (let j = 0; j < count; j++) slots.push({ g, j, t: g * GATE_STEP + j * 8 / (count - 1) });
    }
    slots.sort((a, b) => a.t - b.t || a.g - b.g);
    slots.forEach((s, k) => { s.src = mains[k]; });
    const order = [];
    for (let g = 0; g < gates; g++) {
      const own = slots.filter(s => s.g === g).sort((a, b) => a.j - b.j).map(s => s.src);
      if (midGate(g)) own.splice(MID_POS, 0, mids[g]);
      own.push(finals[g]);
      order.push(...own);
    }
    // Tanıtım kuralı: bir bölüm, mekaniğinin tanıtımından önce geliyorsa tanıtımla yer değiştirir
    for (let p = 0; p < order.length; p++) {
      for (const f of features(get(order[p]))) {
        const q = order.indexOf(INTRO[f]);
        if (q > p) { [order[p], order[q]] = [order[q], order[p]]; p = -1; break; }
      }
    }
    return order;
  }

  // Hayvan şekillerini tahtayı dolduracak kadar büyütür. Her şey aynı oranda
  // büyüdüğü için kesişim açıları, dolayısıyla çözüm ve hedef hamle değişmez.
  function fitted(def) {
    const b = bounds(def.rings);
    const k = Math.min((BOARD.w - 50) / (b.x1 - b.x0), (BOARD.h - 90) / (b.y1 - b.y0), 1.5);
    if (k <= 1) return def;
    return { ...def, rings: def.rings.map(r => movePiece(r, 0, 0, k)) };
  }

  const cache = {};
  function getLevel(levelNo) {
    if (cache[levelNo]) return cache[levelNo];
    let def;
    const pre = root.RING_LEVEL_DATA && root.RING_LEVEL_DATA[levelNo];
    if (MECH_LEVELS[levelNo]) {
      def = MECH_LEVELS[levelNo];
      if (def.par == null) {
        const L = Logic.buildLevel(def);
        const sol = Logic.solve(L, L.startAngles, 0, 200000);
        def.par = sol ? sol.moves : null;
      }
    } else if (levelNo > MAIN_LEVELS) {
      def = pre || finishAnimal(levelNo);
    } else if (levelNo <= HAND_LEVELS.length) {
      def = HAND_LEVELS[levelNo - 1];
      if (def.par == null) {
        const L = Logic.buildLevel(def);
        const sol = Logic.solve(L, L.startAngles, 0, 200000);
        def.par = sol ? sol.moves : null;
      }
    } else {
      // Önceden üretilmiş seviyeler (levels_data.js) varsa onları kullan
      def = pre || generate(levelNo);
    }
    if (def && levelNo > MAIN_LEVELS) def = fitted(def);
    if (def) def = centered(def);
    cache[levelNo] = def;
    return def;
  }

  const api = {
    BOARD, HAND_LEVELS, MAIN_LEVELS, ANIMAL_LEVELS, ANIMALS, TUTORIAL, getLevel, getTutorial, generate, finishAnimal, SHAPE_PLAN,
    difficultyScore, gateOrder, features, INTRO, MAX_PAR, MECH_LEVELS,
    connected, noRingFreeAtStart, difficulty, barVsRing,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingLevels = api;
})(this);
