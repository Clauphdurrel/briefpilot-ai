import type { NextConfig } from "next";
import { marketingConfig } from "./src/config/marketing";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: [
      ...(!marketingConfig().indexable ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ] }, { source: "/(dashboard|login|api)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  // The remote renderer is mandatory on Vercel. Do not package Chromium there.
  ...(process.env.VERCEL === "1" ? { outputFileTracingExcludes: { "/*": ["./node_modules/playwright/**", "./node_modules/playwright-core/**", "./node_modules/.pnpm/playwright*/**", "./infra/**"] } } : {}),
  serverExternalPackages: ["playwright"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
