# DNA Intelligence V3 kaynak, kimlik ve lisans yönetişimi

Sürüm: `dna-source-governance@1`
Denetim tarihi: 2026-07-19

## Kaynak önceliği

A–E sınıfı kaynağa kalıcı bir kalite etiketi olarak değil, soru türüne göre verilir. Konsensüs, kılavuz ve güçlü sentezler A; güçlü birincil çalışmalar B; ders kitapları ve narrative review'lar C; teori/preprint D; blog, pazarlama, sosyal medya ve yalnız metadata E sınıfıdır. D sınıfı yalnız açık `theory_only` veya `contested` çerçevesinde kullanılabilir; E sınıfı bilimsel iddiayı destekleyemez. Mekanizma, ölçüm, gelişim, ilişki, müdahale kanıtı ve vaka yorumu uygun insan/hayvan/in-vitro eşleşmesi olmadan desteklenmez. Gelişim, ölçüm ve vaka yorumunda hem claim hem kaynak için yaş ve örneklem kapsamı zorunludur; başka bir soru türünde yaş iddiası verildiğinde de aynı eşleşme uygulanır.

Mevcut 47 kaynağın tamamı bu sözleşmeye göre normalize edildi. Bu, kaynakların claim düzeyinde yayımlandığı anlamına gelmez; V3 runtime bilimsel release sayısı hâlâ sıfırdır.

## Kimlik ve çalışma ailesi

Her kayıt DOI, PMID, PMCID veya ISBN; başlık, yazarlar, yıl, dergi/kurum; yayın sürümü, düzeltme yönü, work ve cohort family alanlarıyla denetlenir. Preprint ile version of record aynı bağımsız kanıt sayılmaz; düzeltme bildirimi kendi başına claim desteği olamaz; aynı work veya cohort yeniden sayılmaz. Yinelenen DOI/PMID/PMCID/ISBN ve title–identifier–year uyuşmazlığı paketi kapatır.

Gerçek audit sonucu: 47 kaydın 39'u kimlik kapısını geçti, 8'i güçlü çevrimiçi kimlik/ISBN otoritesi bulunmadığı için `pending`, uyuşmazlık sayısı sıfırdır. Work/version/correction/cohort alanlarının 47'si de işlendi. Gelen ve giden düzeltme ilişkileri kanonik kayıtta yön, hedef DOI ve yerel hedef kimliğiyle tutulur; çözülmemiş bir ilişki kaynağı kapatır, gelen düzeltmesi bulunan makale ancak düzeltmenin içeriğe işlendiği `corrected` sürüm olarak yayımlanabilir. Mevcut 47 kayıtta düzeltme ilişkisi bulunmadı (`not_applicable`). Pending kimlikler runtime'a giremez.

Kaynak metadata'sı yaş ve örneklem kapsamını açıkça vermiyorsa sistem başlıktan tahmin yapmaz. Mevcut 47 kaydın 47'sinde de bu iki alan `not_reported` durumundadır. Dolayısıyla bu kaynaklar claim düzeyinde ayrı kodlama tamamlanana kadar gelişim, ölçüm ve vaka yorumu iddialarını destekleyemez.

## Bileşen lisansı

Lisans tek bir kaynak etiketi değildir. Metadata, abstract, full text, passage, table, figure, scale ve test items ayrı karara sahiptir. Canonical allowlist CC0, CC BY ve yükümlülükleri açık CC BY-SA ile sınırlıdır. NC, ND, tüm hakları saklı, bilinmeyen lisans ve kaynak kimliğiyle eşleşmeyen lisans kanıtı fail-closed davranır. Bir HTTPS adresinin bulunması tek başına lisans kanıtı değildir: metadata dışındaki `cleared` kararı ya kaynağın yerel artefaktında doğrulanmış lisans beyanına ve artefakt hash'ine ya da izin verilen resmi lisans otoritesinden doğrulanmış sayfa kanıtına bağlı olmalıdır. “Except where otherwise noted” içeren kaynaklarda full text ve pasaj ayrıca kapalıdır. Tablo, şekil, ölçek ve test maddeleri kaynak açık lisanslı olsa bile bağımsız üçüncü taraf incelemesi olmadan kullanılamaz.

Auditte 47 kaynak × 8 bileşen = 376 karar üretildi. Artefakt içinde lisans beyanı doğrulanan 10 kaynakta abstract/full-text/passage lisans kapısını geçti. Kalan full-text/passage kararları 20 `unknown`, 14 `restricted` ve 3 `metadata_only` olarak kapalıdır; fakat lisans uygunluğu tek başına runtime release değildir. Çıktı attribution veya ShareAlike gerektiriyorsa release derleyicisi yapılandırılmış notice payload'ını yeniden hash'ler ve kaynak kimliği, bibliyografya, bileşen, lisans kaydı ve uygun çıktı lisansıyla karşılaştırır. Tüm tablo, şekil, ölçek ve test maddeleri 47/47 restricted tutuldu.

## Yeniden üretim

- Offline sözleşme ve snapshot: `npm run chat:source-governance`
- ResearchSSD ile birebir ledger/hash doğrulaması: `npm run chat:source-governance:ssd`
- Otoriteleri yeniden sorgula, SSD auditini ve repo snapshot'ını birlikte yenile: `npm run chat:source-audit:online`

Ham çevrimiçi cevaplar, kimlik ve bileşen ledger'ları ResearchSSD'de kalır. Repo snapshot'ı yalnız kontrollü metadata, kararlar ve SHA-256 kanıtlarını taşır; tam metin, pasaj, tablo, ölçek veya test maddesi içermez.
