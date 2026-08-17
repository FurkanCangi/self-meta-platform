# S13 Validator Specification

Validator `dna-s13-validator@1`, Luna cevabı gösterilmeden önce aşağıdaki kapıları uygular:

- kullanılan claim ve kaynakların izin listesinde bulunması;
- claim ile kaynak ilişkisinin korunması;
- her zorunlu slotun gerçekten kapsanması;
- her zorunlu slotta en az bir gerekli claim’in kullanılması;
- yeni sayı, süre veya ölçüm değeri eklenmemesi;
- yaş/popülasyon kapsamının genişletilmemesi;
- olumsuzluğun ve epistemik kipliğin değiştirilmemesi;
- nedensellik düzeyinin yükseltilmemesi;
- her olgusal cümlenin izinli bir claim’e hizalanması.

İlk başarısızlıkta hata kodlarıyla tek repair çağrısı yapılabilir. İkinci aday da başarısızsa Luna metni gösterilmez ve deterministik S1 cevabı kullanılır. Validator başarısızken gösterilen Luna cevabı kabul kapısında sıfır olmalıdır.

## S13-Strict farkı

`dna-s13-strict-validator@4` daha dar bir sözleşme uygular:

- her slot için bütün `requiredClaimIds` zorunludur;
- bütün `lockedClaimIds` kullanılmadan slot tamamlanmış sayılmaz;
- bir claim başka slota taşınamaz;
- Luna kaynak seçmez, kaynaklar kilitli plandan türetilir;
- slot sırası değiştirilemez;
- nedensellik, sonuç, açıklama, karşıtlık, zaman sırası, eşdeğerlik, hiyerarşi ve karşılaştırma sonucu gibi söylem ilişkileri ancak kilitli `claim A → relation R → claim B` sözleşmesinde destekleniyorsa kullanılabilir;
- farklı Türkçe bağlaçlar aynı kilitli ilişki türünü ifade edebilir; kilitli olmayan bir ilişki `unsupported_relation_addition` ile reddedilir;
- karşılaştırmada A tarafı, B tarafı ve `comparison_conclusion` desteği ayrı boolean kapılarla doğrulanır;
- conclusion yalnız doğrudan locked ayrımı, iki tarafta açıkça türetilebilen ve izin listesindeki farklı kategorileri veya kontrollü abstention metnini kullanabilir;
- `aynı düzeyde değildir` sonucu ancak `comparisonConclusionSupportClaimIds`, kategori etiketleri ve türetim kuralı planda kayıtlı ve validator tarafından yeniden üretilebilir olduğunda kabul edilir;
- claim ile karşılaştırma başlığı arasında açık temsil bağı yoksa kategori sonucu kurulmaz;
- required-slot ve required-claim kapsamı ayrı ayrı `%100` olmadan Luna cevabı gösterilemez.
- Evidence Sufficiency Matrix her requested facet için destek durumunu, gerçek `supportClaimIds`, izinli `supportRelationIds` ve confidence değerini taşır; unsupported durumunda support dizileri boş olmalıdır.
- Scientific coverage yalnız `SUPPORTED_DIRECT + SUPPORTED_DERIVED` üzerinden hesaplanır; `UNSUPPORTED` coverage değildir.
- Evidence bulunan requested facet final cevapta temsil edilmezse `SUPPORTED_FACET_OMITTED` oluşur. Gerçek evidence bulunmayan `UNSUPPORTED` facet tek başına omission değildir.
- `evidence_limitation` slotu en fazla birdir; locked/required claim taşımaz, yalnız plandaki kontrollü doğal cümleyi boş `usedClaimIds` ile kullanabilir.
- Kullanıcıya görünen metinde evidence-management jargonu bulunursa `internal_evidence_jargon`; limitation planla uyuşmazsa `evidence_limitation_mismatch` oluşur.
- `system.facet-boundary:*` herhangi bir locked/required/support claim listesine girerse plan geçersizdir.

İlişki reddi repair çağrısına hata koduyla aktarılır. Repair güvenli, nötr bir bağlaçla ilişki iddiasını kaldırabilir; repair de geçmezse deterministik fallback çalışır.
