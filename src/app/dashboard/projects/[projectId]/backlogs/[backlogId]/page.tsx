import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportMenu } from "@/components/brief/export-menu";
import { BacklogViewer } from "@/components/brief/backlog-viewer";
import { GenerateBacklogButton } from "@/components/brief/generate-backlog-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InterviewError } from "@/server/ai/errors";
import { requireUser } from "@/server/services/auth.service";
import { getBacklogById, getProjectBacklogs } from "@/server/services/backlog.service";
import { getBrief } from "@/server/services/brief.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function BacklogDetailPage({ params }: { params: Promise<{ projectId: string; backlogId: string }> }) {
  const user = await requireUser(), raw = await params;
  const projectId = projectIdSchema.safeParse(raw.projectId), backlogId = projectIdSchema.safeParse(raw.backlogId);
  if (!projectId.success || !backlogId.success) notFound();
  let backlog;
  try { backlog = await getBacklogById(user.id, projectId.data, backlogId.data); }
  catch (error) {
    if (error instanceof InterviewError && error.code === "FEATURE_UNAVAILABLE") return <div className="space-y-3"><h1 className="text-2xl font-semibold">Historique limité</h1><p>{error.message}</p><Link href="/pricing" className="underline">Voir les offres</Link></div>; if (error instanceof InterviewError && error.status === 404) notFound(); throw error; }
  const [versions, brief] = await Promise.all([getProjectBacklogs(user.id, projectId.data), getBrief(user.id, projectId.data, backlog.sourceBriefId)]);
  const requiresDraft = brief.generation.draft || brief.document.missingInformation.length > 0 || brief.document.features.some((feature) => ["assumed", "missing"].includes(feature.status));
  return <div className="space-y-6"><Link href={`/dashboard/projects/${projectId.data}/backlogs`} className="text-sm underline">← Tous les backlogs</Link><h1 className="break-words text-3xl font-bold [overflow-wrap:anywhere]">Backlog — {backlog.generation.projectName}</h1><div className="flex flex-wrap gap-3 text-sm"><Badge>Version {backlog.version}</Badge><Badge variant="outline">{backlog.status === "DRAFT" ? "Brouillon à valider" : "À valider avec l’équipe"}</Badge><time dateTime={backlog.createdAt}>{new Date(backlog.createdAt).toLocaleString("fr", { timeZone: "Africa/Abidjan" })}</time><Link className="underline" href={`/dashboard/projects/${projectId.data}/briefs/${backlog.sourceBriefId}`}>Cahier des charges source · version {backlog.generation.sourceBriefVersion}</Link></div>{backlog.status === "DRAFT" && <p className="text-sm text-muted-foreground">Les hypothèses et informations manquantes doivent être confirmées avant les travaux qui en dépendent.</p>}<ExportMenu key={backlog.id} projectId={projectId.data} briefId={backlog.sourceBriefId} backlogId={backlog.id} /><BacklogViewer document={backlog.document} /><Card><CardHeader><CardTitle><h2>Versions et régénération</h2></CardTitle></CardHeader><CardContent className="space-y-4"><GenerateBacklogButton projectId={projectId.data} sourceBriefId={backlog.sourceBriefId} requiresDraft={requiresDraft} regenerate /><nav aria-label="Versions du backlog" className="flex flex-wrap gap-3 text-sm">{versions.map((item) => <Link key={item.id} href={`/dashboard/projects/${projectId.data}/backlogs/${item.id}`} className="underline" aria-current={item.id === backlog.id ? "page" : undefined}>Version {item.version}</Link>)}</nav></CardContent></Card></div>;
}
