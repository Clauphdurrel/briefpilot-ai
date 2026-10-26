import { z } from "zod";

const originSchema = z.url().refine((raw) => {
  const url = new URL(raw);
  return (
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === "/" &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)))
  );
});
export function marketingConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const configured = originSchema.safeParse(env.SITE_URL);
  const fallback = originSchema.safeParse(env.AUTH_URL);
  const origin = configured.success
    ? new URL(configured.data).origin
    : fallback.success
      ? new URL(fallback.data).origin
      : "http://localhost:3000";
  const host = new URL(origin).hostname;
  const indexable =
    env.SITE_INDEXING_ENABLED === "true" &&
    env.APP_ENV === "production" &&
    env.NODE_ENV === "production" &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === "production") &&
    configured.success &&
    new URL(origin).protocol === "https:" &&
    !host.endsWith(".vercel.app") &&
    !["localhost", "127.0.0.1"].includes(host);
  const email = z.email().safeParse(env.MARKETING_CONTACT_EMAIL);
  // No invitation or waitlist system exists. Google login is the current entry point.
  return {
    origin,
    indexable,
    contactEmail: email.success ? email.data : null,
    entryHref: "/login",
  };
}
export const marketingDescription =
  "Transformez les besoins de vos clients en cahiers des charges, backlogs techniques et prompts Codex. L’assistant IA pour cadrer vos projets digitaux.";
export const publicMarketingPaths = [
  "/",
  "/features",
  "/how-it-works",
  "/pricing",
] as const;
