import LegalDocumentPage from "../components/legal/LegalDocumentPage"
import {
  DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR,
  DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
} from "@/lib/dna/chat/intendedUse"

export default function ExplicitConsentPage() {
  return (
    <LegalDocumentPage
      title="Açık Rıza Metni"
      description="Özel nitelikli kişisel veriler, çocuk/danışan verileri, deterministik rapor üretimi ve gerekli altyapı aktarımı için alınacak ayrı açık rıza beyanının taslağıdır."
      sections={[
        {
          title: "1. Rızanın Konusu",
          body: [
            "Kullanıcı, platforma girdiği danışan/çocuk verilerinin değerlendirme, deterministik rapor taslağı oluşturma, güvenli saklama ve gerektiğinde teknik destek amacıyla işlenmesine açık rıza verdiğini kabul eder.",
            "Kullanıcı, danışan/çocuk verisini platforma girmeye yetkili olduğunu; gerekli veli, yasal temsilci, danışan veya kurum izinlerini kendi sorumluluğunda aldığını beyan eder.",
          ],
        },
        {
          title: "2. Özel Nitelikli Veriler",
          body: [
            "Anamnez, gelişimsel gözlem, terapi/klinik değerlendirme, ölçek cevapları, rapor sonuçları ve varsa video gözlem çıktıları özel nitelikli kişisel veri niteliği taşıyabilir.",
            "Bu veriler yalnız DNA Intelligence hizmetinin sunulması, rapor üretimi, kalite kontrol, güvenlik, denetim ve yasal saklama amaçlarıyla işlenir.",
          ],
        },
        {
          title: "3. Deterministik Rapor Üretimi",
          body: [
            "Kullanıcı, değerlendirme verilerinin uygulamanın kendi sunucu tarafı kuralları ve yerel klinik bilgi tabanı kullanılarak terapist incelemesine açık deterministik bir rapor taslağına dönüştürüleceğini kabul eder. Rapor üretimi amacıyla içerik harici bir üretken yapay zeka veya LLM sağlayıcısına gönderilmez.",
            "Deterministik çıktılar tek başına tanı, resmi rapor veya kesin klinik hüküm değildir. Uzman, çıktıyı kullanmadan önce doğruluk, uygunluk ve mesleki etik yönünden kontrol eder.",
            DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR,
          ],
        },
        {
          title: "4. DNA Asistanı",
          body: [
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.descriptionTr,
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr,
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.privacyTr,
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.runtimeTr,
          ],
        },
        {
          title: "5. Yurt Dışı Aktarım ve Altyapı",
          body: [
            "Barındırma, veritabanı, kimlik doğrulama, loglama, güvenlik veya ödeme sağlayıcılarının yurt dışında bulunması halinde kişisel veriler hizmetin gerektirdiği ölçüde yurt dışına aktarılabilir.",
            "Bu aktarım, kullanıcı tarafından verilen açık rıza ve ilgili mevzuat kapsamında yapılır. Hizmet sağlayıcı, aktarımı mümkün olduğunca sınırlı ve güvenli tutmayı hedefler.",
          ],
        },
        {
          title: "6. Rızanın Geri Alınması",
          body: [
            "Açık rıza [ILETISIM_EPOSTA] üzerinden geri alınabilir. Geri alma, geçmişte hukuka uygun şekilde yapılan işlemleri etkilemez.",
            "Rızanın geri alınması halinde özel nitelikli veri işleme, deterministik rapor üretimi veya ilgili hizmet bileşenleri durdurulabilir; yasal saklama ve denetim yükümlülükleri kapsamında tutulması gereken kayıtlar saklanmaya devam edebilir.",
          ],
        },
      ]}
    />
  )
}
