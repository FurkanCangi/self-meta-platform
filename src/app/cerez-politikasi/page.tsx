import LegalDocumentPage from "../components/legal/LegalDocumentPage";

export default function CerezPolitikasiPage() {
  return (
    <LegalDocumentPage
      title="Çerez Politikası"
      description="DNA Intelligence web sitesi ve platformunda kullanılan çerezler, oturum teknolojileri ve yerel saklama tercihleri hakkında bilgilendirme metnidir."
      sections={[
        {
          title: "1. Kapsam",
          body: [
            "Bu politika, DNA Intelligence web sitesi ve platform arayüzünde kullanılan çerezler, benzer takip teknolojileri ve tarayıcı yerel saklama alanları hakkında bilgi verir.",
            "Çerezler; siteyi çalıştırmak, oturumu sürdürmek, güvenliği sağlamak, kullanıcı tercihlerini hatırlamak ve kullanıcının açık rızası varsa analitik veya pazarlama amaçlı ölçümleme yapmak için kullanılabilir.",
          ],
        },
        {
          title: "2. Zorunlu Çerezler ve Oturum Teknolojileri",
          body: [
            "Zorunlu çerezler; kimlik doğrulama, oturum yönetimi, güvenlik, yönlendirme, hata önleme ve hukuki kabul kayıtlarının teknik olarak yürütülmesi gibi temel işlevler için kullanılır.",
            "Bu çerezler olmadan platformun güvenli biçimde çalışması veya talep edilen hizmetin sunulması mümkün olmayabilir. Bu nedenle zorunlu çerezler tercih panelinden kapatılamaz.",
          ],
        },
        {
          title: "3. Analitik ve Pazarlama Çerezleri",
          body: [
            "Analitik çerezler, site performansını ve kullanım örüntülerini toplulaştırılmış şekilde değerlendirmek amacıyla kullanılabilir. Pazarlama çerezleri ise tanıtım, kampanya ölçümleme veya benzer iletişim faaliyetleri için kullanılabilir.",
            "DNA Intelligence, analitik ve pazarlama çerezlerini yalnızca kullanıcının açık onayıyla etkinleştirecek şekilde tasarlar. Kullanıcı onay vermediğinde bu kategoriler varsayılan olarak kapalı kalır.",
          ],
        },
        {
          title: "4. Yerel Saklama ve Tercihler",
          body: [
            "Tarayıcı yerel saklama alanı, çerez tercihinin hatırlanması, arayüz teması gibi kullanıcı tercihleri ve üyelik akışı sırasında gerekli geçici işlem durumları için kullanılabilir.",
            "Yerel saklama kayıtları, ilgili tercih veya işlem için gerekli süre boyunca tutulur; kullanıcı tarayıcı ayarları veya tercih paneli aracılığıyla bu kayıtları silebilir.",
          ],
        },
        {
          title: "5. Tercihlerin Yönetimi",
          body: [
            "Kullanıcılar ilk ziyaretlerinde çerez bannerı üzerinden zorunlu olmayan çerezleri reddedebilir, tümünü kabul edebilir veya kategori bazında tercih yapabilir.",
            "Tarayıcı ayarları üzerinden çerezlerin silinmesi veya yerel saklama kayıtlarının temizlenmesi halinde çerez tercih ekranı yeniden gösterilebilir.",
          ],
        },
        {
          title: "6. KVKK ile İlişki",
          body: [
            "Çerezler yoluyla kişisel veri işlenmesi halinde işleme faaliyetleri KVKK Aydınlatma Metni, Gizlilik Politikası ve ilgili açık rıza süreçleriyle birlikte değerlendirilir.",
            "İlgili kişiler, KVKK kapsamındaki hakları ve başvuru yöntemleri için KVKK Aydınlatma Metni'nde yer alan iletişim kanallarını kullanabilir.",
          ],
        },
      ]}
    />
  );
}
