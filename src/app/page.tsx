import { SiteHeader, SiteFooter } from "@/components/chrome";
import {
  Hero,
  HowItWorks,
  ImportSection,
  AnalysisSection,
  ReportsBento,
  ComparisonSection,
  BenefitsSection,
  SmartCompareSection,
  PricingSection,
  FaqSection,
  RegisterCta,
} from "@/components/landing-sections";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="tresc">
        <Hero />
        <HowItWorks />
        <ImportSection />
        <AnalysisSection />
        <ReportsBento />
        <ComparisonSection />
        <BenefitsSection />
        <SmartCompareSection />
        <PricingSection />
        <FaqSection />
        <RegisterCta />
      </main>
      <SiteFooter />
    </>
  );
}
