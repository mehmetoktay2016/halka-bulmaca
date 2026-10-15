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
  function buildLevel(def) {
    const rings = def.rings.map((r, i) => (r.type === 'bar' ? {
      id: i, kind: 'bar',
      x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2, r: 0,
      x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2,
      fixed: true, gaps: [],
    } : {
      id: i, kind: 'ring', x: r.x, y: r.y, r: r.r,
      fixed: !!r.fixed,
      gaps: (r.gaps || [0]).map(g => g * DEG),
    }));
    const n = rings.length;
    const links = [];
    const ringLinks = rings.map(() => []);
    const angOn = (P, p) => (P.kind === 'bar' ? 0 : norm(Math.atan2(p.y - P.y, p.x - P.x)));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pts = crossings(rings[i], rings[j]);
        if (!pts) continue;
        const A = rings[i], B = rings[j];
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
    const rotatable = rings.map((r, i) => group[i].every(k => !rings[k].fixed));

    return {
      rings, links, ringLinks, group, groupId, rotatable, factor, couples,
      full: (1 << n) - 1,
      startAngles: def.rings.map(r => norm((r.a || 0) * DEG)),
    };
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

  // Serbest halkaları dalga dalga çıkarır; her dalga ayrı animasyon için döner
  function cascade(L, angles, mask) {
    const waves = [];
    for (;;) {
      const wave = [];
      for (let i = 0; i < L.rings.length; i++) {
        if (!(mask & (1 << i)) && isFree(L, i, angles, mask)) wave.push(i);
      }
      if (!wave.length) break;
      for (const i of wave) mask |= 1 << i;
      waves.push(wave);
    }
    return { mask, waves };
  }

  // Halka i'yi delta kadar döndürür; eşleri kendi oranlarıyla döner
  function rotate(L, angles, i, delta) {
    const out = angles.slice();
    for (const k of L.group[i]) out[k] = norm(out[k] + delta * L.factor[k] / L.factor[i]);
    return out;
  }

  // Halka i için anlamlı hedef açılar: boşluğu henüz açık olmayan bir kesişime getirmek
  function candidates(L, angles, mask, i) {
    const ring = L.rings[i];
    const out = [];
    for (const li of L.ringLinks[i]) {
      const k = L.links[li];
      const other = k.a === i ? k.b : k.a;
      if (mask & (1 << other)) continue;
      for (const p of k.pts) {
        if (pointOpen(L, k, p, angles)) continue;
        const angI = k.a === i ? p.angA : p.angB;
        for (const g of ring.gaps) {
          const t = norm(angI - g);
          if (!out.some(o => angDist(o, t) < DEG)) out.push(t);
        }
      }
    }
    return out;
  }

  function stateKey(L, angles, mask) {
    let key = mask.toString(36);
    for (let i = 0; i < L.rings.length; i++) {
      if (mask & (1 << i)) continue;
      key += ',' + (Math.round(angles[i] / DEG * 2) % 720);
    }
    return key;
  }

  // En az hamleli çözüm (BFS). Bulamazsa ya da sınır aşılırsa null.
  function solve(L, angles, mask, maxNodes) {
    maxNodes = maxNodes || 100000;
    mask = cascade(L, angles, mask).mask;
    if (mask === L.full) return { moves: 0, first: null };
    const seen = new Set([stateKey(L, angles, mask)]);
    let frontier = [{ angles, mask, first: null }];
    let expanded = 0;
    for (let depth = 1; frontier.length; depth++) {
      const next = [];
      for (const node of frontier) {
        if (++expanded > maxNodes) return null;
        for (let i = 0; i < L.rings.length; i++) {
          if ((node.mask & (1 << i)) || !L.rotatable[i]) continue;
          for (const target of candidates(L, node.angles, node.mask, i)) {
            const delta = signedDelta(node.angles[i], target);
            const na = rotate(L, node.angles, i, delta);
            const m2 = cascade(L, na, node.mask).mask;
            const first = node.first || { ring: i, target, delta };
            if (m2 === L.full) return { moves: depth, first };
            const key = stateKey(L, na, m2);
            if (seen.has(key)) continue;
            seen.add(key);
            next.push({ angles: na, mask: m2, first });
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
  function solveFast(L, angles, mask, maxNodes, weight) {
    maxNodes = maxNodes || 20000;
    const W = weight == null ? 2 : weight;
    mask = cascade(L, angles, mask).mask;
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
    const seen = new Set([stateKey(L, angles, mask)]);
    push({ angles, mask, g: 0, f: 0, first: null });
    let expanded = 0;
    while (heap.length) {
      const node = pop();
      if (++expanded > maxNodes) return null;
      for (let i = 0; i < L.rings.length; i++) {
        if ((node.mask & (1 << i)) || !L.rotatable[i]) continue;
        for (const target of candidates(L, node.angles, node.mask, i)) {
          const delta = signedDelta(node.angles[i], target);
          const na = rotate(L, node.angles, i, delta);
          const m2 = cascade(L, na, node.mask).mask;
          const first = node.first || { ring: i, target, delta };
          if (m2 === L.full) return { moves: node.g + 1, first };
          const key = stateKey(L, na, m2);
          if (seen.has(key)) continue;
          seen.add(key);
          const g = node.g + 1;
          push({ angles: na, mask: m2, g, f: g + W * closedLinks(L, na, m2), first });
        }
      }
    }
    return null;
  }

  const api = {
    TAU, DEG, GAP_HALF, COVER_HALF,
    norm, angDist, signedDelta,
    buildLevel, circleIntersections, gapCovers, pointOpen, linkOpen, isFree, cascade, rotate, solve, solveFast,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingLogic = api;
})(this);
