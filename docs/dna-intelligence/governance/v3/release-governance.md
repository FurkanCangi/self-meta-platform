# DNA Intelligence V3 yayın derleyicisi

Sürüm: `dna-v3-release-compiler@1`

V3 içeriği tek bir etikete bakılarak canlıya alınmaz. Derleyici; kapsam hücresi, içerik yaşam döngüsü, bilgi otoritesi, kaynak sınıfı, kimlik/çalışma ailesi ve bileşen lisansı kapılarını birlikte doğrular. Herhangi bir kapı kapanırsa aday fail-closed biçimde çalışma paketinin dışında kalır.

Her claim, kaynak, pasaj ve bileşenin gerçek kanonik payload'ı derleme anında yeniden SHA-256 ile özetlenir; sonuç hem aday hash'iyle hem yaşam döngüsü kaydıyla birebir eşleşmek zorundadır. Bilimsel zincir ayrıca `source → passage → component → claim` kimlik ve hash'lerinin yanında kaynak kimliği, lisans matrisi ve A–E öncelik profilinin hash'lerini tek bir provenance kaydında bağlar; başka kaynağın lisansını veya released bileşenini ödünç almak geçersizdir. Aynı kaynağın aynı payload ile birden fazla iddiayı desteklemesi sahte yinelenen kaynak sayılmaz. Buna karşılık aynı claim, kaynak, pasaj veya bileşen kimliği farklı payload/hash ile görünürse ya da aynı kaynak kimliği farklı kimlik/lisans/öncelik profili taşırsa ilgili adayların tümü kapanır.

DNA ürün iddiası için ayrıca sahip onaylı kitap sürümü ile onaylı pasaj bağı zorunludur. Kitap henüz gelmediğinden mevcut durum `deferred_owner_book` ve canlı V3 ürün iddiası sayısı sıfırdır. Dış bilimsel bir iddia ise soru türüne uygun A–E sınıfını, yayın/örneklem sınırını, tekilleştirilmiş çalışma ailesini ve kullanılacak bileşene özgü açık lisansı geçmelidir. Lisansın attribution veya ShareAlike yükümlülüğü varsa, derlenen çıktının bu yükümlülüğü karşıladığı notice hash'iyle ayrıca kanıtlanır; yalnız “yükümlülük var” bayrağı yayın izni değildir.

Alanları doğru görünen bir aday kendi kendini yayınlayamaz. Tam aday nesnesinin deterministik özeti ancak bağımsız denetim tamamlandıktan sonra kod içindeki değişmez `dna-v3-audited-release-registry@1` kaydına eklenebilir. Bu kayıt şu anda bilerek boştur; dolayısıyla sentetik fixture, uydurma DOI veya çağıranın kendi beyan ettiği lisans kaydı release üretemez.

Mevcut V2 katalog rollback yolu korunur; V2'deki `approved`, `sourceVerified` veya benzeri bir alan V3 `released` statüsüne çevrilmez. API çıkışında `dna-chat-runtime-release-gate@1` çalışır: yalnız tam `dna-chat-engine@2` sürümü açıkça adlandırılmış değişmez `v2_legacy` rollback politikasıyla geçebilir. V3 cevap için boş olmayan aday kimliklerinin tamamının güncel V3 release paketinde bulunması gerekir. Bilinmeyen nesil, motor sürümü veya aday fail-closed kalır. Bu, V2 içeriğinin yanlış olduğu iddiası değil; V3 denetiminin geriye dönük olarak uydurulmaması için bir geçiş sınırıdır.

Derleyici aynı girdiye aynı sıralı kararları ve aynı hash'i verir. Kullanıcı cevabına dahili block kodu veya denetim izi taşınmaz.
