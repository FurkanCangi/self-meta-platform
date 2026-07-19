import type { Metadata } from "next";
import DnaInfoPage from "./DnaInfoPage";
import { dnaPages } from "./content";

const page = dnaPages["dna-yaklasimi"];
const canonicalUrl = "https://self-meta-platform.vercel.app/dna-nedir";

export const metadata: Metadata = {
  title: "DNA Intelligence Nedir? | Açıklanabilir Klinik Raporlama",
  description: page.intro,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "DNA Intelligence Nedir? | Açıklanabilir Klinik Raporlama",
    description: page.intro,
    url: canonicalUrl,
    siteName: "DNA Intelligence",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DNA Intelligence Nedir? | Açıklanabilir Klinik Raporlama",
    description: page.intro,
  },
};

export default function DnaNedirPage() {
  return <DnaInfoPage page={page} />;
}
