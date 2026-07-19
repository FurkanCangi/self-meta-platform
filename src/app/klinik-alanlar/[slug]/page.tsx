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
    why: "İnterosepsiyon; açlık, susuzluk, tuvalet ihtiyacı, yorgunluk ve bedensel rahatsızlık gibi sinyallerin fark edilmesiyle ilişkilidir. Bu alandaki güçlükler öz bakım, duygu farkındalığı ve günlük rutinlerle birlikte görülebilir; tek başına neden göstermez.",
    evaluate: "DNA Intelligence modeli, iç beden sinyali farkındalığına dair ölçek yanıtlarını anamnez ve gözlem notlarıyla birlikte değerlendiren klinik eğitim çerçevesi sunar. DNA Intelligence bu bulguları yalnız puan düzeyinde değil, günlük işlevsellik örüntüsü içinde yorumlamaya destek olur.",
    use: "Terapist, bedensel farkındalık ile davranışsal organizasyon arasındaki ilişkiyi daha net görür. Bu sayede klinik görüşmede hedef alanlar daha somut tartışılabilir.",
  },
  "fizyolojik-regulasyon": {
    title: "Fizyolojik Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#2563EB",
    icon: Activity,
    intro: "Uyku, uyarılmışlık, enerji düzeyi ve temel bedensel denge süreçlerinin organizasyonu.",
    why: "Uyku, enerji ve uyarılmışlıkla ilgili gözlemler; öğrenme, oyun ve sosyal etkileşime katılım bağlamında önemlidir. Bu birliktelikler doğrudan fizyolojik ölçüm veya nedensellik göstermez.",
    evaluate: "Dynamic Neuro-Regulation Approach; uyku, toparlanma, yorgunluk, uyarılmışlık ve rutin toleransına ilişkin gözlemleri birlikte ele alan klinik eğitim çerçevesidir. DNA Intelligence bu kayıtların alan dağılımını görünür kılar; fizyolojik durumu doğrudan ölçmez.",
    use: "Terapist, uyku, yorgunluk ve rutin gözlemlerini davranışsal bulguların yanında sistematik biçimde inceleyebilir. Platform biyolojik yük veya otonom durum çıkarımı yapmaz; klinik yorum terapiste aittir.",
  },
  "duyusal-regulasyon": {
    title: "Duyusal Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#7C3AED",
    icon: Gauge,
    intro: "Ses, dokunma, hareket, görsel uyaran ve diğer duyusal girdilere verilen yanıtların modülasyonu.",
    why: "Duyusal regülasyonla ilgili güçlükler günlük yaşamda kaçınma, arayış, dağılma veya yoğun tepkilerle birlikte görülebilir. Aynı davranış farklı işlevsel bağlamlarda oluşabildiği için çok boyutlu değerlendirme gerekir.",
    evaluate: "Dynamic Neuro-Regulation Approach, duyusal yanıt örüntülerini diğer regülasyon alanlarıyla birlikte ele alan klinik eğitim çerçevesidir. DNA Intelligence alan dağılımını görünür kılar; duyusal zorlanmayı birincil neden veya ikincil sonuç olarak sınıflandırmaz.",
    use: "Terapist, seans ve ev rutini içinde hangi duyusal koşulların çocuğu zorladığını daha net açıklayabilir. Aile bilgilendirmesi daha somut hale gelir.",
  },
  "duygusal-regulasyon": {
    title: "Duygusal Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#7C3AED",
    icon: Zap,
    intro: "Duygusal yoğunluk, toparlanma süresi, geçişlere yanıt ve stres toleransının düzenlenmesi.",
    why: "Duygusal regülasyon yalnız davranış kontrolü değildir; beden, çevre ve bilişsel yükle birlikte şekillenir. Klinik değerlendirmede duygusal tepkilerin ne zaman, neyle ve ne kadar sürdüğü önemlidir.",
    evaluate: "Dynamic Neuro-Regulation Approach, duygusal yanıtları duyusal, fizyolojik ve yürütücü işlev gözlemleriyle birlikte ele alan klinik eğitim çerçevesidir. DNA Intelligence kayıtlı eşlik eden alanları gösterir; neden veya mekanizma belirlemez.",
    use: "Terapist, aile ve ekip görüşmelerinde duygusal tepkileri daha az etiketleyici, daha işlevsel bir dille tartışabilir. Klinik hipotez platform çıktısı değil, terapistin değerlendirmesidir.",
  },
  "bilissel-regulasyon": {
    title: "Bilişsel Regülasyon",
    eyebrow: "DNA Intelligence modeli",
    accent: "#2563EB",
    icon: Brain,
    intro: "Dikkati sürdürme, bilişsel yük altında organize kalma ve göreve bağlı kalma kapasitesi.",
    why: "Bilişsel regülasyon öğrenme ve problem çözmeyle ilişkilidir. Dikkat güçlükleri farklı işlevsel bağlamlarda görülebilir; ölçek örüntüsü duyusal, fizyolojik veya nörobiyolojik neden göstermez.",
    evaluate: "Dynamic Neuro-Regulation Approach, bilişsel regülasyon bulgularını diğer alanlarla birlikte ele alan klinik eğitim çerçevesidir. DNA Intelligence yüzeydeki dikkatsizliğe eşlik eden kayıtlı alan dağılımını gösterir; kaynağını ayırt etmez.",
    use: "Terapist, görev sürdürme ve öğrenme ortamındaki zorlanmaları yapılandırılmış bir profil üzerinden tartışabilir. Müdahale önceliğini platform değil terapist belirler.",
  },
  "yurutucu-islevler": {
    title: "Yürütücü İşlevler",
    eyebrow: "DNA Intelligence modeli",
    accent: "#00C8D7",
    icon: Route,
    intro: "Planlama, ketleme, esneklik, geçiş yapabilme ve hedefe yönelik davranışı organize etme becerileri.",
    why: "Yürütücü işlevler çocuğun günlük aktivitelerde bağımsızlığını ve görev yönetimini etkiler. Bu alan zayıf olduğunda başlama, sürdürme, değiştirme ve tamamlamada zorlanma görülebilir.",
    evaluate: "DNA Intelligence modeli, yürütücü işlev bulgularını klinik profil içinde konumlandıran klinik eğitim çerçevesidir. DNA Intelligence, planlama ve esneklik gibi becerilerin duyusal, duygusal ve bilişsel alanlarla ilişkisini görünür hale getirir.",
    use: "Terapist, görev performansındaki zorlanmaları yapılandırılmış bulgular üzerinden tartışabilir. Klinik hedefler ve aileye verilecek öneriler platform tarafından üretilmez; terapist tarafından belirlenir.",
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
