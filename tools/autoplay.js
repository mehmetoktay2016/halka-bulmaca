// Tarayıcı içi otomatik oynatıcı (test için).
// Kullanım: index.html?level=12&debug&autoplay  → ipuçlarını gerçek sürükleme olaylarıyla uygular.
(function () {
  'use strict';
  if (!/[?&](autoplay|autofail)/.test(location.search)) return;
  const { solveFast, DEG } = window.RingLogic;
  const canvas = document.getElementById('board');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function fire(type, x, y) {
    const rect = canvas.getBoundingClientRect();
    const sc = window.__halka.scale();
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 1, pointerType: 'mouse',
      clientX: rect.left + x * sc, clientY: rect.top + y * sc,
    }));
  }

  async function drag(ring, from, delta) {
    const steps = Math.max(4, Math.ceil(Math.abs(delta) / (8 * DEG)));
    const at = a => [ring.x + Math.cos(a) * ring.r, ring.y + Math.sin(a) * ring.r];
    fire('pointerdown', ...at(from));
    for (let k = 1; k <= steps; k++) {
      fire('pointermove', ...at(from + delta * k / steps));
      await wait(16);
    }
    fire('pointerup', ...at(from + delta));
  }

  // &autofail: boş hamlelerle sınırı doldurur, "hamle bitti" ve başa dönüşü doğrular
  async function runFail() {
    await wait(400);
    const S = window.__halka.S;
    const i = S.L.rings.findIndex((r, k) => S.L.rotatable[k]);
    for (let k = 0; k < 40 && !S.failed && !S.won; k++) {
      const ring = S.L.rings[i];
      await drag(ring, S.angles[i] + Math.PI, (k % 2 ? -1 : 1) * 6 * DEG);
      await wait(150);
    }
    const sawFail = S.failed && !document.getElementById('fail').classList.contains('hidden');
    await wait(2600);
    document.title = sawFail && !S.failed && S.moves === 0 ? 'AUTOFAIL_OK' : `AUTOFAIL_BAD_${sawFail}_${S.moves}`;
  }

  async function run() {
    if (/[?&]autofail/.test(location.search)) return runFail();
    await wait(400);
    const S = window.__halka.S;
    for (let guard = 0; guard < 30 && !S.won; guard++) {
      const sol = solveFast(S.L, S.angles, S.mask, 30000, undefined, S.left, S.sw, S.ph);
      if (!sol || !sol.first) break;
      const ring = S.L.rings[sol.first.ring];
      // halkayı boşluğun tam karşısından tut
      await drag(ring, S.angles[sol.first.ring] + Math.PI, sol.first.delta);
      await wait(900);
    }
    document.title = S.won ? 'AUTOPLAY_WIN' : 'AUTOPLAY_STUCK';
  }
  run();
})();
