# V3 esnek yanıt, kaynak ve karma vaka sözleşmesi

Bu katman Faz 32–34 için deterministik sunum ve birleştirme kurallarını uygular. Bilgi üretmez ve yayın kapılarını gevşetmez.

## Esnek yanıt profilleri

- `short`: bir ana onaylı iddia, bir temel sınır ve en fazla iki kaynak kartı.
- `standard`: en fazla dört onaylı bilimsel yanıt birimi ve dört kaynak kartı.
- `deep`: en fazla on iki onaylı bilimsel yanıt birimi ve sekiz kaynak kartı.

Derin profil daha fazla akıl yürütme izi göstermez. Yalnız aynı yayıma uygun pakette bulunan ek iddiaları kullanır. Gelişim, ölçüm, kanıt veya karşı kanıt bölümü için ayrı bir onaylı iddia yoksa motor bölümü uydurmaz; eksikliği açıklar.
Rapor seçilmemiş bir derin teori yanıtında vaka bağlamının bağlı olmadığı ayrıca belirtilir.

`kısaca`, `özetle`, `tek cümle`, `detaylı`, `kanıtlarıyla` ve `kaynaklarıyla` gibi açık doğal dil sinyalleri seçim kontrolünü değiştirebilir. Kısa ve derin sinyal aynı soruda çelişirse standart profil kullanılır.

## Claim–passage sadakati

Bilimsel her yanıt birimi en az bir kanonik claim, entailed passage ve kullanıcıya gösterilen kaynak kartına bağlıdır. Kartlar kaynak düzeyinde geniş bir destek izlenimi vermez; bir claim–passage kenarı için oluşturulur. Çok pasajlı bir iddia diğer görünen iddianın kart kapasitesini tüketemez. Başlık, yazar, yıl, DOI veya resmî bağlantı, kaynak türü, locator, kanıt düzeyi, yaş kapsamı, sınırlı desteklenen iddia ve bilinen sınır eksikse kart gösterilmez.

Rapor cümleleri bilimsel pasaj gibi gösterilmez. Bunlar yalnız izinli güvenli vaka alanlarına ve o alanın gerçek değerine birebir bağlanır. Soru konusu ile açık bir sözcüksel eşleşme yoksa ilişkisiz ilk rapor bulgusu kullanılmaz; “eşleşen bulgu kayıtlı değil” sınırı gösterilir. Güvenlik cümleleri de bilimsel kaynak atfı almaz; politika otoritesi olarak ayrılır.

## Karma vaka–teori yanıtı

Karma derleyici yalnız sahiplik zincirinden sonra kimlik tabanlı rapor otoritesi verilmiş kanonik bağlamı kabul eder. Raporda bulunan bulgu, eksik veri, genel literatür, çıkarılamayacak sonuç ve korunmuş kapasite/karşı kanıt ayrı bölümlerdir. Genel literatür bölümü yalnız V3 claim–passage paketinden gelir.

Her karma yanıtta şu sınır değişmeden bulunur:

> Bu rapor biyolojik mekanizmayı doğrudan ölçmez; rapor bulguları genel literatürle birlikte fakat ondan ayrı değerlendirilmelidir.

Ham yanıt, anamnez, rapor serbest metni, trace, rule ID ve dahili eşikler derleyicinin giriş sözleşmesinde yoktur. Saf vaka yanıtı bu fazda açılmamıştır.

## Mevcut yayın durumu

Bu kod ve testler sentetik yayıma uygun fixture’larla mühendislik sözleşmesini doğrular. Gerçek V3 statik paket hâlen boştur; bu faz gerçek bilimsel iddia yayımlamaz veya V2 karantinasını kaldırmaz.
