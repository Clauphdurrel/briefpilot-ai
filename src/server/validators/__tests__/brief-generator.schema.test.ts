import { expect, it } from "vitest";

import { documentFixture } from "@/server/agents/__tests__/brief-fixtures";
import { generatedBriefSchema } from "../brief.schema";
import { generateBriefRequestSchema } from "../brief-generator.schema";

it("accepts complete and incomplete structured documents without changing the initial schema", () => {
  expect(generatedBriefSchema.parse(documentFixture()).missingInformation.length).toBeGreaterThan(0);
  expect(generatedBriefSchema.parse(documentFixture(true)).missingInformation).toEqual([]);
});

it.each(["MUST", "SHOULD", "COULD", "WONT"])("supports MoSCoW priority %s", (priority) => {
  const doc = documentFixture();
  expect(generatedBriefSchema.safeParse({ ...doc, features: [{ ...doc.features[0], priority }] }).success).toBe(true);
});

it("rejects unknown classifications, required-field omissions and extra properties", () => {
  const doc = documentFixture();
  expect(generatedBriefSchema.safeParse({ ...doc, features: [{ ...doc.features[0], status: "certain" }] }).success).toBe(false);
  expect(generatedBriefSchema.safeParse({ ...doc, userJourneys: undefined }).success).toBe(false);
  expect(generatedBriefSchema.safeParse({ ...doc, arbitrary: "invented" }).success).toBe(false);
});

it("requires an idempotency key and explicit draft consent", () => {
  expect(generateBriefRequestSchema.parse({ requestId: crypto.randomUUID() }).allowDraft).toBe(false);
  expect(generateBriefRequestSchema.safeParse({ requestId: "bad" }).success).toBe(false);
  expect(generateBriefRequestSchema.safeParse({ requestId: crypto.randomUUID(), ownerId: "other" }).success).toBe(false);
});
