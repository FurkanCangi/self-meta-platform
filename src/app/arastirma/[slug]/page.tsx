import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import FooterContact from "../../components/FooterContact";
import LandingHeader from "../../components/LandingHeader";
import styles from "../../marketing-pages.module.css";
import ResearchNotesClient from "../ResearchNotesClient";
import { getResearchPage, researchPages } from "../researchContent";

type ResearchDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return researchPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: ResearchDetailPageProps) {
  const { slug } = await params;
  const page = getResearchPage(slug);
  if (!page) return {};

  return {
    title: `${page.eyebrow} | DNA Intelligence`,
    description: page.description,
  };
}

export default async function ResearchDetailPage({ params }: ResearchDetailPageProps) {
  const { slug } = await params;
  const page = getResearchPage(slug);

  if (!page) {
    notFound();
  }

  if (slug === "arastirma-notlari") {
    return (
      <div className={styles.page}>
        <LandingHeader />
        <ResearchNotesClient />
        <FooterContact />
      </div>
    );
  }

  const HeroIcon = page.icon;

  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>{page.eyebrow}</div>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </section>

        <section className={styles.section}>
          <article className={styles.callout}>
            <div className={styles.icon} style={{ "--accent": page.accent } as CSSProperties}>
              <HeroIcon size={30} strokeWidth={2} />
            </div>
            <h2>{page.eyebrow} alanı ne sağlar?</h2>
            <p>
              Bu alan; bilimsel değerlendirme, metodoloji, iş birliği ve veri üretimi süreçlerini klinik uygulamadan
              koparmadan, etik sınırları belirgin ve okunaklı bir araştırma çerçevesinde sunmak için yapılandırılmıştır.
            </p>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.grid}>
            {page.sections.map(({ title, text, icon: Icon }) => (
              <article className={styles.card} key={title} style={{ "--accent": page.accent } as CSSProperties}>
                <div className={styles.icon}>
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.callout}>
          <h2>{page.callout.title}</h2>
          <p>{page.callout.text}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href={page.callout.href}>{page.callout.label}</a>
            <a className={styles.secondary} href="/arastirma">Araştırma Merkezine Dön</a>
          </div>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}
