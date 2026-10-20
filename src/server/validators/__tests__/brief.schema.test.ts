import { describe, expect, it } from "vitest";

import { briefSchema, featureSchema, pageSchema } from "../brief.schema";
import { brief } from "./fixtures";

describe("brief schemas", () => {
  it("accepts a structured brief with missing information and an unknown estimate", () => {
    const result = briefSchema.parse(brief);
    expect(result.features[0].complexity).toBe("unknown");
    expect(result.assumptions).toEqual([]);
    expect(result.missingInformation).toEqual(["Contraintes d’hébergement"]);
  });

  it.each(Object.keys(brief))("requires brief field %s", (field) => {
    const input: Record<string, unknown> = { ...brief };
    delete input[field];
    expect(briefSchema.safeParse(input).success).toBe(false);
  });

  it.each(["id", "name", "description", "priority", "complexity", "acceptanceCriteria"])("requires feature field %s", (field) => {
    const input: Record<string, unknown> = { ...brief.features[0] };
    delete input[field];
    expect(featureSchema.safeParse(input).success).toBe(false);
  });

  it.each(["low", "medium", "high", "unknown"])("accepts feature complexity %s", (complexity) => {
    expect(featureSchema.parse({ ...brief.features[0], complexity }).complexity).toBe(complexity);
  });

  it.each([
    { ...brief.features[0], name: " " },
    { ...brief.features[0], priority: "critical" },
    { ...brief.features[0], complexity: 3 },
    { ...brief.features[0], complexity: "simple" },
    { ...brief.features[0], acceptanceCriteria: "À tester" },
    { ...brief.features[0], acceptanceCriteria: [""] },
  ])("rejects malformed feature %#", (feature) => {
    expect(briefSchema.safeParse({ ...brief, features: [feature] }).success).toBe(false);
  });

  it("requires meaningful page fields and rejects extra properties", () => {
    expect(pageSchema.parse(brief.pages[0]).id).toBe("menu");
    expect(pageSchema.safeParse({ id: "menu", name: "La carte" }).success).toBe(false);
    expect(pageSchema.safeParse({ ...brief.pages[0], name: " " }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief, inventedField: true }).success).toBe(false);
  });

  it.each([
    { projectSummary: " " }, { projectScope: "" }, { integrations: "Stripe" },
    { businessObjectives: [1] }, { securityRequirements: [""] },
    { risks: null }, { requiredContent: [{}] },
  ])("rejects malformed brief data %#", (changes) => {
    expect(briefSchema.safeParse({ ...brief, ...changes }).success).toBe(false);
  });
});
