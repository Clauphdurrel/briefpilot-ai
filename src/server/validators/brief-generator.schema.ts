import { z } from "zod";

import { generatedBriefSchema } from "./brief.schema";
import { projectTypeSchema } from "./interview.schema";

export const generateBriefRequestSchema = z.strictObject({
  requestId: z.uuid(),
  allowDraft: z.boolean().default(false),
  language: z.enum(["fr", "en"]).default("fr"),
});

export const briefAgentInputSchema = z.strictObject({
  project: z.strictObject({ name: z.string().min(1).max(120), type: projectTypeSchema, description: z.string().max(2000).nullable() }),
  sources: z.array(z.strictObject({ id: z.string().min(1).max(150), text: z.string().min(1).max(4000), kind: z.enum(["project", "answer"]) })).max(60),
  history: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(30),
  knownInformation: z.array(z.string().min(1).max(1000)).max(60),
  missingInformation: z.array(z.string().min(1).max(1000)).max(30),
  language: z.enum(["fr", "en"]),
  draftRequested: z.boolean(),
});

export const storedBriefSchema = z.strictObject({
  schemaVersion: z.literal("brief.v1"),
  document: generatedBriefSchema,
  generation: z.strictObject({
    version: z.number().int().positive(), requestId: z.uuid(), sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
    projectName: z.string().min(1).max(120), projectType: projectTypeSchema,
    language: z.enum(["fr", "en"]), draft: z.boolean(), generatedAt: z.iso.datetime(), model: z.string().min(1),
  }),
});

export type GenerateBriefRequest = z.infer<typeof generateBriefRequestSchema>;
export type BriefAgentInput = z.infer<typeof briefAgentInputSchema>;
export type StoredBrief = z.infer<typeof storedBriefSchema>;
