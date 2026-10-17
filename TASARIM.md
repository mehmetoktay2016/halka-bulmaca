# Halka Bulmaca Oyunu — Tasarım Dokümanı

> Referans: Rotate Rings (Nebula Studio) — com.nebula.rotaterings — 4.8★, 1M+ indirme, reklamlı
> İsim ve tema: henüz belirlenmedi ("Rotate Rings" adı ve görselleri kullanılmayacak)
> Teknoloji: 2D, saf JavaScript + Canvas (tarayıcı prototipi). Android için ileride Capacitor ile paketlenecek.

## Temel mekanik (referans oyundan)

- İç içe / birbirine kilitli halkalar var, her halkada bir veya birkaç boşluk (gap) bulunur.
- Oyuncu halkaya dokunup sürükleyerek döndürür.
- Boşluklar doğru hizalanınca halka kilitten kurtulur ve çıkar; katman katman tüm yapı çözülür.
- Amaç: seviyeyi en az hamleyle bitirmek.
- Çeşitli parça tipleri: C-kilit, D-halka, S-esnek kilit, üçgen çerçeve, U-tüp.

## Rakiplerin aldığı olumsuz yorumlar → Bizim çözümümüz

| # | Şikayet | Kaynak | Bizim kuralımız |
|---|---|---|---|
| 1 | Oyundan çok reklam izleniyor ("1 dk oyun, 1 dk+ reklam") | Rotate Rings + benzer oyunlar (en baskın şikayet) | Seviye sonu zorunlu reklam yok. Yalnızca isteğe bağlı ödüllü reklam (ipucu/bonus). En fazla birkaç seviyede bir, atlanabilir kısa reklam |
| 2 | Aynı birkaç seviye tekrar ediyor | Rotate Rings + benzer oyunlar | Her seviye benzersiz; kimliği/hash'i kontrol edilir. Elle tasarım + prosedürel üretici, tekrar yasak |
| 3 | Çok kolay, sıkıcı | Rotate Rings | Belirgin zorluk eğrisi, her ~15 seviyede yeni parça tipi, "uzman" modu, minimum hamle için yıldız sistemi |
| 4 | Zamanlayıcı baskısı | Benzer oyun | Süre sınırı yok; zamanlı mod sadece isteğe bağlı |
| 5 | Reklamda gösterilen içerik oyunda yok | Benzer oyun | Mağaza görselleri ve reklamlar gerçek oyun görüntüsü olacak |
| 6 | Güncellemeden sonra açılmama, takılan ekranlar | Benzer oyun | Kapalı testte otomatik testler + çökme raporu; ilerleme kaydı sürüm uyumlu |
| 7 | Reklamla açılan bölümlerde az ödül | Benzer oyun | Reklam ödülleri cömert ve net gösterilir |

## Prototipteki kural

İki halka iki noktada kesişir. Bir kesişim noktası, halkalardan birinin boşluğu
o noktanın üzerindeyse "açık"tır. Bir halkanın tahtadaki bütün komşularıyla
bağı açıksa halka serbest kalır ve uçar. Hedef hamle sayısı çözücüyle (BFS) hesaplanır.

## Ek fikirler (fark yaratmak için)

- Sıfırla (yeniden başla) butonu, ücretsiz. Geri al 2.0'da kaldırıldı: hamle sayacını geri verdiği için deneme-yanılmayı bedava yapıyor, hamle hakkını ve yıldızı anlamsızlaştırıyordu.
- Günlük bulmaca.
- Tek seferlik "reklamları kaldır" satın alımı.
- İnternetsiz oynanabilir.

## Ödül ekonomisi ve reklam anları (2.1)

Amaç: oyuncuyu oyunda tutan ödüller, ama oyunu bilerek zorlaştırmadan. Reklam (ileride) bir zorunluluk değil,
oyuncunun seçtiği bir hızlandırıcı olacak (yukarıdaki şikayet 1 ve 7).

- **Kaynaklar:** bölüm altını (yalnızca ilk bitiriş), rozetler, sandıklar (kapı başına 3; zor kapılarda nadir/efsane
  daha sık), altın halka (×2), ampul halkası (yalnızca en zor kapılar: 6, 9-12), çıkartma setleri (dünya başına 25),
  günlük sandık (haftada 100 altın + 1 ampul).
- **Harcama:** ampul (20 altın), +3 hamle (20 altın), süs mağazası (9 ürün, toplam 1.350 altın).
- **Ölçüm:** `npm run economy`. 2.1'de tipik oyuncu yolculuk boyunca ~1.490 altın ve 39 garanti ampul kazanır
  (2.0'da 770 altın, 22 ampul). Bütün miktarlar `rewards.js`'te.

**İleride reklam düğmesi eklenebilecek anlar** (bugün hepsi altınla ya da bedava çalışır; reklam yalnızca
yanına "veya reklam izle" seçeneği olarak gelir, hiçbiri zorunlu olmaz):

| An | Bugün | Reklamla |
|---|---|---|
| Hamle bitti | 20 altınla +3 hamle | +3 hamle (bölüm başına bir) |
| İpucu menüsü | 20 altınla ampul | +1 ampul (günde birkaç) |
| Sandık açıldı | — | içindeki altını 2 katla |
| Günlük sandık açıldı | — | ödülü 2 katla; kaçırılan günü kurtar |
| Çıkartmanın son parçası eksik | parçalı bölümü bitir | — (parça hep oyunla kazanılır) |

1. kapıda reklam olmaz. Ödüllü reklamın ödülü cömert ve net yazılır.

## Zorluk ve övgü (2.2)

- **Zorluk puanı** = hamle puanı (en az hamle, parça ve mekanik sayısı) + halka yakınlığı katkısı (en çok ±1).
  Yakınlık: her halkanın en yakın komşusuna uzaklığının iki yarıçap toplamına oranı; küçükse sıkışık.
- **Düzen:** testere dişi. Kapı içinde kolaydan zora (baş ferah ve kısa, son sıkışık ve uzun); yeni kapı önceki
  zirvenin altından başlar; zirve ve ortalama her kapıda artar. En iyi çözüm sınırı kapı 12-16'da 9 (hamle hakkı 12).
- **Oyuncu kaydı** bölüm düzeni değişince sıra numarasıyla taşınır (`save.js` relayout): oyuncu yerini korur.
- **Övgü:** zincir 2 / 3 / 4+ → Güzel-Süper / Harika-Şahane / Muhteşem-İnanılmaz; tek halkada övgü yok.

## Yol Haritası

1. [x] Prototip: halka döndürme, boşluk hizalama, halka çıkışı
2. [x] Seviye formatı + 8 elle tasarlanmış seviye
3. [x] Hamle sayacı, yıldız, seviye geçişi, kayıt, geri al, ipucu
4. [x] Kilitli halka, birlikte dönen halkalar, çift boşluk; seviye üretici + çözücü
4b. [ ] Yeni parça tipleri (D-halka, S-kilit, üçgen çerçeve, U-tüp)
5. [ ] Ses, animasyon, titreşim
6. [ ] Android derlemesi, kapalı test (12 kişi / 14 gün)
7. [ ] Google Play yayını
