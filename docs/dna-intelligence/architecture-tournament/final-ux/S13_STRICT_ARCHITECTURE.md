# S13-Strict Architecture

S13-Strict, kör değerlendirmede görülen iki ayrı gücü birleştirir:

- **S1 içerik kontrolü:** gerekli claim ve cevap slotları deterministik olarak seçilir.
- **S5 dil davranışı:** Luna yalnız kilitlenmiş içeriği doğal Türkçeye dönüştürür.

Akış:

1. Soru mevcut QueryFrame sözleşmesiyle en fazla iki alt soruya ayrılır.
2. S1 her alt soru için gerekli claimleri seçer.
3. Her slotun `requiredClaimIds`, `lockedClaimIds` ve `sourceIds` değerleri değiştirilemez biçimde kilitlenir.
4. Açıklama isteniyorsa yalnız doğrudan açıklama, gerekli mekanizma/örnek, önemli sınır veya neden önemli olduğunu taşıyan `answerEligible` komşu claimlerden en fazla iki tanesi deterministik olarak seçilebilir. Tutulan ve elenen adayların karar nedenleri planda kaydedilir.
5. Planner, claim metninde açıkça desteklenen ilişkileri `claim A → relation R → claim B` sözleşmesi olarak kilitler. Aynı konu içinde bulunmak ilişki kanıtı sayılmaz.
6. Karşılaştırmada iki taraf slotuna graded-policy ile kontrollü bir sonuç slotu eklenir: açık ayrım `direct`, iki farklı ve izinli kavramsal tür `safe_categorical_inference`, kalan durumlar `abstain` olur.
7. Luna yalnız her slotun kilitli claim paketini yeniden yazar. Kaynak, claim veya ilişki seçmez.
8. Slot metinleri deterministik sırada birleştirilir.
9. Strict validator bütün slotları, bütün required claimleri, claim-slot aidiyetini, ilişki sözleşmesini, A/B/conclusion desteğini, conclusion support claim kimliklerini, kategori dayanağını, sayı/yaş/olumsuzluk/nedensellik sınırını ve cümle hizasını doğrular.
10. İlk aday geçmezse tek repair yapılır. İkinci aday da geçmezse bütün kilitli claimleri ve kontrollü sonucu içeren deterministik cevap gösterilir.

## Güvenlik özellikleri

- Bir slot için **bütün** required claimler zorunludur; “en az biri” yeterli değildir.
- Bir claim başka slotta kullanılamaz.
- Luna çıktısında kaynak seçimi bulunmaz; kaynaklar kilitli plandan sunucu tarafından türetilir.
- Yanlış claim ikamesi, kaynak dışı ekleme veya eksik slot varken Luna metni gösterilmez.
- Kilitli sözleşmede bulunmayan nedensellik, sonuç, açıklama, karşıtlık, zaman, eşdeğerlik, hiyerarşi veya karşılaştırma ilişkisi gösterilmez.
- Vaka ve kişisel veri bu aday hatta gönderilmez.

## 40 soruluk odak testi

Yeni geniş benchmark oluşturulmaz. Donmuş 100 soruluk paketten yalnız şu 40 vaka seçilir:

- 15 iki-alt-soru
- 10 takip/açıklama
- 10 karşılaştırma
- 5 düşük lexical overlap

Ham yanıtlar ResearchSSD üzerinde saklanır. Otomatik doğallık ölçümü yalnız vekil göstergedir; insan değerlendirmesi olarak sunulmaz. Bu çalışma production trafiğini değiştirmez.

v3 sonrasında yalnız donmuş 10 `comparison_relation` vakası graded conclusion policy ile yeniden çalıştırılır; diğer 30 vaka yeniden realize edilmez. Bu çalışma internal-canary kanıtı üretir, production veya release yetkisi vermez.
