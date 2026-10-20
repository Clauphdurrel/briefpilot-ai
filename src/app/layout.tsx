import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
