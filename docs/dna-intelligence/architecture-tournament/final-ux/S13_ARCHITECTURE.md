# DNA Intelligence S13 Architecture

S13, donmuş S1 bilgi çekirdeğini korur. GPT-5.6 Luna yalnız iki dar görevde kullanılabilir:

1. Kullanıcı iletisini kapalı `DnaS13QueryFrame@1` sözleşmesine dönüştürmek.
2. Seçilmiş claim ve kaynak paketini doğal Türkçeyle ifade etmek.

Luna yeni topic, claim, kaynak, sayı, biyolojik mekanizma veya klinik öneri üretemez. Rapor/vaka içeriği, kişisel veri ve güvenlik talepleri Luna hattına girmez.

## Varyantlar

- `S13-A`: Luna Query -> S1 retrieval -> required slots -> Luna realization -> validator.
- `S13-B`: S13-A; yalnız S1 güveni `<0.617638`, aday farkı `<0.12`, lexical/FTRL uyuşmazlığı veya cevaplanamaz slot varsa S2 denenir. S2 farklı destekli claim getirmezse S1 korunur.

Normal yol iki Luna çağrısıdır. Validator başarısızlığında en fazla bir repair çağrısı yapılır. Üçüncü çağrıdan sonra hâlâ doğrulanamayan çıktı gösterilmez; S1 deterministik cevap devreye girer.

## Konuşma durumu

Yalnız en fazla iki topic, focus, soru türü ve yanıt derinliği iki saat geçerli AES-256-GCM tokenında taşınır. Claim, passage, rapor kimliği veya klinik içerik tokena girmez. Token yönlendirme içindir; rapor yetkilendirmesinde kullanılamaz.

## Yayın sınırı

S13 feature flag’leri varsayılan kapalıdır. ChatGPT Pro değerlendirmesi ve üç bağımsız insan değerlendirmesi tamamlanmadan `publicAnswerMutationAllowed=false` kalır. Public yayın yapılırsa sıra `internal -> %10 -> %50 -> %100` olur; legacy tek ayarla geri dönüş yoludur.

Ham challenge, cevap, mapping ve değerlendirme dosyaları yalnız ResearchSSD’de tutulur. Repoda sözleşmeler, testler ve kişisel veri içermeyen hash özeti bulunur.
