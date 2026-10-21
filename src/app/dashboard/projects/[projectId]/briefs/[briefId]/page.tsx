import Link from "next/link";
import { notFound } from "next/navigation";

import { ExportMenu } from "@/components/brief/export-menu";
import { BriefActions } from "@/components/brief/brief-actions";
import { BriefInsights } from "@/components/brief/brief-insights";
import { BriefToc } from "@/components/brief/brief-toc";
import { BriefVersions } from "@/components/brief/brief-versions";
import { BriefWorkspace } from "@/components/brief/brief-workspace";
import { BriefViewer } from "@/components/brief/brief-viewer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectStatusLabels, projectTypeLabels } from "@/config/projects";
import { InterviewError } from "@/server/ai/errors";
import { requireUser } from "@/server/services/auth.service";
import { getBrief, getBriefReaderContext } from "@/server/services/brief.service";
import { getOwnedProject } from "@/server/services/project.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function BriefDetailPage({ params }: { params: Promise<{ projectId: string; briefId: string }> }) {
  const user = await requireUser();
  const raw = await params;
  const projectId = projectIdSchema.safeParse(raw.projectId), briefId = projectIdSchema.safeParse(raw.briefId);
  if (!projectId.success || !briefId.success) notFound();
  const project = await getOwnedProject(user.id, projectId.data);
  if (!project) notFound();
  let brief;
  try { brief = await getBrief(user.id, project.id, briefId.data); }
  catch (error) {
    if (error instanceof InterviewError && error.code === "FEATURE_UNAVAILABLE") return <div className="space-y-3"><h1 className="text-2xl font-semibold">Historique limité</h1><p>{error.message}</p><Link href="/pricing" className="underline">Voir les offres</Link></div>;
    if (error instanceof InterviewError && error.status === 404) notFound();
    if (error instanceof InterviewError && error.code === "BRIEF_LEGACY_FORMAT") return (
      <Card><CardHeader><CardTitle><h1>Ancien format de document</h1></CardTitle></CardHeader><CardContent className="space-y-3"><p>{error.message}</p><Link href={`/dashboard/projects/${project.id}/briefs`} className="underline">Retour aux versions</Link></CardContent></Card>
    );
    throw error;
  }
  const { readiness, briefs } = await getBriefReaderContext(user.id, project.id);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href={`/dashboard/projects/${project.id}/briefs`} className="text-sm text-muted-foreground hover:text-foreground">← Toutes les versions</Link>
        <h1 className="break-words text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{brief.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Version {brief.generation.version}</Badge>
          <Badge variant="outline">{brief.generation.draft ? "Brouillon — à compléter" : "Document à valider"}</Badge>
          <Badge variant="outline">{projectTypeLabels[brief.generation.projectType]}</Badge>
          <Badge variant="outline">Projet : {projectStatusLabels[project.status]}</Badge>
          <time dateTime={brief.createdAt}>{new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date(brief.createdAt))}</time>
        </div>
        <ExportMenu key={brief.id} projectId={project.id} briefId={brief.id} />
        {brief.generation.draft && <p className="text-sm text-muted-foreground">Ce brouillon contient des informations manquantes. Il doit être complété et validé avec le client.</p>}
        {brief.generation.sourceRevision !== readiness.sourceRevision && <p className="text-sm text-muted-foreground">Le projet ou l’interview a évolué depuis cette version. Tu peux régénérer le document.</p>}
      </div>
      {briefs[0] && briefs[0].id !== brief.id && <p className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">Tu consultes une ancienne version. <Link className="font-medium underline" href={`/dashboard/projects/${project.id}/briefs/${briefs[0].id}`}>Revenir à la dernière version</Link></p>}
      <BriefWorkspace key={brief.id} toc={<BriefToc />} insights={<>
        <BriefInsights document={brief.document} />
        <BriefActions projectId={project.id} briefId={brief.id} readiness={readiness} requiresDraft={brief.generation.draft || brief.document.missingInformation.length > 0 || brief.document.features.some((feature) => ["assumed", "missing"].includes(feature.status))} />
        <BriefVersions versions={briefs} currentId={brief.id} projectId={project.id} />
      </>}>
        <BriefViewer document={brief.document} />
      </BriefWorkspace>
    </div>
  );
}
