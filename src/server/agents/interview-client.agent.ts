import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import { InterviewError } from "@/server/ai/errors";
import { getOpenAI } from "@/server/ai/openai";
import { interviewClientPrompt } from "@/server/prompts/interview-client";
import {
  interviewAgentInputSchema, interviewCategories, interviewTurnSchema, interviewWireOutputSchema,
  type InterviewAgentInput, type InterviewTurn,
} from "@/server/validators/interview-agent.schema";

export function calculateCompletionScore(coverage: InterviewTurn["coverage"]) {
  const categories = new Set(coverage.map((item) => item.category));
  if (categories.size !== interviewCategories.length || coverage.length !== interviewCategories.length) {
    throw new InterviewError("AI_INVALID_OUTPUT", 502, "La réponse IA est invalide. Réessaie.");
  }
  return Math.round(100 * coverage.reduce((sum, item) => sum + (item.status === "confirmed" ? 1 : item.status === "partial" ? 0.5 : 0), 0) / interviewCategories.length);
}

export function buildInterviewContext(input: InterviewAgentInput) {
  const data = interviewAgentInputSchema.parse(input);
  const context = JSON.stringify({
    project: data.project, language: data.language, knownInformation: data.knownInformation,
    previousAnalysis: data.previousAnalysis, conversation: data.history,
  });
  if (context.length > 64000) throw new InterviewError("AI_CONTEXT_LIMIT", 422, "Cette interview contient trop d’informations pour poursuivre automatiquement.");
  return [
    { role: "system" as const, content: interviewClientPrompt },
    { role: "user" as const, content: context },
  ];
}

export async function runInterviewClientAgent(raw: unknown): Promise<{ analysis: InterviewTurn; model: string }> {
  const input = interviewAgentInputSchema.safeParse(raw);
  if (!input.success) throw new InterviewError("INVALID_AGENT_INPUT", 400, "Le contexte de l’interview est invalide.");

  try {
    const { client, model } = getOpenAI();
    const response = await client.responses.parse({
      model, input: buildInterviewContext(input.data), store: false, max_output_tokens: 8000,
      text: { format: zodTextFormat(interviewWireOutputSchema, "interview_turn") },
    });
    if (response.output.some((item) => item.type === "message" && item.content.some((content) => content.type === "refusal"))) {
      throw new InterviewError("AI_REFUSAL", 422, "L’IA ne peut pas traiter cette demande. Reformule ta réponse.");
    }
    if (response.status !== "completed") throw new InterviewError("AI_INCOMPLETE", 502, "La réponse IA est incomplète. Réessaie.");
    const parsed = interviewWireOutputSchema.safeParse(response.output_parsed);
    if (!parsed.success) throw new InterviewError("AI_INVALID_OUTPUT", 502, "La réponse IA est invalide. Réessaie.");
    const wire = parsed.data;
    const nextQuestion = wire.nextQuestion ? { ...wire.nextQuestion, helpText: wire.nextQuestion.helpText ?? undefined } : null;
    const analysis = interviewTurnSchema.parse({ ...wire, nextQuestion, completionScore: calculateCompletionScore(wire.coverage) });
    if (analysis.coverage.some((item) => item.status !== "missing" && !item.evidence?.trim()) ||
      (analysis.completionScore < 100 && !analysis.nextQuestion)) {
      throw new InterviewError("AI_INVALID_OUTPUT", 502, "L’analyse IA doit préciser les informations manquantes. Réessaie.");
    }
    if (input.data.history.at(-1)?.role === "user" && input.data.previousAnalysis?.nextQuestion &&
      analysis.nextQuestion?.question === input.data.previousAnalysis.nextQuestion.question) {
      throw new InterviewError("AI_REPEATED_QUESTION", 502, "L’IA a répété la question précédente. Réessaie.");
    }
    return { analysis, model };
  } catch (error) {
    if (error instanceof InterviewError) throw error;
    if (error instanceof ZodError || error instanceof SyntaxError) throw new InterviewError("AI_INVALID_OUTPUT", 502, "La réponse IA est invalide. Réessaie.");
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new InterviewError("AI_TIMEOUT", 504, "L’IA met trop de temps à répondre. Réessaie.");
    if (error instanceof OpenAI.RateLimitError) throw new InterviewError("AI_QUOTA", 503, "Le service IA est momentanément indisponible. Réessaie plus tard.");
    if (error instanceof OpenAI.APIConnectionError) throw new InterviewError("AI_NETWORK", 502, "Connexion au service IA impossible. Réessaie.");
    throw new InterviewError("AI_UNAVAILABLE", 502, "Le service IA n’a pas pu répondre. Réessaie plus tard.");
  }
}
