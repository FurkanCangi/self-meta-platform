import LegalDocumentPage from "../components/legal/LegalDocumentPage"

export default function PackageAgreementPage() {
  return (
    <LegalDocumentPage
      title="Paket Satın Alma ve Hizmet Sözleşmesi"
      description="DNA Intelligence paket seçimi, hizmet kapsamı, kullanım limitleri, clickwrap kabulü ve ödeme entegrasyonu öncesi ekonomik v1 sözleşme akışını düzenler."
      sections={[
        {
          title: "1. Taraflar ve Sözleşmenin Kurulması",
          body: [
            "Bu sözleşme [VERI_SORUMLUSU_UNVANI] ile DNA Intelligence platformunda hesap açan ve paket seçen uzman kullanıcı arasında elektronik ortamda kurulur.",
            "Kullanıcı, kayıt veya ilk giriş sırasında ilgili checkbox’ları işaretleyip devam ettiğinde bu sözleşmeyi, kullanım şartlarını, gizlilik politikasını, KVKK aydınlatma metnini ve açık rıza metnini kabul etmiş sayılır.",
          ],
        },
        {
          title: "2. Paketler ve Kullanım Limitleri",
          body: [
            "Paketler öğrenci, mezun, gelişmiş/profesyonel ve kurumsal seçeneklerden oluşabilir. Paket kapsamı; danışan limiti, rapor/aktivite hakkı, eğitim içerikleri, kurum üyeliği ve ek modüllere göre değişebilir.",
            "Ek rapor paketleri süreli abonelik değildir. Satın alınan rapor hakları kullanıcı hesabına tanımlanır, rapor üretildikçe düşer ve kullanılmadığı sürece aylık olarak silinmez.",
            "Ödeme entegrasyonu tamamlanana kadar paket seçimi clickwrap kabul kanıtıyla kaydedilir. Gerçek ödeme ve fatura süreçleri entegre edildiğinde kullanıcıya ayrıca gösterilir.",
          ],
        },
        {
          title: "3. Ücret, Kullanım ve İptal",
          body: [
            "Platformda gösterilen ek rapor paketi ücretleri aksi açıkça belirtilmedikçe tek seferlik kullanım hakkı bedelidir. Rapor hakları ay sonunda yanmaz ve otomatik yenileme yapılmaz.",
            "Vergi, fatura, ödeme komisyonu ve kampanya koşulları ödeme altyapısı devreye alındığında ayrıca düzenlenir.",
            "Kullanıcı paket iptal, dondurma veya değişiklik taleplerini [ILETISIM_EPOSTA] üzerinden iletebilir. Kurumsal paketlerde özel sözleşme veya manuel onay süreci uygulanabilir.",
          ],
        },
        {
          title: "4. Veri Erişimi ve Denetim Maddesi",
          body: [
            "Kullanıcı, hizmet sağlayıcı owner/admin yetkililerinin kimlikli verilere yalnız hizmet sunumu, güvenlik, destek, denetim, yasal saklama, ödeme, kötüye kullanım önleme ve uyuşmazlık amaçlarıyla erişebileceğini kabul eder.",
            "Ürün geliştirme, kalite ölçümü, rapor doğruluğu analizi ve istatistik için veriler anonimleştirilmiş veya toplulaştırılmış şekilde kullanılabilir. Kimlikli çocuk/danışan verisi pazarlama amacıyla satılmaz.",
          ],
        },
        {
          title: "5. Uzman Sorumluluğu",
          body: [
            "Uzman kullanıcı, platforma veri girmeden önce gerekli izinleri aldığını, danışan/çocuk verisini mesleki ve hukuki sorumluluğuyla yönettiğini ve raporları uzman kontrolünden geçirmeden paylaşmayacağını kabul eder.",
            "Platform karar destek sağlar; tanı, tedavi, terapi programı veya resmi kurul kararı yerine geçmez.",
          ],
        },
        {
          title: "6. Clickwrap Kabul Kanıtı",
          body: [
            "Kabul işleminde kullanıcı hesabı, e-posta, seçilen paket, kabul edilen doküman sürümleri, kabul zamanı, IP adresi, user-agent ve kaynak sayfa kaydedilebilir.",
            "Bu kayıtlar sözleşmenin kurulması, açık rıza ispatı, denetim, güvenlik ve uyuşmazlık yönetimi amacıyla saklanır.",
          ],
        },
      ]}
    />
  )
}
