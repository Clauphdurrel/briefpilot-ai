import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import { InterviewError } from "@/server/ai/errors";
import { getOpenAI } from "@/server/ai/openai";
import { briefGeneratorPrompt } from "@/server/prompts/brief-generator";
import { briefAgentInputSchema, type BriefAgentInput } from "@/server/validators/brief-generator.schema";
import { generatedBriefSchema, type GeneratedBrief } from "@/server/validators/brief.schema";

export function buildBriefContext(raw: unknown) {
  const input = briefAgentInputSchema.parse(raw);
  const context = JSON.stringify(input);
  if (context.length > 64000) throw new InterviewError("BRIEF_CONTEXT_LIMIT", 422, "L’interview est trop volumineuse pour cette génération.");
  return [{ role: "system" as const, content: briefGeneratorPrompt }, { role: "user" as const, content: context }];
}

export function validateBriefSources(document: GeneratedBrief, sources: BriefAgentInput["sources"]) {
  const allowed = new Set(sources.map((source) => source.id));
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (Array.isArray(item.sourceIds)) {
      if (item.sourceIds.some((id) => typeof id !== "string" || !allowed.has(id)) ||
        (item.status === "confirmed" && !item.sourceIds.length) || (item.status === "missing" && item.sourceIds.length)) {
        throw new InterviewError("BRIEF_INVALID_SOURCES", 502, "Le document contient des exigences non sourcées. Réessaie.");
      }
    }
    Object.values(item).forEach(visit);
  }
  visit(document);
  const ids = new Set(document.features.map((feature) => feature.id));
  if (ids.size !== document.features.length ||
    [document.pages, document.userRoles, document.userJourneys].some((items) => new Set(items.map((item) => item.id)).size !== items.length) ||
    document.features.some((feature) => feature.dependencies.some((id) => id === feature.id || !ids.has(id)))) {
    throw new InterviewError("BRIEF_INVALID_OUTPUT", 502, "Les identifiants ou dépendances du document sont invalides.");
  }
  const budget = document.budgetAndTimeline.budget;
  const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const containsExactQuote = (source: string, quote: string) => {
    const text = normalize(source), excerpt = normalize(quote);
    for (let index = text.indexOf(excerpt); index >= 0; index = text.indexOf(excerpt, index + 1)) {
      const before = text.slice(0, index), after = text.slice(index + excerpt.length);
      if (/[\p{L}\p{N}_]$/u.test(before) || /^[\p{L}\p{N}_]/u.test(after)) continue;
      // A quote must retain the entire amount, including grouped digits and its sign.
      if (/^\d/u.test(excerpt) && /(?:\d[\s.,'’]*|[-−+]\s*)$/u.test(before)) continue;
      if (/\d$/u.test(excerpt) && /^[\s.,'’]*\d/u.test(after)) continue;
      return true;
    }
    return false;
  };
  for (const item of [budget, ...document.budgetAndTimeline.deadlines]) {
    if (item.status === "confirmed" && !sources.some((source) => item.sourceIds.includes(source.id) && containsExactQuote(source.text, item.text))) {
      throw new InterviewError("BRIEF_INVALID_SOURCES", 502, "Le budget et les échéances confirmés doivent reprendre les informations exactes du client.");
    }
  }
  if (budget.status === "missing" && budget.text !== "À définir") {
    throw new InterviewError("BRIEF_INVALID_OUTPUT", 502, "Un budget absent doit rester à définir.");
  }
  for (const deadline of document.budgetAndTimeline.deadlines) {
    if (deadline.status === "missing" && deadline.text !== "À définir") throw new InterviewError("BRIEF_INVALID_OUTPUT", 502, "Une échéance absente doit rester à définir.");
  }
}

export async function runBriefGeneratorAgent(raw: unknown): Promise<{ document: GeneratedBrief; model: string }> {
  const parsed = briefAgentInputSchema.safeParse(raw);
  if (!parsed.success) throw new InterviewError("BRIEF_INVALID_INPUT", 400, "Le contexte du cahier des charges est invalide.");
  try {
    const { client, model } = getOpenAI();
    const response = await client.responses.parse({
      model, input: buildBriefContext(parsed.data), store: false, max_output_tokens: 12000,
      text: { format: zodTextFormat(generatedBriefSchema, "project_brief") },
    });
    if (response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"))) {
      throw new InterviewError("BRIEF_REFUSAL", 422, "L’IA ne peut pas générer ce document. Précise le besoin dans l’interview.");
    }
    if (response.status !== "completed") throw new InterviewError("BRIEF_INCOMPLETE", 502, "Le document généré est incomplet. Réessaie.");
    const output = generatedBriefSchema.safeParse(response.output_parsed);
    if (!output.success) throw new InterviewError("BRIEF_INVALID_OUTPUT", 502, "Le document généré est invalide. Réessaie.");
    validateBriefSources(output.data, parsed.data.sources);
    return { document: output.data, model };
  } catch (error) {
    if (error instanceof InterviewError) throw error;
    if (error instanceof ZodError || error instanceof SyntaxError) throw new InterviewError("BRIEF_INVALID_OUTPUT", 502, "Le document généré est invalide. Réessaie.");
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new InterviewError("BRIEF_TIMEOUT", 504, "La génération prend trop de temps. Réessaie.");
    if (error instanceof OpenAI.RateLimitError) throw new InterviewError("BRIEF_QUOTA", 503, "Le service IA est momentanément indisponible. Réessaie plus tard.");
    if (error instanceof OpenAI.APIConnectionError) throw new InterviewError("BRIEF_NETWORK", 502, "Connexion au service IA impossible. Réessaie.");
    throw new InterviewError("BRIEF_UNAVAILABLE", 502, "Le cahier des charges n’a pas pu être généré. Réessaie.");
  }
}
