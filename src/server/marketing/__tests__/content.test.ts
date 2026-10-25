import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroSection } from "@/components/marketing/hero-section";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { PricingCards } from "@/components/marketing/pricing-preview";
import { plans } from "@/config/plans";
it("renders a real login entry and labels the fictitious editable demonstration", () => {
  const html = renderToStaticMarkup(createElement(HeroSection));
  expect(html.match(/<h1 /g)).toHaveLength(1);
  expect(html).toContain('href="/login"');
  expect(html).toContain('href="#fonctionnement"');
  expect(html).toContain("Exemple fictif");
  expect(html).not.toMatch(/waitlist|inscription publique|10 000 clients/);
});
it("reuses the document status component without presenting a real customer account", () => {
  const html = renderToStaticMarkup(createElement(ProductShowcase));
  expect(html).toContain("Confirmé");
  expect(html).toContain("Hypothèse");
  expect(html).toContain("À préciser");
  expect(html).toContain("pas une capture");
});
it("uses the canonical plans without opening a checkout from the landing", () => {
  const html = renderToStaticMarkup(createElement(PricingCards));
  for (const plan of Object.values(plans)) expect(html).toContain(plan.name);
  expect(html).toContain(String(plans.PRO.monthlyPriceEuro));
  expect(html).toContain(String(plans.AGENCY.monthlyPriceEuro));
  expect(html).not.toContain("Passer à Pro");
  expect(html).toContain("non souscriptible");
  expect(html).toContain('href="/contact"');
});
