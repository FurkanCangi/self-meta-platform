import LegalDocumentPage from "../components/legal/LegalDocumentPage"

export default function RetentionPolicyPage() {
  return (
    <LegalDocumentPage
      title="Kişisel Veri Saklama ve İmha Politikası"
      description="DNA Intelligence kapsamında işlenen kişisel verilerin hangi amaçlarla saklandığını, ne zaman silindiğini/yok edildiğini/anonimleştirildiğini ve owner audit katmanının nasıl konumlandığını açıklar."
      sections={[
        {
          title: "1. Saklama İlkeleri",
          body: [
            "Kişisel veriler yalnız işlendikleri amaç için gerekli süre boyunca, hukuki sebep devam ettiği ölçüde ve güvenlik tedbirleri altında saklanır.",
            "Saklama süreleri belirlenirken sözleşme ilişkisi, hesap/paket durumu, yasal yükümlülükler, uyuşmazlık ihtimali, teknik güvenlik, audit gerekliliği ve veri minimizasyonu ilkesi dikkate alınır.",
          ],
        },
        {
          title: "2. Veri Kategorilerine Göre Saklama",
          body: [
            "Hesap ve sözleşme kayıtları hizmet ilişkisi boyunca ve yasal zamanaşımı/uyuşmazlık süreleri boyunca saklanabilir.",
            "Danışan/çocuk değerlendirme verileri aktif hesap süresince hizmet sunumu için saklanır; silme veya hesap kapatma taleplerinde ürün görünürlüğünden kaldırılır, yasal saklama/audit gereği olan sınırlı kayıtlar ayrıştırılır.",
            "Clickwrap kabul kayıtları sözleşmenin ispatı, açık rıza kanıtı ve uyuşmazlık yönetimi için ilgili zamanaşımı süreleri boyunca saklanır.",
          ],
        },
        {
          title: "3. Owner Audit Katmanı",
          body: [
            "Platformda oluşturulan, güncellenen veya silinen `clients`, `assessments_v2` ve `reports` kayıtları owner-only append-only audit katmanında snapshot olarak tutulabilir.",
            "Bu katman kullanıcı arayüzünde gösterilmez; yalnız yetkili owner/admin erişimiyle güvenlik, denetim, veri bütünlüğü, yasal saklama, destek ve uyuşmazlık amaçlarıyla kullanılabilir.",
          ],
        },
        {
          title: "4. İmha Yöntemleri",
          body: [
            "Saklama amacı sona eren kişisel veriler teknik uygunluğa göre silinir, yok edilir veya anonim hale getirilir. Anonim veriler kimliği belirli veya belirlenebilir kişiyle ilişkilendirilemeyecek hale getirilir.",
            "Yedekler, loglar ve audit kayıtları teknik döngüler ve yasal saklama gereklilikleri nedeniyle ana ürün arayüzünden daha uzun süre tutulabilir.",
          ],
        },
        {
          title: "5. Periyodik Gözden Geçirme",
          body: [
            "Saklama ve imha politikası ürün kapsamı, ödeme altyapısı, video gözlem modülü, AI sağlayıcıları ve mevzuat değişikliklerine göre düzenli olarak gözden geçirilir.",
            "Avukat incelemesi sonrası kesin süreler ve veri kategorisi bazlı tablo bu metne eklenecektir.",
          ],
        },
      ]}
    />
  )
}
