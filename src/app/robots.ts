import type { MetadataRoute } from "next";
import { marketingConfig } from "@/config/marketing";
export default function robots(): MetadataRoute.Robots {
  const { origin, indexable } = marketingConfig();
  return indexable
    ? {
        rules: {
          userAgent: "*",
          allow: "/",
          // Public noindex pages must remain crawlable for their directive to be read.
          disallow: ["/dashboard", "/api/"],
        },
        sitemap: `${origin}/sitemap.xml`,
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
