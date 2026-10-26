import { afterEach, describe, expect, it, vi } from "vitest";
import { marketingConfig, publicMarketingPaths } from "@/config/marketing";
import {
  marketingMetadata,
  softwareApplicationJsonLd,
} from "@/lib/marketing-seo";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
const production = {
  SITE_URL: "https://briefpilot.example",
  SITE_INDEXING_ENABLED: "true",
  APP_ENV: "production",
  NODE_ENV: "production",
  VERCEL_ENV: "production",
};
afterEach(() => vi.unstubAllEnvs());
describe("marketing indexing guard", () => {
  it.each([
    {},
    { ...production, APP_ENV: "staging" },
    { ...production, VERCEL_ENV: "preview" },
    { ...production, SITE_URL: undefined },
    { ...production, SITE_INDEXING_ENABLED: "false" },
    { ...production, SITE_URL: "https://preview.vercel.app" },
    { ...production, SITE_URL: "https://private:secret@briefpilot.example" },
    { ...production, SITE_URL: "https://briefpilot.example/?token=private" },
    { ...production, SITE_URL: "http://localhost:3000" },
  ])("fails closed for unapproved or noncommercial environments %#", (env) => {
    expect(marketingConfig(env).indexable).toBe(false);
  });
  it("allows an explicitly configured production site only", () => {
    expect(marketingConfig(production)).toMatchObject({
      origin: production.SITE_URL,
      indexable: true,
      contactEmail: null,
      entryHref: "/login",
    });
  });
  it("never reflects secrets or a malformed origin into metadata", () => {
    vi.stubEnv("SITE_URL", "https://private:secret@example.invalid");
    vi.stubEnv("AUTH_URL", "https://example.invalid/?token=private");
    const meta = marketingMetadata("Test", "/features");
    expect(JSON.stringify(meta)).not.toMatch(/secret|token=|private:/);
    expect(String(meta.metadataBase)).toBe("http://localhost:3000/");
  });
  it("disallows the whole staging and returns an empty sitemap", () => {
    vi.stubEnv("SITE_INDEXING_ENABLED", "true");
    vi.stubEnv("APP_ENV", "staging");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(sitemap()).toEqual([]);
  });
  it("lists only genuine public routes and excludes account and draft pages", () => {
    for (const [key, value] of Object.entries(production))
      vi.stubEnv(key, value);
    expect(sitemap().map((item) => new URL(item.url).pathname)).toEqual([
      ...publicMarketingPaths,
    ]);
    expect(JSON.stringify(sitemap())).not.toMatch(
      /dashboard|login|api|privacy|terms|contact/,
    );
    expect(robots().sitemap).toBe(`${production.SITE_URL}/sitemap.xml`);
    // Blocking these public pages would prevent a crawler from reading noindex.
    expect(JSON.stringify(robots().rules)).not.toMatch(/login|privacy|terms|contact/);
    expect(marketingMetadata("Test", "/features").alternates?.canonical).toBe(
      `${production.SITE_URL}/features`,
    );
  });
  it("publishes no invented rating, commercial offer or organization", () => {
    const schema = softwareApplicationJsonLd();
    expect(schema["@type"]).toBe("SoftwareApplication");
    expect(JSON.stringify(schema)).not.toMatch(
      /aggregateRating|review|offers|Organization|address/,
    );
  });
});
