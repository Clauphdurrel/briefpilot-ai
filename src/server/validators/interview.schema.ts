import { z } from "zod";

import { projectTypes } from "@/config/projects";

// Stable enum values are independent of the language used for client-facing text.
export const projectTypeSchema = z.enum(projectTypes);
export const prioritySchema = z.enum(["low", "medium", "high"]);
export const completionScoreSchema = z.number().min(0).max(100);
export const nonEmptyTextSchema = z.string().trim().min(1);
export const informationListSchema = z.array(nonEmptyTextSchema);

export const questionSchema = z.strictObject({
  id: nonEmptyTextSchema,
  question: nonEmptyTextSchema,
  category: nonEmptyTextSchema,
  priority: prioritySchema,
  required: z.boolean(),
  helpText: nonEmptyTextSchema.optional(),
});

export const clientAnswerSchema = z.strictObject({
  questionId: nonEmptyTextSchema,
  answer: nonEmptyTextSchema,
  answeredAt: z.iso.datetime({ offset: true }).optional(),
});

export const interviewInputSchema = z.strictObject({
  projectType: projectTypeSchema,
  questions: z.array(questionSchema),
  answers: z.array(clientAnswerSchema),
  locale: z.string().trim().min(2).max(35).optional(),
});

export const interviewAnalysisSchema = z.strictObject({
  summary: nonEmptyTextSchema,
  knownInformation: informationListSchema,
  missingInformation: informationListSchema,
  assumptions: informationListSchema,
  completionScore: completionScoreSchema,
  nextQuestion: questionSchema.nullable(),
});

export const interviewSchema = z.strictObject({
  ...interviewInputSchema.shape,
  ...interviewAnalysisSchema.shape,
});

export type ProjectType = z.infer<typeof projectTypeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type Question = z.infer<typeof questionSchema>;
export type ClientAnswer = z.infer<typeof clientAnswerSchema>;
export type InterviewInput = z.infer<typeof interviewInputSchema>;
export type InterviewAnalysis = z.infer<typeof interviewAnalysisSchema>;
export type Interview = z.infer<typeof interviewSchema>;
