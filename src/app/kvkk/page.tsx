import LegalDocumentPage from "../components/legal/LegalDocumentPage"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "@/lib/dna/chat/intendedUse"

export default function KvkkPage() {
  return (
    <LegalDocumentPage
      title="KVKK Aydınlatma Metni"
      description="6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında DNA Intelligence kullanıcılarının ve platforma girilen danışan/çocuk verilerinin işlenmesine ilişkin aydınlatma metnidir."
      sections={[
        {
          title: "1. Veri Sorumlusu",
          body: [
            "Veri sorumlusu [VERI_SORUMLUSU_UNVANI] olup iletişim adresi [ILETISIM_EPOSTA] şeklindedir. Resmi unvan, vergi/MERSIS ve adres bilgileri yayına çıkmadan önce tamamlanacaktır.",
            "Bu metin, DNA Intelligence platformunun web uygulaması, üyelik, ödeme, eğitim erişimi, klinik değerlendirme, rapor üretimi, DNA Asistanı, güvenlik/audit ve destek süreçleri için hazırlanmıştır.",
          ],
        },
        {
          title: "2. Kişisel Veri Kategorileri",
          body: [
            "Kimlik ve iletişim verileri: uzman kullanıcının ad soyad, e-posta, hesap, doğrulama ve iletişim bilgileri.",
            "Üyelik, ödeme ve sözleşme verileri: paket/plan bilgisi, ödeme sağlayıcı event kayıtları, abonelik/erişim durumu, fatura/ödeme referansları, clickwrap kabul kayıtları ve açık rıza kanıtları.",
            "Güvenlik ve işlem verileri: IP adresi, cihaz/tarayıcı bilgisi, oturum kayıtları, kayıtlı cihaz bilgisi, aktif session durumu, anomali/risk sinyalleri, erişim logları, API kullanım kayıtları ve hata/güvenlik kayıtları.",
            "Eğitim erişimi verileri: eğitim/video erişim zamanı, kısa süreli erişim token kayıtları, video izleme olayları, kullanıcıya özel watermark/QR/kısa kod kayıtları ve kötüye kullanım inceleme logları.",
            "Danışan/çocuk verileri: uzman tarafından girilen kod, yaş/ay bilgisi, anamnez, gelişimsel/klinik gözlem, değerlendirme cevapları, skorlar, raporlar ve varsa video gözlem çıktıları.",
            "Özel nitelikli kişisel veri niteliği taşıyabilecek sağlık/gelişim/terapi bağlamlı veriler, yalnız hizmetin gerektirdiği ölçüde ve açık rıza süreçleriyle işlenir.",
          ],
        },
        {
          title: "3. İşleme Amaçları",
          body: [
            "Veriler; üyelik oluşturma, kimlik doğrulama, tek aktif oturum ve cihaz sınırı uygulama, paket/ödeme yönetimi, eğitim erişimi, değerlendirme ve rapor üretimi, uzman destek hizmeti, sistem güvenliği, hata giderme, denetim, yasal saklama, uyuşmazlık yönetimi ve kötüye kullanımın önlenmesi amaçlarıyla işlenir.",
            "Güvenlik kayıtları; hesap paylaşımı, yetkisiz erişim, ödeme manipülasyonu, API kötüye kullanımı, video/eğitim sızıntısı ve veri ihlali risklerini tespit etmek, önlemek ve gerektiğinde incelemek için tutulur.",
            "Anonimleştirilmiş veya toplulaştırılmış veriler ürün geliştirme, kalite ölçümü, rapor doğruluğu analizi ve istatistiksel değerlendirme amacıyla kullanılabilir.",
          ],
        },
        {
          title: "4. Hukuki Sebepler",
          body: [
            "Hesap, üyelik, paket ve hizmet sunumu verileri sözleşmenin kurulması/ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanabilir.",
            "Güvenlik, audit, erişim logu, kötüye kullanım önleme, ödeme doğrulama ve uyuşmazlık yönetimi kayıtları; veri güvenliğinin sağlanması, sözleşmenin korunması, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat kapsamında işlenebilir.",
            "Özel nitelikli veri, çocuk/danışan verisi, deterministik rapor üretimi ve gerekli yurt dışı aktarım süreçlerinde açık rıza alınması öngörülür. Açık rızanın geri alınması halinde hizmetin ilgili veri işleme kısmı durdurulabilir veya sınırlanabilir; hukuken saklanması gereken kayıtlar saklanmaya devam edebilir.",
          ],
        },
        {
          title: "5. Aktarım Yapılabilecek Taraflar",
          body: [
            "Veriler, hizmetin gerektirdiği ölçüde barındırma, veritabanı, kimlik doğrulama, güvenlik, loglama, ödeme/fatura, destek ve hukuki danışmanlık sağlayıcılarına aktarılabilir. Rapor üretimi ve DNA Asistanı yanıtı amacıyla klinik içerik harici bir üretken yapay zeka veya LLM sağlayıcısına aktarılmaz.",
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.privacyTr,
            "Yurt dışı altyapı sağlayıcısı kullanılması halinde aktarım açık rıza ve ilgili mevzuat çerçevesinde yürütülür.",
          ],
        },
        {
          title: "6. Teknik ve İdari Güvenlik Tedbirleri",
          body: [
            "Platformda kimlik doğrulama, e-posta doğrulama, aktif uygulama oturumu, aynı anda tek aktif oturum, hesap başına sınırlı cihaz politikası, kısa süreli erişim tokenları, same-origin kontrolleri, rate limit ve yetki kontrolleri uygulanabilir.",
            "Eğitim/video içerikleri için doğrudan public dosya linki yerine private storage veya private video provider, kısa süreli signed URL veya signed playback/embed tokenı, domain restriction, kullanıcıya özel watermark/QR/kısa kod, erişim tokenı ve izleme/erişim logu kullanılabilir.",
            "Ödeme ve ekonomik güvenlik için client tarafındaki ödeme durumuna tek başına güvenilmez; erişim hakları doğrulanmış ödeme webhookları veya audit kayıtlı manuel işlem ile server tarafında tutulur.",
            "Owner/admin export, deterministik rapor üretimi, video erişimi, güvenlik olayları, ödeme eventleri ve KVKK veri talepleri için audit kayıtları tutulabilir. Hassas içeriklerin uygulama loglarına düşmemesi için log redaction ve debug log kapatma politikaları uygulanır.",
          ],
        },
        {
          title: "7. Saklama, Silme ve Anonimleştirme",
          body: [
            "Kişisel veriler işleme amacı, sözleşme ilişkisi, yasal yükümlülük, uyuşmazlık ihtimali, güvenlik/audit ihtiyacı ve saklama-imha politikası kapsamında gerekli süreyle saklanır.",
            "Ürün arayüzünde silinen kayıtlar görünürlükten kaldırılabilir; ancak denetim, veri bütünlüğü, güvenlik, yasal saklama ve uyuşmazlık amaçlarıyla sınırlı audit snapshot kayıtları ayrı ve yetki kısıtlı katmanda tutulabilir.",
            "Saklama amacı sona eren veriler teknik uygunluğa göre silinir, yok edilir veya anonim hale getirilir. Yedekler, loglar ve audit kayıtları teknik döngüler ve yasal saklama gereklilikleri nedeniyle ana ürün arayüzünden daha uzun süre tutulabilir.",
          ],
        },
        {
          title: "8. Toplama Yöntemi ve İlgili Kişi Hakları",
          body: [
            "Veriler web arayüzü, değerlendirme formları, API istekleri, ödeme sağlayıcı webhookları, çerez/oturum teknolojileri, cihaz/session kontrolleri, destek yazışmaları, video/eğitim erişim kayıtları ve sistem logları yoluyla elektronik ortamda toplanır.",
            "İlgili kişiler KVKK madde 11 kapsamındaki bilgi edinme, düzeltme, silme/yok etme, anonimleştirme, aktarıma itiraz ve zararın giderilmesini talep etme hakları için [ILETISIM_EPOSTA] adresine başvurabilir.",
            "Platform içinde teknik olarak desteklendiğinde veri erişim, silme, anonimleştirme, dışa aktarma veya düzeltme talepleri güvenli kullanıcı oturumu üzerinden alınabilir. Başvuruların sonuçlandırılabilmesi için kimlik/doğrulama ve talebin kapsamına ilişkin ek bilgi istenebilir.",
          ],
        },
        {
          title: "9. Kaynak ve Gözden Geçirme",
          body: [
            "Bu metin 6698 sayılı KVKK, aydınlatma yükümlülüğü, özel nitelikli kişisel veri, veri güvenliği, saklama ve imha ilkeleri dikkate alınarak teknik ürün mimarisiyle uyumlu olacak şekilde hazırlanmıştır.",
            "Ürün kapsamı, ödeme sağlayıcısı, video/eğitim modülü, yurt dışı aktarım yapısı veya mevzuat değiştiğinde metin güncellenir. Yayına çıkmadan önce resmi veri sorumlusu bilgileri ve nihai hukuki değerlendirme tamamlanmalıdır.",
          ],
        },
      ]}
    />
  )
}
