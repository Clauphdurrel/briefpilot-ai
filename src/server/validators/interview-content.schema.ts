import { z } from "zod";

export const interviewContentSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  status: z.enum(["available", "missing", "not_applicable"]),
  importance: z.enum(["high", "medium", "low"]),
  description: z.string().trim().max(500),
  url: z.string().trim().max(1000).refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }, "Utilise un lien http ou https sans identifiants."),
});
export type InterviewContent = z.infer<typeof interviewContentSchema>;
