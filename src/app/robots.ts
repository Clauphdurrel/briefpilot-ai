import type { MetadataRoute } from "next";
import { marketingConfig } from "@/config/marketing";
export default function robots(): MetadataRoute.Robots {
  const { origin, indexable } = marketingConfig();
  return indexable
    ? {
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/dashboard",
            "/login",
            "/api/",
            "/privacy",
            "/terms",
            "/contact",
          ],
        },
        sitemap: `${origin}/sitemap.xml`,
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
