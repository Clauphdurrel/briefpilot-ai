import { afterEach, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Unit tests must not inherit an operator's remote renderer configuration.
// Dedicated worker-client tests explicitly override this with a mocked transport.
beforeEach(() => {
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("PDF_RENDER_MODE", "local");
  vi.stubEnv("PDF_WORKER_URL", "");
  vi.stubEnv("PDF_WORKER_SECRET", "");
  vi.stubEnv("PDF_WORKER_VERCEL_BYPASS_SECRET", "");
});

afterEach(() => vi.unstubAllEnvs());
