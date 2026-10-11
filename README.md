# Halka Bulmaca

Birbirine geçmiş halkaları döndür, boşlukları kesişimlere getir, hepsini serbest bırak.
Tarayıcıda çalışır; telefonda uygulama gibi açılır. Kurulum gerekmez.

## Oynamak

`index.html` dosyasını tarayıcıda aç. İlk açılışta 4 rehberli deneme bölümü oyunu öğretir.

- Halkayı parmakla / fareyle sürükleyerek döndür.
- Parlayan beyaz nokta: o kesişim açık, halka oradan geçebilir.
- Bir halkanın bütün kesişimleri açılınca halka uçup gider; hepsi gidince bölüm biter.
- Gri halka kilitli, dönmez. Noktalı çizgiyle bağlı halkalar birlikte döner.
- Düz çubuklar dönmez; içinden geçtiği halkalar kurtulunca kayıp gider.
- Her bölümde en fazla 10 hamle hakkın var; biterse bölüm başa döner.
- Skor: yıldız başına 100, altın başına 25 (her bölümün en iyi sonucu sayılır).

60 bölüm kolaydan zora dizilidir; aralarına 10 hayvan bölümü (kedi, ayıcık, aslan…) serpiştirilmiştir.

## GitHub Pages ile yayınlama

1. Depoda **Settings → Pages** bölümüne gir.
2. **Source**: "Deploy from a branch", **Branch**: `main`, klasör: `/ (root)` seç, **Save**.
3. Birkaç dakika sonra oyun `https://<kullanıcı-adı>.github.io/halka-bulmaca/` adresinde yayında olur.

Telefonda bu adresi açıp "Ana ekrana ekle" dersen oyun kendi simgesiyle, tam ekran açılır.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html`, `style.css` | Sayfa ve tasarım |
| `logic.js` | Kurallar: kesişimler, serbest kalma, çözücüler |
| `levels.js` | El yapımı 10 tanıtım bölümü, deneme bölümleri, hayvanlar, seviye üretici, zorluk sırası |
| `levels_data.js` | Önceden üretilmiş bölümler (elle düzenlenmez) |
| `deco.js` | Hayvan yüzleri ve süsler |
| `game.js` | Ekranlar, çizim, dokunma, ses, skor, kayıt |
| `manifest.webmanifest`, `icon-*.png` | Telefonda uygulama gibi açılma |
| `tools/check_levels.js` | `node tools/check_levels.js` → bütün bölümleri ve zorluk sırasını doğrular |
| `tools/build_levels.js` | `node tools/build_levels.js 11 50` → bölümleri yeniden üretir |
| `tools/autoplay.js` | Tarayıcıda otomatik oynatma testi (`index.html?level=5&debug&autoplay`) |

Tasarım kararları ve rakip oyun analizi: `TASARIM.md`.
