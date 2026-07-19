import Image from "next/image";
import {
  DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR,
  DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR,
} from "@/lib/dna/chat/intendedUse";
import styles from "./LandingHeroV2.module.css";

const orbitItems = [
  {
    className: styles.orbitExecutive,
    title: "Yürütücü İşlevler",
    text: "Planlama, odaklanma ve görev sürdürme",
    tone: "purple",
  },
  {
    className: styles.orbitEmotion,
    title: "Duygusal Regülasyon",
    text: "Toparlanma, yoğunluk ve geçiş yanıtları",
    tone: "blue",
  },
  {
    className: styles.orbitIntero,
    title: "İnterosepsiyon",
    text: "İç beden sinyali ve farkındalık",
    tone: "teal",
  },
  {
    className: styles.orbitSomato,
    title: "Somatosensoriyel Sistem",
    text: "Dokunsal işlemleme ve beden farkındalığı",
    tone: "pink",
  },
];

export default function LandingHeroV2() {
  return (
    <section className={styles.wrap} id="home">
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.copy}>
          <div className={styles.badge}>
            <span className={styles.badgeBrand}>DNA Intelligence</span>
            <span className={styles.badgeSub}>Deterministik klinik çalışma platformu</span>
          </div>

          <h1 className={styles.h1}>
            Klinik değerlendirmede
            <span>daha kapsamlı analiz.</span>
          </h1>

          <p className={styles.lead}>
            {DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR} {DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR}
            {" "}Çalışma zamanında haricî LLM veya internetten bilgi arama kullanılmaz.
          </p>

          <div className={styles.actions}>
            <a className={styles.primaryCta} href="/signup">
              Kayıt Ol
              <span aria-hidden="true">→</span>
            </a>
            <a className={styles.secondaryCta} href="/dna-nedir">
              Platformu Keşfet
              <span aria-hidden="true">▷</span>
            </a>
          </div>
        </div>

        <div className={styles.visual} aria-label="Self-regülasyon alanlarını temsil eden kavramsal ağ görseli">
          <div className={styles.neuralField} aria-hidden="true">
            <span className={styles.sparkOne} />
            <span className={styles.sparkTwo} />
            <span className={styles.sparkThree} />
            <span className={styles.sparkFour} />
          </div>

          <div className={styles.orbitShell}>
            <div className={styles.orbitPath} aria-hidden="true" />
            <div className={styles.orbitPathInner} aria-hidden="true" />

            <svg className={styles.connectorSvg} viewBox="0 0 800 640" preserveAspectRatio="none" aria-hidden="true">
              <path className={styles.connectorExecutive} d="M 258 92 C 310 92 350 112 398 142" />
              <path className={styles.connectorEmotion} d="M 552 302 C 536 280 520 256 536 232" />
              <path className={styles.connectorIntero} d="M 266 305 C 324 286 382 254 454 214" />
              <path className={styles.connectorSomato} d="M 552 118 C 566 112 580 110 598 112" />
              <circle className={styles.connectorExecutive} cx="398" cy="142" r="6" />
              <circle className={styles.connectorEmotion} cx="536" cy="232" r="6" />
              <circle className={styles.connectorIntero} cx="454" cy="214" r="6" />
              <circle className={styles.connectorSomato} cx="598" cy="112" r="6" />
            </svg>

            <div className={styles.brainAura}>
              <Image
                src="/images/landing/neuro-child.png"
                alt="Çocuk profili çevresinde temsili self-regülasyon alanları"
                fill
                priority
                unoptimized
                sizes="(max-width: 760px) 78vw, (max-width: 1180px) 420px, 500px"
                className={styles.heroImage}
              />
            </div>

            <div className={styles.orbitLayer}>
              {orbitItems.map((item) => (
                <article className={`${styles.orbitCard} ${item.className}`} data-tone={item.tone} key={item.title}>
                  <span className={styles.cardIcon} aria-hidden="true" />
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
