import { renderBriefMarkdown } from "@/server/formatters/brief-markdown";
import { storedBriefSchema } from "@/server/validators/brief-generator.schema";
import { projectTypeLabels } from "@/config/projects";
import { escapeMarkdown, referenceMarkdown } from "./markdown-utils";

// Reuse the canonical converter already used for Brief.content; export always starts from JSON.
export function briefToMarkdown(raw: unknown): string {
  const brief = storedBriefSchema.parse(raw);
  const { generation } = brief;
  const document = renderBriefMarkdown(brief.document, `Cahier des charges — ${generation.projectName}`, generation.draft);
  const firstBreak = document.indexOf("\n\n");
  const metadata = `${referenceMarkdown({ version: generation.version, createdAt: generation.generatedAt })}\n\nProjet : ${escapeMarkdown(generation.projectName)}\n\nType : ${escapeMarkdown(projectTypeLabels[generation.projectType])}\n\nCe document reprend la version enregistrée. Une relecture avec le client reste nécessaire.`;
  return `${document.slice(0, firstBreak)}\n\n${metadata}${document.slice(firstBreak)}`;
}
