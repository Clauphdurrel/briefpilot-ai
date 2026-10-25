import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { MarketingAnalytics } from "./marketing-analytics";
import { marketingAnalyticsEnabled } from "@/server/marketing/analytics";
import "./marketing.css";
export function MarketingShell({
  children,
  page = "home",
}: {
  children: React.ReactNode;
  page?: "home" | "pricing" | "features" | "workflow" | "contact" | "legal";
}) {
  return (
    <div className="marketing">
      <MarketingHeader />
      <main id="main-content">{children}</main>
      <MarketingFooter />
      <MarketingAnalytics enabled={marketingAnalyticsEnabled()} page={page} />
    </div>
  );
}
