import { z } from "zod";

import { interviewAnalysisSchema, projectTypeSchema, questionSchema } from "./interview.schema";

export const interviewCategories = [
  "context", "problem", "objectives", "users", "features", "pages", "journeys",
  "roles", "content", "branding", "integrations", "data", "technical",
  "regulatory", "budget", "timeline", "success",
] as const;

const boundedText = z.string().trim().min(1).max(1000);
export const coverageSchema = z.strictObject({
  category: z.enum(interviewCategories),
  status: z.enum(["missing", "partial", "confirmed"]),
  evidence: boundedText.nullable(),
});

const boundedQuestionSchema = questionSchema.extend({
  id: z.string().trim().min(1).max(100),
  question: boundedText,
  category: z.string().trim().min(1).max(100),
  helpText: z.string().trim().min(1).max(500).optional(),
});

export const interviewTurnSchema = interviewAnalysisSchema.extend({
  summary: boundedText,
  message: z.string().trim().min(1).max(2000),
  knownInformation: z.array(boundedText).max(60),
  missingInformation: z.array(boundedText).max(30),
  assumptions: z.array(boundedText).max(30),
  nextQuestion: boundedQuestionSchema.nullable(),
  coverage: z.array(coverageSchema).length(interviewCategories.length),
});

// Structured Outputs requires all properties to be present: optional helpText uses null on the wire.
export const interviewWireOutputSchema = interviewTurnSchema.extend({
  nextQuestion: boundedQuestionSchema.extend({
    helpText: z.string().trim().min(1).max(500).nullable(),
  }).nullable(),
});

export const interviewAgentInputSchema = z.strictObject({
  project: z.strictObject({
    name: z.string().trim().min(1).max(120),
    type: projectTypeSchema,
    description: z.string().max(2000).nullable(),
  }),
  history: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  })).max(40).refine((messages) => messages.reduce((sum, item) => sum + item.content.length, 0) <= 32000),
  knownInformation: z.array(boundedText).max(60),
  previousAnalysis: interviewTurnSchema.nullable(),
  language: z.enum(["fr", "en"]),
});

export const startInterviewSchema = z.strictObject({
  requestId: z.uuid(),
  language: z.enum(["fr", "en"]).default("fr"),
});

export const sendInterviewMessageSchema = startInterviewSchema.extend({
  content: z.string().trim().min(1, "Écris une réponse.").max(4000, "La réponse est limitée à 4 000 caractères."),
  expectedLastMessageId: z.string().min(1).max(128),
});

export const interviewStateSchema = z.strictObject({
  analysis: interviewTurnSchema.nullable().optional(),
  messages: z.array(z.strictObject({
    id: z.string(), role: z.enum(["user", "assistant"]), content: z.string(), createdAt: z.iso.datetime(),
  })).max(200),
  completionScore: z.number().min(0).max(100).nullable(),
  missingInformation: z.array(z.string()),
});

export type InterviewTurn = z.infer<typeof interviewTurnSchema>;
export type InterviewAgentInput = z.infer<typeof interviewAgentInputSchema>;
export type StartInterviewInput = z.infer<typeof startInterviewSchema>;
export type SendInterviewMessageInput = z.infer<typeof sendInterviewMessageSchema>;
export type InterviewState = z.infer<typeof interviewStateSchema>;
