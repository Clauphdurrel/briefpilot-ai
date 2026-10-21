import { storedBriefSchema } from "@/server/validators/brief-generator.schema";
import { storedBacklogSchema } from "@/server/validators/backlog.schema";
import type { ExportReference } from "../markdown/markdown-utils";
import { briefChapter } from "./brief-pdf";
import { backlogChapter } from "./backlog-pdf";
import { documentHtml } from "./pdf-templates";
export function buildProjectHtml(rawBrief: unknown, rawBacklog?: unknown, reference?: ExportReference, status: "DRAFT" | "READY" = "DRAFT"): string {
  const brief = storedBriefSchema.parse(rawBrief);
  const backlog = rawBacklog === undefined ? undefined : storedBacklogSchema.parse(rawBacklog);
  if (backlog && (!reference || backlog.generation.sourceBriefVersion !== brief.generation.version)) throw new Error("Incompatible document versions");
  return documentHtml({ title: "Dossier projet", projectName: brief.generation.projectName, description: brief.document.projectSummary.executiveSummary.text,
    reference: `Cahier des charges v${brief.generation.version}${backlog ? ` · Backlog v${reference!.version}` : " · Backlog non disponible"}`,
    date: reference?.createdAt ?? brief.generation.generatedAt,
    chapters: [briefChapter(brief), ...(backlog ? [backlogChapter(backlog, reference!, status)] : [])],
    conclusion: `Ce dossier rassemble les versions indiquées en couverture. ${backlog ? "Les efforts du backlog sont indicatifs et ne constituent pas un engagement contractuel." : "Aucun backlog n’a été associé à cet export."} Les hypothèses, risques et informations manquantes nécessitent une validation avec le client et l’équipe.` });
}
