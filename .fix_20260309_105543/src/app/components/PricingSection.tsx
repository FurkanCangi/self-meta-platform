import styles from "./PricingSection.module.css";

const cols = ["Öğrenci Paketi", "Mezun Paketi", "Gelişmiş (Profesyonel) Paket", "Kurumsal Paket"];

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

const prices = ["500 TL / Ay", "1500 TL / Ay", "3000 TL / Ay", "10.000 TL / Ay"];

export default function PricingSection() {
  return (
    <section className={styles.wrap} id="paketler">
      <div className={styles.inner}>
        <h2 className={styles.h2}>Fiyatlandırma</h2>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.leftHead}> </th>
                {cols.map((c) => (
                  <th key={c} className={styles.head}>{c}</th>
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
                {prices.map((p, i) => (
                  <td key={i} className={styles.priceCell}>
                    <div className={styles.price}>{p}</div>
                    <button className={styles.buy}>Satın Al</button>
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
