import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { currentUsage, meterProvider } from "./usage-context";
import { InterviewError } from "./errors";

const configSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_MODEL: z.string().trim().min(1),
});

export function getOpenAI() {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success || /ta-cle|change-me/.test(parsed.data.OPENAI_API_KEY)) {
    throw new InterviewError("AI_NOT_CONFIGURED", 503, "Le service IA n’est pas encore configuré. Contacte l’administrateur.");
  }
  const client = new OpenAI({ apiKey: parsed.data.OPENAI_API_KEY, timeout: 45000, maxRetries: 0 });
  if (currentUsage()) {
    const parse = client.responses.parse.bind(client.responses);
    client.responses.parse = ((...args: Parameters<typeof parse>) => meterProvider(() => parse(...args))) as typeof client.responses.parse;
  }
  return {
    client,
    model: parsed.data.OPENAI_MODEL,
  };
}
