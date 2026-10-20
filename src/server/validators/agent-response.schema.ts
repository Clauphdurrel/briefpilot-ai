import { z } from "zod";

import { nonEmptyTextSchema } from "@/server/validators/interview.schema";

export const agentIssueSchema = z.strictObject({
  code: nonEmptyTextSchema,
  message: nonEmptyTextSchema,
  path: z.array(nonEmptyTextSchema).optional(),
});

export const agentMetadataSchema = z.strictObject({
  agentName: nonEmptyTextSchema.optional(),
  model: nonEmptyTextSchema.optional(),
  executionTimeMs: z.number().nonnegative().optional(),
  generatedAt: z.iso.datetime({ offset: true }).optional(),
});

// Each agent supplies its own data schema; a failed response never carries data.
export function createAgentResponseSchema<T extends z.ZodType>(dataSchema: T) {
  const common = {
    warnings: z.array(agentIssueSchema),
    metadata: agentMetadataSchema,
  };

  return z.discriminatedUnion("success", [
    z.strictObject({
      ...common,
      success: z.literal(true),
      data: dataSchema,
      errors: z.tuple([]),
    }),
    z.strictObject({
      ...common,
      success: z.literal(false),
      data: z.null(),
      errors: z.array(agentIssueSchema).min(1),
    }),
  ]);
}

// Validates the common JSON envelope only. Use the factory for agent-specific data.
export const agentResponseSchema = createAgentResponseSchema(z.json());

export type AgentIssue = z.infer<typeof agentIssueSchema>;
export type AgentMetadata = z.infer<typeof agentMetadataSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type AgentResponseFor<T extends z.ZodType> = z.infer<ReturnType<typeof createAgentResponseSchema<T>>>;
