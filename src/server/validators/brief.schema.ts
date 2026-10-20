import { z } from "zod";

import {
  informationListSchema,
  nonEmptyTextSchema,
  prioritySchema,
} from "@/server/validators/interview.schema";

// An unknown estimate stays explicit until enough information is available.
export const complexitySchema = z.enum(["low", "medium", "high", "unknown"]);

export const featureSchema = z.strictObject({
  id: nonEmptyTextSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  priority: prioritySchema,
  complexity: complexitySchema,
  acceptanceCriteria: informationListSchema,
});

export const pageSchema = z.strictObject({
  id: nonEmptyTextSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
});

export const briefSchema = z.strictObject({
  projectSummary: nonEmptyTextSchema,
  businessObjectives: informationListSchema,
  targetAudience: informationListSchema,
  projectScope: nonEmptyTextSchema,
  userRoles: informationListSchema,
  features: z.array(featureSchema),
  pages: z.array(pageSchema),
  integrations: informationListSchema,
  technicalConstraints: informationListSchema,
  securityRequirements: informationListSchema,
  requiredContent: informationListSchema,
  assumptions: informationListSchema,
  missingInformation: informationListSchema,
  risks: informationListSchema,
  acceptanceCriteria: informationListSchema,
});

export type Complexity = z.infer<typeof complexitySchema>;
export type Feature = z.infer<typeof featureSchema>;
export type BriefPage = z.infer<typeof pageSchema>;
export type Brief = z.infer<typeof briefSchema>;
