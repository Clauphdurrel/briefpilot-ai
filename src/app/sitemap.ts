import type { MetadataRoute } from "next";
import { marketingConfig, publicMarketingPaths } from "@/config/marketing";
export default function sitemap(): MetadataRoute.Sitemap {
  const { origin, indexable } = marketingConfig();
  return indexable
    ? publicMarketingPaths.map((path) => ({ url: new URL(path, origin).href }))
    : [];
}
