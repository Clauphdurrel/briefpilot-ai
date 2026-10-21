import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerateBacklogButton } from "@/components/brief/generate-backlog-button";
import { BriefViewer } from "@/components/brief/brief-viewer";
import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectStatusLabels, projectTypeLabels } from "@/config/projects";
import { InterviewError } from "@/server/ai/errors";
import { requireUser } from "@/server/services/auth.service";
import { getBrief, listBriefs } from "@/server/services/brief.service";
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
    if (error instanceof InterviewError && error.status === 404) notFound();
    if (error instanceof InterviewError && error.code === "BRIEF_LEGACY_FORMAT") return (
      <Card><CardHeader><CardTitle><h1>Ancien format de document</h1></CardTitle></CardHeader><CardContent className="space-y-3"><p>{error.message}</p><Link href={`/dashboard/projects/${project.id}/briefs`} className="underline">Retour aux versions</Link></CardContent></Card>
    );
    throw error;
  }
  const { readiness, briefs } = await listBriefs(user.id, project.id);
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
        {brief.generation.draft && <p className="text-sm text-muted-foreground">Ce brouillon contient des informations manquantes. Il doit être complété et validé avec le client.</p>}
        {brief.generation.sourceRevision !== readiness.sourceRevision && <p className="text-sm text-muted-foreground">Le projet ou l’interview a évolué depuis cette version. Tu peux régénérer le document.</p>}
      </div>
      <Card><CardHeader><CardTitle><h2>Préparer le développement</h2></CardTitle></CardHeader><CardContent className="space-y-4">
        <GenerateBacklogButton projectId={project.id} sourceBriefId={brief.id} requiresDraft={brief.generation.draft || brief.document.missingInformation.length > 0 || brief.document.features.some((feature) => ["assumed", "missing"].includes(feature.status))} />
        <Link className="inline-block text-sm underline" href={`/dashboard/projects/${project.id}/backlogs`}>Consulter les backlogs du projet</Link>
      </CardContent></Card>
      <BriefViewer document={brief.document} />
      <Card><CardHeader><CardTitle><h2>Actualiser le cahier des charges</h2></CardTitle></CardHeader><CardContent className="space-y-4">
        <GenerateBriefButton projectId={project.id} readiness={readiness} regenerate />
        <nav aria-label="Versions du cahier des charges" className="flex flex-wrap gap-3 text-sm">{briefs.map((item) => <Link key={item.id} href={`/dashboard/projects/${project.id}/briefs/${item.id}`} aria-current={item.id === brief.id ? "page" : undefined} className="underline underline-offset-4">{item.version ? `Version ${item.version}` : "Ancienne version"}</Link>)}</nav>
      </CardContent></Card>
    </div>
  );
}
