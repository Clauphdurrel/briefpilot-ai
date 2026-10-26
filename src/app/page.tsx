import { MarketingShell } from "@/components/marketing/marketing-shell";
import { HeroSection } from "@/components/marketing/hero-section";
import {
  ProblemSection,
  SolutionSection,
  FeaturesSection,
  WorkflowSection,
  AudienceSection,
} from "@/components/marketing/content-sections";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import {
  marketingMetadata,
  softwareApplicationJsonLd,
} from "@/lib/marketing-seo";
export const metadata = marketingMetadata(
  "BriefPilot AI — Des besoins clients aux spécifications prêtes à développer",
  "/",
);
export default function Home() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd()).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <WorkflowSection />
      <ProductShowcase />
      <AudienceSection />
      <PricingPreview />
      <FaqSection />
      <FinalCta />
    </MarketingShell>
  );
}
