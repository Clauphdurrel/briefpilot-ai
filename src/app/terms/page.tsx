import { LegalDraft } from "@/components/marketing/legal-draft";
import { marketingMetadata } from "@/lib/marketing-seo";
export const metadata = {
  ...marketingMetadata(
    "Conditions d’utilisation — brouillon — BriefPilot AI",
    "/terms",
  ),
  robots: { index: false, follow: false },
};
export default function TermsPage() {
  return <LegalDraft kind="terms" />;
}
