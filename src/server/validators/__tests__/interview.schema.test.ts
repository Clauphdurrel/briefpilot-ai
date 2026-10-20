import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  clientAnswerSchema, completionScoreSchema, interviewAnalysisSchema,
  interviewInputSchema, interviewSchema, prioritySchema, projectTypeSchema, questionSchema,
} from "../interview.schema";
import { analysis, question } from "./fixtures";

describe("interview schemas", () => {
  it("accepts a French interview without inventing assumptions or answers", () => {
    const result = interviewSchema.parse({
      ...analysis, projectType: "WEBSITE", locale: "fr", questions: [question], answers: [],
    });
    expect(result.assumptions).toEqual([]);
    expect(result.answers).toEqual([]);
    expect(result.nextQuestion?.id).toBe("target_users");
  });

  it("accepts a complete interview with no next question", () => {
    expect(interviewAnalysisSchema.parse({ ...analysis, completionScore: 100, nextQuestion: null }).nextQuestion).toBeNull();
  });

  it("matches all ProjectType values in the actual Prisma schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const values = schema.match(/enum ProjectType\s*\{([^}]+)\}/)?.[1].trim().split(/\s+/);
    expect(values).toBeDefined();
    expect([...projectTypeSchema.options].sort()).toEqual(values?.sort());
    for (const value of values ?? []) expect(projectTypeSchema.safeParse(value).success).toBe(true);
  });

  it.each(["website", "LANDING_PAGE", "", 1, null])("rejects unsupported project type %j", (value) => {
    expect(projectTypeSchema.safeParse(value).success).toBe(false);
  });

  it.each([0, 30, 72.5, 100])("accepts completion score %s", (score) => {
    expect(completionScoreSchema.parse(score)).toBe(score);
  });

  it.each([-1, 100.1, NaN, Infinity, -Infinity, "30", null])("rejects invalid completion score %s", (score) => {
    expect(completionScoreSchema.safeParse(score).success).toBe(false);
  });

  it.each(["low", "medium", "high"])("accepts priority %s", (priority) => {
    expect(prioritySchema.parse(priority)).toBe(priority);
  });

  it.each(["urgent", "HIGH", "haute", "", 1])("rejects invalid priority %j", (priority) => {
    expect(prioritySchema.safeParse(priority).success).toBe(false);
  });

  it.each(["id", "question", "category", "priority", "required"])("requires question field %s", (field) => {
    const input: Record<string, unknown> = { ...question };
    delete input[field];
    expect(questionSchema.safeParse(input).success).toBe(false);
  });

  it("accepts help text and translated wording without translating identifiers", () => {
    expect(questionSchema.parse({ ...question, question: "Who will use the app?", helpText: "Describe your audience." }).id).toBe(question.id);
  });

  it.each([
    { ...question, id: "   " }, { ...question, question: " " },
    { ...question, category: "" }, { ...question, required: "true" },
    { ...question, helpText: 1 }, { ...question, unexpected: true },
  ])("rejects malformed question %#", (input) => {
    expect(questionSchema.safeParse(input).success).toBe(false);
  });

  it.each([undefined, "2026-10-20T10:00:00Z", "2026-10-20T12:00:00+02:00"])("accepts optional ISO answer timestamp %s", (answeredAt) => {
    expect(clientAnswerSchema.parse({ questionId: question.id, answer: "Clients du restaurant", answeredAt }).answer).toBe("Clients du restaurant");
  });

  it.each([
    { answer: "Une réponse" }, { questionId: question.id },
    { questionId: " ", answer: "Une réponse" },
    { questionId: question.id, answer: " " },
    { questionId: question.id, answer: { value: "texte" } },
    { questionId: question.id, answer: "Texte", answeredAt: "hier" },
    { questionId: question.id, answer: "Texte", answeredAt: "2026-02-30T10:00:00Z" },
  ])("rejects malformed answer %#", (input) => {
    expect(clientAnswerSchema.safeParse(input).success).toBe(false);
  });

  it.each(["knownInformation", "missingInformation", "assumptions"])("requires explicit %s instead of silently adding defaults", (field) => {
    const input: Record<string, unknown> = { ...analysis };
    delete input[field];
    expect(interviewAnalysisSchema.safeParse(input).success).toBe(false);
    expect(interviewAnalysisSchema.safeParse({ ...analysis, [field]: [" "] }).success).toBe(false);
  });

  it("rejects a malformed next question and wrong input collection types", () => {
    expect(interviewAnalysisSchema.safeParse({ ...analysis, nextQuestion: "À préciser" }).success).toBe(false);
    expect(interviewInputSchema.safeParse({ projectType: "SAAS", questions: {}, answers: [] }).success).toBe(false);
  });
});
