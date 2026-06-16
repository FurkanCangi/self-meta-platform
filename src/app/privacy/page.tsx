import LegalDocumentPage from "../components/legal/LegalDocumentPage"

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      title="Gizlilik Politikası"
      description="DNA Intelligence platformunun hesap, klinik değerlendirme, rapor üretimi, yapay zeka destekli çıktı, denetim ve destek süreçlerinde kişisel verileri nasıl işlediğini açıklar."
      sections={[
        {
          title: "1. Kapsam",
          body: [
            "Bu politika, DNA Intelligence web uygulamasını, değerlendirme formlarını, rapor üretim araçlarını, owner/admin denetim panelini, destek süreçlerini ve varsa video gözlem MVP modülünü kapsar.",
            "Platform uzmanlara karar destek aracı sunar. Platform çıktıları tek başına tanı, tedavi, terapi planı veya tıbbi karar yerine geçmez; nihai mesleki değerlendirme uzman kullanıcıya aittir.",
          ],
        },
        {
          title: "2. İşlenen Veri Kategorileri",
          body: [
            "Hesap verileri: ad soyad, e-posta, parola doğrulama bilgisi, oturum bilgisi, plan/paket bilgisi ve iletişim kayıtları.",
            "Danışan/çocuk verileri: uzman tarafından girilen çocuk/danışan kodu, yaş/ay bilgisi, anamnez, gözlem notları, değerlendirme cevapları, ölçek skorları, klinik bağlam ve rapor çıktıları.",
            "Teknik veriler: IP adresi, cihaz/tarayıcı bilgisi, işlem zamanı, güvenlik logları, hata kayıtları ve clickwrap kabul kanıtları.",
            "Video gözlem modülü kullanılırsa video segmentleri, kalite ölçümleri, çıkarılan hareket/kanıt sinyalleri, rapor özetleri ve klinisyen inceleme kayıtları işlenebilir.",
          ],
        },
        {
          title: "3. Kullanım Amaçları",
          body: [
            "Veriler; hesap açma, kimlik doğrulama, paket kullanımını yönetme, değerlendirme ve rapor üretme, destek sağlama, güvenliği koruma, kötüye kullanımı önleme, yasal saklama yükümlülüklerini yerine getirme ve uyuşmazlıkları yönetme amaçlarıyla işlenir.",
            "Owner/admin yetkilileri kimlikli verilere yalnız hizmet sunumu, teknik destek, güvenlik, denetim, yasal saklama, ödeme ve uyuşmazlık yönetimi amaçlarıyla erişebilir.",
            "Ürün geliştirme, kalite ölçümü, rapor doğruluğu analizi, istatistik ve akademik/operasyonel değerlendirme için veriler mümkün olan ölçüde anonimleştirilmiş veya toplulaştırılmış şekilde kullanılır. Kimlikli çocuk/danışan verisi pazarlama amacıyla satılmaz veya üçüncü kişilere bu amaçla verilmez.",
          ],
        },
        {
          title: "4. Yapay Zeka ve Altyapı Sağlayıcıları",
          body: [
            "Rapor üretiminde OpenAI veya benzeri LLM/API sağlayıcıları kullanılabilir. Bu durumda rapor üretimi için gerekli sınırlı içerik API sağlayıcısına aktarılabilir ve çıktı uzman kullanıcıya karar destek metni olarak sunulur.",
            "Veriler Supabase gibi veritabanı, kimlik doğrulama ve depolama sağlayıcıları; Vercel gibi barındırma/dağıtım sağlayıcıları; ileride entegre edilecek ödeme/fatura sağlayıcıları ve güvenlik/monitoring araçlarıyla işlenebilir.",
            "Sağlayıcı seçimi yapılırken erişim yetkileri, güvenlik, saklama ve aktarım riskleri gözetilir. Yurt dışı aktarım gerektiren süreçler açık rıza ve ilgili mevzuat çerçevesinde ayrıca ele alınır.",
          ],
        },
        {
          title: "5. Saklama, Silme ve Owner Audit",
          body: [
            "Kullanıcı arayüzünde silinen kayıtlar günlük kullanım görünürlüğünden kaldırılabilir. Ancak denetim, veri bütünlüğü, uyuşmazlık, yasal saklama ve güvenlik amaçlarıyla sınırlı snapshot kayıtları owner audit katmanında saklanabilir.",
            "Saklama süreleri veri kategorisine, hukuki sebebe, sözleşme ilişkisine, yasal yükümlülüklere ve teknik güvenlik ihtiyacına göre belirlenir. Süresi dolan veriler silinir, yok edilir veya anonim hale getirilir.",
          ],
        },
        {
          title: "6. Kullanıcı Hakları ve İletişim",
          body: [
            "İlgili kişiler KVKK kapsamındaki başvuru haklarını kullanmak için [ILETISIM_EPOSTA] adresine başvurabilir. Başvuruda kimlik doğrulama ve talebin hangi veriyle ilgili olduğunun açıklanması istenebilir.",
            "Uzman kullanıcı, platforma girdiği danışan/çocuk verileri için gerekli bilgilendirme ve izinleri aldığını; yetkisiz veri girmeyeceğini kabul eder.",
          ],
        },
      ]}
    />
  )
}
