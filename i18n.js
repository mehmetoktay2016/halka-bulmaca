// Dil desteği: Türkçe (kaynak) ve İngilizce. Hem tarayıcıda (window.RingI18n) hem Node'da (require) çalışır.
// Metnin Türkçesi aynı zamanda anahtarıdır: t('Ayarlar') İngilizcede 'Settings' döner; sözlükte yoksa Türkçe kalır.
// Değişkenli metin: t('{n} hamle kaldı', { n: 3 }); çoğul için sözlükte [tekil, çoğul]. Sözlük i18n_en.js'te (RING_LANG_EN).
// Dil: kayıtta seçilmiş dil (ayarlardan), yoksa telefonun dili (Türkçe değilse İngilizce).
(function (root) {
  'use strict';

  const LANGS = ['tr', 'en'];
  const SAVE_KEY = 'halka.progress.v3';

  function detect() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(SAVE_KEY));
      if (saved && LANGS.includes(saved.lang)) return saved.lang;
    } catch (e) { /* gizli sekme, kayıt yok */ }
    const nav = root.navigator && (root.navigator.language || (root.navigator.languages || [])[0]);
    return !nav || /^tr/i.test(nav) ? 'tr' : 'en';
  }

  let lang = root.localStorage ? detect() : 'tr';
  const dict = () => (lang === 'en' ? root.RING_LANG_EN || {} : null);

  // Çoğul: sözlükte [tekil, çoğul] yazılırsa n === 1 iken tekil seçilir ('+{n} coin' / '+{n} coins')
  function t(src, vars) {
    const d = dict();
    let s = d && d[src] != null ? d[src] : src;
    if (Array.isArray(s)) s = s[vars && Number(vars.n) === 1 ? 0 : 1];
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }

  // Sayfadaki sabit metinler: data-t (yazı), data-t-aria (aria-label), data-t-title (title).
  // Türkçe kaynak ilk çağrıda data-t-src'de saklanır; dil değişse de kaynaktan çevrilir.
  function applyDom(scope) {
    const doc = scope || root.document;
    if (!doc) return;
    for (const el of doc.querySelectorAll('[data-t]')) {
      if (!el.dataset.tSrc) el.dataset.tSrc = el.dataset.t || el.innerHTML.trim();
      el.innerHTML = t(el.dataset.tSrc);
    }
    for (const el of doc.querySelectorAll('[data-t-aria]')) el.setAttribute('aria-label', t(el.dataset.tAria));
    for (const el of doc.querySelectorAll('[data-t-title]')) el.setAttribute('title', t(el.dataset.tTitle));
    if (root.document) root.document.documentElement.lang = lang;
  }

  const api = {
    LANGS, t, applyDom, detect,
    get lang() { return lang; },
    setLang(l) { if (LANGS.includes(l)) lang = l; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingI18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
