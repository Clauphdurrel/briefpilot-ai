import { test, expect, noOverflow } from "./fixtures";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

test("marketing · sections, CTA et FAQ au clavier", async ({ page }) => {
  const remote: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      remote.push(url.hostname);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Des besoins clients aux spécifications prêtes à développer.",
  );
  await expect(page.locator("main > section")).toHaveCount(10);
  const brand = page.locator("header a.mk-brand");
  await expect(brand).toHaveAccessibleName("BriefPilot AI, accueil");
  await expect(brand).toHaveText(/briefpilot\s+AI/);
  await expect(page.locator("main a[data-marketing-hero]")).toHaveAttribute(
    "href",
    "/login",
  );
  await page.getByRole("link", { name: "Découvrir comment ça marche" }).click();
  await expect(page).toHaveURL(/#fonctionnement$/);
  const question = page
    .locator("summary")
    .filter({ hasText: "Peut-on utiliser BriefPilot AI gratuitement ?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details[open]")).toContainText("3 réponses IA");
  await noOverflow(page);
  expect(remote).toEqual([]);
});

test("marketing · navigation mobile et fermeture Escape", async ({ page }) => {
  await page.goto("/");
  if (page.viewportSize()!.width >= 768) {
    await expect(
      page.getByRole("navigation", {
        name: "Navigation principale",
        exact: true,
      }),
    ).toBeVisible();
    return;
  }
  const toggle = page.getByRole("button", { name: "Ouvrir le menu" });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Navigation mobile" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: "Fonctionnalités", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Navigation mobile" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/#fonctionnalites$/);
});

test("marketing · SEO staging, routes et informations honnêtes", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https?:\/\//,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      "{}",
  );
  expect(data["@type"]).toBe("SoftwareApplication");
  expect(data.aggregateRating).toBeUndefined();
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
  const health = await request.get("/api/health");
  expect(health.headers()["x-robots-tag"]).toContain("noindex");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("<loc>");
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  for (const path of [
    "/features",
    "/how-it-works",
    "/pricing",
    "/contact",
    "/privacy",
    "/terms",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await noOverflow(page);
  }
  await expect(
    page.getByText("Brouillon informatif", { exact: false }),
  ).toBeVisible();
  await page.goto("/pricing");
  await expect(
    page.getByRole("button", { name: "Passer à Pro" }),
  ).toBeVisible();
  await expect(
    page.getByText("aucun achat réel", { exact: false }).first(),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("marketing · cinq tailles, reduced motion et captures", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Matrix captured once; other journeys still run on all projects.",
  );
  const directory =
    process.env.MARKETING_SCREENSHOTS_DIR ??
    "/tmp/briefpilot-marketing-validation";
  await mkdir(directory, { recursive: true });
  for (const width of [320, 375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    expect(
      await page
        .locator("h1")
        .evaluate((node) => getComputedStyle(node).fontSize),
    ).toBeTruthy();
    await page.screenshot({
      path: join(directory, `landing-${width}.png`),
      fullPage: true,
    });
    const buttons = page.locator("a.mk-button:visible");
    for (let index = 0; index < (await buttons.count()); index++)
      expect(
        (await buttons.nth(index).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(40);
  }
});
