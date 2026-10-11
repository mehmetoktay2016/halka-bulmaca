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

- Geri al (undo) ve sıfırla butonu, ücretsiz.
- Günlük bulmaca.
- Tek seferlik "reklamları kaldır" satın alımı.
- İnternetsiz oynanabilir.

## Yol Haritası

1. [x] Prototip: halka döndürme, boşluk hizalama, halka çıkışı
2. [x] Seviye formatı + 8 elle tasarlanmış seviye
3. [x] Hamle sayacı, yıldız, seviye geçişi, kayıt, geri al, ipucu
4. [x] Kilitli halka, birlikte dönen halkalar, çift boşluk; seviye üretici + çözücü
4b. [ ] Yeni parça tipleri (D-halka, S-kilit, üçgen çerçeve, U-tüp)
5. [ ] Ses, animasyon, titreşim
6. [ ] Android derlemesi, kapalı test (12 kişi / 14 gün)
7. [ ] Google Play yayını
