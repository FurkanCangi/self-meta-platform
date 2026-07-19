import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import FooterContact from "../../components/FooterContact";
import LandingHeader from "../../components/LandingHeader";
import styles from "../../marketing-pages.module.css";
import CollaborationPage from "../CollaborationPage";
import DataNetworkPage from "../DataNetworkPage";
import ProjectSupportPage from "../ProjectSupportPage";
import ResearchNotesClient from "../ResearchNotesClient";
import { getResearchPage, researchPages } from "../researchContent";
import { getResearchNotes } from "../researchNotesData";

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
        <ResearchNotesClient notes={getResearchNotes()} />
        <FooterContact />
      </div>
    );
  }

  if (slug === "veri-agi") {
    return <DataNetworkPage />;
  }

  if (slug === "tez-ve-proje-destegi") {
    return <ProjectSupportPage />;
  }

  if (slug === "is-birlikleri") {
    return <CollaborationPage />;
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
            <h2>Bu sayfada neler bulacaksınız?</h2>
            <p>Bu bölümde konuya ilişkin temel bilgileri, dikkat edilmesi gereken noktaları ve sonraki adımları bulabilirsiniz.</p>
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
            <a className={styles.secondary} href="/arastirma">Araştırma sayfasına dön</a>
          </div>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}
