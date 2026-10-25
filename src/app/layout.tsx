import type { Metadata } from "next";
import "./globals.css";
import { marketingConfig } from "@/config/marketing";

export const metadata: Metadata = {
  metadataBase: new URL(marketingConfig().origin),
  robots: { index: false, follow: false },
  title: "BriefPilot AI",
  description:
    "Prépare tes projets clients : cahiers des charges, fonctionnalités, backlog et prompts Codex.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
