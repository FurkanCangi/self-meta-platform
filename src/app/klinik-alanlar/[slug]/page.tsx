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
    eyebrow: "DNA Intelligence modeli",
    accent: "#00C8D7",
    icon: HeartPulse,
    intro: "İç beden sinyallerini fark etme, anlamlandırma ve davranışı buna göre organize etme kapasitesi.",
    why: "İnterosepsiyon; açlık, susuzluk, tuvalet ihtiyacı, yorgunluk ve bedensel rahatsızlık gibi sinyallerin düzenlenmesinde kritik rol oynar. Bu alan zayıf olduğunda çocuk öz bakım, duygu farkındalığı ve günlük rutinlerde zorlanabilir.",
    evaluate: "DNA Intelligence modeli, iç beden sinyali farkındalığına dair ölçek yanıtlarını anamnez ve gözlem notlarıyla birlikte değerlendiren klinik eğitim çerçevesi sunar. DNA Intelligence bu bulguları yalnız puan düzeyinde değil, günlük işlevsellik örüntüsü içinde yorumlamaya destek olur.",
    use: "Terapist, bedensel farkındalık ile davranışsal organizasyon arasındaki ilişkiyi daha net görür. Bu sayede klinik görüşmede hedef alanlar daha somut tartışılabilir.",
  },
  "fizyolojik-regulasyon": {
    title: "Fizyolojik Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#2563EB",
    icon: Activity,
    intro: "Uyku, uyarılmışlık, enerji düzeyi ve temel bedensel denge süreçlerinin organizasyonu.",
    why: "Fizyolojik regülasyon, çocuğun öğrenmeye, oyuna ve sosyal etkileşime hazır olma halini doğrudan etkiler. Dengesizlikler dikkat, duygu ve duyusal yanıtları ikincil olarak zorlaştırabilir.",
    evaluate: "DNA Intelligence modeli; uyku, toparlanma, yorgunluk, uyarılmışlık ve rutin toleransına ilişkin verileri bir arada ele alan klinik eğitim çerçevesidir. DNA Intelligence, fizyolojik kırılganlığın diğer alanları nasıl etkileyebileceğini görünür kılar.",
    use: "Terapist, davranışsal belirtilerin altında fizyolojik bir yük olup olmadığını daha sistematik tartışabilir. Bu da değerlendirme sonrası önceliklendirmeyi güçlendirir.",
  },
  "duyusal-regulasyon": {
    title: "Duyusal Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#7C3AED",
    icon: Gauge,
    intro: "Ses, dokunma, hareket, görsel uyaran ve diğer duyusal girdilere verilen yanıtların modülasyonu.",
    why: "Duyusal regülasyon güçlükleri günlük yaşamda kaçınma, arayış, dağılma veya yoğun tepkiler olarak görülebilir. Aynı davranış farklı duyusal mekanizmalarla ilişkili olabileceği için çok boyutlu değerlendirme gerekir.",
    evaluate: "DNA Intelligence modeli, duyusal yanıt örüntülerini diğer regülasyon alanlarıyla birlikte değerlendiren klinik eğitim çerçevesidir. DNA Intelligence, duyusal yüklenmenin birincil mi yoksa ikincil bir zorlanma mı olduğunu daha açık hale getirir.",
    use: "Terapist, seans ve ev rutini içinde hangi duyusal koşulların çocuğu zorladığını daha net açıklayabilir. Aile bilgilendirmesi daha somut hale gelir.",
  },
  "duygusal-regulasyon": {
    title: "Duygusal Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#7C3AED",
    icon: Zap,
    intro: "Duygusal yoğunluk, toparlanma süresi, geçişlere yanıt ve stres toleransının düzenlenmesi.",
    why: "Duygusal regülasyon yalnız davranış kontrolü değildir; beden, çevre ve bilişsel yükle birlikte şekillenir. Klinik değerlendirmede duygusal tepkilerin ne zaman, neyle ve ne kadar sürdüğü önemlidir.",
    evaluate: "DNA Intelligence modeli, duygusal yanıtları duyusal, fizyolojik ve yürütücü işlev verileriyle ilişkili şekilde ele alan klinik eğitim çerçevesidir. DNA Intelligence, duygusal güçlüğün bağlamını ve olası eşlik eden alanları gösterir.",
    use: "Terapist, aile ve ekip görüşmelerinde duygusal tepkileri daha az etiketleyici, daha işlevsel bir dille açıklayabilir. Klinik hipotez daha tutarlı kurulur.",
  },
  "bilissel-regulasyon": {
    title: "Bilişsel Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#2563EB",
    icon: Brain,
    intro: "Dikkati sürdürme, bilişsel yük altında organize kalma ve göreve bağlı kalma kapasitesi.",
    why: "Bilişsel regülasyon, öğrenme ve problem çözme süreçlerinin temel bileşenidir. Dikkat güçlükleri bazen doğrudan bilişsel zorlanmadan, bazen duyusal veya fizyolojik yükten kaynaklanabilir.",
    evaluate: "DNA Intelligence modeli, bilişsel regülasyon bulgularını diğer alanlardan ayırarak ve onlarla ilişkilendirerek değerlendiren klinik eğitim çerçevesidir. DNA Intelligence, yüzeydeki dikkatsizliğin olası klinik kaynaklarını ayırt etmeye yardım eder.",
    use: "Terapist, görev sürdürme ve öğrenme ortamındaki zorlanmaları daha nesnel bir profil üzerinden tartışabilir. Müdahale öncelikleri daha anlaşılır hale gelir.",
  },
  "yurutucu-islevler": {
    title: "Yürütücü İşlevler",
    eyebrow: "DNA Intelligence modeli",
    accent: "#00C8D7",
    icon: Route,
    intro: "Planlama, ketleme, esneklik, geçiş yapabilme ve hedefe yönelik davranışı organize etme becerileri.",
    why: "Yürütücü işlevler çocuğun günlük aktivitelerde bağımsızlığını ve görev yönetimini etkiler. Bu alan zayıf olduğunda başlama, sürdürme, değiştirme ve tamamlamada zorlanma görülebilir.",
    evaluate: "DNA Intelligence modeli, yürütücü işlev bulgularını klinik profil içinde konumlandıran klinik eğitim çerçevesidir. DNA Intelligence, planlama ve esneklik gibi becerilerin duyusal, duygusal ve bilişsel alanlarla ilişkisini görünür hale getirir.",
    use: "Terapist, görev performansındaki zorlanmaları daha net karar notlarıyla açıklayabilir. Klinik hedefler ve aileye verilecek öneriler daha yapılandırılmış olur.",
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
            <h3>DNA Intelligence modeli bu alanı nasıl değerlendirir?</h3>
            <p>{area.evaluate}</p>
          </article>
        </section>

        <section className={styles.section}>
          <article className={styles.callout}>
            <h2>Klinik kullanımda ne sağlar?</h2>
            <p>{area.use}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/cozumler">Çözümleri İncele</Link>
              <Link className={styles.secondary} href="/iletisim">İletişime Geç</Link>
            </div>
          </article>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}
