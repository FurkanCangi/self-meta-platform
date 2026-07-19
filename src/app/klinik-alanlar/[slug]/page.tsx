import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Brain, Gauge, HeartPulse, Layers3, Route, Zap } from "lucide-react";
import FooterContact from "../../components/FooterContact";
import LandingHeader from "../../components/LandingHeader";
import styles from "../../marketing-pages.module.css";

const clinicalAreas = {
  interosepsiyon: {
    title: "İnterosepsiyon",
    eyebrow: "Değerlendirme alanı",
    accent: "#00C8D7",
    icon: HeartPulse,
    intro: "Açlık, susuzluk, yorgunluk, ağrı ve tuvalet ihtiyacı gibi beden sinyallerini fark etme ve bu sinyallere uygun davranma becerisi.",
    why: "Beden sinyallerini fark etmek; öz bakım, duygu farkındalığı ve günlük rutinler için önemlidir. Bu alandaki güçlükler tek başına belirli bir neden veya tanı göstermez.",
    evaluate: "Test yanıtları, anamnez bilgileri ve gözlem notları birlikte incelenir. Böylece beden sinyallerini fark etme güçlüğünün günlük yaşamda nerelerde ortaya çıktığı anlaşılır.",
    use: "Terapist, çocuğun beden sinyallerini ne zaman fark ettiğini ve bu sinyallere nasıl karşılık verdiğini aileyle somut örnekler üzerinden konuşabilir.",
  },
  "fizyolojik-regulasyon": {
    title: "Fizyolojik Regülasyon",
    eyebrow: "Değerlendirme alanı",
    accent: "#2563EB",
    icon: Activity,
    intro: "Uyku, enerji düzeyi, uyanıklık ve günlük rutinlerle ilgili bedensel düzen.",
    why: "Uyku, yorgunluk ve enerji düzeyi; öğrenmeyi, oyunu ve sosyal katılımı etkileyebilir. Bu gözlemler tek başına fizyolojik bir sorun veya neden göstermez.",
    evaluate: "Uyku, toparlanma, yorgunluk ve günlük rutinlerle ilgili bilgiler diğer değerlendirme sonuçlarıyla birlikte incelenir. Platform fizyolojik durumu doğrudan ölçmez.",
    use: "Terapist, uyku ve enerjiyle ilgili gözlemleri davranış ve günlük yaşam bilgileriyle birlikte değerlendirir. Platform biyolojik yük veya otonom durum çıkarımı yapmaz; son yorumu terapist yapar.",
  },
  "duyusal-regulasyon": {
    title: "Duyusal Regülasyon",
    eyebrow: "Değerlendirme alanı",
    accent: "#7C3AED",
    icon: Gauge,
    intro: "Ses, dokunma, hareket, ışık ve diğer duyusal uyaranlara verilen tepkileri ayarlama becerisi.",
    why: "Bu alandaki güçlükler kaçınma, sürekli uyaran arama, çabuk dağılma veya yoğun tepki verme şeklinde görülebilir. Aynı davranış farklı koşullarda ortaya çıkabileceği için diğer alanlarla birlikte değerlendirilir.",
    evaluate: "Duyusal tepkiler; test sonuçları, anamnez bilgileri ve gözlem notlarıyla birlikte incelenir. Bu bilgiler tek başına zorlanmanın nedenini göstermez.",
    use: "Terapist, çocuğu zorlayan ses, dokunma, hareket veya ortam koşullarını daha somut biçimde açıklayabilir ve aileyle günlük yaşam örnekleri üzerinden konuşabilir.",
  },
  "duygusal-regulasyon": {
    title: "Duygusal Regülasyon",
    eyebrow: "Değerlendirme alanı",
    accent: "#7C3AED",
    icon: Zap,
    intro: "Yoğun duygularla baş etme, zor bir durumdan sonra sakinleşme ve değişikliklere uyum sağlama becerisi.",
    why: "Duygusal tepkiler beden durumu, çevre, duyusal yük ve görevin zorluğuyla birlikte değişebilir. Değerlendirmede tepkinin ne zaman başladığı, ne kadar sürdüğü ve çocuğun nasıl sakinleştiği incelenir.",
    evaluate: "Duygusal tepkiler; duyusal, fizyolojik, bilişsel ve yürütücü alanlardaki sonuçlarla birlikte incelenir. Bu bilgiler tek başına kesin bir neden göstermez.",
    use: "Terapist, duygusal tepkileri etiketlemek yerine hangi koşullarda ortaya çıktığını ve günlük yaşamı nasıl etkilediğini aile ve ekiple konuşabilir.",
  },
  "bilissel-regulasyon": {
    title: "Bilişsel Regülasyon",
    eyebrow: "Değerlendirme alanı",
    accent: "#2563EB",
    icon: Brain,
    intro: "Dikkati sürdürme, göreve odaklanma ve zihinsel yük arttığında işi sürdürebilme becerisi.",
    why: "Bu beceriler öğrenme ve problem çözme için önemlidir. Dikkat güçlükleri farklı koşullarda görülebilir; test sonuçları tek başına güçlüğün nedenini göstermez.",
    evaluate: "Dikkat ve görevi sürdürmeyle ilgili sonuçlar diğer değerlendirme alanlarıyla birlikte incelenir. Bu sonuçlar dikkatsizliğin nedenini tek başına göstermez.",
    use: "Terapist, çocuğun hangi görevlerde ve ortamlarda zorlandığını inceler. Önce hangi konunun ele alınacağına terapist karar verir.",
  },
  "yurutucu-islevler": {
    title: "Yürütücü İşlevler",
    eyebrow: "Değerlendirme alanı",
    accent: "#00C8D7",
    icon: Route,
    intro: "Planlama, işe başlama, durma, esnek davranma, geçiş yapma ve işi tamamlama becerileri.",
    why: "Bu beceriler günlük işlerde bağımsızlığı ve görev yönetimini etkiler. Güçlük olduğunda çocuk bir işe başlama, sürdürme, değiştirme veya tamamlama sırasında zorlanabilir.",
    evaluate: "Planlama, esneklik ve görevi tamamlama bilgileri duyusal, duygusal ve bilişsel sonuçlarla birlikte incelenir. Bu bilgiler tek başına zorlanmanın nedenini göstermez.",
    use: "Terapist, görev sırasında nerede zorlanıldığını aile ve ekiple somut örnekler üzerinden konuşabilir. Hedefleri ve önerileri terapist belirler.",
  },
} as const;

