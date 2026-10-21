import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import { InterviewError } from "@/server/ai/errors";
import { getOpenAI } from "@/server/ai/openai";
import { backlogGeneratorPrompt } from "@/server/prompts/backlog-generator";
import { backlogAgentInputSchema, backlogSchema, validateBacklog, type Backlog } from "@/server/validators/backlog.schema";
import { containsCredential, renderCodexPrompt } from "@/server/formatters/codex-task";

export function buildBacklogContext(raw: unknown) {
  const input = backlogAgentInputSchema.parse(raw);
  if (containsCredential(input)) throw new InterviewError("BACKLOG_SENSITIVE_INPUT", 422, "Retire les identifiants sensibles du cahier des charges avant la génération.");
  const context = JSON.stringify(input);
  if (context.length > 100000) throw new InterviewError("BACKLOG_CONTEXT_LIMIT", 422, "Le cahier des charges est trop volumineux pour cette génération.");
  return [{ role: "system" as const, content: backlogGeneratorPrompt }, { role: "user" as const, content: context }];
}

export async function runBacklogGeneratorAgent(raw: unknown): Promise<{ document: Backlog; model: string }> {
  const parsed = backlogAgentInputSchema.safeParse(raw);
  if (!parsed.success) throw new InterviewError("BACKLOG_INVALID_INPUT", 400, "Le contexte du backlog est invalide.");
  try {
    const { client, model } = getOpenAI();
    const response = await client.responses.parse({
      model, input: buildBacklogContext(parsed.data), store: false, max_output_tokens: 20000,
      text: { format: zodTextFormat(backlogSchema, "project_backlog") },
    });
    if (response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"))) {
      throw new InterviewError("BACKLOG_REFUSAL", 422, "L’IA ne peut pas générer ce document. Précise le besoin dans l’interview.");
    }
    if (response.status !== "completed") throw new InterviewError("BACKLOG_INCOMPLETE", 502, "Le document généré est incomplet. Réessaie.");
    const output = backlogSchema.safeParse(response.output_parsed);
    if (!output.success) throw new InterviewError("BACKLOG_INVALID_OUTPUT", 502, "Le document généré est invalide. Réessaie.");
    try { validateBacklog(output.data, parsed.data.brief); }
    catch { throw new InterviewError("BACKLOG_INVALID_GRAPH", 502, "Le backlog généré contient des références ou priorités incohérentes. Réessaie."); }
    output.data.tasks = output.data.tasks.map((task) => ({ ...task, codexPrompt: renderCodexPrompt(output.data, task) }));
    if (containsCredential(output.data)) throw new InterviewError("BACKLOG_SENSITIVE_OUTPUT", 502, "La sortie contient une donnée sensible et ne peut pas être enregistrée.");
    return { document: output.data, model };
  } catch (error) {
    if (error instanceof InterviewError) throw error;
    if (error instanceof ZodError || error instanceof SyntaxError) throw new InterviewError("BACKLOG_INVALID_OUTPUT", 502, "Le document généré est invalide. Réessaie.");
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new InterviewError("BACKLOG_TIMEOUT", 504, "La génération prend trop de temps. Réessaie.");
    if (error instanceof OpenAI.RateLimitError) throw new InterviewError("BACKLOG_QUOTA", 503, "Le service IA est momentanément indisponible. Réessaie plus tard.");
    if (error instanceof OpenAI.APIConnectionError) throw new InterviewError("BACKLOG_NETWORK", 502, "Connexion au service IA impossible. Réessaie.");
    throw new InterviewError("BACKLOG_UNAVAILABLE", 502, "Le backlog n’a pas pu être généré. Réessaie.");
  }
}
