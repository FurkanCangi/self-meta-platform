import { notFound } from "next/navigation";
import DnaInfoPage from "../DnaInfoPage";
import { dnaChildSlugs, dnaPages, type DnaPageKey } from "../content";

export function generateStaticParams() {
  return dnaChildSlugs.map((slug) => ({ slug }));
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function DnaNedirChildPage({ params }: PageProps) {
  const { slug } = await params;
  const page = dnaPages[slug as DnaPageKey];

  if (!page || slug === "dna-yaklasimi") {
    notFound();
  }

  return <DnaInfoPage page={page} />;
}
