# S13 Writing Contract

- Cevap, yalnız content planındaki izinli claim’lerle yazılır.
- Doğrudan cevap önce gelir; ardından gerekli açıklama, ilişki/karşılaştırma, ikinci alt soru ve zorunlu kısa sınır gelir.
- İki desteklenen alt soruda iki slotun da kapsanması zorunludur.
- Claim kimlikleri ve dahili teknik etiketler kullanıcı metninde gösterilmez.
- “Kısaca:” gibi mekanik açılış zorunlu değildir.
- Yeni örnek, sayı, süre, yaş kapsamı, ölçüm değeri, mekanizma, nedensellik, tanı veya müdahale eklenemez.
- Kaynakta bulunmayan kesinlik ve epistemik güç artırılamaz.
- Gereksiz güvenlik/sınırlılık paragrafı eklenmez; zorunlu sınır kısa ve doğal yazılır.
- `short`, `standard` ve `deep` profilleri yeni bilgi değil, aynı izinli claim paketinin farklı yoğunluklarıdır.

## S13-Strict dil sözleşmesi

- Luna’ya aday claim havuzu verilmez; yalnız deterministik olarak kilitlenmiş slot içeriği verilir.
- Her slot bağımsız yazılır ve sunucu tarafından sabit sırada birleştirilir.
- Açıklama isteyen soruda iki-dört bağlantılı cümle ancak kilitli açıklayıcı claim paketi bunu destekliyorsa üretilebilir.
- Akıcılık amacıyla claim seçme, claim çıkarma, başka claimle ikame veya serbest bilimsel tamamlama yapılamaz.
- Claim metnini kelimesi kelimesine yapıştırmak yerine anlam, olumsuzluk, kapsam ve kesinlik korunarak doğal Türkçe kullanılmalıdır.
- “çünkü”, “bu nedenle”, “dolayısıyla”, “sonucunda”, “yol açar”, “neden olur” ve benzeri bağlaçlar yeni bir ilişki kuruyorsa kullanılamaz; yalnız kilitli ilişki türünün doğal Türkçe yüzeyi olabilir.
- Karşılaştırma yanıtı A tarafı, B tarafı ve karşılaştırma sonucu olmak üzere üç slot içerir. Sonuç sırasıyla direct, safe categorical inference ve abstain kapılarından geçer.
- Safe categorical inference yalnız `yapı`, `süreç`, `ölçüm`, `kuramsal çerçeve`, `klinik örnek`, `değerlendirme başlığı`, `işlevsel hedef`, `fizyolojik sistem`, `bilişsel süreç` ve `gelişimsel kavram` etiketlerini kullanabilir.
- Kategori iki locked taraftan ayrı ayrı türetilemiyorsa veya başlık ile claim birbirini temsil etmiyorsa sonuç yeni ilişki kurmaz; kontrollü abstention metni kullanılır.
- Açıklayıcı claim yalnız soruyu doğrudan açıklıyor, gerekli mekanizmayı/örneği/sınırı veriyor veya neden önemli olduğunu gösteriyorsa tutulur. Aynı konu komşuluğu tek başına yeterli değildir.

## Evidence sufficiency ve kullanıcı dili

- Her requested facet, cevap planından önce gerçek verified claimlere karşı `SUPPORTED_DIRECT`, `SUPPORTED_DERIVED`, `UNSUPPORTED` veya `NOT_REQUESTED` olarak sınıflanır.
- `system.facet-boundary:*` bir bilimsel claim, required claim veya coverage birimi değildir ve cevap planına alınamaz.
- `SUPPORTED_DERIVED` yalnız verified claimler ile izinli kontrollü ilişki/semantik eşleme üzerinden kurulabilir; yeni mekanizma, nedensellik, popülasyon, sayı, biyoloji veya hiyerarşi üretemez.
- Örnek isteğinde yalnız kaynak claim içindeki açık örnek, somut durum, günlük yaşam görünümü veya açıklayıcı senaryo kullanılabilir. Model yeni örnek oluşturamaz.
- “Neden önemli?” ve işlev sorularında işlevsel anlamın yanı sıra günlük işlev, katılım, ölçüm yorumu ve yorum sınırıyla doğrudan ilgili verified claimler değerlendirilebilir; relevance mapping bilimsel otorite değildir.
- Desteklenen bütün facetler normal yanıtlanır. Bir veya daha fazla facet gerçekten unsupported ise cevapta gerekliyse en fazla bir kısa ve doğal evidence-limitation cümlesi bulunur.
- Kullanıcı metni evidence-management dilini göstermez: `kilitli içerik`, `locked claim`, `claim`, `facet`, `system.facet-boundary`, `catalog`, `topicId` ve `requiredClaim` yazılmaz.
- Aynı limitation tekrarlanmaz ve her eksik facet için ayrı katalog-durumu cümlesi kurulmaz.
