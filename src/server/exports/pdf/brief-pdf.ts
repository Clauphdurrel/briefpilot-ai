import { storedBriefSchema } from "@/server/validators/brief-generator.schema";
import { briefToMarkdown } from "../markdown/brief-to-markdown";
import { documentHtml, type PdfChapter } from "./pdf-templates";
export function briefChapter(raw: unknown): PdfChapter {
  return { title: "Cahier des charges", markdown: briefToMarkdown(raw) };
}
export function buildBriefHtml(raw: unknown): string {
  const brief = storedBriefSchema.parse(raw);
  return documentHtml({ title: "Cahier des charges", projectName: brief.generation.projectName, description: brief.document.projectSummary.executiveSummary.text, reference: `Cahier des charges · Version ${brief.generation.version}${brief.generation.draft ? " · Brouillon" : ""}`, date: brief.generation.generatedAt, chapters: [briefChapter(brief)] });
}
