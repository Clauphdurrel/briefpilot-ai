import { LegalDraft } from "@/components/marketing/legal-draft";
import { marketingMetadata } from "@/lib/marketing-seo";
export const metadata = {
  ...marketingMetadata(
    "Confidentialité — brouillon — BriefPilot AI",
    "/privacy",
  ),
  robots: { index: false, follow: false },
};
export default function PrivacyPage() {
  return <LegalDraft kind="privacy" />;
}
