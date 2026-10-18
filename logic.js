// Oyun kuralları: halkalar, kesişimler, serbest kalma ve çözücü.
// Hem tarayıcıda (window.RingLogic) hem Node'da (require) çalışır.
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const GAP_HALF = 26 * DEG;   // boşluğun görünen yarı genişliği
  const COVER_HALF = 18 * DEG; // kesişim noktası boşluğun bu kadar içindeyse halka geçebilir

  const norm = a => ((a % TAU) + TAU) % TAU;
  const angDist = (a, b) => { const d = norm(a - b); return Math.min(d, TAU - d); };
  const signedDelta = (from, to) => { let d = norm(to - from); if (d > Math.PI) d -= TAU; return d; };

  function circleIntersections(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy);
    if (d >= A.r + B.r || d <= Math.abs(A.r - B.r) || d === 0) return null;
    const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
    const h = Math.sqrt(A.r * A.r - a * a);
    const mx = A.x + a * dx / d, my = A.y + a * dy / d;
    const ox = -dy * h / d, oy = dx * h / d;
    return [{ x: mx + ox, y: my + oy }, { x: mx - ox, y: my - oy }];
  }

  // Düz çubuk ile çemberin kesişimleri (yalnızca çubuğun üzerindeki noktalar)
  function segmentCircle(B, C) {
    const dx = B.x2 - B.x1, dy = B.y2 - B.y1;
    const fx = B.x1 - C.x, fy = B.y1 - C.y;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - C.r * C.r;
    const disc = b * b - 4 * a * c;
    if (disc <= 0) return null;
    const sq = Math.sqrt(disc);
    const pts = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]
      .filter(t => t >= 0 && t <= 1)
      .map(t => ({ x: B.x1 + dx * t, y: B.y1 + dy * t }));
    return pts.length ? pts : null;
  }

  function crossings(A, B) {
    if (A.kind === 'bar' && B.kind === 'bar') return null;
    if (A.kind === 'bar') return segmentCircle(A, B);
    if (B.kind === 'bar') return segmentCircle(B, A);
    return circleIntersections(A, B);
  }

  // Seviye tanımı (derece cinsinden) -> hesaplamaya hazır yapı.
  // Parçalar halka ya da düz çubuktur ({ type: 'bar', x1, y1, x2, y2 }).
  // Çubuk dönmez ve boşluğu yoktur; içinden geçtiği halkalar ondan kurtulunca çıkar.
  // Çerçeve ({ type: 'frame', points: [[x, y], ...] }) kapalı bir çokgendir: hiç oynamaz ve tahtadan
  // hiç çıkmaz; her kenarı ayrı bir çubuk gibi davranır. Bölüm, halkalar çerçeveden kurtulunca biter.
  function buildLevel(def) {
    const rings = def.rings.map((r, i) => (r.type === 'frame' ? {
      id: i, kind: 'frame',
      x: r.points.reduce((s, q) => s + q[0], 0) / r.points.length,
      y: r.points.reduce((s, q) => s + q[1], 0) / r.points.length, r: 0,
      points: r.points.map(q => ({ x: q[0], y: q[1] })),
      segs: r.points.map((q, k) => {
        const q2 = r.points[(k + 1) % r.points.length];
        return { x1: q[0], y1: q[1], x2: q2[0], y2: q2[1] };
      }),
      fixed: true, gaps: [], lockedBy: -1, step: 0,
    } : r.type === 'bar' ? {
      id: i, kind: 'bar',
      x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2, r: 0,
      x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2,
      fixed: true, gaps: [],
    } : {
      id: i, kind: 'ring', x: r.x, y: r.y, r: r.r,
      fixed: !!r.fixed,
      gaps: (r.gaps || [0]).map(g => g * DEG),
      // Tıklı halka: yalnızca başlangıç açısından step'in katları kadar döner (derece; 360'ı tam bölmeli)
      step: r.step ? r.step * DEG : 0,
      // Anahtarlı kilit: lockedBy numaralı halka tahtadan çıkana kadar bu halka dönmez
      lockedBy: r.lockedBy == null ? -1 : r.lockedBy,
      // Yaylı halka (kick: [hedef, derece]): tahtadan çıkarken hedef halkayı o kadar döndürür
      // (artı saat yönü). Tekme hamle sayılmaz; hedefin eşleri de kendi oranlarıyla döner.
      kick: r.kick ? { target: r.kick[0], turn: r.kick[1] * DEG } : null,
      // Jetonlu halka (tokens: n, 0 olabilir): her döndürme bir jeton harcar, jetonu yoksa dönmez.
      // Jeton taşıyan halka (token: k) kurtulunca k numaralı jetonlu halkaya bir jeton verir.
      // Yay tekmesi jeton harcamaz.
      tokens: r.tokens == null ? null : r.tokens,
      token: r.token == null ? -1 : r.token,
    }));
    for (const [i, r] of def.rings.entries()) {
      if (r.lockedBy == null) continue;
      const k = def.rings[r.lockedBy];
      if (!k || r.lockedBy === i || k.type === 'bar' || k.type === 'frame') throw new Error(`Halka ${i}: anahtar halkası geçersiz`);
      if (r.fixed) throw new Error(`Halka ${i}: hem sabit hem anahtarlı olamaz`);
    }
    for (const [i, r] of def.rings.entries()) {
      if (r.step && (360 % r.step || r.step <= 0)) throw new Error(`Halka ${i}: tık adımı 360'ı tam bölmeli`);
    }
    const n = rings.length;
    const links = [];
    const ringLinks = rings.map(() => []);
    const angOn = (P, p) => (P.kind !== 'ring' ? 0 : norm(Math.atan2(p.y - P.y, p.x - P.x)));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = rings[i], B = rings[j];
        if (A.kind === 'frame' || B.kind === 'frame') {
          // Çerçeve ile halka: her kenar ayrı bir bağ (kenarın çizgisi `seg` çizim için saklanır)
          if (A.kind !== 'ring' && B.kind !== 'ring') continue;
          const [F, R] = A.kind === 'frame' ? [A, B] : [B, A];
          for (const seg of F.segs) {
            const pts = segmentCircle(seg, R);
            if (!pts) continue;
            if (pts.length !== 2) throw new Error(`Halka ${R.id}: çerçevenin köşesi halkanın içinde kalmamalı`);
            ringLinks[i].push(links.length);
            ringLinks[j].push(links.length);
            links.push({ a: i, b: j, seg, pts: pts.map(p => ({ x: p.x, y: p.y, angA: angOn(A, p), angB: angOn(B, p) })) });
          }
          continue;
        }
        const pts = crossings(rings[i], rings[j]);
        if (!pts) continue;
        const link = {
          a: i, b: j,
          pts: pts.map(p => ({ x: p.x, y: p.y, angA: angOn(A, p), angB: angOn(B, p) })),
        };
        ringLinks[i].push(links.length);
        ringLinks[j].push(links.length);
        links.push(link);
      }
    }
    // Birlikte dönen halka grupları. Eş tanımı [a, b] ya da [a, b, oran]:
    // a δ kadar dönünce b oran·δ kadar döner (1: aynı yöne, -1: ters dişli, 2: hızlı dişli).
    // factor[i]: halkanın grubundaki dönüş katsayısı; i döndürülünce k, δ·factor[k]/factor[i] döner.
    const couples = (def.couples || []).map(([a, b, ratio]) => ({ a, b, ratio: ratio == null ? 1 : ratio }));
    const adj = rings.map(() => []);
    for (const c of couples) {
      if (!c.ratio) throw new Error('Eş oranı sıfır olamaz');
      adj[c.a].push([c.b, c.ratio]);
      adj[c.b].push([c.a, 1 / c.ratio]);
    }
    const factor = rings.map(() => 0);
    const groupId = rings.map((_, i) => i);
    for (let i = 0; i < n; i++) {
      if (factor[i]) continue;
      factor[i] = 1;
      const stack = [i];
      while (stack.length) {
        const u = stack.pop();
        for (const [v, r] of adj[u]) {
          const f = factor[u] * r;
          if (!factor[v]) { factor[v] = f; groupId[v] = i; stack.push(v); }
          else if (Math.abs(factor[v] - f) > 1e-9) throw new Error(`Eş oranları çelişiyor (halka ${v})`);
        }
      }
    }
    const group = rings.map((_, i) => rings.filter((_, k) => groupId[k] === groupId[i]).map(r => r.id));
    // Tıklı halka eşli olamaz: eşi farklı oranla dönünce halka tık yerlerinin dışına düşerdi
    for (const r of rings) if (r.step && group[r.id].length > 1) throw new Error(`Halka ${r.id}: tıklı halka eşli olamaz`);
    // Jetonlu halka eşli olamaz: eşi döndürülünce jeton harcanıp harcanmadığı belirsiz kalırdı
    for (const r of rings) if (r.tokens != null && (group[r.id].length > 1 || r.fixed || r.lockedBy >= 0 || r.kick)) throw new Error(`Halka ${r.id}: jetonlu halka eşli, sabit, anahtarlı ya da yaylı olamaz`);
    for (const r of rings) {
      if (!(r.token >= 0)) continue; // çubuk ve çerçevede alan yok
      const t = rings[r.token];
      if (!t || t === r || t.tokens == null) throw new Error(`Halka ${r.id}: jetonun gideceği halka jetonlu değil`);
    }
    // Anahtarlı halka da eşli olamaz (kilidi tek başına açılmalı, eşini kilitlememeli)
    for (const r of rings) if (r.lockedBy >= 0 && group[r.id].length > 1) throw new Error(`Halka ${r.id}: anahtarlı halka eşli olamaz`);
    const rotatable = rings.map((r, i) => group[i].every(k => !rings[k].fixed));
    // Yay hedefi dönebilen, kilitsiz bir halka olmalı; tıklıysa tekme tık adımının katı olmalı
    const kickedBy = rings.map(() => []);
    for (const r of rings) {
      if (!r.kick) continue;
      const t = rings[r.kick.target];
      if (!t || t === r || t.kind !== 'ring' || !rotatable[t.id] || t.lockedBy >= 0) throw new Error(`Halka ${r.id}: yayın hedefi geçersiz`);
      if (!r.kick.turn) throw new Error(`Halka ${r.id}: yayın tekmesi sıfır olamaz`);
      for (const k of group[t.id]) {
        const st = rings[k].step;
        if (st && Math.abs(r.kick.turn * factor[k] / factor[t.id] / st % 1) > 1e-9) throw new Error(`Halka ${r.id}: tekme tık adımına uymuyor`);
      }
      kickedBy[t.id].push(r.id);
    }

    return {
      rings, links, ringLinks, group, groupId, rotatable, factor, couples, kickedBy,
      // Bölümün bitişi: çerçeveler dışında her parça tahtadan çıkmış olmalı
      full: rings.reduce((m, r, i) => (r.kind === 'frame' ? m : m | (1 << i)), 0),
      startAngles: def.rings.map(r => norm((r.a || 0) * DEG)),
      // Başlangıç jetonları (jetonsuz halkada null)
      tokens: rings.map(r => r.tokens),
    };
  }

  // Halka i döndürüldü: jetonluysa bir jeton harcanır (yeni dizi döner)
  function spend(L, left, i) {
    if (left[i] == null) return left;
    const out = left.slice();
    out[i]--;
    return out;
  }

  // Halka i şu an döndürülebilir mi? Sabit değil, (anahtarlıysa) anahtarı tahtadan çıkmış ve
  // (jetonluysa) jetonu kalmış olmalı. left: kalan jetonlar (verilmezse başlangıçtaki).
  function canRotate(L, i, mask, left) {
    if (!L.rotatable[i]) return false;
    if ((left || L.tokens)[i] === 0) return false;
    const key = L.rings[i].lockedBy;
    return key < 0 || !!(mask & (1 << key));
  }

  function gapCovers(ring, angle, target) {
    for (const g of ring.gaps) if (angDist(angle + g, target) < COVER_HALF) return true;
    return false;
  }

  function pointOpen(L, link, p, angles) {
    return gapCovers(L.rings[link.a], angles[link.a], p.angA) ||
           gapCovers(L.rings[link.b], angles[link.b], p.angB);
  }

  function linkOpen(L, link, angles) {
    return link.pts.some(p => pointOpen(L, link, p, angles));
  }

  // mask: bit i = 1 ise halka i tahtadan çıkmış
  function isFree(L, i, angles, mask) {
    for (const li of L.ringLinks[i]) {
      const k = L.links[li];
      const other = k.a === i ? k.b : k.a;
      if (mask & (1 << other)) continue;
      if (!linkOpen(L, k, angles)) return false;
    }
    return true;
  }

  // Serbest halkaları dalga dalga çıkarır; her dalga ayrı animasyon için döner.
  // Dalgada çıkan yaylı halkalar hedeflerini döndürür (kicks[w]: w. dalganın tekmeleri);
  // tekmelerden sonraki açılar `angles` olarak döner. Jeton taşıyan halkalar çıkınca jetonları
  // hedeflerine geçer: `left` kalan jetonlar (verilmezse başlangıçtaki), `tokens[w]` w. dalganın jetonları.
  function cascade(L, angles, mask, left) {
    left = left || L.tokens;
    const waves = [], kicks = [], tokens = [];
    for (;;) {
      const wave = [];
      for (let i = 0; i < L.rings.length; i++) {
        if (!(mask & (1 << i)) && L.rings[i].kind !== 'frame' && isFree(L, i, angles, mask)) wave.push(i);
      }
      if (!wave.length) break;
      for (const i of wave) mask |= 1 << i;
      const ks = [];
      for (const i of wave) {
        const k = L.rings[i].kick;
        if (!k || (mask & (1 << k.target))) continue;
        angles = rotate(L, angles, k.target, k.turn);
        ks.push({ from: i, target: k.target, turn: k.turn });
      }
      const ts = [];
      for (const i of wave) {
        const t = L.rings[i].token;
        if (!(t >= 0) || (mask & (1 << t))) continue;
        left = left.slice(); left[t]++;
        ts.push({ from: i, to: t });
      }
      waves.push(wave);
      kicks.push(ks);
      tokens.push(ts);
    }
    return { mask, waves, kicks, tokens, angles, left };
  }

  // Halka i'yi delta kadar döndürür; eşleri kendi oranlarıyla döner
  function rotate(L, angles, i, delta) {
    const out = angles.slice();
    for (const k of L.group[i]) out[k] = norm(out[k] + delta * L.factor[k] / L.factor[i]);
    return out;
  }

  // Tıklı halkanın t açısına en yakın tık yeri (tık yerleri başlangıç açısından ölçülür)
  function snapStep(L, i, t) {
    const ring = L.rings[i];
    if (!ring.step) return t;
    const base = L.startAngles[i];
    return norm(base + Math.round(signedDelta(base, t) / ring.step) * ring.step);
  }

  // Halka i için anlamlı hedef açılar: boşluğu henüz açık olmayan bir kesişime getirmek.
  // Tıklı halkada hedef en yakın tık yerine çekilir; boşluk orada kesişimi açmıyorsa hedef sayılmaz.
  function candidates(L, angles, mask, i) {
    const ring = L.rings[i];
    const out = [];
    const pendingKicks = L.kickedBy[i].filter(s => !(mask & (1 << s))).map(s => L.rings[s].kick.turn);
    for (const li of L.ringLinks[i]) {
      const k = L.links[li];
      const other = k.a === i ? k.b : k.a;
      if (mask & (1 << other)) continue;
      for (const p of k.pts) {
        if (pointOpen(L, k, p, angles)) continue;
        const angI = k.a === i ? p.angA : p.angB;
        for (const g of ring.gaps) {
          // Bekleyen yay tekmesi varsa boşluğu tekmeden sonra kesişime düşecek yere de getirmek anlamlı
          for (const pre of [0, ...pendingKicks]) {
            const t = snapStep(L, i, norm(angI - g - pre));
            if (ring.step && !gapCovers(ring, norm(t + pre), angI)) continue;
            if (angDist(t, angles[i]) < DEG / 2) continue;
            if (!out.some(o => angDist(o, t) < DEG)) out.push(t);
          }
        }
      }
    }
    return out;
  }

  function stateKey(L, angles, mask, left) {
    let key = mask.toString(36);
    for (let i = 0; i < L.rings.length; i++) {
      if (mask & (1 << i)) continue;
      key += ',' + (Math.round(angles[i] / DEG * 2) % 720);
      if (left[i] != null) key += 't' + left[i];
    }
    return key;
  }

  // En az hamleli çözüm (BFS). Bulamazsa ya da sınır aşılırsa null.
  // left: kalan jetonlar (verilmezse başlangıçtaki)
  function solve(L, angles, mask, maxNodes, left) {
    maxNodes = maxNodes || 100000;
    ({ mask, angles, left } = cascade(L, angles, mask, left));
    if (mask === L.full) return { moves: 0, first: null };
    const seen = new Set([stateKey(L, angles, mask, left)]);
    let frontier = [{ angles, mask, left, first: null }];
    let expanded = 0;
    for (let depth = 1; frontier.length; depth++) {
      const next = [];
      for (const node of frontier) {
        if (++expanded > maxNodes) return null;
        for (let i = 0; i < L.rings.length; i++) {
          if ((node.mask & (1 << i)) || !canRotate(L, i, node.mask, node.left)) continue;
          const spent = spend(L, node.left, i);
          for (const target of candidates(L, node.angles, node.mask, i)) {
            const delta = signedDelta(node.angles[i], target);
            const { mask: m2, angles: na, left: l2 } = cascade(L, rotate(L, node.angles, i, delta), node.mask, spent);
            const first = node.first || { ring: i, target, delta };
            if (m2 === L.full) return { moves: depth, first };
            const key = stateKey(L, na, m2, l2);
            if (seen.has(key)) continue;
            seen.add(key);
            next.push({ angles: na, mask: m2, left: l2, first });
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  // Kapalı bağ sayısı: çözüme ne kadar uzak olduğumuzun kaba tahmini
  function closedLinks(L, angles, mask) {
    let c = 0;
    for (const k of L.links) {
      if ((mask & (1 << k.a)) || (mask & (1 << k.b))) continue;
      if (!linkOpen(L, k, angles)) c++;
    }
    return c;
  }

  // Hızlı çözücü (ağırlıklı A*): her zaman en kısa yolu bulmaz ama milisaniyeler sürer.
  // Üretimde ön eleme ve denemelerin rehber eli için kullanılır.
  // weight: tahminin ağırlığı. 2 (varsayılan) en hızlısı; 0.8 neredeyse her zaman en kısa yolu bulur
  // ama daha çok düğüm açar (ipucu bunu kullanır: ilk 50 bölümde 49'u en kısa yol).
  function solveFast(L, angles, mask, maxNodes, weight, left) {
    maxNodes = maxNodes || 20000;
    const W = weight == null ? 2 : weight;
    ({ mask, angles, left } = cascade(L, angles, mask, left));
    if (mask === L.full) return { moves: 0, first: null };
    const heap = [];
    const push = node => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l].f < heap[m].f) m = l;
          if (r < heap.length && heap[r].f < heap[m].f) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    const seen = new Set([stateKey(L, angles, mask, left)]);
    push({ angles, mask, left, g: 0, f: 0, first: null });
    let expanded = 0;
    while (heap.length) {
      const node = pop();
      if (++expanded > maxNodes) return null;
      for (let i = 0; i < L.rings.length; i++) {
        if ((node.mask & (1 << i)) || !canRotate(L, i, node.mask, node.left)) continue;
        const spent = spend(L, node.left, i);
        for (const target of candidates(L, node.angles, node.mask, i)) {
          const delta = signedDelta(node.angles[i], target);
          const { mask: m2, angles: na, left: l2 } = cascade(L, rotate(L, node.angles, i, delta), node.mask, spent);
          const first = node.first || { ring: i, target, delta };
          if (m2 === L.full) return { moves: node.g + 1, first };
          const key = stateKey(L, na, m2, l2);
          if (seen.has(key)) continue;
          seen.add(key);
          const g = node.g + 1;
          push({ angles: na, mask: m2, left: l2, g, f: g + W * closedLinks(L, na, m2), first });
        }
      }
    }
    return null;
  }

  const api = {
    TAU, DEG, GAP_HALF, COVER_HALF,
    norm, angDist, signedDelta,
    buildLevel, circleIntersections, gapCovers, pointOpen, linkOpen, isFree, cascade, rotate, solve, solveFast, snapStep, canRotate, spend,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingLogic = api;
})(this);
