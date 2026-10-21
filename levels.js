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
    if (p.type === 'frame') {
      const xs = p.points.map(q => q[0]), ys = p.points.map(q => q[1]);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    }
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
    if (p.type === 'frame') return { ...p, points: p.points.map(([x, y]) => [x * k + dx, y * k + dy]) };
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

  // cage: true ise çubuklar bir kafes gibi dizilir: hepsi aynı yönde (yatay ya da dikey, hafif eğik),
  // birbirine paralel ve boyları şeklin genişliği kadar. Şekil bölümleri parmaklık arkasında görünür.
  function placeBars(rnd, rings, count, cage) {
    const bars = [];
    let cageAng = 0, cageLen = 0, cageMid = null;
    if (cage) {
      cageAng = (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.3;
      const ux = Math.cos(cageAng), uy = Math.sin(cageAng);
      const proj = rings.flatMap(c => [c.x * ux + c.y * uy - c.r, c.x * ux + c.y * uy + c.r]);
      cageLen = Math.max(...proj) - Math.min(...proj) + 50;
      const b = bounds(rings);
      cageMid = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
    }
    // halka-halka kesişim noktaları: çubuk bunların üstünden geçmesin
    const ringPts = [];
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const pts = Logic.circleIntersections(rings[i], rings[j]);
        if (pts) ringPts.push(...pts);
      }
    }
    for (let tries = 0; bars.length < count && tries < 300; tries++) {
      let ang, len, cx, cy;
      if (cage) {
        // Kafes: şeklin ortasından dik yönde kaydırılmış paralel çubuklar
        ang = cageAng + (rnd() - 0.5) * 0.06;
        len = cageLen;
        const off = (rnd() - 0.5) * cageLen * 0.8;
        cx = cageMid.x - Math.sin(ang) * off; cy = cageMid.y + Math.cos(ang) * off;
      } else {
        const base = rings[Math.floor(rnd() * rings.length)];
        ang = rnd() * Math.PI;
        const off = (rnd() - 0.5) * base.r * 0.7;
        len = 210 + rnd() * 130;
        cx = base.x - Math.sin(ang) * off; cy = base.y + Math.cos(ang) * off;
      }
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

  // near: istenen yakınlık (bkz. closeness); verilirse halka komşusundan bu orana yakın uzaklığa konur
  function placeRings(rnd, count, near) {
    const rand = (a, b) => a + rnd() * (b - a);
    const rings = [{ x: 200, y: 280, r: rand(58, 72) }];
    let tries = 0;
    while (rings.length < count && tries++ < 400) {
      const parent = rings[Math.floor(rnd() * rings.length)];
      const r = rand(52, 70);
      const d = near == null ? rand(72, parent.r + r - 30)
        : Math.max(72, Math.min(parent.r + r - 27, (near + (rnd() - 0.5) * 0.08) * (parent.r + r)));
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
    // Kapı 1-6'nın üretilmiş bölümleri: hamle sayısı korunur, yakınlık kapıdaki yerinden gelir
    // (kapının başında ferah, sonunda sıkışık). Bulunamazsa hamle ±1 ve yakınlık bandı genişler.
    if (KEEP_PAR[levelNo]) {
      const par = KEEP_PAR[levelNo], near = nearOf(levelNo);
      for (let relax = 0; relax <= 3; relax++) {
        const def = generateWith(levelNo, { ...base, minPar: par - (relax >= 2 ? 1 : 0), maxPar: par + (relax >= 1 ? 1 : 0),
          near, band: 0.03 + 0.01 * relax, tries: 1500 }, 10 + relax);
        if (def) return def;
      }
      return null;
    }
    for (let relax = 0; relax <= 4; relax++) {
      const def = generateWith(levelNo, { ...base, minPar: Math.max(3, base.minPar - relax) }, relax);
      if (def) return def;
    }
    return null;
  }

  function generateWith(levelNo, p, relax) {
    const exactCap = p.count >= 9 ? 60000 : 150000;
    for (let attempt = 0; attempt < (p.tries || (relax ? 80 : 150)); attempt++) {
      const rnd = mulberry32(levelNo * 7919 + attempt * 104729 + relax * 15485863);
      const pos = placeRings(rnd, p.count, p.near);
      if (!pos) continue;
      if (p.near != null && Math.abs(closeness({ rings: pos }) - p.near) > p.band) continue;
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
      if (def.par > (p.maxPar || MAX_PAR)) continue;
      return def;
    }
    return null;
  }

  // Döner tabla da yerleşimde bir parça gibi sayılır (sınırları ve kaydırması)
  const withTable = def => (def.table ? [...def.rings, def.table] : def.rings);
  const moveTable = (def, dx, dy, k = 1) => (def.table ? { table: { ...def.table, ...movePiece({ x: def.table.x, y: def.table.y, r: def.table.r }, dx, dy, k) } } : {});

  // Halkaları bütün olarak tahtanın ortasına kaydırır (kural değişmez, sadece görünüm)
  function centered(def) {
    const b = bounds(withTable(def));
    const dx = BOARD.w / 2 - (b.x0 + b.x1) / 2;
    const dy = BOARD.h / 2 - (b.y0 + b.y1) / 2;
    return { ...def, rings: def.rings.map(r => movePiece(r, dx, dy)), ...moveTable(def, dx, dy) };
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
    // Tırtıl tahta genişliğinde yatay uzanır: paralel kafes sığmaz, çubukları serbest yerleşir
    57: { name: 'Tırtıl', gate: 4, role: 'final', target: 9.4, bars: 2, cage: false },
    58: { name: 'Domuzcuk', gate: 3, role: 'mid', target: 4.1, bars: 0 },
    59: { name: 'Penguen', gate: 5, role: 'final', target: 9.4, bars: 2 },
    60: { name: 'Aslan', gate: 6, role: 'final', target: 10.3, bars: 3 },
    // Görev 12: yeni şekiller. Hedefler ölçülerek kondu: her şeklin kafes çubuğu sayısına göre ulaşabildiği
    // zorluk aralığından (finaller üst ucunda, ara şekiller ortasında). Kapı 7-20, Görev 13'te sıraya girer.
    61: { name: 'Kaplumbağa', gate: 6, role: 'mid', target: 7.0, bars: 1 },
    62: { name: 'Fare', gate: 7, role: 'mid', target: 6.5, bars: 1 },
    63: { name: 'Bisiklet', gate: 7, role: 'final', target: 9.0, bars: 3 },
    64: { name: 'Kirpi', gate: 8, role: 'mid', target: 7.0, bars: 2 },
    65: { name: 'Kamyon', gate: 8, role: 'final', target: 8.0, bars: 2 },
    66: { name: 'Guguk Kuşu', gate: 9, role: 'final', target: 9.2, bars: 3 },
    67: { name: 'Çalar Saat', gate: 9, role: 'mid', target: 6.5, bars: 1 },
    68: { name: 'Salyangoz', gate: 10, role: 'mid', target: 7.5, bars: 2 },
    69: { name: 'Tren', gate: 10, role: 'final', target: 9.0, bars: 2 },
    70: { name: 'Yarasa', gate: 11, role: 'mid', target: 7.5, bars: 2 },
    71: { name: 'Ejderha', gate: 11, role: 'final', target: 10.0, bars: 2 },
    72: { name: 'Örümcek', gate: 12, role: 'mid', target: 7.5, bars: 1 },
    73: { name: 'Hazine Sandığı', gate: 12, role: 'final', target: 9.0, bars: 1 },
    74: { name: 'Köpek', gate: 13, role: 'mid', target: 7.0, bars: 2 },
    75: { name: 'Ev', gate: 13, role: 'final', target: 8.5, bars: 2 },
    76: { name: 'Güvercin', gate: 14, role: 'mid', target: 7.0, bars: 2 },
    77: { name: 'Araba', gate: 14, role: 'final', target: 9.0, bars: 3 },
    78: { name: 'Arı', gate: 15, role: 'mid', target: 7.5, bars: 2 },
    79: { name: 'Robot', gate: 15, role: 'final', target: 9.0, bars: 2 },
    80: { name: 'Ördek', gate: 16, role: 'mid', target: 7.0, bars: 2 },
    81: { name: 'Gemi', gate: 16, role: 'final', target: 7.9, bars: 3 }, // ulaşılabilen en yüksek; kapı buna göre başlar
    82: { name: 'Uzaylı', gate: 17, role: 'mid', target: 7.5, bars: 2 },
    83: { name: 'Füze', gate: 17, role: 'final', target: 9.5, bars: 3 },
    84: { name: 'Ahtapot', gate: 18, role: 'mid', target: 8.0, bars: 2 },
    85: { name: 'Gezegen', gate: 18, role: 'final', target: 8.5, bars: 2 },
    86: { name: 'Tilki', gate: 19, role: 'mid', target: 9.0, bars: 2 },
    87: { name: 'Fil', gate: 19, role: 'final', target: 10.5, bars: 3 },
    88: { name: 'Zürafa', gate: 20, role: 'mid', target: 6.5, bars: 0 },
    89: { name: 'Büyük Makine', gate: 20, role: 'final', target: 10.5, bars: 2 },
    // 2.4 (Y8): kapı 21-30'un ara şekilleri ve finalleri. Kaynak numaraları 2001'den başlar (bölüm kimliği).
    // Hedefler Y9'da ölçüldü (her çubuk/kafes ayarında ulaşılabilen en yüksek zorluk). Kafes (3 paralel çubuk)
    // birçok şeklin etrafına sığmıyor: onlarda çubuklar serbest (cage: false). Kapı 21, 23 ve 27'de final
    // şekli yeterince zorlaşamadığı için ara şekille rolü değiştirildi.
    2001: { name: 'Maymun', gate: 21, role: 'final', target: 9.50, bars: 3 },
    2002: { name: 'Dönme Dolap', gate: 21, role: 'mid', target: 7.20, bars: 2, cage: false },
    2003: { name: 'Fok', gate: 22, role: 'mid', target: 7.65, bars: 2 },
    2004: { name: 'Atlıkarınca', gate: 22, role: 'final', target: 9.62, bars: 2 },
    2005: { name: 'Kanguru', gate: 23, role: 'final', target: 9.50, bars: 3 },
    2006: { name: 'Flamingo', gate: 23, role: 'mid', target: 7.60, bars: 2, cage: false },
    2007: { name: 'Ateş Böceği', gate: 24, role: 'mid', target: 7.95, bars: 2 },
    2008: { name: 'Ampul', gate: 24, role: 'final', target: 9.86, bars: 3 },
    2009: { name: 'Yılan Balığı', gate: 25, role: 'mid', target: 8.10, bars: 2, cage: false },
    2010: { name: 'Kunduz', gate: 25, role: 'final', target: 9.98, bars: 3 },
    2011: { name: 'Yengeç', gate: 26, role: 'mid', target: 8.25, bars: 2 },
    2012: { name: 'Deniz Feneri', gate: 26, role: 'final', target: 9.10, bars: 3, cage: false },
    2013: { name: 'Martı', gate: 27, role: 'final', target: 9.60, bars: 3 },
    2014: { name: 'Balina', gate: 27, role: 'mid', target: 8.00, bars: 2 },
    2015: { name: 'Denizatı', gate: 28, role: 'mid', target: 8.55, bars: 2 },
    2016: { name: 'Yunus', gate: 28, role: 'final', target: 9.30, bars: 3, cage: false },
    2017: { name: 'Rakun', gate: 29, role: 'mid', target: 8.70, bars: 2 },
    2018: { name: 'Teleskop', gate: 29, role: 'final', target: 10.40, bars: 3, cage: false },
    2019: { name: 'Kurt', gate: 30, role: 'mid', target: 8.85, bars: 2 },
    2020: { name: 'Gözlemevi', gate: 30, role: 'final', target: 10.58, bars: 3 },
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

  // Görev 11: yeni şekiller (yerleşim tools dışında denetlendi: temiz kesişim, bağlılık, tahtaya sığma,
  // gireceği dünyada renk kontrastı). Kaynak numaraları ve kapıları Görev 12'de SHAPE_PLAN'a eklenir.
  ANIMALS.push(
    { name: 'Kaplumbağa',
      rings: [
        {x: 0, y: 0, r: 82, color: '#90be6d'},
        {x: 80, y: 0, r: 36, color: '#b5e48c'},
        {x: 40, y: -69.3, r: 28, color: '#7fb069'},
        {x: -40, y: -69.3, r: 28, color: '#7fb069'},
        {x: 40, y: 69.3, r: 28, color: '#7fb069'},
        {x: -40, y: 69.3, r: 28, color: '#7fb069'},
      ],
      couples: [[2, 5], [3, 4]],
      deco: [{ring: 0, type: 'shell'}, {ring: 1, type: 'face', look: {eyes: 'round', nose: 'none', mouth: 'smile'}}] },
    { name: 'Fare',
      rings: [
        {x: 0, y: 0, r: 68, color: '#c9cbe0'},
        {x: -49.2, y: -41.3, r: 40, color: '#ffc8dd'},
        {x: 49.2, y: -41.3, r: 40, color: '#ffc8dd'},
        {x: 0, y: 92.6, r: 60, color: '#b4b7d6'},
        {x: 52.6, y: 117.1, r: 28, color: '#ffafcc'},
      ],
      couples: [[1, 2, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', noseColor: '#ff7aa2', mouth: 'w', extras: ['whiskers', 'cheeks']}}] },
    { name: 'Bisiklet',
      rings: [
        {x: 0, y: 0, r: 56, color: '#4cc9f0'},
        {x: -70, y: 39, r: 56, color: '#2dd4bf'},
        {x: 70, y: 39, r: 56, color: '#2dd4bf'},
        {x: -31, y: -44.2, r: 24, color: '#ff6b6b'},
        {x: 31, y: -44.2, r: 26, color: '#ffc94a'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 1, type: 'wheel'}, {ring: 2, type: 'wheel'}] },
    { name: 'Kirpi',
      rings: [
        {x: 0, y: 0, r: 80, color: '#a47551'},
        {x: 76.8, y: 13.5, r: 44, color: '#e9c39b'},
        {x: -67.5, y: 39, r: 26, color: '#d4a373'},
        {x: -6.8, y: 77.7, r: 26, color: '#d4a373'},
      ],
      couples: [[2, 3, -1]],
      deco: [{ring: 0, type: 'spikes', z: -1}, {ring: 0, type: 'fill', z: -2}, {ring: 1, type: 'face', look: {eyes: 'round', nose: 'oval', mouth: 'w', extras: ['cheeks']}}] },
    { name: 'Kamyon',
      rings: [
        {x: -40, y: -20, r: 72, color: '#ff9f1c'},
        {x: 50, y: -5, r: 50, color: '#4895ef'},
        {x: -55, y: 52, r: 32, color: '#c9b8ff'},
        {x: 55, y: 50, r: 32, color: '#c9b8ff'},
      ],
      couples: [[2, 3]],
      deco: [{ring: 0, type: 'crate'}, {ring: 1, type: 'window', s: 0.55, dy: -0.15}, {ring: 2, type: 'wheel'}, {ring: 3, type: 'wheel'}] },
    { name: 'Guguk Kuşu',
      rings: [
        {x: 0, y: 0, r: 70, color: '#4895ef'},
        {x: 0, y: 98.8, r: 66, color: '#90be6d', step: 45},
        {x: -49, y: 139.9, r: 30, color: '#2dd4bf'},
        {x: 49, y: 139.9, r: 30, color: '#2dd4bf'},
      ],
      couples: [[2, 3]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'beak', mouth: 'none', extras: ['cheeks']}}, {ring: 1, type: 'fill', z: -1}] },
    { name: 'Çalar Saat',
      rings: [
        {x: 0, y: 0, r: 80, color: '#ff6b6b', step: 30},
        {x: -48, y: -61.5, r: 30, color: '#ffc94a'},
        {x: 48, y: -61.5, r: 30, color: '#ffc94a'},
        {x: -44.7, y: 63.9, r: 24, color: '#b388ff'},
        {x: 44.7, y: 63.9, r: 24, color: '#b388ff'},
      ],
      couples: [[1, 2], [3, 4]],
      deco: [{ring: 0, type: 'clock'}] },
    { name: 'Salyangoz',
      rings: [
        {x: 0, y: 0, r: 76, color: '#f4a261', step: 60},
        {x: 67.1, y: 31.3, r: 46, color: '#90be6d'},
        {x: 108.4, y: 46.3, r: 26, color: '#b5e48c'},
        {x: -64.1, y: 37, r: 30, color: '#90be6d'},
      ],
      deco: [{ring: 0, type: 'spiral'}, {ring: 1, type: 'face', look: {eyes: 'round', nose: 'none', mouth: 'smile', extras: ['antennae', 'cheeks'], tint: '#ffc94a'}}] },
    { name: 'Tren',
      rings: [
        {x: 0, y: 0, r: 60, color: '#ff6b6b', step: 30},
        {x: -79, y: 0, r: 52, color: '#4cc9f0'},
        {x: 19.8, y: -54.5, r: 24, color: '#ffc94a'},
        {x: 10.5, y: 59.5, r: 28, color: '#c9b8ff'},
        {x: -88.1, y: 51.6, r: 28, color: '#c9b8ff'},
      ],
      couples: [[3, 4]],
      deco: [{ring: 0, type: 'window', s: 0.5, dx: 0.1, dy: -0.12}, {ring: 1, type: 'window', s: 0.5}, {ring: 2, type: 'smoke', dy: -0.6}, {ring: 3, type: 'wheel'}, {ring: 4, type: 'wheel'}] },
    { name: 'Yarasa',
      rings: [
        {x: 0, y: 0, r: 58, color: '#b3a4ff'},
        {x: -76.7, y: 0, r: 66, color: '#9b8af7'},
        {x: 76.7, y: 0, r: 66, color: '#9b8af7'},
        {x: -32.1, y: -45.9, r: 24, color: '#c9b8ff'},
        {x: 32.1, y: -45.9, r: 24, color: '#c9b8ff'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'big', nose: 'none', mouth: 'fangs', extras: ['cheeks']}}, {ring: 1, type: 'wing', side: 1}, {ring: 2, type: 'wing', side: 1}] },
    { name: 'Ejderha',
      rings: [
        {x: 0, y: 0, r: 76, color: '#2dd4bf'},
        {x: 0, y: 104, r: 72, color: '#20a68f', lockedBy: 0},
        {x: 53.6, y: 149, r: 30, color: '#90be6d'},
        {x: -53.6, y: 149, r: 30, color: '#90be6d'},
        {x: -64.1, y: -37, r: 28, color: '#ffc94a'},
        {x: 64.1, y: -37, r: 28, color: '#ffc94a'},
      ],
      couples: [[2, 3], [4, 5]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', noseColor: '#13594d', mouth: 'fangs', extras: ['horns', 'brows', 'cheeks']}}] },
    { name: 'Örümcek',
      rings: [
        {x: 0, y: 0, r: 62, color: '#b388ff', lockedBy: 5},
        {x: -54, y: -31.2, r: 26, color: '#ad92f7'},
        {x: 0, y: -62.4, r: 26, color: '#ad92f7'},
        {x: 54, y: -31.2, r: 26, color: '#ad92f7'},
        {x: 54, y: 31.2, r: 26, color: '#ad92f7'},
        {x: 0, y: 62.4, r: 26, color: '#ad92f7'},
        {x: -54, y: 31.2, r: 26, color: '#ad92f7'},
      ],
      couples: [[1, 6], [3, 4]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'three', nose: 'none', mouth: 'smile', extras: ['cheeks']}}] },
    { name: 'Hazine Sandığı',
      rings: [
        {x: 0, y: 0, r: 84, color: '#c08552', lockedBy: 2},
        {x: -71, y: -41, r: 30, color: '#ffc94a'},
        {x: 0, y: -82, r: 30, color: '#ffd166'},
        {x: 71, y: -41, r: 30, color: '#ffc94a'},
        {x: -58, y: 58, r: 34, color: '#c9b8ff'},
        {x: 58, y: 58, r: 34, color: '#c9b8ff'},
      ],
      couples: [[1, 3], [4, 5]],
      deco: [{ring: 0, type: 'crate', gold: true}, {ring: 1, type: 'sparkle'}, {ring: 2, type: 'sparkle'}, {ring: 3, type: 'sparkle'}] },
    { name: 'Köpek',
      rings: [
        {x: 0, y: 0, r: 76, color: '#e9c39b'},
        {x: -62.9, y: -36.3, r: 36, color: '#a47551'},
        {x: 62.9, y: -36.3, r: 36, color: '#a47551'},
        {x: 0, y: 103.4, r: 64, color: '#d4a373'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'snout', mouth: 'tongue', extras: ['cheeks']}}] },
    { name: 'Ev',
      rings: [
        {x: 0, y: 0, r: 88, color: '#ffd166'},
        {x: 40.4, y: -75.9, r: 26, color: '#ff6b6b'},
        {x: -86, y: 0, r: 40, color: '#90be6d'},
        {x: 86, y: 0, r: 40, color: '#90be6d'},
        {x: 0, y: 86, r: 44, color: '#a47551'},
      ],
      couples: [[2, 3]],
      deco: [{ring: 0, type: 'house'}, {ring: 1, type: 'smoke', dy: -0.5}] },
    { name: 'Güvercin',
      rings: [
        {x: 0, y: 0, r: 58, color: '#c9cbe0'},
        {x: 0, y: 97.2, r: 74, color: '#a9adc9'},
        {x: -67.7, y: 121.8, r: 40, color: '#e8eaf6'},
        {x: 67.7, y: 121.8, r: 40, color: '#e8eaf6'},
      ],
      couples: [[2, 3]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'beak', noseColor: '#f4a261', mouth: 'none', extras: ['cheeks']}}, {ring: 2, type: 'wing', light: true, side: -1}, {ring: 3, type: 'wing', light: true, side: 1}] },
    { name: 'Araba',
      rings: [
        {x: 0, y: 0, r: 84, color: '#ff6b6b'},
        {x: 0, y: -82, r: 40, color: '#4cc9f0'},
        {x: -62, y: 60, r: 32, color: '#c9b8ff'},
        {x: 62, y: 60, r: 32, color: '#c9b8ff'},
      ],
      couples: [[2, 3]],
      deco: [{ring: 0, type: 'door'}, {ring: 0, type: 'headlight', dx: 0.62, dy: 0.12}, {ring: 1, type: 'window', s: 0.7}, {ring: 2, type: 'wheel'}, {ring: 3, type: 'wheel'}] },
    { name: 'Arı',
      rings: [
        {x: 0, y: 0, r: 60, color: '#ffc94a'},
        {x: 0, y: 94.6, r: 70, color: '#ffd166'},
        {x: -63.9, y: 117.9, r: 40, color: '#cfefff'},
        {x: 63.9, y: 117.9, r: 40, color: '#cfefff'},
      ],
      couples: [[2, 3, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'big', nose: 'none', mouth: 'smile', extras: ['antennae', 'cheeks']}}, {ring: 1, type: 'face', look: {eyes: 'none', nose: 'none', mouth: 'none', extras: ['stripes'], fill: 0.25}}, {ring: 2, type: 'wing', light: true, side: -1}, {ring: 3, type: 'wing', light: true, side: 1}] },
    { name: 'Robot',
      rings: [
        {x: 0, y: 0, r: 70, color: '#c3cada'},
        {x: 0, y: 105.6, r: 74, color: '#90a4b8'},
        {x: 0, y: -68, r: 24, color: '#ff6b6b'},
        {x: -67.7, y: 130.2, r: 30, color: '#c3cada'},
        {x: 67.7, y: 130.2, r: 30, color: '#c3cada'},
      ],
      couples: [[3, 4, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'visor', nose: 'none', mouth: 'grill', extras: []}}, {ring: 1, type: 'gear'}] },
    { name: 'Ördek',
      rings: [
        {x: 0, y: 0, r: 60, color: '#ffd166'},
        {x: -17.5, y: 99.1, r: 76, color: '#ffe9a8'},
        {x: 52.1, y: 124.4, r: 34, color: '#f4d06f'},
        {x: -74.2, y: 146.6, r: 26, color: '#ff9f1c'},
      ],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'duck', mouth: 'none', extras: ['cheeks']}}, {ring: 1, type: 'fill', z: -1}] },
    { name: 'Gemi',
      rings: [
        {x: 0, y: 20, r: 90, color: '#4895ef'},
        {x: -45, y: -72, r: 40, color: '#ff6b6b'},
        {x: 45, y: -72, r: 40, color: '#ff6b6b'},
        {x: 76.2, y: 64, r: 28, color: '#e8eaf6'},
        {x: -44, y: 96.2, r: 30, color: '#ffc94a'},
      ],
      couples: [[1, 2, 2]],
      deco: [{ring: 0, type: 'porthole', dx: -0.4, s: 0.2}, {ring: 0, type: 'porthole', dx: 0, s: 0.2}, {ring: 0, type: 'porthole', dx: 0.4, s: 0.2}, {ring: 1, type: 'smoke', dy: -0.6}, {ring: 2, type: 'smoke', dy: -0.6}] },
    { name: 'Uzaylı',
      rings: [
        {x: 0, y: 0, r: 72, color: '#90be6d'},
        {x: 0, y: 96.6, r: 60, color: '#b5e48c', step: 60},
        {x: -44.4, y: 133.9, r: 28, color: '#7cc4ff'},
        {x: 44.4, y: 133.9, r: 28, color: '#7cc4ff'},
      ],
      couples: [[2, 3]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'three', nose: 'none', mouth: 'open', extras: ['antennae', 'cheeks'], tint: '#7cc4ff'}}] },
    { name: 'Füze',
      rings: [
        {x: 0, y: 0, r: 70, color: '#e8eaf6'},
        {x: 0, y: -68, r: 44, color: '#ff6b6b'},
        {x: -52.1, y: 43.7, r: 34, color: '#ff6b6b'},
        {x: 52.1, y: 43.7, r: 34, color: '#ff6b6b'},
      ],
      couples: [[2, 3, -1]],
      deco: [{ring: 0, type: 'porthole', s: 0.42}, {ring: 0, type: 'flame', dy: 0.9, z: -1}] },
    { name: 'Ahtapot',
      rings: [
        {x: 0, y: 0, r: 76, color: '#ff8fab'},
        {x: 76.7, y: 20.6, r: 28, color: '#f72585'},
        {x: 33.6, y: 72, r: 28, color: '#f72585'},
        {x: -33.6, y: 72, r: 28, color: '#f72585'},
        {x: -76.7, y: 20.6, r: 28, color: '#f72585'},
      ],
      couples: [[1, 4, -1], [2, 3, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'big', nose: 'none', mouth: 'smile', extras: ['cheeks', 'freckles']}}] },
    { name: 'Gezegen',
      rings: [
        {x: 0, y: 0, r: 80, color: '#f4a261'},
        {x: -78, y: 0, r: 46, color: '#7cc4ff'},
        {x: 78, y: 0, r: 46, color: '#7cc4ff'},
        {x: 0, y: -78, r: 26, color: '#b388ff'},
      ],
      couples: [[1, 2, 2]],
      deco: [{ring: 0, type: 'planet'}, {ring: 3, type: 'sparkle'}] },
    { name: 'Tilki',
      rings: [
        {x: 0, y: 0, r: 72, color: '#ff9f1c'},
        {x: -48.6, y: -48.6, r: 34, color: '#e76f51'},
        {x: 48.6, y: -48.6, r: 34, color: '#e76f51'},
        {x: -8.5, y: 97.6, r: 62, color: '#f4a261'},
        {x: 30, y: 143.6, r: 32, color: '#ffe0b5', step: 45},
      ],
      couples: [[1, 2, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'happy', nose: 'oval', mouth: 'w', extras: ['mask']}}] },
    { name: 'Fil',
      rings: [
        {x: 0, y: 0, r: 70, color: '#b4b7d6'},
        {x: -75.2, y: 0, r: 58, color: '#d6d8ee'},
        {x: 75.2, y: 0, r: 58, color: '#d6d8ee'},
        {x: 0, y: 73.6, r: 30, color: '#b4b7d6'},
        {x: 5.4, y: 104.3, r: 26, color: '#b4b7d6'},
      ],
      couples: [[1, 2, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'none', mouth: 'none', extras: ['cheeks'], eyeY: -0.12}}] },
    { name: 'Zürafa',
      rings: [
        {x: 0, y: 0, r: 60, color: '#ffd166'},
        {x: -37.3, y: -44.4, r: 26, color: '#c08552'},
        {x: 37.3, y: -44.4, r: 26, color: '#c08552'},
        {x: 0, y: 58, r: 46, color: '#f4c06a', step: 60},
        {x: 0, y: 126, r: 46, color: '#f4c06a'},
        {x: 0, y: 190, r: 66, color: '#ffd166'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', noseColor: '#8a5a3c', mouth: 'w', extras: ['spots', 'cheeks']}}, {ring: 5, type: 'face', look: {eyes: 'none', nose: 'none', mouth: 'none', extras: ['spots'], fill: 0.3}}] },
    { name: 'Büyük Makine',
      rings: [
        {x: 0, y: 0, r: 80, color: '#ffc94a', lockedBy: 3},
        {x: -55.2, y: -55.2, r: 44, color: '#c3cada'},
        {x: 55.2, y: -55.2, r: 44, color: '#c3cada'},
        {x: 55.2, y: 55.2, r: 44, color: '#4cc9f0'},
        {x: -55.2, y: 55.2, r: 44, color: '#4cc9f0'},
      ],
      couples: [[1, 2, -1], [3, 4, -1]],
      deco: [{ring: 0, type: 'gear'}, {ring: 1, type: 'gear', dir: -1}, {ring: 2, type: 'gear', dir: -1}, {ring: 3, type: 'gear', dir: -1}, {ring: 4, type: 'gear', dir: -1}] },
    // ---- 2.4 (Y8): kapı 21-30'un 20 yeni şekli ----
    // Koyu renkler yeni dünyaların zemininde en az 3:1 kontrast için açıldı (Y9, tools/check_themes.js)
    { name: 'Maymun',
      rings: [
        {x: 0, y: 0, r: 70, color: '#c08552'},
        {x: -78, y: 0, r: 34, color: '#e0b48a'},
        {x: 78, y: 0, r: 34, color: '#e0b48a'},
        {x: 0, y: 99, r: 62, color: '#ab7953'},
        {x: 39.9, y: 146.5, r: 26, color: '#e0b48a', step: 45},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', mouth: 'smile', extras: ['muzzle', 'cheeks']}}] },
    { name: 'Dönme Dolap',
      rings: [
        {x: 0, y: 0, r: 86, color: '#ff6fb5'},
        {x: 0, y: -86, r: 26, color: '#ffc94a'},
        {x: 86, y: 0, r: 26, color: '#4cc9f0'},
        {x: 0, y: 86, r: 26, color: '#90be6d'},
        {x: -86, y: 0, r: 26, color: '#b388ff'},
      ],
      couples: [[1, 3], [2, 4]],
      deco: [{ring: 0, type: 'wheel'}, {ring: 1, type: 'window', s: 0.6}, {ring: 2, type: 'window', s: 0.6}, {ring: 3, type: 'window', s: 0.6}, {ring: 4, type: 'window', s: 0.6}] },
    { name: 'Fok',
      rings: [
        {x: 0, y: 0, r: 62, color: '#8d99ae'},
        {x: 0, y: -62, r: 26, color: '#ff6b6b'},
        {x: 0, y: 100.5, r: 72, color: '#a3b1c6'},
        {x: -65.8, y: 138.5, r: 30, color: '#78859b'},
        {x: 65.8, y: 138.5, r: 30, color: '#78859b'},
      ],
      couples: [[3, 4, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'big', nose: 'oval', mouth: 'w', extras: ['whiskers', 'cheeks']}}, {ring: 1, type: 'ball'}] },
    { name: 'Atlıkarınca',
      rings: [
        {x: 0, y: 0, r: 84, color: '#ff6fb5'},
        {x: 0, y: -88, r: 30, color: '#ffc94a'},
        {x: -66.5, y: 66.5, r: 36, color: '#ffd34a', step: 45},
        {x: 66.5, y: 66.5, r: 36, color: '#ffd34a', step: 45},
        {x: -26.4, y: 98.5, r: 44, color: '#4cc9f0'},
      ],
      deco: [{ring: 0, type: 'canopy'}, {ring: 1, type: 'sparkle'}, {ring: 4, type: 'face', look: {eyes: 'happy', nose: 'snout', mouth: 'none', extras: ['cheeks']}}] },
    { name: 'Kanguru',
      rings: [
        {x: 0, y: 0, r: 58, color: '#d4a373'},
        {x: -24.5, y: -52.6, r: 26, color: '#c08552'},
        {x: 37.3, y: -44.4, r: 26, color: '#c08552'},
        {x: 0, y: 100.3, r: 74, color: '#e0b48a'},
        {x: 26.7, y: 173.6, r: 30, color: '#f2d0a9'},
        {x: -77.1, y: 128.3, r: 34, color: '#c08552'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', mouth: 'w', extras: ['cheeks']}}, {ring: 4, type: 'face', look: {eyes: 'round', nose: 'oval', mouth: 'none', eyeS: 0.13, extras: ['cheeks']}}] },
    { name: 'Flamingo',
      rings: [
        {x: 0, y: 0, r: 44, color: '#ff8fab'},
        {x: 0, y: 50, r: 32, color: '#ff8fab'},
        {x: 0, y: 88, r: 32, color: '#ff8fab'},
        {x: 38, y: 153.8, r: 70, color: '#ffb3c6'},
        {x: 25.2, y: 226.7, r: 30, color: '#f72585'},
      ],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'hook', mouth: 'none', extras: ['cheeks']}}, {ring: 3, type: 'wing', light: true, side: 1}] },
    { name: 'Ateş Böceği',
      rings: [
        {x: 0, y: 0, r: 52, color: '#2a9d8f'},
        {x: 0, y: 86, r: 60, color: '#ffe066'},
        {x: -65.7, y: 68.4, r: 34, color: '#cfefff'},
        {x: 65.7, y: 68.4, r: 34, color: '#cfefff'},
      ],
      couples: [[2, 3, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'big', nose: 'none', mouth: 'smile', extras: ['antennae', 'cheeks'], tint: '#ffe066'}}, {ring: 1, type: 'glow'}, {ring: 2, type: 'wing', light: true, side: -1}, {ring: 3, type: 'wing', light: true, side: 1}] },
    { name: 'Ampul',
      rings: [
        {x: 0, y: 0, r: 84, color: '#ffe066'},
        {x: 0, y: 92, r: 34, color: '#c3cada'},
        {x: 0, y: 130, r: 30, color: '#90a4b8'},
        {x: 62.2, y: -62.2, r: 30, color: '#fff3b0'},
      ],
      deco: [{ring: 0, type: 'filament'}, {ring: 3, type: 'sparkle'}] },
    { name: 'Yılan Balığı',
      rings: [
        {x: 0, y: 0, r: 52, color: '#3d9bff'},
        {x: 60.6, y: 35, r: 44, color: '#5aa9ff'},
        {x: 112.6, y: 5, r: 42, color: '#3d9bff'},
        {x: 161.1, y: 33, r: 40, color: '#5aa9ff'},
        {x: 204.4, y: 8, r: 36, color: '#3d9bff'},
      ],
      couples: [[1, 3, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'big', nose: 'none', mouth: 'open', extras: ['cheeks']}}, {ring: 2, type: 'bolt'}] },
    { name: 'Kunduz',
      rings: [
        {x: 0, y: 0, r: 66, color: '#ab7953'},
        {x: -27.9, y: -59.8, r: 24, color: '#9f7d66'},
        {x: 59.8, y: -27.9, r: 24, color: '#9f7d66'},
        {x: 0, y: 103.4, r: 70, color: '#c08552'},
        {x: 72.7, y: 145.4, r: 40, color: '#927f73'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', mouth: 'buckteeth', extras: ['cheeks']}}, {ring: 4, type: 'tailx'}] },
    { name: 'Yengeç',
      rings: [
        {x: 0, y: 0, r: 72, color: '#ff6b6b'},
        {x: -69.3, y: -40, r: 34, color: '#ff8a6b'},
        {x: 69.3, y: -40, r: 34, color: '#ff8a6b'},
        {x: -68.9, y: 32.1, r: 30, color: '#e85d5d'},
        {x: 68.9, y: 32.1, r: 30, color: '#e85d5d'},
      ],
      couples: [[1, 2, -1], [3, 4]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'none', mouth: 'smile', extras: ['antennae', 'cheeks'], tint: '#ff8a6b', eyeY: -0.2}}, {ring: 1, type: 'pincer', side: -1}, {ring: 2, type: 'pincer', side: 1}] },
    { name: 'Deniz Feneri',
      rings: [
        {x: 0, y: 0, r: 40, color: '#ffd27a'},
        {x: 0, y: 60, r: 46, color: '#ff6b6b'},
        {x: 0, y: 132, r: 52, color: '#e8eaf6'},
        {x: 0, y: 218, r: 60, color: '#ff6b6b'},
        {x: 0, y: 286, r: 34, color: '#4895ef'},
      ],
      deco: [{ring: 0, type: 'lamp'}, {ring: 2, type: 'window', s: 0.5}] },
    { name: 'Martı',
      rings: [
        {x: 0, y: 0, r: 52, color: '#e8eaf6'},
        {x: 0, y: 89.7, r: 66, color: '#c9cbe0'},
        {x: -81.1, y: 68, r: 44, color: '#a9adc9'},
        {x: 81.1, y: 68, r: 44, color: '#a9adc9'},
      ],
      couples: [[2, 3, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'beak', noseColor: '#ffc94a', mouth: 'none', extras: ['cheeks']}}, {ring: 2, type: 'wing', light: true, side: -1}, {ring: 3, type: 'wing', light: true, side: 1}] },
    { name: 'Balina',
      rings: [
        {x: 0, y: 0, r: 92, color: '#4895ef'},
        {x: 0, y: -94, r: 28, color: '#cfefff'},
        {x: 99.2, y: 36.1, r: 40, color: '#4683d8'},
        {x: 137.3, y: 14.1, r: 30, color: '#4683d8', step: 60},
        {x: -86.5, y: 31.5, r: 26, color: '#7cc4ff'},
      ],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'none', mouth: 'smile', extras: ['cheeks'], eyeX: 0.35}}, {ring: 1, type: 'spout'}] },
    { name: 'Denizatı',
      rings: [
        {x: 0, y: 0, r: 46, color: '#ffb347'},
        {x: -12.5, y: 70.9, r: 52, color: '#ffa62b'},
        {x: -0.3, y: 139.8, r: 44, color: '#ffb347'},
        {x: 26.7, y: 186.6, r: 36, color: '#ffa62b'},
        {x: -63.2, y: 52.4, r: 28, color: '#ffd27a'},
      ],
      couples: [[1, 3]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'tube', mouth: 'none', extras: ['cheeks']}}, {ring: 3, type: 'spiral'}] },
    { name: 'Yunus',
      rings: [
        {x: 0, y: 0, r: 60, color: '#4cc9f0'},
        {x: 30, y: -52, r: 26, color: '#3aa6d0'},
        {x: 95.7, y: 34.8, r: 74, color: '#7fd8f5'},
        {x: 158.5, y: 87.5, r: 34, color: '#3aa6d0', step: 45},
      ],
      deco: [{ring: 0, type: 'face', look: {eyes: 'happy', nose: 'none', mouth: 'smile', extras: ['cheeks']}}, {ring: 2, type: 'fill', z: -1}] },
    { name: 'Rakun',
      rings: [
        {x: 0, y: 0, r: 66, color: '#9a9aaa'},
        {x: -42.4, y: -50.6, r: 26, color: '#81818e'},
        {x: 42.4, y: -50.6, r: 26, color: '#81818e'},
        {x: 0, y: 97.3, r: 62, color: '#b4b4c4'},
        {x: 67, y: 85.5, r: 32, color: '#81818e'},
        {x: 93, y: 63.6, r: 28, color: '#d6d6e2'},
      ],
      couples: [[1, 2, -1]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'round', nose: 'oval', mouth: 'w', extras: ['bandit', 'cheeks']}}] },
    { name: 'Teleskop',
      rings: [
        {x: 0, y: 0, r: 40, color: '#c3a6ff'},
        {x: -55.4, y: 32, r: 50, color: '#8a6cff'},
        {x: -126.4, y: 73, r: 58, color: '#8872d9'},
        {x: -126.4, y: 139, r: 34, color: '#c3cada'},
        {x: -68.6, y: 78.1, r: 26, color: '#ffc94a'},
      ],
      couples: [[0, 2]],
      deco: [{ring: 0, type: 'lens'}, {ring: 4, type: 'sparkle'}] },
    { name: 'Kurt',
      rings: [
        {x: 0, y: 0, r: 62, color: '#8d99ae'},
        {x: -35.6, y: -50.8, r: 26, color: '#78859b'},
        {x: 35.6, y: -50.8, r: 26, color: '#78859b'},
        {x: 0, y: 97.3, r: 66, color: '#a3b1c6'},
        {x: 75.2, y: -27.4, r: 44, color: '#fff3b0'},
      ],
      couples: [[1, 2]],
      deco: [{ring: 0, type: 'face', look: {eyes: 'happy', nose: 'snout', mouth: 'howl', extras: ['cheeks']}}, {ring: 4, type: 'moon'}] },
    { name: 'Gözlemevi',
      rings: [
        {x: 0, y: 0, r: 80, color: '#c3a6ff'},
        {x: 0, y: 113.9, r: 66, color: '#8a6cff'},
        {x: 67.4, y: -56.6, r: 34, color: '#ffc94a'},
        {x: -61.3, y: -51.4, r: 26, color: '#7cc4ff'},
        {x: 64.1, y: 150.9, r: 34, color: '#8872d9'},
        {x: -64.1, y: 150.9, r: 34, color: '#8872d9'},
      ],
      couples: [[2, 3, -1], [4, 5]],
      deco: [{ring: 0, type: 'dome'}, {ring: 1, type: 'door'}, {ring: 2, type: 'moon'}, {ring: 3, type: 'sparkle'}] },
  );

  // Yakınlık: her halkanın en yakın komşusuna uzaklığı / iki yarıçapın toplamı, ortalaması.
  // Küçük değer sıkışık (0,60 civarı: halkalar üst üste), büyük değer ferah (0,77 civarı).
  function closeness(def) {
    const R = def.rings.filter(r => !r.type);
    let sum = 0;
    for (const a of R) {
      let m = Infinity;
      for (const b of R) if (a !== b) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y) / (a.r + b.r));
      sum += m;
    }
    return sum / R.length;
  }

  // Zorluk puanı: hamle puanı + yakınlık katkısı. Sıkışık halkalar zorlaştırır, ferah halkalar
  // kolaylaştırır; katkı en çok ±1 (bir hamle kadar), yani hamle sayısı ağır basar.
  const NEAR_MID = 0.69;
  const NEAR_EASY = 0.76, NEAR_HARD = 0.61; // kapının ilk / son normal bölümünde istenen yakınlık
  function difficultyScore(def) {
    return parScore(def) + Math.max(-1, Math.min(1, 8 * (NEAR_MID - closeness(def))));
  }

  // Hamle puanı: en az hamle esas; parça, eş, kilit, çubuk ve çift boşluk ek yük getirir.
  // Yeni mekanikler (ters/hızlı dişli, tıklı halka, kilit, çerçeve) daha çok düşündürür.
  // Üreticiler hedefi bununla tutturur (kapı içindeki hamle eğrisi), yakınlığı ayrıca seçer.
  function parScore(def) {
    const n = t => def.rings.filter(t).length;
    const ratios = (def.couples || []).map(c => (c[2] == null ? 1 : c[2]));
    return def.par + 0.15 * def.rings.length + 0.3 * (def.couples || []).length +
      0.3 * n(r => r.fixed) + 0.3 * n(r => r.type === 'bar') + 0.2 * n(r => r.gaps && r.gaps.length > 1) +
      0.4 * ratios.filter(r => r === -1).length + 0.5 * ratios.filter(r => Math.abs(r) !== 1).length +
      0.4 * n(r => r.step) + 0.5 * n(r => r.lockedBy != null) + 0.4 * n(r => r.type === 'frame') +
      // 2.4 parçaları: hamleyi az değiştirse de sırayı ve zamanlamayı önceden düşünmeyi gerektirir
      // (Y9'da ölçüldü: daha küçük ağırlıklarla 10 hamlelik bölüm bile kapı zirvelerine ulaşamıyordu)
      0.8 * n(r => r.kick) + // yay hamleyi kısaltır ama zinciri önceden görmek düşündürür
      1.0 * n(r => r.tokens != null) + 0.3 * n(r => r.token != null) +
      (def.switch != null ? 1.0 + 0.15 * n(r => r.side != null) : 0) + 1.0 * n(r => r.pulse != null) +
      (def.table ? 1.5 : 0) +
      // 2.5: bomba hamleyi çok kısaltır; düşündüren, hangi halkanın önce gitmesi gerektiğini görmek
      1.0 * n(r => r.bomb) +
      // buz sırayı dayatır: hangi komşu önce gitmeli (kat başına)
      0.6 * def.rings.reduce((s, r) => s + (r.ice || 0), 0);
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
        step: r.step, lockedBy: r.lockedBy,
      }));
      // Şekillerin çubukları kafes düzeninde (paralel, şekil genişliğinde)
      const bars = spec.bars ? placeBars(rnd, rings, spec.bars, plan.cage !== false) : [];
      if (!bars) continue;
      const def = { name: spec.name, couples: spec.couples || [], deco: spec.deco, rings: rings.concat(bars) };
      const L = Logic.buildLevel(def);
      if (!connected(L) || !noRingFreeAtStart(L)) continue;
      const quick = Logic.solveFast(L, L.startAngles, 0, 20000);
      if (!quick) continue;
      def.par = quick.moves;
      if (parScore(def) < spec.target - 1.2) continue; // üst sınır bile hedefin çok altında
      const exact = Logic.solve(L, L.startAngles, 0, 150000);
      if (exact) def.par = exact.moves;
      if (def.par > (plan.maxPar || MAX_PAR)) continue;
      // İpucu (hızlı arama) bu bölümü çözebilmeli
      if (exact && !Logic.solveFast(L, L.startAngles, 0, 40000, 0.8)) continue;
      const err = Math.abs(parScore(def) - spec.target);
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
  // Tıklı halka tanıtımı (1003): üstteki halka 45°'lik adımlarla döner. Serbest dönseydi 1 hamle
  // yeterdi; tık kuralıyla boşluk o kesişime tam oturmaz, oyuncu başka yol bulur (2 hamle).
  const CROSSED = [{ x: 145, y: 280, r: 66 }, { x: 200, y: 375, r: 60 }, { x: 255, y: 280, r: 66 }, { x: 200, y: 185, r: 60 }];
  const MECH_LEVELS = {
    1001: { title: 'Ters dişli', world: 'atolye', tip: 'Ters dişli: biri sağa dönerse eşi sola döner',
      rings: CROSSED.map((r, i) => ({ ...r, a: [150, 240, 330, 210][i] })), couples: [[0, 2, -1]] },
    1002: { title: 'Hızlı dişli', world: 'fabrika', tip: '×2 yazan halka, eşinin iki katı döner',
      rings: CROSSED.map((r, i) => ({ ...r, a: [180, 120, 30, 270][i] })), couples: [[0, 2, 2]] },
    // Kilit-anahtar tanıtımı (1004): soldaki halka kilitli, anahtarı alttaki halkada.
    // Kilit olmasa 2 hamle; kilitle önce anahtar kurtarılır, sonra kilitli halka döner (3 hamle).
    1004: { title: 'Kilit ve anahtar', world: 'zindan', tip: 'Kilitli halka, anahtarlı halka kurtulunca açılır',
      rings: CROSSED.map((r, i) => ({ ...r, a: [120, 315, 90, 60][i], lockedBy: i === 0 ? 1 : undefined })) },
    // Çerçeve tanıtımı (1005): dikdörtgen çerçeve, sol, üst ve sağ kenarını kesen üç halka.
    // Çerçeve olmasa 2 hamle; çerçeve hiç çıkmadığı için her halka ondan da kurtulmalı (3 hamle).
    1005: { title: 'Çerçeve', world: 'sehir', tip: 'Çerçeve yerinden oynamaz: halkaları etrafından kurtar',
      rings: [{ x: 110, y: 270, r: 66, a: 105 }, { x: 200, y: 190, r: 64, a: 345 }, { x: 290, y: 280, r: 66, a: 105 },
        { type: 'frame', points: [[110, 190], [290, 190], [290, 370], [110, 370]] }] },
    1003: { title: 'Tıklı halka', world: 'saat', tip: 'Tıklı halkanın boşluğu yalnızca noktalarda durur',
      rings: [{ x: 200, y: 215, r: 70, a: 255, step: 45 }, { x: 140, y: 320, r: 64, a: 135 }, { x: 260, y: 320, r: 64, a: 195 }] },
    // Yaylı halka tanıtımı (1006, 2.4): üstteki yaylı halka kurtulunca büyük halkayı çeyrek tur iter,
    // büyük halkanın boşluğu alttakiyle kesişime gelir ve ikisi birlikte kurtulur. Yaysız 2 hamle, yayla 1.
    1006: { title: 'Yaylı halka', world: 'lunapark', tip: 'Yaylı halka kurtulunca değdiği halkayı yay yönünde çeyrek tur iter',
      rings: [{ x: 200, y: 290, r: 74, a: 282.8 }, { x: 103, y: 338, r: 69, a: 45 }, { x: 127, y: 239, r: 71, a: 0, kick: [0, -90] }] },
    // Jetonlu halka tanıtımı (1007, 2.4): üstteki halkanın jetonu yok, dönmez. Sol alttaki halka kurtulunca
    // jetonu ona uçar, üstteki bir kez döner ve kalanlar kurtulur. Jeton kuralı olmasa 1 hamle, kuralla 2.
    1007: { title: 'Jetonlu halka', world: 'lunapark', tip: 'Jetonlu halka jetonsuz dönmez. Jeton taşıyan halkayı kurtar, jetonu ona uçar',
      rings: [{ x: 200, y: 215, r: 70, a: 165, tokens: 0 }, { x: 140, y: 320, r: 64, a: 60, token: 0 }, { x: 260, y: 320, r: 64, a: 195 }] },
    // Şalter tanıtımı (1008, 2.4): şalter başta mavide, yalnızca sağdaki mavi halka döner. Önce onu çevir,
    // sonra şalteri turuncuya al ve üstteki turuncu halkayı çevir. Şalter olmasa 2 hamle, şalterle 3.
    1008: { title: 'Şalter', world: 'santral', tip: 'Şalter hangi rengi gösteriyorsa o renkteki halkalar döner. Şaltere dokunmak bir hamle',
      switch: 0, rings: CROSSED.map((r, i) => ({ ...r, a: [75, 180, 345, 315][i], side: [1, 1, 0, 1][i] })) },
    // Nabız halka tanıtımı (1009, 2.4): üstteki halkanın kapağı başta açık. Halkayı doğru yere çevirmek bir hamle
    // olduğu için kapak kapanır ve hiçbir şey olmaz; bir hamle daha yapınca kapak açılır, hepsi kurtulur.
    // Nabız olmasa 1 hamle, nabızla 2 (ritmi yakalamak).
    1009: { title: 'Nabız halka', world: 'fener', tip: 'Nabız halkanın kapağı her hamlede açılıp kapanır. Kapak açıkken boşluk işe yarar',
      rings: [{ x: 200, y: 215, r: 70, a: 195, pulse: 0 }, { x: 140, y: 320, r: 64, a: 15 }, { x: 260, y: 320, r: 64, a: 180 }] },
    // Döner tabla tanıtımı (1010, 2.4): tabla iki halka taşır. Önce sağdaki halkayı çevir, sonra tablayı çevir:
    // taşınan halkalar yer değiştirir ve kalanlar kurtulur. Tabla olmasa 3 hamle, tablayla 2 (prototipin "İlk tur"u).
    1010: { title: 'Döner tabla', world: 'rasathane', tip: 'Göbekteki düğmeye dokun: tabla çeyrek tur döner, üstündeki halkalar yer değiştirir. Bu bir hamle',
      rings: [{ x: 159, y: 321, r: 52, a: 270 }, { x: 241, y: 239, r: 52, a: 120 }, { x: 328, y: 280, r: 56, a: 90 }, { x: 105, y: 375, r: 64, a: 30 }, { x: 295, y: 185, r: 60, a: 270 }],
      table: { x: 200, y: 280, r: 112, step: 90, carried: [0, 1] } },
    // Bomba halka tanıtımı (1011, 2.5): üstteki halka bomba. Onu kurtarınca patlar, alttaki iki halka
    // birbirine kilitli olsa da patlamayla uçar. Bomba olmasa 2 hamle, bombayla 1 (prototipin "İlk bomba"sı).
    1011: { title: 'Bomba halka', world: 'fisek', tip: 'Bomba halka kurtulunca patlar. Turuncu yıldızların olduğu yerde değdiği halkalar da uçar',
      rings: [{ x: 200, y: 215, r: 70, a: 255, bomb: true }, { x: 140, y: 320, r: 64, a: 210 }, { x: 260, y: 320, r: 64, a: 105 }] },
    // Buz halka tanıtımı (1012, 2.5): üstteki halka donmuş. Alttakilerden biri kurtulunca buzu kırılır ve döner.
    // Buz olmasa 1 hamle, buzla 2 (prototipin "İlk buz"u).
    1012: { title: 'Buz halka', world: 'buzul', tip: 'Buz halka donmuştur, dönmez. Değdiği bir halka kurtulunca buzu bir kat çatlar, eriyince döner',
      rings: [{ x: 200, y: 215, r: 70, a: 165, ice: 1 }, { x: 140, y: 320, r: 64, a: 225 }, { x: 260, y: 320, r: 64, a: 165 }] },
  };
  // Bir bölümün mekaniksiz hali: eş oranları 1, tıklar yok (tanıtımın kuralı gerektirdiğini sınamak için)
  // (çerçeveler en sonda tanımlanır ki çıkarılınca halka numaraları değişmesin)
  const plainVersion = def => ({
    ...def,
    switch: undefined,
    table: undefined,
    rings: def.rings.filter(r => r.type !== 'frame').map(r => ({ ...r, step: undefined, lockedBy: undefined, kick: undefined, tokens: undefined, token: undefined, side: undefined, pulse: undefined, bomb: undefined, ice: undefined })),
    couples: (def.couples || []).map(([a, b]) => [a, b]),
  });

  // Bir mekanik (kilit 5, eş 7, çift boşluk 8, çubuk 9, ters dişli 1001, hızlı dişli 1002,
  // tıklı halka 1003, kilit-anahtar 1004, çerçeve 1005, yaylı halka 1006, jetonlu halka 1007) tanıtılmadan
  // onu kullanan bölüm gelemez.
  const INTRO = { fixed: 5, couple: 7, double: 8, bar: 9, reverse: 1001, fast: 1002, click: 1003, key: 1004, frame: 1005, kick: 1006, token: 1007,
    switch: 1008, pulse: 1009, table: 1010, bomb: 1011, ice: 1012 };
  function features(def) {
    const f = [];
    const ratios = (def.couples || []).map(c => (c[2] == null ? 1 : c[2]));
    if (def.rings.some(r => r.fixed)) f.push('fixed');
    if (ratios.includes(1)) f.push('couple');
    if (ratios.includes(-1)) f.push('reverse');
    if (ratios.some(r => Math.abs(r) === 2 || Math.abs(r) === 0.5)) f.push('fast');
    if (def.rings.some(r => r.step)) f.push('click');
    if (def.rings.some(r => r.lockedBy != null)) f.push('key');
    if (def.rings.some(r => r.type === 'frame')) f.push('frame');
    if (def.rings.some(r => r.kick)) f.push('kick');
    if (def.rings.some(r => r.tokens != null)) f.push('token');
    if (def.switch != null) f.push('switch');
    if (def.rings.some(r => r.pulse != null)) f.push('pulse');
    if (def.table) f.push('table');
    if (def.rings.some(r => r.bomb)) f.push('bomb');
    if (def.rings.some(r => r.ice)) f.push('ice');
    if (def.rings.some(r => r.gaps && r.gaps.length > 1)) f.push('double');
    if (def.rings.some(r => r.type === 'bar')) f.push('bar');
    return f;
  }

  // Oyuncunun gördüğü sıra: 10'ar bölümlük kapılar.
  // - Her kapının 10. bölümü bir şekil finalidir; bazı kapılarda 5. bölüm de ara şekildir (SHAPE_PLAN).
  // - Kapının içinde zorluk artar; yeni kapı bir öncekinin zirvesinin biraz altından başlar
  //   (testere dişi). Hangi bölümün hangi kapıda olduğu LAYOUT'ta sabittir, kapı içi sıra gateOrder'da.
  const GATE_LEN = 10;
  const MID_POS = 4;    // ara şeklin kapı içindeki yeri (0'dan sayılır)

  // ---- Kapı 7-20: dünyaların yeni bölümleri (Görev 13) ----
  // Kapı 1-6 eskisi gibi kalır; yalnızca 6. kapıya ara şekil (Kaplumbağa) girer ve o kapının en zor
  // normal bölümü MOVED_GATE'e taşınır. Kapı 7-20'de her kapı: (dünyanın ilk kapısıysa) tanıtım,
  // normal bölümler, 5. sırada ara şekil, sonda final. Normal bölümler 90'dan başlayan kaynak
  // numaralarıyla kendi kapılarının dünyasına göre üretilir (NORMAL_PLAN: kapı ve hedef zorluk).
  const OLD_GATES = 6;
  const LAST_GATE = 30; // 2.4: kapı 21-30 (Lunapark, Santral, Deniz Feneri, Rasathane)
  const NEW_FIRST = 90;
  const MOVED_GATE = 12;
  // Kapının başındaki tanıtım (dünyanın başı ya da dünyanın ikinci parçası: 22. kapıda jetonlu halka)
  const WORLD_INTRO = { 7: 1001, 9: 1003, 11: 1004, 13: 1005, 15: 1002, 21: 1006, 22: 1007, 24: 1008, 26: 1009, 29: 1010, 31: 1011, 34: 1012 };
  // Hedefler zorluk puanıyla (hamle + yakınlık). Kapının en zor normal bölümü (zirve) her kapıda bir
  // öncekinden yüksektir: zirve bölümü [kendi hedefi, sonraki kapının hedefi) aralığında seçilir.
  // 6. kapının zirvesi 12,5. En iyi çözüm sınırı kapı 7-11'de 8, 12-16'da 9, 17-20'de 10.
  // 2.4 (kullanıcı kararı): kapı 21-30'da zorluk artmaz, kapı 20'de ulaşılan düzeyde sabit kalır. Her kapı
  // kapı 20 gibi önceki zirvenin 2,5 altından başlar ve aynı zirveye (15,7) çıkar (kapı içi testere dişi korunur).
  const GATE_PEAK = { 7: 12.6, 8: 12.75, 9: 12.9, 10: 13.05, 11: 13.2, 12: 13.5, 13: 13.75, 14: 14.0,
    15: 14.25, 16: 14.5, 17: 14.8, 18: 15.1, 19: 15.4, 20: 15.7,
    21: 15.7, 22: 15.7, 23: 15.7, 24: 15.7, 25: 15.7, 26: 15.7, 27: 15.7, 28: 15.7, 29: 15.7, 30: 15.7 };
  const PLATEAU = 21; // bu kapıdan sonra zirveler artmaz (check_levels de buna göre denetler)
  const OLD_PEAK = 12.5; // 6. kapının zirvesi
  const GATE_DROP = 2.5; // yeni kapının ilk normal bölümü önceki zirvenin bu kadar altından başlar
  const maxParOfGate = g => (g >= 17 ? 10 : g >= 12 ? 9 : MAX_PAR);
  const shapeOf = (g, role) => Number(Object.keys(SHAPE_PLAN).find(k => SHAPE_PLAN[k].gate === g && SHAPE_PLAN[k].role === role));

  // Yeni normal bölümlerin planı: kaynak -> { gate, target, peak, top, near }. Kapı içinde hedef,
  // başlangıçtan zirveye doğrusal artar; başlangıç önceki zirveyle birlikte yükselir (testere dişi),
  // böylece kapının ortalaması da her kapıda artar. near: istenen yakınlık (baş ferah, son sıkışık).
  const NORMAL_PLAN = {};
  (function () {
    let src = NEW_FIRST, prevPeak = OLD_PEAK;
    for (let g = OLD_GATES + 1; g <= LAST_GATE; g++) {
      const slots = GATE_LEN - 2 - (WORLD_INTRO[g] ? 1 : 0) - (g === MOVED_GATE ? 1 : 0);
      const start = prevPeak - GATE_DROP;
      const peak = GATE_PEAK[g];
      for (let j = 0; j < slots; j++) {
        const f = j / (slots - 1);
        NORMAL_PLAN[src++] = { gate: g, target: Math.round((start + (peak - start) * f) * 100) / 100, peak: j === slots - 1,
          top: GATE_PEAK[g + 1] > peak ? GATE_PEAK[g + 1] : peak + 0.4, near: NEAR_EASY + (NEAR_HARD - NEAR_EASY) * f };
      }
      prevPeak = peak;
    }
  })();
  const NEW_LAST = NEW_FIRST + Object.keys(NORMAL_PLAN).length - 1;

  // Kapıların bölümleri (kaynak numaraları), 2.1 sürümündeki sırayla. Oyuncu kaydı bu sıradan
  // yeni sıraya taşınır (save.js relayout); değiştirmeyin, yeni kapılar sona eklenir.
  const LAYOUT = [
    1, 2, 4, 5, 9, 7, 8, 11, 13, 52,
    3, 10, 12, 14, 51, 6, 15, 21, 19, 53,
    17, 16, 18, 20, 58, 23, 24, 27, 26, 55,
    22, 29, 33, 31, 54, 25, 32, 35, 41, 57,
    28, 39, 45, 47, 56, 38, 42, 50, 37, 59,
    48, 34, 49, 43, 61, 30, 36, 44, 46, 60,
    1001, 90, 91, 92, 62, 93, 94, 95, 96, 63,
    97, 98, 99, 100, 64, 101, 102, 103, 104, 65,
    1003, 105, 106, 107, 67, 108, 109, 110, 111, 66,
    112, 114, 113, 115, 68, 116, 118, 117, 119, 69,
    1004, 120, 121, 122, 70, 123, 124, 125, 126, 71,
    127, 128, 129, 130, 72, 131, 132, 40, 133, 73,
    1005, 134, 135, 136, 74, 137, 138, 139, 140, 75,
    141, 142, 143, 144, 76, 145, 146, 147, 148, 77,
    1002, 149, 150, 151, 78, 152, 153, 154, 155, 79,
    156, 157, 158, 159, 80, 160, 161, 162, 163, 81,
    164, 165, 166, 167, 82, 168, 169, 170, 171, 83,
    172, 173, 174, 175, 84, 176, 177, 178, 179, 85,
    180, 181, 182, 183, 86, 184, 185, 186, 187, 87,
    188, 189, 190, 191, 88, 192, 193, 194, 195, 89,
  ];
  // 2.4: kapı 21-30 sona eklenir: (tanıtım) + normal bölümler + ara şekil + final
  for (let g = 21; g <= LAST_GATE; g++) {
    const normals = Object.keys(NORMAL_PLAN).map(Number).filter(s => NORMAL_PLAN[s].gate === g);
    LAYOUT.push(...(WORLD_INTRO[g] ? [WORLD_INTRO[g]] : []), ...normals.slice(0, 4), shapeOf(g, 'mid'), ...normals.slice(4), shapeOf(g, 'final'));
  }
  // Kapının normal bölümleri (şekiller ve dünya tanıtımı hariç), LAYOUT'taki sırayla
  const gateNormals = g => LAYOUT.slice((g - 1) * GATE_LEN, g * GATE_LEN)
    .filter(s => !SHAPE_PLAN[s] && s !== WORLD_INTRO[g]);
  const gateOfLayout = src => Math.floor(LAYOUT.indexOf(src) / GATE_LEN) + 1;

  // Kapı 1-6'nın üretilmiş bölümlerinin en az hamlesi (2.1'deki hâli); yeniden üretimde korunur
  const KEEP_PAR = { 11: 3, 12: 3, 13: 3, 14: 3, 15: 4, 16: 4, 17: 4, 18: 5, 19: 4, 20: 5, 21: 4, 22: 5,
    23: 5, 24: 5, 25: 7, 26: 6, 27: 6, 28: 6, 29: 6, 30: 8, 31: 6, 32: 6, 33: 6, 34: 7, 35: 7, 36: 8, 37: 7,
    38: 7, 39: 7, 40: 8, 41: 7, 42: 7, 43: 7, 44: 8, 45: 7, 46: 8, 47: 7, 48: 7, 49: 7, 50: 7 };

  // İstenen yakınlık: kapının ilk normal bölümünde ferah, sonuncusunda sıkışık (NEAR_EASY/HARD)
  function nearOf(src) {
    const list = gateNormals(gateOfLayout(src));
    const k = list.indexOf(src);
    return NEAR_EASY + (NEAR_HARD - NEAR_EASY) * k / Math.max(1, list.length - 1);
  }

  // Bir kaynağın kapısı (bilinmiyorsa null): en iyi çözüm sınırı ve hamle hakkı buna göre
  function gateOfSource(src) {
    if (NORMAL_PLAN[src]) return NORMAL_PLAN[src].gate;
    if (SHAPE_PLAN[src]) return SHAPE_PLAN[src].gate;
    const intro = Object.keys(WORLD_INTRO).find(g => WORLD_INTRO[g] === src);
    return intro ? Number(intro) : null;
  }
  const maxParOf = src => maxParOfGate(gateOfSource(src) || 1);

  // Kapalı çerçeve yerleştirir (dikdörtgen ya da üçgen): her kenar halkaları ya temiz keser ya hiç
  // dokunmaz, köşeler halkaların dışında kalır, kenarlar halka-halka kesişimlerinden uzak durur.
  function placeFrame(rnd, rings) {
    const ringPts = [];
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const pts = Logic.circleIntersections(rings[i], rings[j]);
        if (pts) ringPts.push(...pts);
      }
    }
    const b = bounds(rings);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    for (let tries = 0; tries < 400; tries++) {
      let pts;
      const jx = (rnd() - 0.5) * 60, jy = (rnd() - 0.5) * 60;
      if (rnd() < 0.65) {
        const w = (b.x1 - b.x0) * (0.45 + rnd() * 0.5), h = (b.y1 - b.y0) * (0.45 + rnd() * 0.5);
        pts = [[cx + jx - w / 2, cy + jy - h / 2], [cx + jx + w / 2, cy + jy - h / 2], [cx + jx + w / 2, cy + jy + h / 2], [cx + jx - w / 2, cy + jy + h / 2]];
      } else {
        const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) * (0.35 + rnd() * 0.35), a0 = rnd() * Math.PI * 2;
        pts = [0, 1, 2].map(k => [cx + jx + Math.cos(a0 + k * 2.094) * R, cy + jy + Math.sin(a0 + k * 2.094) * R]);
      }
      pts = pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      if (pts.some(([x, y]) => x < 14 || x > BOARD.w - 14 || y < 14 || y > BOARD.h - 14)) continue;
      let ok = true, crossings = 0;
      for (let k = 0; k < pts.length && ok; k++) {
        const q2 = pts[(k + 1) % pts.length];
        const seg = { x1: pts[k][0], y1: pts[k][1], x2: q2[0], y2: q2[1] };
        if (Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) < 60) { ok = false; break; }
        for (const c of rings) {
          const rel = barVsRing(seg, c);
          if (rel === 'bad') { ok = false; break; }
          if (rel === 'cross') crossings++;
        }
        if (ok && ringPts.some(q => segDist(q.x, q.y, seg) < 18)) ok = false;
      }
      if (ok && crossings >= 2) return { type: 'frame', points: pts };
    }
    return null;
  }

  // Çubuk çerçevenin herhangi bir kenarını kesiyor mu?
  function crossesFrame(bar, frame) {
    const P = frame.points;
    const side = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    return P.some((q, k) => {
      const q2 = P[(k + 1) % P.length];
      return side(bar.x1, bar.y1, bar.x2, bar.y2, q[0], q[1]) !== side(bar.x1, bar.y1, bar.x2, bar.y2, q2[0], q2[1]) &&
        side(q[0], q[1], q2[0], q2[1], bar.x1, bar.y1) !== side(q[0], q[1], q2[0], q2[1], bar.x2, bar.y2);
    });
  }

  // Dünyaya göre mekanikler: Atölye ters dişli, Saat Kulesi tıklı halka, Zindan kilit,
  // Şehir çerçeve, Fabrika hızlı dişli; Uzay ve Büyük Usta hepsini karıştırır.
  const WORLD_MECH = { 7: ['reverse'], 8: ['reverse'], 9: ['click'], 10: ['click'], 11: ['key'], 12: ['key'],
    13: ['frame'], 14: ['frame'], 15: ['fast'], 16: ['fast'],
    // 2.4: Lunapark yay ve jeton, Santral şalter, Deniz Feneri nabız, Rasathane döner tabla
    21: ['kick'], 22: ['token'], 23: ['kick', 'token'], 24: ['switch'], 25: ['switch'], 26: ['pulse'], 27: ['pulse'], 28: ['pulse'],
    29: ['table'], 30: ['table'] };
  // Kapı 21-30'da dünyanın kendi parçasına yarı yarıya daha önce tanıtılmış bir parça eşlik eder
  const NEW_MECH_GATE = { kick: 21, token: 22, switch: 24, pulse: 26, table: 29 };
  function mechanicsFor(gate, rnd) {
    if (gate >= 21) {
      const own = WORLD_MECH[gate].slice();
      if (rnd() < 0.5) {
        const pool = ['reverse', 'click', 'key', 'fast', ...Object.keys(NEW_MECH_GATE).filter(m => NEW_MECH_GATE[m] < gate && m !== 'table')]
          .filter(m => !own.includes(m));
        own.push(pool[Math.floor(rnd() * pool.length)]);
      }
      return own;
    }
    if (WORLD_MECH[gate]) {
      const own = WORLD_MECH[gate].slice();
      // Dünyanın ikinci kapısında arada önceki dünyaların mekaniklerinden biri de gelir
      if (gate % 2 === 0 && rnd() < 0.45) own.push(['reverse', 'click', 'key'][Math.floor(rnd() * Math.min(3, (gate - 6) / 2))]);
      return own;
    }
    const all = ['reverse', 'click', 'key', 'frame', 'fast'];
    const n = gate >= 19 ? 2 + (rnd() < 0.4 ? 1 : 0) : 2;
    const out = [];
    while (out.length < n) { const m = all[Math.floor(rnd() * all.length)]; if (!out.includes(m)) out.push(m); }
    return out;
  }

  // Yeni normal bölüm: kapısının dünyasına göre mekanikli. Hamle puanı hedefe en yakın aday seçilir;
  // halkaların yakınlığı bölümün kapıdaki yerinden gelir (nearOf), band içinde kalmayan aday elenir.
  // first/count: denenecek aday aralığı (aynı bölüm için aralıklar paralel işlere bölünebilir)
  function generateFor(levelNo, first = 0, count = NORMAL_PLAN[levelNo] && NORMAL_PLAN[levelNo].peak ? 3000 : 2000, band = 0.03) {
    const plan = NORMAL_PLAN[levelNo];
    if (!plan) return null;
    const maxPar = maxParOfGate(plan.gate);
    const near = plan.near;
    let best = null, bestErr = Infinity;
    // 2.4 (kapı 21+): süre sınırı (normal 3, zirve 6 dk) dolunca o ana kadarki en iyi bölüm alınır;
    // hedefe uzaklık eşiği 0,3 (parçalar arama uzayını büyüttü, 2000 adayın hepsi saatler sürüyordu)
    // Hiç aday bulunamasa da en çok 10 dakika aranır (bir zirve bölümü gece 8 saat takılı kaldı)
    const late = plan.gate >= 21, deadline = Date.now() + (plan.peak ? 360000 : 180000), hardStop = Date.now() + 600000;
    for (let attempt = first; attempt < first + count && bestErr > (plan.peak ? 0 : late ? 0.3 : 0.15); attempt++) {
      if (late && best && Date.now() > deadline) break;
      if (late && Date.now() > hardStop) break;
      const rnd = mulberry32(levelNo * 7919 + attempt * 104729 + 77);
      const mech = mechanicsFor(plan.gate, rnd);
      // Çerçeve çok halkalı zor yerleşimlerde kenarlarına yer bulamayabilir: uzun süre olmazsa
      // o bölümde çerçeve yerine önceki dünyaların mekaniklerinden biri kullanılır
      if (attempt >= 250 && mech.includes('frame')) mech.splice(mech.indexOf('frame'), 1, ['reverse', 'click', 'key'][attempt % 3]);
      // Zirve bölümü tek mekanikle yeterince zorlaşamayabilir: yarı yarıya önceki dünyalardan bir mekanik eklenir
      if (plan.peak && WORLD_MECH[plan.gate] && rnd() < 0.5) {
        const extra = ['reverse', 'click', 'key'][Math.floor(rnd() * 3)];
        if (!mech.includes(extra)) mech.push(extra);
      }
      const t = plan.target;
      const tp = t - Math.max(-1, Math.min(1, 8 * (NEAR_MID - near))); // hedefin hamle puanı karşılığı
      const count = tp < 9 ? 6 : tp < 10.5 ? 7 : tp < 12 ? 8 : 9;
      const pos = placeRings(rnd, count, near);
      if (!pos) continue;
      if (Math.abs(closeness({ rings: pos }) - near) > band) continue;
      const idx = pos.map((_, i) => i).sort(() => rnd() - 0.5);
      const take = () => idx.shift();
      const rings = pos.map(c => ({ x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, r: Math.round(c.r), a: Math.round(rnd() * 360) }));
      const couples = [];
      const pair = ratio => { if (idx.length >= 2) couples.push([take(), take(), ratio]); };
      if (mech.includes('reverse')) { pair(-1); if (t > 10 && rnd() < 0.5) pair(-1); }
      if (mech.includes('fast')) pair(rnd() < 0.5 ? 2 : -2);
      if (rnd() < 0.35) pair(1);
      if (mech.includes('click') && idx.length) {
        rings[take()].step = [30, 45, 60, 90][Math.floor(rnd() * 4)];
        if (t > 10.5 && idx.length && rnd() < 0.5) rings[take()].step = [45, 60][Math.floor(rnd() * 2)];
      }
      if (mech.includes('key') && idx.length) {
        const lock = take();
        let key = Math.floor(rnd() * rings.length);
        if (key === lock) key = (key + 1) % rings.length;
        rings[lock].lockedBy = key;
      }
      // Yaylı halka: bir halka kesiştiği bir halkayı tekmeler (hedef kilitsiz ve sabit olmayan bir halka)
      const crossing = (i, j) => { const A = rings[i], B = rings[j], d = Math.hypot(A.x - B.x, A.y - B.y); return i !== j && d < A.r + B.r && d > Math.abs(A.r - B.r); };
      if (mech.includes('kick')) {
        for (let n = t > 12.5 && rnd() < 0.5 ? 2 : 1; n > 0 && idx.length >= 2; n--) {
          const s = take();
          const ti = idx.findIndex(j => crossing(s, j));
          if (ti < 0) continue;
          const tg = idx.splice(ti, 1)[0];
          rings[s].kick = [tg, rnd() < 0.5 ? 90 : -90];
        }
      }
      // Jetonlu halka: jetonu yok (ya da 1), bir iki halka ona jeton taşır
      if (mech.includes('token') && idx.length >= 2) {
        const tr = take();
        rings[tr].tokens = rnd() < 0.3 ? 1 : 0;
        const others = rings.map((_, i) => i).filter(i => i !== tr).sort(() => rnd() - 0.5);
        for (const c of others.slice(0, rnd() < 0.5 ? 1 : 2)) rings[c].token = tr;
      }
      if (idx.length && rnd() < 0.3) rings[take()].fixed = true;
      for (const i of idx) if (rnd() < 0.12) rings[i].gaps = [0, 180];
      for (const c of couples) if (c[2] === 1) c.length = 2;
      // Nabız: bir iki halkanın boşluk kapağı her hamlede açılıp kapanır
      if (mech.includes('pulse')) {
        const cand = rings.map((_, i) => i).filter(i => !rings[i].fixed).sort(() => rnd() - 0.5);
        for (const i of cand.slice(0, t > 12.5 && rnd() < 0.5 ? 2 : 1)) rings[i].pulse = rnd() < 0.5 ? 0 : 1;
      }
      // Şalter: dönebilen halkaların çoğu mavi ya da turuncu; eşler aynı renkte
      let sw = null;
      if (mech.includes('switch')) {
        const side = rings.map(() => null);
        for (const c of couples) { const v = rnd() < 0.5 ? 0 : 1; side[c[0]] = v; side[c[1]] = v; }
        rings.forEach((r, i) => { if (side[i] == null && !r.fixed && rnd() < 0.8) side[i] = rnd() < 0.5 ? 0 : 1; });
        if (!side.includes(0) || !side.includes(1)) continue;
        side.forEach((v, i) => { if (v != null && !rings[i].fixed) rings[i].side = v; });
        sw = 0;
      }
      // Döner tabla: birbirini kesen iki halkanın tam ortasına kurulur ve ikisini taşır (prototipteki gibi).
      // 180°'de iki halka yer değiştirir, 90° ve 270°'de aynı dik konuma gelir: denetlenecek düzen azdır.
      let table = null;
      if (mech.includes('table')) {
        const pairs = [];
        for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) {
          if (rings[i].fixed || rings[j].fixed || !crossing(i, j) || Math.abs(rings[i].r - rings[j].r) > 10) continue;
          pairs.push([i, j]);
        }
        // Çiftler karışık sırayla denenir; tablanın her konumunda düzeni temiz kalan ilk çift seçilir
        for (const [i, j] of pairs.sort(() => rnd() - 0.5)) {
          const A = rings[i], B = rings[j], d = Math.hypot(A.x - B.x, A.y - B.y);
          const tb = { x: Math.round((A.x + B.x) / 2 * 10) / 10, y: Math.round((A.y + B.y) / 2 * 10) / 10, r: Math.round(d / 2 + Math.max(A.r, B.r) * 0.95), step: 90, carried: [i, j] };
          if (tableFits({ rings, table: tb })) { table = tb; break; }
        }
        if (!table) continue;
      }
      let extra = [];
      if (mech.includes('frame')) {
        const f = placeFrame(rnd, rings);
        if (!f) continue;
        extra = [f];
        // Zor çerçeveli bölümlerde bir çubuk da olabilir; çerçevenin kenarlarını kesmemeli
        if (t > 10.5 && rnd() < 0.6) {
          const bars = placeBars(rnd, rings, 1);
          if (bars && !crossesFrame(bars[0], f)) extra.push(bars[0]);
        }
      } else if (rnd() < 0.45) {
        const bars = placeBars(rnd, rings, rnd() < 0.7 ? 1 : 2);
        if (bars) extra = bars;
      }
      const def = { rings: rings.concat(extra), couples };
      if (sw != null) def.switch = sw;
      if (table) def.table = table;
      let L;
      try { L = Logic.buildLevel(def); } catch (e) { continue; }
      if (!connected(L)) continue;
      if (table && !tableFits(def)) continue;
      for (let re = 0; re < 20 && !noRingFreeAtStart(L); re++) {
        for (const r of def.rings) if (!r.type) r.a = Math.round(rnd() * 360);
        L = Logic.buildLevel(def);
      }
      if (!noRingFreeAtStart(L)) continue;
      const quick = Logic.solveFast(L, L.startAngles, 0, 20000);
      if (!quick || quick.moves < 3) continue;
      // Kapısına kadar tanıtılmamış mekanik olamaz (tanıtım kuralı bölümü başka kapıya taşırdı)
      if (features(def).some(f => gateOfLayout(INTRO[f]) > plan.gate)) continue;
      def.par = quick.moves;
      if (difficultyScore(def) < t - 1.0) continue; // en iyi çözüm bundan da kısa olabilir: zaten kolay
      // 2.4 (kapı 21+): yeni parçalar arama uzayını büyüttüğü için tam arama kısa tutulur; bulamazsa
      // titiz hızlı çözücünün (ipucunun) sonucu alınır. Sınırda vazgeçen tam aramalar sürenin %90'ını yiyordu.
      const exact = plan.gate >= 21 ? Logic.solve(L, L.startAngles, 0, 12000) : Logic.solve(L, L.startAngles, 0, count >= 9 ? 60000 : 150000);
      const careful = !exact && plan.gate >= 21 ? Logic.solveFast(L, L.startAngles, 0, 40000, 0.8) : null;
      def.par = exact ? exact.moves : careful ? Math.min(careful.moves, quick.moves) : quick.moves;
      if (def.par > maxPar || def.par < 3) continue;
      if (!Logic.solveFast(L, L.startAngles, 0, 40000, 0.8)) continue; // ipucu çözebilmeli
      // Dünyanın kendi parçası bu bölümde gerçekten işe yaramalı: o parça olmadan en iyi çözüm değişmeli
      if (plan.gate >= 21 && !mattersAll(def, WORLD_MECH[plan.gate].filter(m => features(def).includes(m)))) continue;
      const sc = difficultyScore(def);
      // Zirve: bu kapının hedefi ile sonraki kapının hedefi arasında (zirveler kesin artar)
      // Kapı 21+ zorluk sabit (kapı 20 düzeyi): zirve 0,4 aşağıya kadar kabul (check_levels ±0,5 izin verir)
      if (plan.peak && (sc < t - (late ? 0.4 : 0) || sc >= plan.top)) continue;
      const err = plan.peak ? 0 : Math.abs(sc - t);
      if (err < bestErr) { best = def; bestErr = err; }
    }
    return best;
  }

  // Bir parçanın kaldırılmış hali (bölümde o parça gerçekten işe yarıyor mu sınamak için)
  function withoutFeature(def, f) {
    const out = { ...def, rings: def.rings.map(r => ({ ...r })), couples: (def.couples || []).map(c => c.slice()) };
    if (f === 'kick') out.rings.forEach(r => delete r.kick);
    if (f === 'token') out.rings.forEach(r => { delete r.tokens; delete r.token; });
    if (f === 'switch') { delete out.switch; out.rings.forEach(r => delete r.side); }
    if (f === 'pulse') out.rings.forEach(r => delete r.pulse);
    if (f === 'table') delete out.table;
    if (f === 'bomb') out.rings.forEach(r => delete r.bomb);
    if (f === 'ice') out.rings.forEach(r => delete r.ice);
    return out;
  }
  function mattersAll(def, feats) {
    for (const f of feats) {
      const P = Logic.buildLevel(withoutFeature(def, f));
      if (Logic.cascade(P, P.startAngles, 0).mask) continue; // parçasız hali baştan çözülüyorsa parça şart
      // Hızlı ve titiz arama yeter: parçasız hali aynı hamlede çözülüyorsa parça işe yaramıyor demektir
      const s = Logic.solveFast(P, P.startAngles, 0, 20000, 0.8);
      if (s && s.moves <= def.par) return false;
    }
    return true;
  }
  // Tablanın her konumunda taşınan halkalar tahtada kalmalı ve kesişimler seçilebilir olmalı. Dönmüş konumlar
  // geçici olduğundan eşik başlangıç düzeninden yumuşak: kesişim en az 14 derin, kesişmeyenler değmesin.
  function tableFits(def) {
    const T = def.table;
    for (let t = 1; t < 360 / T.step; t++) {
      const a = t * T.step * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const R = def.rings.map((r, i) => (T.carried.includes(i) ? { ...r, x: T.x + (r.x - T.x) * c - (r.y - T.y) * s, y: T.y + (r.x - T.x) * s + (r.y - T.y) * c } : r));
      for (const i of T.carried) {
        const A = R[i];
        if (A.x - A.r < 12 || A.x + A.r > BOARD.w - 12 || A.y - A.r < 12 || A.y + A.r > BOARD.h - 12) return false;
        for (let j = 0; j < R.length; j++) {
          const B = R[j];
          if (j === i || B.type) continue;
          const d = Math.hypot(A.x - B.x, A.y - B.y), crosses = d < A.r + B.r && d > Math.abs(A.r - B.r);
          if (crosses && (d > A.r + B.r - 14 || d < Math.abs(A.r - B.r) + 14)) return false;
          if (!crosses && d < A.r + B.r + 2) return false;
        }
      }
    }
    return true;
  }

  // Kapı içi sıra: kapının bölümleri LAYOUT'tan gelir; dünya tanıtımı başta, normal bölümler zorluk
  // puanına göre kolaydan zora (ferah ve kısa olandan sıkışık ve uzun olana), ara şekil 5. sırada,
  // final sonda. Bir bölüm mekaniğinin tanıtımından önce gelirse tanıtımla yer değiştirir.
  function gateOrder(get) {
    const D = new Map();
    const score = s => (D.has(s) ? D.get(s) : D.set(s, difficultyScore(get(s))).get(s));
    const order = [];
    for (let g = 1; g <= LAST_GATE; g++) {
      const intro = WORLD_INTRO[g];
      const normals = gateNormals(g).sort((a, b) => score(a) - score(b) || a - b);
      const own = intro ? [intro, ...normals] : normals;
      const mid = shapeOf(g, 'mid');
      if (mid) own.splice(MID_POS, 0, mid);
      own.push(shapeOf(g, 'final'));
      order.push(...own);
    }
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
    const b = bounds(withTable(def));
    const k = Math.min((BOARD.w - 50) / (b.x1 - b.x0), (BOARD.h - 90) / (b.y1 - b.y0), 1.5);
    if (k <= 1) return def;
    return { ...def, rings: def.rings.map(r => movePiece(r, 0, 0, k)), ...moveTable(def, 0, 0, k) };
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
    } else if (SHAPE_PLAN[levelNo]) {
      def = pre || finishAnimal(levelNo);
    } else if (NORMAL_PLAN[levelNo]) {
      def = pre || generateFor(levelNo);
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
    if (def && (SHAPE_PLAN[levelNo] || MECH_LEVELS[levelNo])) def = fitted(def);
    if (def) def = centered(def);
    cache[levelNo] = def;
    return def;
  }

  const api = {
    BOARD, HAND_LEVELS, MAIN_LEVELS, ANIMAL_LEVELS, ANIMALS, TUTORIAL, getLevel, getTutorial, generate, finishAnimal, SHAPE_PLAN,
    difficultyScore, parScore, closeness, placeRings, nearOf, LAYOUT, KEEP_PAR, gateOrder, features, INTRO, MAX_PAR, MECH_LEVELS, plainVersion,
    connected, noRingFreeAtStart, difficulty, barVsRing, placeBars,
    NORMAL_PLAN, NEW_FIRST, NEW_LAST, generateFor, placeFrame, gateOfSource, maxParOf, WORLD_INTRO, PLATEAU,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingLevels = api;
})(this);
