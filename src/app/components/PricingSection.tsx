import styles from "./PricingSection.module.css";
import Link from "next/link";

const plans = [
  { code: "student", label: "Öğrenci Paketi", price: "500 TL / Ay" },
  { code: "graduate", label: "Mezun Paketi", price: "1500 TL / Ay" },
  { code: "professional", label: "Gelişmiş (Profesyonel) Paket", price: "3000 TL / Ay" },
  { code: "enterprise", label: "Kurumsal Paket", price: "10.000 TL / Ay" },
];

const rows = [
  { name: "Teorik Eğitimler", v: ["Aylık 15 Saat", "Aylık 10 Saat", "Aylık 25 Saat", "Sınırsız Erişim"] },
  { name: "Akademik Blog", v: ["Sınırsız erişim.", "Sınırsız erişim.", "Sınırsız erişim.", "Sınırsız erişim."] },
  { name: "Aktivite Kartları", v: ["✗", "Aylık 5 adet aktivite kartı", "Aylık 25 adet aktivite kartı", "Sınırsız sayıda aktivite kartı"] },
  { name: "Testler", v: ["✗", "Aylık 10 danışan", "Aylık 25 danışan", "Sınırsız danışan"] },
  { name: "Hedef Takip Sistemi", v: ["✗", "Aylık 10 danışan", "Aylık 25 danışan", "Sınırsız danışan"] },
  { name: "Öğrenci Koordinatörlüğü Sistemi", v: ["✗", "✗", "✗", "✓"] },
  { name: "Terapist Bul", v: ["✗", "✗", "✗", "✓"] },
  { name: "Paylaşım Hakkı", v: ["✗", "✗", "✗", "Bu paketi 5 kişiyle paylaşma imkanı."] },
];

export default function PricingSection() {
  return (
    <section className={styles.wrap} id="paketler">
      <div className={styles.inner}>
        <h2 className={styles.h2}>Paket Karşılaştırması</h2>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.leftHead}> </th>
                {plans.map((plan) => (
                  <th key={plan.code} className={styles.head}>{plan.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className={styles.leftCol}>{r.name}</td>
                  {r.v.map((x, i) => (
                    <td key={i} className={styles.cell}>
                      <span className={x === "✓" ? styles.ok : x === "✗" ? styles.no : ""}>{x}</span>
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <td className={styles.leftPrice}>Fiyat</td>
                {plans.map((plan) => (
                  <td key={plan.code} className={styles.priceCell}>
                    <div className={styles.price}>{plan.price}</div>
                    <Link href="/signup" className={styles.buy}>
                      Satın Al
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </section>
  );
}
