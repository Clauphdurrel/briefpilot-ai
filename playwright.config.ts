import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.E2E_STATE_FILE ??= join(tmpdir(), `briefpilot-e2e-${randomUUID()}.json`);
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1,
  timeout: 90000, expect: { timeout: 15000 }, retries: 0,
  reporter: [["list"]], outputDir: "/tmp/briefpilot-playwright-results",
  use: { baseURL: "http://localhost:3181", browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure", acceptDownloads: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node scripts/test-e2e-server.mjs",
    url: "http://localhost:3181/api/auth/providers",
    reuseExistingServer: false,
    timeout: 120000,
    // Let the harness stop Next, unlink its state and drop its own test DB.
    // Playwright otherwise kills the process group without running finally.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
  },
});
