import LandingHeader from "./components/LandingHeader";
import LandingHeroV2 from "./components/LandingHeroV2";
import SolutionsGrid from "./components/SolutionsGrid";
import TherapistsSection from "./components/TherapistsSection";
import PricingSection from "./components/PricingSection";
import FooterContact from "./components/FooterContact";

export default function Page() {
  return (
    <>
      <LandingHeader />
      <LandingHeroV2 />
      <SolutionsGrid />
      <TherapistsSection />
      <PricingSection />
      <FooterContact />
</>
  );
}
