# DNA Intelligence V3 deterministik retrieval sözleşmesi

## Kapsam

Bu katman Faz 31'in çalışma zamanı sırasını uygular. Haricî model, embedding,
vektör veritabanı veya çalışma zamanı interneti kullanmaz. Yalnız sunucu
tarafındaki, hash ile doğrulanmış V3 statik paketinin `release_eligible`
kayıtlarını okuyabilir.

İşlem sırası değiştirilemez:

1. Klinik güvenlik ve mahremiyet kapısı
2. Teori, vaka veya vaka–teori niyeti
3. Soru türü
4. Kesin başlık ve eş anlamlı eşleşmesi
5. Türkçe normalizasyon ve sınırlı kök çıkarımı
6. BM25 kelime eşleşmesi
7. 3–5 karakter n-gram yazım hatası eşleşmesi
8. Başlık, eş anlamlı, anahtar kelime, özet ve ayrıntı alan ağırlıkları
9. Yaş, kanıt, lisans, passage ve entailment filtresi
10. Yalnız açık ve kanıt bağlı tek-adımlı ilişki
11. Güven eşiği ve stabil kimlik eşitlik çözümü
12. Onaylı iddialardan şablonlu cevap
13. Kaynak kartı ve nihai claim guard

## Karar davranışı

- Skor en az `0.72` ve ilk iki aday farkı en az `0.12`: cevap.
- Skor `0.50–0.72` arasında veya iki aday birbirine yakın: açıklama ister.
- Skor `0.50` altında: `not_available`.
- Eşit skorlar stabil claim kimliğine göre sıralanır.
- Bir mesajda en fazla iki alt soru kabul edilir.
- `previousTopic` yalnız kullanıcının daha önce gördüğü genel konu için takip
  ipucudur; rapor yetkisi vermez ve sahiplik kontrolünün yerine geçmez.

## Fail-closed filtreler

Bir iddia aşağıdakilerden biri varsa aday havuzuna giremez:

- Gerçek passage veya `entailed` claim–passage bağlantısı yoksa
- Bağlı kaynak yoksa
- Kaynak lisansı `pending`, `restricted` veya belirsizse
- Yaş sorusu, iddianın kodlanmış yaş kapsamıyla uyuşmuyorsa
- Statik paket kaydı `release_eligible` değilse
- İlişki birden fazla hop gerektiriyorsa veya doğrudan claim/source bağı yoksa

Rapor niyeti algılanıp kimliği kayıtlı, sahiplik zincirinden üretilmiş güvenli
rapor bağlamı yoksa klinik içerik açılmaz; yanıt bir rapor seçimi ister. Boolean
bayrak veya şekil olarak geçerli bir nesne yetki vermez. V3 vaka derleyicisi
bağlanana kadar doğrulanmış bağlam bulunsa bile vaka ve vaka–teori cevabı
`not_available` kalır; genel literatür yanıtı vaka hipotezi diye etiketlenmez.

Committed paket boş değilse server-only retrieval sınırı, paketin bütün kanonik
candidate yetkilerini runtime release gate ile yeniden doğrular. Kapı geçmezse
yanıt üretmeden fail-closed durur.

## Güncel dağıtım durumu

19 Temmuz 2026 itibarıyla V3 statik paketindeki yayıma uygun gerçek claim sayısı
sıfırdır. Bu nedenle üretim V3 retrieval yolu güvenli biçimde
`not_available` döndürür. Sentetik pozitif testler yalnız motor davranışını
kanıtlar; bilimsel korpusun tamamlandığını göstermez. Mevcut V2 motoru geri
dönüş nesli olarak değiştirilmeden kalır ve V3 henüz API'ye bağlanmaz.
