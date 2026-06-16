import LegalDocumentPage from "../components/legal/LegalDocumentPage"

export default function ExplicitConsentPage() {
  return (
    <LegalDocumentPage
      title="Açık Rıza Metni"
      description="Özel nitelikli kişisel veriler, çocuk/danışan verileri, AI destekli rapor üretimi ve gerekli altyapı aktarımı için alınacak ayrı açık rıza beyanının taslağıdır."
      sections={[
        {
          title: "1. Rızanın Konusu",
          body: [
            "Kullanıcı, platforma girdiği danışan/çocuk verilerinin değerlendirme, rapor üretimi, klinik karar destek çıktısı oluşturma, güvenli saklama ve gerektiğinde teknik destek amacıyla işlenmesine açık rıza verdiğini kabul eder.",
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
          title: "3. Yapay Zeka Destekli İşleme",
          body: [
            "Kullanıcı, rapor üretiminde LLM/API sağlayıcılarına sınırlı değerlendirme içeriği gönderilebileceğini ve çıktının uzman kontrolüne tabi karar destek metni olduğunu kabul eder.",
            "AI çıktıları tek başına tanı, tedavi, resmi rapor veya kesin klinik hüküm değildir. Uzman, çıktıyı kullanmadan önce doğruluk, uygunluk ve mesleki etik yönünden kontrol eder.",
          ],
        },
        {
          title: "4. Yurt Dışı Aktarım ve Altyapı",
          body: [
            "Barındırma, veritabanı, kimlik doğrulama, yapay zeka, loglama, güvenlik veya ödeme sağlayıcılarının yurt dışında bulunması halinde kişisel veriler hizmetin gerektirdiği ölçüde yurt dışına aktarılabilir.",
            "Bu aktarım, kullanıcı tarafından verilen açık rıza ve ilgili mevzuat kapsamında yapılır. Hizmet sağlayıcı, aktarımı mümkün olduğunca sınırlı ve güvenli tutmayı hedefler.",
          ],
        },
        {
          title: "5. Rızanın Geri Alınması",
          body: [
            "Açık rıza [ILETISIM_EPOSTA] üzerinden geri alınabilir. Geri alma, geçmişte hukuka uygun şekilde yapılan işlemleri etkilemez.",
            "Rızanın geri alınması halinde özel nitelikli veri işleme, AI destekli rapor üretimi veya ilgili hizmet bileşenleri durdurulabilir; yasal saklama ve denetim yükümlülükleri kapsamında tutulması gereken kayıtlar saklanmaya devam edebilir.",
          ],
        },
      ]}
    />
  )
}
