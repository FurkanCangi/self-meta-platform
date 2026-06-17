# Sistem Kullanım Protokolü

Bu protokol, `literature-catalog.md` içindeki geniş kaynak havuzunun rapor motorundaki `8. Literatürle Uyumlu Klinik Dayanak` bölümüne nasıl taşınacağını tanımlar.

## Katmanlar

1. Geniş katalog
   - Dosya: `docs/clinical-literature-catalog/literature-catalog.md`
   - Amaç: Alan bazlı literatür havuzunu geniş tutmak.
   - Doğrudan rapora kaynak vermez.

2. Doğrulanmış runtime registry
   - Dosya: `src/lib/dna/literatureNote.ts`
   - Nesne: `VERIFIED_LITERATURE_SOURCES`
   - Amaç: Raporlarda kullanılmasına izin verilen kaynakları tutmak.
   - AI bu liste dışında kaynak, DOI, URL veya APA üretmez.

3. Katalog seçim haritası
   - Dosya: `src/lib/dna/literatureNote.ts`
   - Nesne: `CATALOG_LITERATURE_SELECTIONS`
   - Amaç: Her klinik alan için katalogdan seçilmiş çekirdek kaynakları görünür kılmak.

4. Deterministik seçim
   - Fonksiyon: `buildLiteratureAlignedSection`
   - Amaç: Vakanın zayıf alanları, eşleşen anamnez temaları, dış test kategorileri ve terapist gözlemlerine göre sınırlı sayıda kaynak cümlesi seçmek.

## Kaynak Ekleme İş Akışı

1. Kaynak önce `literature-catalog.md` içine eklenir.
2. DOI, PubMed veya dergi sayfası doğrulanır.
3. Kaynağın kullanım sınırı yazılır.
4. Raporlarda kullanılacaksa `VERIFIED_LITERATURE_SOURCES` içine alınır.
5. Alan çekirdeğine dahil edilecekse `CATALOG_LITERATURE_SELECTIONS` içine eklenir.
6. Gerekirse `buildDomainParagraph` içinde ilgili vaka koşuluna bağlanır.
7. `npm run report:quality` ve `npm run report:audit` çalıştırılır.

## Seçim Kuralları

- Genel self-regülasyon paragrafı her raporda kısa tutulur.
- Alan paragrafı yalnız vaka tarafından desteklenen alanları kullanır.
- İnterosepsiyon, fizyolojik, duyusal, duygusal, bilişsel ve yürütücü kaynaklar aynı anda yığılmaz; vaka profili ve dış test kategorisi sıralamayı belirler.
- Kaynakça yalnız seçilmiş cümlelerde kullanılan kaynaklardan oluşur.
- Kaynak sınır paragrafı her zaman eklenir.

## Yasaklar

- AI kaynak üretmez.
- Katalogdaki her kaynak otomatik olarak rapora girmez.
- Kaynaklar tanı, nedensellik veya müdahale reçetesi üretmek için kullanılmaz.
- Pilot/fizibilite çalışmalar tek başına güçlü klinik dayanak gibi yazılmaz.
