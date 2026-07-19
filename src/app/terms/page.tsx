import LegalDocumentPage from "../components/legal/LegalDocumentPage"
import {
  DNA_INTELLIGENCE_INTENDED_USE_VERSION,
  DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
} from "@/lib/dna/chat/intendedUse"

export default function TermsPage() {
  return (
    <LegalDocumentPage
      title="Kullanım Şartları ve Hizmet Koşulları"
      description="DNA Intelligence platformunun uzman kullanıcılar tarafından kullanımına ilişkin ticari, teknik ve mesleki sorumluluk kurallarını düzenler."
      sections={[
        {
          title: "1. Hizmetin Niteliği",
          body: [
            "DNA Intelligence; uzmanlara çocuk/danışan değerlendirme verilerini düzenleme, skorları yapılandırılmış biçimde inceleme ve deterministik rapor taslağı oluşturma imkanı sağlayan dijital bir platformdur.",
            "Platform tanı koymaz, tedavi/terapi kararı vermez ve uzman mesleki kanaatinin yerine geçmez. Üretilen rapor taslaklarının nihai değerlendirmesi, düzenlenmesi ve danışanla paylaşılması uzman kullanıcının sorumluluğundadır.",
          ],
        },
        {
          title: "2. Kullanıcı Yükümlülükleri",
          body: [
            "Kullanıcı, platforma yalnız hukuka uygun şekilde elde ettiği verileri gireceğini; danışan, veli veya yasal temsilci bilgilendirme/izin süreçlerini mesleki ve hukuki sorumluluğu dahilinde yürüteceğini kabul eder.",
            "Kullanıcı, hesap bilgilerini korumak, yetkisiz erişimi önlemek, doğru paket/kurum bilgisi vermek ve platformu mevzuata, meslek etiğine ve bu koşullara uygun kullanmakla yükümlüdür.",
          ],
        },
        {
          title: "3. Paketler, Limitler ve Ödeme Hazırlığı",
          body: [
            "Paket içerikleri, kullanım limitleri ve ücretler platformda gösterilen güncel bilgilere göre belirlenir. Ödeme entegrasyonu tamamlanana kadar paket seçimi hesap açılışı ve clickwrap kabul akışı üzerinden kaydedilebilir.",
            "Paketin kötüye kullanımı, hesap paylaşım kurallarının ihlali, yetkisiz toplu veri girişi veya sistem kaynaklarını olağan dışı kullanma durumunda hizmet askıya alınabilir veya sonlandırılabilir.",
          ],
        },
        {
          title: "4. Deterministik Rapor Taslakları",
          body: [
            "Platform raporları sunucu tarafındaki doğrulanmış skor kuralları ve yerel klinik bilgi tabanı ile deterministik olarak oluşturulur; rapor üretimi için harici bir üretken yapay zeka veya LLM servisi kullanılmaz.",
            "Sistem kalite kontrolleri ve deterministik skor motoru içerse de raporun danışan özelinde uygunluğu, dilinin düzenlenmesi ve paylaşım kararı uzman kullanıcıya aittir. Çıktılar uzman kontrolü olmadan doğrudan tanı, resmi karar veya kesin klinik hüküm olarak kullanılmamalıdır.",
          ],
        },
        {
          title: "5. DNA Asistanı Amaçlanan Kullanımı",
          body: [
            `Amaçlanan kullanım sözleşmesi ${DNA_INTELLIGENCE_INTENDED_USE_VERSION}: ${DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.descriptionTr}`,
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr,
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.privacyTr,
            DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.evidenceTr,
          ],
        },
        {
          title: "6. Admin/Owner Erişimi ve Veri Kullanımı",
          body: [
            "Hizmet sağlayıcı owner/admin yetkilileri kimlikli verilere yalnız hizmetin sunumu, teknik destek, güvenlik, denetim, yasal saklama, ödeme ve uyuşmazlık yönetimi gibi sınırlı amaçlarla erişebilir.",
            "Ürün geliştirme, kalite ölçümü, rapor doğruluğu analizi ve istatistiksel değerlendirme için veriler anonimleştirilmiş veya toplulaştırılmış şekilde kullanılabilir. Kimlikli çocuk/danışan verisi pazarlama amacıyla satılmaz.",
          ],
        },
        {
          title: "7. Sorumluluk Sınırları",
          body: [
            "Platformun kesintisiz, hatasız veya her vaka için klinik olarak eksiksiz çıktı vereceği garanti edilmez. Kullanıcı kritik kararlarında kendi mesleki değerlendirmesini, ek testleri ve gerektiğinde süpervizyonu esas alır.",
            "Hizmet sağlayıcı, mevzuatın izin verdiği ölçüde dolaylı zararlar, hatalı uzman kullanımı, yetkisiz veri girişi, üçüncü kişi izin eksikliği veya raporun uzman kontrolü olmadan kullanılmasından doğan sonuçlardan sorumlu değildir.",
          ],
        },
        {
          title: "8. Değişiklik ve Fesih",
          body: [
            "Bu koşullar, ürün ve mevzuat değişikliklerine göre güncellenebilir. Önemli değişikliklerde kullanıcılardan yeni clickwrap kabulü alınabilir.",
            "Kullanıcı hizmeti bırakabilir; hizmet sağlayıcı ise ihlal, güvenlik riski, ödeme uyuşmazlığı veya hukuki zorunluluk halinde hesabı askıya alabilir ya da sonlandırabilir.",
          ],
        },
      ]}
    />
  )
}
