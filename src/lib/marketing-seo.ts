import type { Metadata } from "next";
import { marketingConfig, marketingDescription } from "@/config/marketing";

export function marketingMetadata(
  title: string,
  path: string,
  description = marketingDescription,
): Metadata {
  const { origin, indexable } = marketingConfig();
  return {
    metadataBase: new URL(origin),
    title,
    description,
    alternates: { canonical: new URL(path, origin).href },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "BriefPilot AI",
      title,
      description,
      url: new URL(path, origin).href,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "BriefPilot AI — Des besoins clients aux spécifications prêtes à développer",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
export const privateMetadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};
export function softwareApplicationJsonLd() {
  const { origin } = marketingConfig();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BriefPilot AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "fr",
    url: origin,
    description: marketingDescription,
  };
}
