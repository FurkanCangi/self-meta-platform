import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import styles from "./FinalCTA.module.css";

export default function FinalCTA() {
  return (
    <section className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.badge}>
          <ShieldCheck size={18} />
          Klinik karar destek altyapısı
        </div>
        <h2>Değerlendirme sürecinizi daha net, hızlı ve izlenebilir hale getirin.</h2>
        <p>
          DNA Intelligence, terapistin klinik muhakemesini merkeze alır; veriyi düzenler, örüntüyü görünür kılar ve
          raporlama yükünü azaltır.
        </p>
        <div className={styles.actions}>
          <Link href="/signup" className={styles.primary}>
            Kayıt Ol
            <ArrowRight size={20} />
          </Link>
          <Link href="/cozumler" className={styles.secondary}>
            Kullanım Senaryoları
          </Link>
        </div>
      </div>
    </section>
  );
}
