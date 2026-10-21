import "server-only";

import { InterviewError } from "@/server/ai/errors";
import { getBrief, getBriefForSource } from "@/server/services/brief.service";
import { getBacklogById } from "@/server/services/backlog.service";
import { containsCredential } from "@/server/formatters/codex-task";
import { storedBriefSchema } from "@/server/validators/brief-generator.schema";
import { storedBacklogSchema, validateBacklog } from "@/server/validators/backlog.schema";
import { briefToMarkdown } from "./markdown/brief-to-markdown";
import { backlogToMarkdown } from "./markdown/backlog-to-markdown";
import { codexTasksToMarkdown } from "./markdown/codex-tasks-to-markdown";
import { exportFilename, MAX_EXPORT_BYTES } from "./markdown/markdown-utils";

export type MarkdownExport = { content: string; filename: string };
function rejectSensitiveData(value: unknown): void {
  if (containsCredential(value)) throw new InterviewError("EXPORT_SENSITIVE_CONTENT", 422, "Ce document contient une donnée sensible. Retire-la avant de le partager.");
}
function checked(result: MarkdownExport): MarkdownExport {
  rejectSensitiveData(result.content);
  if (Buffer.byteLength(result.content, "utf8") > MAX_EXPORT_BYTES) throw new InterviewError("EXPORT_TOO_LARGE", 422, "Ce document dépasse la taille maximale de téléchargement (8 Mo).");
  return result;
}
export async function exportBriefMarkdown(ownerId: string, projectId: string, briefId: string): Promise<MarkdownExport> {
  const row = await getBrief(ownerId, projectId, briefId);
  const stored = storedBriefSchema.safeParse({ schemaVersion: row.schemaVersion, document: row.document, generation: row.generation });
  if (!stored.success) throw new InterviewError("EXPORT_INVALID_DOCUMENT", 422, "Cette version du cahier des charges n’est pas exportable.");
  rejectSensitiveData({ document: stored.data.document, projectName: stored.data.generation.projectName });
  return checked({ content: briefToMarkdown(stored.data), filename: exportFilename(stored.data.generation.projectName, "brief", stored.data.generation.version) });
}
async function loadBacklog(ownerId: string, projectId: string, backlogId: string) {
  const row = await getBacklogById(ownerId, projectId, backlogId);
  const brief = await getBriefForSource(ownerId, projectId, row.sourceBriefId);
  const parsed = storedBacklogSchema.safeParse({ schemaVersion: row.schemaVersion, document: row.document, generation: row.generation });
  if (!parsed.success || row.generation.sourceBriefVersion !== brief.generation.version) throw new InterviewError("EXPORT_INVALID_DOCUMENT", 422, "Le backlog et sa version de cahier des charges ne sont pas cohérents.");
  rejectSensitiveData({ document: parsed.data.document, projectName: parsed.data.generation.projectName });
  try { validateBacklog(parsed.data.document, brief.document); }
  catch { throw new InterviewError("EXPORT_INVALID_DOCUMENT", 422, "Ce backlog contient des références ou dépendances invalides."); }
  return { row, stored: parsed.data, reference: { version: row.version, createdAt: row.createdAt } };
}
export async function exportBacklogMarkdown(ownerId: string, projectId: string, backlogId: string): Promise<MarkdownExport> {
  const { row, stored, reference } = await loadBacklog(ownerId, projectId, backlogId);
  return checked({ content: backlogToMarkdown(stored, reference, row.status), filename: exportFilename(stored.generation.projectName, "backlog", row.version) });
}
export async function exportCodexTasksMarkdown(ownerId: string, projectId: string, backlogId: string): Promise<MarkdownExport> {
  const { row, stored, reference } = await loadBacklog(ownerId, projectId, backlogId);
  return checked({ content: codexTasksToMarkdown(stored, reference), filename: exportFilename(stored.generation.projectName, "codex-tasks", row.version) });
}
