// PROTOTİP (Y6): döner tabla kuralı. Tabla, üstündeki halkaları (carried) merkezinin etrafında
// step derecelik adımlarla taşır; taşınan halkaların boşlukları da tablayla birlikte döner.
// Tablanın her konumu ayrı bir düzendir (kesişimler yeniden hesaplanır); halka numaraları aynı kalır.
// Hem tarayıcıda (window.TableLogic) hem Node'da (require) çalışır; logic.js'i kullanır.
(function (root) {
  'use strict';
  const Logic = typeof require !== 'undefined' ? require('../logic.js') : root.RingLogic;
  const { DEG, norm, signedDelta } = Logic;

  // def: { rings, table: { x, y, r, step, carried: [halka numaraları] } }
  function build(def) {
    const T = def.table, k = Math.round(360 / T.step);
    const variants = [];
    for (let t = 0; t < k; t++) {
      const a = t * T.step * DEG, c = Math.cos(a), s = Math.sin(a);
      const rings = def.rings.map((r, i) => {
        if (!T.carried.includes(i)) return r;
        const dx = r.x - T.x, dy = r.y - T.y;
        return { ...r, x: T.x + dx * c - dy * s, y: T.y + dx * s + dy * c };
      });
      variants.push(Logic.buildLevel({ ...def, rings }));
    }
    return { def, T, k, variants, full: variants[0].full, startAngles: variants[0].startAngles };
  }

  // Tabla bir adım döner: taşınan halkaların boşlukları da aynı açıyla döner
  function turnAngles(TL, angles) {
    const out = angles.slice();
    for (const i of TL.T.carried) out[i] = norm(out[i] + TL.T.step * DEG);
    return out;
  }

  const key = (TL, s) => s.t + '|' + Logic.stateKey(TL.variants[s.t], s.angles, s.mask, TL.variants[s.t].tokens);

  // En az hamleli çözüm (BFS). Hamle: bir halkayı çevirmek ya da tablayı bir adım döndürmek (first.table).
  function solve(TL, angles, mask, t, maxNodes) {
    maxNodes = maxNodes || 150000;
    ({ mask, angles } = Logic.cascade(TL.variants[t], angles, mask));
    if (mask === TL.full) return { moves: 0, first: null };
    const start = { angles, mask, t, first: null };
    const seen = new Set([key(TL, start)]);
    let frontier = [start], expanded = 0;
    for (let depth = 1; frontier.length; depth++) {
      const next = [];
      for (const node of frontier) {
        if (++expanded > maxNodes) return null;
        const L = TL.variants[node.t];
        const push = (s, first) => {
          if (s.mask === TL.full) return { moves: depth, first };
          const kk = key(TL, s);
          if (seen.has(kk)) return null;
          seen.add(kk);
          next.push({ ...s, first });
          return null;
        };
        // tablayı çevir
        {
          const t2 = (node.t + 1) % TL.k;
          const c = Logic.cascade(TL.variants[t2], turnAngles(TL, node.angles), node.mask);
          const r = push({ angles: c.angles, mask: c.mask, t: t2 }, node.first || { table: true, ring: -1 });
          if (r) return r;
        }
        for (let i = 0; i < L.rings.length; i++) {
          if ((node.mask & (1 << i)) || !Logic.canRotate(L, i, node.mask)) continue;
          for (const target of Logic.candidates(L, node.angles, node.mask, i)) {
            const delta = signedDelta(node.angles[i], target);
            const c = Logic.cascade(L, Logic.rotate(L, node.angles, i, delta), node.mask);
            const r = push({ angles: c.angles, mask: c.mask, t: node.t }, node.first || { ring: i, target, delta });
            if (r) return r;
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  const api = { build, turnAngles, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TableLogic = api;
})(this);
