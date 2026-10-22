// Kullanım: node tools/build_www.js
// Oyunun yayınlanan dosyalarını www/ klasörüne kopyalar; Android uygulaması (Capacitor) buradan paketlenir.
// Test ve geliştirme araçları (tools/) uygulamaya girmez.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const FILES = [
  'index.html', 'style.css', 'i18n_en.js', 'i18n.js', 'logic.js', 'levels_data.js', 'levels.js', 'worlds.js', 'save.js', 'achievements.js', 'rewards.js', 'loot_data.js', 'stickers.js', 'pieces.js', 'deco.js', 'scenery.js', 'ambience.js', 'adventure.js', 'game.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'fonts'), { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(www, f));
for (const f of fs.readdirSync(path.join(root, 'fonts'))) {
  fs.copyFileSync(path.join(root, 'fonts', f), path.join(www, 'fonts', f));
}
console.log(`www/ hazır: ${FILES.length} dosya + fonts/`);
