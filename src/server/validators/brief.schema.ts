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

// Versioned document format. The initial schemas remain available for existing consumers.
const documentTextSchema = z.string().trim().min(1).max(2000);
const documentIdSchema = z.string().trim().min(1).max(100);
const sourceIdsSchema = z.array(z.string().min(1).max(150)).max(8);
export const requirementStatusSchema = z.enum(["confirmed", "assumed", "recommended", "missing"]);
export const statementSchema = z.strictObject({
  text: documentTextSchema,
  status: requirementStatusSchema,
  sourceIds: sourceIdsSchema,
});
const statementsSchema = z.array(statementSchema).max(40);
const assumptionsSchema = z.array(statementSchema.extend({ status: z.literal("assumed") })).max(30);
const classification = { status: requirementStatusSchema, sourceIds: sourceIdsSchema };

export const documentFeatureSchema = featureSchema.extend({
  id: documentIdSchema,
  name: z.string().trim().min(1).max(200),
  description: documentTextSchema,
  priority: z.enum(["MUST", "SHOULD", "COULD", "WONT"]),
  actor: z.string().trim().min(1).max(200),
  ...classification,
  businessRules: statementsSchema,
  acceptanceCriteria: statementsSchema,
  dependencies: z.array(documentIdSchema).max(20),
});

export const documentPageSchema = pageSchema.extend({
  id: documentIdSchema,
  name: z.string().trim().min(1).max(200),
  description: documentTextSchema,
  ...classification,
  objective: statementSchema,
  users: z.array(documentTextSchema).max(10),
  requiredContent: statementsSchema,
  components: statementsSchema,
  interactions: statementsSchema,
});

export const generatedBriefSchema = briefSchema.extend({
  projectSummary: z.strictObject({ context: statementSchema, executiveSummary: statementSchema, problem: statementSchema }),
  businessObjectives: statementsSchema,
  targetAudience: statementsSchema,
  projectScope: z.strictObject({ included: statementsSchema, excluded: statementsSchema, assumptions: assumptionsSchema, limits: statementsSchema }),
  features: z.array(documentFeatureSchema).max(40),
  pages: z.array(documentPageSchema).max(30),
  userJourneys: z.array(z.strictObject({
    id: documentIdSchema, name: documentTextSchema, ...classification,
    steps: statementsSchema, expectedResult: statementSchema,
  })).max(20),
  userRoles: z.array(z.strictObject({
    id: documentIdSchema, name: documentTextSchema, ...classification,
    permissions: statementsSchema, restrictions: statementsSchema,
  })).max(20),
  requiredContent: statementsSchema,
  integrations: statementsSchema,
  technicalConstraints: statementsSchema,
  securityRequirements: statementsSchema,
  nonFunctionalRequirements: statementsSchema,
  regulatoryConsiderations: statementsSchema,
  budgetAndTimeline: z.strictObject({
    budget: statementSchema.extend({ status: z.enum(["confirmed", "missing"]) }),
    deadlines: z.array(statementSchema.extend({ status: z.enum(["confirmed", "missing"]) })).max(40),
    deliveryConstraints: statementsSchema, assumptions: assumptionsSchema,
  }),
  risks: statementsSchema,
  missingInformation: z.array(z.strictObject({
    category: z.string().trim().min(1).max(100), description: documentTextSchema,
    importance: prioritySchema, question: documentTextSchema,
  })).max(40),
  acceptanceCriteria: statementsSchema,
  assumptions: assumptionsSchema,
});

export type RequirementStatus = z.infer<typeof requirementStatusSchema>;
export type Statement = z.infer<typeof statementSchema>;
export type GeneratedBrief = z.infer<typeof generatedBriefSchema>;
