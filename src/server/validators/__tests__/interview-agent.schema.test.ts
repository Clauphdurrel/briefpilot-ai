import { expect, it } from "vitest";

import { input, wire } from "@/server/agents/__tests__/fixtures";
import { interviewAgentInputSchema, interviewWireOutputSchema, sendInterviewMessageSchema, startInterviewSchema } from "../interview-agent.schema";

it("accepts an empty conversation with real project context", () => {
  expect(interviewAgentInputSchema.parse(input).history).toEqual([]);
  expect(interviewWireOutputSchema.parse(wire).nextQuestion?.helpText).toBeNull();
});

it("requires all wire fields, including nullable helpText", () => {
  expect(interviewWireOutputSchema.safeParse({ ...wire, nextQuestion: { ...wire.nextQuestion, helpText: undefined } }).success).toBe(false);
});

it("requires a UUID idempotency key and rejects unexpected ownership fields", () => {
  expect(startInterviewSchema.safeParse({ requestId: "bad" }).success).toBe(false);
  expect(startInterviewSchema.safeParse({ requestId: crypto.randomUUID(), ownerId: "other" }).success).toBe(false);
});

it("validates bounded replies and the expected prior message", () => {
  const request = { requestId: crypto.randomUUID(), content: " Agences ", expectedLastMessageId: "message-1" };
  expect(sendInterviewMessageSchema.parse(request)).toMatchObject({ content: "Agences", language: "fr" });
  expect(sendInterviewMessageSchema.safeParse({ ...request, content: " " }).success).toBe(false);
  expect(sendInterviewMessageSchema.safeParse({ ...request, content: "x".repeat(4001) }).success).toBe(false);
  expect(sendInterviewMessageSchema.safeParse({ ...request, expectedLastMessageId: "" }).success).toBe(false);
});
