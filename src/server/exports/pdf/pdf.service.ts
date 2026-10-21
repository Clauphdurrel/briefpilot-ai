import "server-only";
import { getBrief } from "@/server/services/brief.service";
import { getBacklogById } from "@/server/services/backlog.service";
import { storedBriefSchema } from "@/server/validators/brief-generator.schema";
import { storedBacklogSchema, validateBacklog } from "@/server/validators/backlog.schema";
import { containsCredential } from "@/server/formatters/codex-task";
import { InterviewError } from "@/server/ai/errors";
import { exportFilename } from "../markdown/markdown-utils";
import { buildBriefHtml } from "./brief-pdf";
import { buildBacklogHtml } from "./backlog-pdf";
import { buildProjectHtml } from "./project-pdf";
import { renderPdf } from "./pdf-renderer";
export type PdfExport = { content: Buffer; filename: string };
function sensitive(value: unknown) {
  if (containsCredential(value)) throw new InterviewError("EXPORT_SENSITIVE_CONTENT", 422, "Ce document contient une donnée sensible. Retire-la avant de le partager.");
}
async function loadBrief(ownerId: string, projectId: string, briefId: string) {
  const row = await getBrief(ownerId, projectId, briefId);
  const brief = storedBriefSchema.parse({ schemaVersion: row.schemaVersion, document: row.document, generation: row.generation });
  sensitive({ document: brief.document, projectName: brief.generation.projectName });
  return brief;
}
async function loadBacklog(ownerId: string, projectId: string, backlogId: string) {
  const row = await getBacklogById(ownerId, projectId, backlogId);
  const backlog = storedBacklogSchema.parse({ schemaVersion: row.schemaVersion, document: row.document, generation: row.generation });
  const brief = await loadBrief(ownerId, projectId, row.sourceBriefId);
  sensitive({ document: backlog.document, projectName: backlog.generation.projectName });
  try {
    if (backlog.generation.sourceBriefVersion !== brief.generation.version) throw new Error("Version mismatch");
    validateBacklog(backlog.document, brief.document);
  } catch { throw new InterviewError("PDF_INCOMPATIBLE_DOCUMENT", 422, "Le backlog et son cahier des charges source ne sont pas cohérents."); }
  return { row, backlog, brief, reference: { version: row.version, createdAt: row.createdAt } };
}
export async function generateBriefPdf(ownerId: string, projectId: string, briefId: string): Promise<PdfExport> {
  const brief = await loadBrief(ownerId, projectId, briefId);
  return { content: await renderPdf(buildBriefHtml(brief), ownerId), filename: exportFilename(brief.generation.projectName, "brief", brief.generation.version).replace(/\.md$/, ".pdf") };
}
export async function generateBacklogPdf(ownerId: string, projectId: string, backlogId: string): Promise<PdfExport> {
  const { row, backlog, reference } = await loadBacklog(ownerId, projectId, backlogId);
  return { content: await renderPdf(buildBacklogHtml(backlog, reference, row.status), ownerId), filename: exportFilename(backlog.generation.projectName, "backlog", row.version).replace(/\.md$/, ".pdf") };
}
export async function generateProjectPdf(ownerId: string, projectId: string, briefId: string, backlogId?: string): Promise<PdfExport> {
  const brief = await loadBrief(ownerId, projectId, briefId);
  const loaded = backlogId ? await loadBacklog(ownerId, projectId, backlogId) : undefined;
  if (loaded && loaded.row.sourceBriefId !== briefId) throw new InterviewError("PDF_INCOMPATIBLE_DOCUMENT", 422, "Choisis le cahier des charges source exact de ce backlog.");
  const name = exportFilename(brief.generation.projectName, "brief", brief.generation.version).replace(/-brief-v(\d+)\.md$/, `-project-brief-v$1${loaded ? `-backlog-v${loaded.row.version}` : ""}.pdf`);
  return { content: await renderPdf(buildProjectHtml(brief, loaded?.backlog, loaded?.reference, loaded?.row.status), ownerId), filename: name };
}
