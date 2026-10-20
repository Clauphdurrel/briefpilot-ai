import { describe, expect, expectTypeOf, it } from "vitest";

import { agentResponseSchema, createAgentResponseSchema } from "../agent-response.schema";
import type { AgentResponseFor } from "../agent-response.schema";
import { interviewAnalysisSchema } from "../interview.schema";
import type { InterviewAnalysis } from "../interview.schema";
import { analysis } from "./fixtures";

const schema = createAgentResponseSchema(interviewAnalysisSchema);
const success = {
  success: true,
  data: analysis,
  warnings: [],
  errors: [],
  metadata: { agentName: "InterviewClientAgent", executionTimeMs: 12.5, generatedAt: "2026-10-20T10:00:00Z" },
};
const failure = {
  success: false,
  data: null,
  warnings: [],
  errors: [{ code: "INVALID_OUTPUT", message: "La réponse reçue est invalide.", path: ["completionScore"] }],
  metadata: {},
};

describe("agent response schemas", () => {
  it("validates typed successful data and narrows the inferred TypeScript union", () => {
    const parsed: AgentResponseFor<typeof interviewAnalysisSchema> = schema.parse(success);
    if (!parsed.success) throw new Error("Expected a successful response");
    expectTypeOf(parsed.data).toEqualTypeOf<InterviewAnalysis>();
    expect(parsed.data.completionScore).toBe(30);
  });

  it("accepts a failure with errors and no fabricated data", () => {
    const parsed = schema.parse(failure);
    if (parsed.success) throw new Error("Expected a failed response");
    expectTypeOf(parsed.data).toEqualTypeOf<null>();
    expect(parsed.data).toBeNull();
    expect(parsed.errors[0].code).toBe("INVALID_OUTPUT");
  });

  it("allows warnings with stable codes and localized messages", () => {
    const warnings = [{ code: "MISSING_BUDGET", message: "Budget non renseigné." }];
    expect(schema.parse({ ...success, warnings }).warnings).toEqual(warnings);
  });

  it("allows optional metadata fields without generating timestamps or model names", () => {
    expect(schema.parse({ ...success, metadata: {} }).metadata).toEqual({});
    expect(schema.parse({ ...success, metadata: { model: "test-model" } }).metadata.model).toBe("test-model");
  });

  it.each([
    { ...success, data: { ...analysis, completionScore: 101 } },
    { ...success, data: null },
    { ...success, errors: failure.errors },
    { ...failure, data: analysis },
    { ...failure, errors: [] },
    { ...success, success: "true" },
    { ...failure, success: 0 },
    { ...failure, errors: [{ code: "", message: "Erreur" }] },
    { ...success, warnings: ["Un avertissement"] },
    { ...success, metadata: { executionTimeMs: -1 } },
    { ...success, metadata: { executionTimeMs: Infinity } },
    { ...success, metadata: { generatedAt: "hier" } },
    { ...success, metadata: { model: " " } },
    { ...success, extra: "unexpected" },
  ])("rejects malformed or contradictory response %#", (input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each(["success", "data", "warnings", "errors", "metadata"])("requires common response field %s", (field) => {
    const input: Record<string, unknown> = { ...success };
    delete input[field];
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("accepts JSON envelopes but rejects non-JSON values", () => {
    expect(agentResponseSchema.parse(success).success).toBe(true);
    expect(agentResponseSchema.safeParse({ ...success, data: () => "not JSON" }).success).toBe(false);
    expect(agentResponseSchema.safeParse({ ...success, data: undefined }).success).toBe(false);
  });
});