export function generateStaticParams() {
  return Object.keys(clinicalAreas).map((slug) => ({ slug }));
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ClinicalAreaPage({ params }: PageProps) {
  const { slug } = await params;
  const area = clinicalAreas[slug as keyof typeof clinicalAreas];

  if (!area) {
    notFound();
  }

  const Icon = area.icon;

  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>{area.eyebrow}</div>
          <h1>{area.title}</h1>
          <p>{area.intro}</p>
        </section>

        <section className={styles.split}>
          <article className={styles.wideCard} style={{ "--accent": area.accent } as CSSProperties}>
            <div className={styles.icon}>
              <Icon size={30} strokeWidth={2} />
            </div>
            <h3>Bu alan neden önemlidir?</h3>
            <p>{area.why}</p>
          </article>
          <article className={styles.wideCard} style={{ "--accent": area.accent } as CSSProperties}>
            <div className={styles.icon}>
              <Layers3 size={30} strokeWidth={2} />
            </div>
            <h3>Değerlendirmede hangi bilgiler kullanılır?</h3>
            <p>{area.evaluate}</p>
          </article>
        </section>

        <section className={styles.section}>
          <article className={styles.callout}>
            <h2>Terapiste nasıl yardımcı olur?</h2>
            <p>{area.use}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/cozumler">Çözümleri incele</Link>
              <Link className={styles.secondary} href="/iletisim">İletişime geç</Link>
            </div>
          </article>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}
