import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DnaInfoPage from "../DnaInfoPage";
import { dnaChildSlugs, dnaPages, type DnaPageKey } from "../content";

const siteUrl = "https://self-meta-platform.vercel.app";

export function generateStaticParams() {
  return dnaChildSlugs.map((slug) => ({ slug }));
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = dnaPages[slug as DnaPageKey];

  if (!page || slug === "dna-yaklasimi") {
    return {};
  }

  const title = `${page.eyebrow} | DNA Intelligence`;
  const canonicalUrl = new URL(page.route, siteUrl).toString();

  return {
    title,
    description: page.intro,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description: page.intro,
      url: canonicalUrl,
      siteName: "DNA Intelligence",
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description: page.intro,
    },
  };
}

export default async function DnaNedirChildPage({ params }: PageProps) {
  const { slug } = await params;
  const page = dnaPages[slug as DnaPageKey];

  if (!page || slug === "dna-yaklasimi") {
    notFound();
  }

  return <DnaInfoPage page={page} />;
}
