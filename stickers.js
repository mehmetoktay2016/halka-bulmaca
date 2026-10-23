// Çıkartmalar: her dünyanın 5 parçalı bir çıkartması (resim ve ad). Parçaların hangi bölümde olduğu rewards.js'te.
// Hem tarayıcıda (window.RingStickers) hem Node'da (require) çalışır.
// Kural: dünya kimlikleri ve parça sırası oyuncu kaydında ("vadi:0") tutulur; değiştirilmez.
(function (root) {
  'use strict';

  // c: { bg, ink, hi } renkleri. Çizimler 100×100 kutuda, ortası (50, 50).
  const SETS = {
    vadi: {
      name: 'Vadi Güneşi',
      art: c => `<circle cx="50" cy="40" r="13" fill="${c.hi}"/>
        <g stroke="${c.hi}" stroke-width="4" stroke-linecap="round">
          <path d="M50 16v6M22 40h6M78 40h-6M31 21l4 4M69 21l-4 4"/></g>
        <path d="M6 72Q28 52 50 66T96 60V96H6Z" fill="${c.ink}"/>
        <path d="M6 82Q34 66 62 78T96 76V96H6Z" fill="${c.ink}" opacity=".6"/>`,
    },
    atolye: {
      name: 'Usta Anahtarı',
      art: c => `<g transform="rotate(-40 50 50)" fill="${c.ink}">
          <rect x="44" y="34" width="12" height="50" rx="5"/>
          <circle cx="50" cy="28" r="16"/><rect x="44" y="8" width="12" height="20" rx="2" fill="${c.bg}"/>
          <circle cx="50" cy="76" r="3.5" fill="${c.hi}"/></g>`,
    },
    saat: {
      name: 'Kule Saati',
      art: c => `<circle cx="50" cy="50" r="28" fill="${c.hi}" stroke="${c.ink}" stroke-width="5"/>
        <g stroke="${c.ink}" stroke-width="3.5" stroke-linecap="round">
          <path d="M50 27v5M50 68v5M27 50h5M68 50h5"/>
          <path d="M50 50V36M50 50l10 7" stroke-width="5"/></g>
        <circle cx="50" cy="50" r="3.5" fill="${c.ink}"/>`,
    },
    zindan: {
      name: 'Zindan Anahtarı',
      art: c => `<g transform="rotate(-35 50 50)" fill="${c.ink}">
          <circle cx="50" cy="28" r="14"/><circle cx="50" cy="28" r="6" fill="${c.hi}"/>
          <rect x="45.5" y="38" width="9" height="44" rx="3"/>
          <rect x="54" y="62" width="10" height="6" rx="1.5"/><rect x="54" y="72" width="7" height="6" rx="1.5"/></g>`,
    },
    sehir: {
      name: 'Şehir Işıkları',
      art: c => `<g fill="${c.ink}">
          <rect x="14" y="46" width="18" height="40"/><rect x="34" y="26" width="18" height="60"/>
          <rect x="54" y="38" width="14" height="48"/><rect x="70" y="52" width="16" height="34"/>
          <path d="M43 26V16h0" stroke="${c.ink}" stroke-width="3"/></g>
        <g fill="${c.hi}"><rect x="38" y="32" width="4" height="5"/><rect x="45" y="32" width="4" height="5"/>
          <rect x="38" y="42" width="4" height="5"/><rect x="45" y="52" width="4" height="5"/>
          <rect x="18" y="52" width="4" height="5"/><rect x="24" y="62" width="4" height="5"/>
          <rect x="58" y="44" width="4" height="5"/><rect x="74" y="58" width="4" height="5"/></g>`,
    },
    fabrika: {
      name: 'Buhar Bacası',
      art: c => `<circle cx="66" cy="20" r="7" fill="${c.hi}" opacity=".85"/><circle cx="76" cy="12" r="5" fill="${c.hi}" opacity=".6"/>
        <path d="M12 86V54l18 10V54l18 10V54l12 7V30h14v56Z" fill="${c.ink}"/>
        <g fill="${c.hi}"><rect x="18" y="70" width="7" height="7"/><rect x="34" y="70" width="7" height="7"/><rect x="50" y="70" width="7" height="7"/></g>`,
    },
    uzay: {
      name: 'Uzay Roketi',
      art: c => `<g transform="rotate(35 50 50)">
          <path d="M50 12C62 24 64 44 62 66H38C36 44 38 24 50 12Z" fill="${c.ink}"/>
          <circle cx="50" cy="40" r="7" fill="${c.hi}"/>
          <path d="M38 56L28 72L38 70ZM62 56L72 72L62 70Z" fill="${c.ink}"/>
          <path d="M42 68Q50 90 58 68Z" fill="${c.hi}"/></g>`,
    },
    usta: {
      name: 'Büyük Çark',
      art: c => {
        let teeth = '';
        for (let k = 0; k < 10; k++) teeth += `<rect x="45" y="14" width="10" height="14" rx="2" transform="rotate(${k * 36} 50 50)"/>`;
        return `<g fill="${c.ink}">${teeth}<circle cx="50" cy="50" r="27"/></g>
          <circle cx="50" cy="50" r="11" fill="${c.hi}"/><circle cx="50" cy="50" r="4" fill="${c.ink}"/>`;
      },
    },
    // 2.4: yeni dünyalar
    lunapark: {
      name: 'Uçan Balonlar',
      art: c => `<g stroke="${c.ink}" stroke-width="2" fill="none"><path d="M33 52Q36 70 48 86M50 44Q50 66 48 86M67 52Q62 70 48 86"/></g>
        <ellipse cx="33" cy="36" rx="13" ry="16" fill="${c.ink}"/><path d="M30 52h6l-3 4z" fill="${c.ink}"/>
        <ellipse cx="67" cy="36" rx="13" ry="16" fill="${c.ink}"/><path d="M64 52h6l-3 4z" fill="${c.ink}"/>
        <ellipse cx="50" cy="27" rx="14" ry="17" fill="${c.hi}" stroke="${c.ink}" stroke-width="3"/><path d="M47 44h6l-3 4z" fill="${c.ink}"/>
        <path d="M44 20q2-5 7-6" stroke="${c.ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    },
    santral: {
      name: 'Yıldırım',
      art: c => `<path d="M58 8L26 54h20L38 92L74 40H53L64 8Z" fill="${c.ink}"/>
        <path d="M57 16L36 48h16L46 76" stroke="${c.hi}" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`,
    },
    fener: {
      name: 'Gemi Çapası',
      art: c => `<g stroke="${c.ink}" stroke-width="7" stroke-linecap="round" fill="none">
          <path d="M50 30V82M36 40h28M22 60Q24 82 50 84Q76 82 78 60"/></g>
        <path d="M14 64l8-8 8 8ZM70 64l8-8 8 8Z" fill="${c.ink}"/>
        <circle cx="50" cy="21" r="8" fill="none" stroke="${c.ink}" stroke-width="6"/><circle cx="50" cy="21" r="3" fill="${c.hi}"/>`,
    },
    rasathane: {
      name: 'Kuyruklu Yıldız',
      art: c => `<path d="M12 84L56 36L64 44Z" fill="${c.hi}" opacity=".55"/><path d="M20 90L58 42L62 48Z" fill="${c.hi}" opacity=".35"/>
        <path d="M8 72L52 32L58 40Z" fill="${c.hi}" opacity=".35"/>
        <path d="M64 18l5 11 12 1.5-9 8 2.5 12L64 45l-10.5 5.5 2.5-12-9-8 12-1.5Z" fill="${c.ink}"/>
        <circle cx="82" cy="70" r="3" fill="${c.ink}"/><circle cx="30" cy="22" r="2.5" fill="${c.ink}"/>`,
    },
    // 2.5: yeni dünyalar
    fisek: {
      name: 'Gök Fişeği',
      art: c => `<g stroke="${c.ink}" stroke-width="4" stroke-linecap="round">
          <path d="M50 18v10M50 72v10M18 50h10M72 50h10M27 27l7 7M73 27l-7 7M27 73l7-7M73 73l-7-7"/></g>
        <circle cx="50" cy="50" r="12" fill="${c.hi}" stroke="${c.ink}" stroke-width="3"/>
        <g fill="${c.ink}"><circle cx="50" cy="12" r="3"/><circle cx="88" cy="50" r="3"/><circle cx="50" cy="88" r="3"/><circle cx="12" cy="50" r="3"/></g>`,
    },
    buzul: {
      name: 'Kar Tanesi',
      art: c => `<g stroke="${c.ink}" stroke-width="5" stroke-linecap="round">
          <path d="M50 14V86M19 32l62 36M19 68l62-36"/></g>
        <g stroke="${c.ink}" stroke-width="3.5" stroke-linecap="round" fill="none">
          <path d="M42 20l8 8 8-8M42 80l8-8 8 8M18 42l11 3-3 11M82 58l-11-3 3-11M18 58l11-3-3-11M82 42l-11 3 3 11"/></g>
        <circle cx="50" cy="50" r="7" fill="${c.hi}" stroke="${c.ink}" stroke-width="3"/>`,
    },
    degirmen: {
      name: 'Yel Değirmeni',
      art: c => `<path d="M38 88L42 46h16l4 42Z" fill="${c.ink}"/><path d="M40 46l10-10 10 10Z" fill="${c.ink}"/>
        <rect x="46" y="70" width="8" height="18" rx="3" fill="${c.hi}"/>
        <g transform="rotate(20 50 38)" fill="${c.hi}" stroke="${c.ink}" stroke-width="2.5">
          <rect x="47" y="8" width="10" height="28" rx="2"/><rect x="43" y="40" width="10" height="28" rx="2"/>
          <rect x="14" y="35" width="28" height="10" rx="2"/><rect x="58" y="31" width="28" height="10" rx="2"/></g>
        <circle cx="50" cy="38" r="5" fill="${c.ink}"/>`,
    },
    buyu: {
      name: 'Büyücü Şapkası',
      art: c => `<path d="M14 78Q50 66 86 78Q50 90 14 78Z" fill="${c.ink}"/>
        <path d="M30 74L52 14Q56 10 58 16L70 74Z" fill="${c.ink}"/>
        <path d="M33 66Q50 60 67 66" stroke="${c.hi}" stroke-width="5" fill="none"/>
        <path d="M56 30l2 5 5 .6-3.8 3.4 1 5-4.2-2.6-4.2 2.6 1-5L49 35.6l5-.6Z" fill="${c.hi}"/>`,
    },
    // 2.6: yeni dünyalar
    seker: {
      name: 'Lolipop',
      art: c => `<rect x="46" y="58" width="8" height="34" rx="3" fill="${c.hi}" stroke="${c.ink}" stroke-width="2.5"/>
        <circle cx="50" cy="38" r="26" fill="${c.hi}" stroke="${c.ink}" stroke-width="4"/>
        <path d="M50 38m-4 0a4 4 0 1 1 8 0a10 10 0 1 1 -20 0a16 16 0 1 1 32 0a22 22 0 0 1 -6 15" fill="none" stroke="${c.ink}" stroke-width="4" stroke-linecap="round"/>
        <path d="M42 60q8 6 16 0" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`,
    },
  };
  const PIECES = 5;

  // k. dilim: tepeden başlayıp saat yönünde 72°
  function wedge(k, r = 47) {
    const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / PIECES, a1 = a0 + (2 * Math.PI) / PIECES;
    const p = a => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    return `M50 50L${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}Z`;
  }

  // Çıkartma: sahip olunan dilimler renkli, eksikler soluk ve kesik çizgili.
  // owned: 5 elemanlı dizi; accent: dünyanın rengi; fresh: yeni kazanılan dilim (canlanır)
  let uid = 0;
  function svg(id, owned, accent, fresh = -1) {
    const set = SETS[id];
    const n = ++uid;
    const full = c => `<circle cx="50" cy="50" r="47" fill="#f4f1ff"/><circle cx="50" cy="50" r="42" fill="${c.bg}"/>
      <g clip-path="url(#sc${n})">${set.art(c)}</g>`;
    const color = { bg: accent, ink: '#1d1934', hi: '#fff7d6' };
    const ghost = { bg: '#262b4f', ink: '#343a66', hi: '#3d4475' };
    const done = owned.every(Boolean);
    let html = `<svg class="sticker${done ? ' done' : ''}" viewBox="0 0 100 100" aria-hidden="true">
      <defs><clipPath id="sc${n}"><circle cx="50" cy="50" r="42"/></clipPath>
      ${owned.map((_, k) => `<clipPath id="sw${n}-${k}"><path d="${wedge(k, 48)}"/></clipPath>`).join('')}</defs>
      <g opacity=".55">${full(ghost)}</g>`;
    if (done && fresh < 0) return html + `<g>${full(color)}</g></svg>`;
    owned.forEach((o, k) => {
      if (o) html += `<g class="piece${k === fresh ? ' fresh' : ''}" clip-path="url(#sw${n}-${k})">${full(color)}</g>`;
    });
    if (!done) {
      for (let k = 0; k < PIECES; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / PIECES;
        html += `<path d="M50 50L${(50 + 47 * Math.cos(a)).toFixed(2)} ${(50 + 47 * Math.sin(a)).toFixed(2)}" stroke="#0f1226" stroke-width="1.6" stroke-dasharray="3 2.5"/>`;
      }
    }
    return html + '</svg>';
  }

  const api = { SETS, PIECES, svg, wedge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingStickers = api;
})(this);
