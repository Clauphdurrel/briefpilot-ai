import { afterEach, expect, it, vi } from "vitest";

import { getOpenAI } from "../openai";

afterEach(() => vi.unstubAllEnvs());

it("requires server-side credentials and an explicitly configured model", () => {
  vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("OPENAI_MODEL", "");
  expect(getOpenAI).toThrow("n’est pas encore configurée");
});

it("does not make any request when constructing the client and disables automatic retries", () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real"); vi.stubEnv("OPENAI_MODEL", "test-model");
  const { client, model } = getOpenAI();
  expect(model).toBe("test-model");
  expect(client.maxRetries).toBe(0);
  expect(client.timeout).toBe(45000);
});
