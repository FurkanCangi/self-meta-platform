import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR,
  DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR,
} from "@/lib/dna/chat/intendedUse";
import styles from "./FinalCTA.module.css";

export default function FinalCTA() {
  return (
    <section className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.badge}>
          <ShieldCheck size={18} />
          Klinik değerlendirme ve raporlama
        </div>
        <h2>Değerlendirme bilgilerinizi tek yerde toplayın, raporunuzu daha kolay hazırlayın.</h2>
        <p>
          {DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR} {DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR}
        </p>
        <div className={styles.actions}>
          <Link href="/signup" className={styles.primary}>
            Kayıt Ol
            <ArrowRight size={20} />
          </Link>
          <Link href="/cozumler" className={styles.secondary}>
            Neler Yapabilirsiniz?
          </Link>
        </div>
      </div>
    </section>
  );
}
