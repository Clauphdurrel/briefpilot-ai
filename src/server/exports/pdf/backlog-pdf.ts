import { storedBacklogSchema } from "@/server/validators/backlog.schema";
import { backlogToMarkdown } from "../markdown/backlog-to-markdown";
import { exportReferenceSchema, type ExportReference } from "../markdown/markdown-utils";
import { documentHtml, type PdfChapter } from "./pdf-templates";
export function backlogChapter(raw: unknown, reference: ExportReference, status: "DRAFT" | "READY"): PdfChapter {
  return { title: "Backlog", markdown: backlogToMarkdown(raw, reference, status) };
}
export function buildBacklogHtml(raw: unknown, reference: ExportReference, status: "DRAFT" | "READY"): string {
  const backlog = storedBacklogSchema.parse(raw); exportReferenceSchema.parse(reference);
  return documentHtml({ title: "Backlog", projectName: backlog.generation.projectName, description: backlog.document.summary.objective, reference: `Backlog · Version ${reference.version} · Cahier des charges source v${backlog.generation.sourceBriefVersion}${status === "DRAFT" ? " · Brouillon" : ""}`, date: reference.createdAt, chapters: [backlogChapter(backlog, reference, status)] });
}
