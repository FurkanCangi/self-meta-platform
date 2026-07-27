# Türkçe retrieval V1 kilitli değerlendirme sonucu

Bu kayıt, geliştirme verisinde dondurulmuş Türkçe konu yönlendiricisinin daha önce
görmediği 126 soruluk iç değerlendirmede yalnız bir kez çalıştırılmasını belgeler.
Değerlendirme sorularını veya beklenen yanıtları sonuç dosyasına ya da repoya
kopyalamaz; yalnız toplu sayılar, konu düzeyi oranlar ve bütünlük hash'leri tutulur.

Sonuç bir bağımsız insan ya da klinik geçerlik çalışması değildir. Önceden tanımlı
kalite kapısı geçilmediği için bu adapter runtime, release veya V3 aktivasyon
otoritesi taşımaz. Tek koşu sonucu değiştirilmez ve aynı V1 holdout üzerinde
iyileştirme sonrası yeniden test yapılmaz. Sonraki geliştirme yalnız geliştirme
verisinde yapılır; yeni aday ancak ayrı ve önceden mühürlenmiş bir holdout üzerinde
değerlendirilebilir.

`chat:locked-evaluation:result:verify:ssd` komutu claim, sonuç, adapter geliştirme
manifesti, holdout hash'i ve exact değerlendirme kod kapanışını yeniden doğrular.
Doğrulayıcı kilitli soru artefaktını açmaz.
