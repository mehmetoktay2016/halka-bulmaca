// Kullanım: node tools/build_single.js
// Oyunu tek bir HTML dosyasında toplar (stiller, kodlar ve yazı tipleri gömülü).
// Çıktılar:
//   dist/halka-bulmaca.html  → tek başına açılabilen oyun
//   expo_app/game-html.js    → Expo uygulamasının WebView'da gösterdiği aynı sayfa
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// Yazı tiplerini data: adresi olarak göm
const fontsCss = read('fonts/fonts.css').replace(/url\(([^)]+\.woff2)\)/g, (_, file) => {
  const b64 = fs.readFileSync(path.join(root, 'fonts', file)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="fonts/fonts.css">', () => `<style>\n${fontsCss}</style>`);
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = read(src).replace(/<\/script/gi, '<\\/script');
  return `<script>\n${code}\n</script>`;
});
// Tek dosyada işe yaramayan bağlantılar (manifest, simgeler)
html = html.replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '');

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'halka-bulmaca.html'), html);

const expoDir = path.join(root, 'expo_app');
if (fs.existsSync(expoDir)) {
  fs.writeFileSync(path.join(expoDir, 'game-html.js'),
    '// tools/build_single.js tarafından üretildi — elle düzenlemeyin\n' +
    'export default ' + JSON.stringify(html) + ';\n');
}
console.log(`Tek dosya hazır: ${(html.length / 1024).toFixed(0)} KB` + (fs.existsSync(expoDir) ? ' (+ expo_app/game-html.js)' : ''));
