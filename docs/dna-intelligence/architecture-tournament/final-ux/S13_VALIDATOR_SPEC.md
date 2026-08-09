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
