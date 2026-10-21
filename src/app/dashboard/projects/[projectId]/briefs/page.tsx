import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectStatusLabels } from "@/config/projects";
import { requireUser } from "@/server/services/auth.service";
import { listBriefs } from "@/server/services/brief.service";
import { getOwnedProject } from "@/server/services/project.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function ProjectBriefsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser();
  const parsed = projectIdSchema.safeParse((await params).projectId);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(user.id, parsed.data);
  if (!project) notFound();
  const { briefs, readiness } = await listBriefs(user.id, project.id);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-muted-foreground hover:text-foreground">← Retour au projet</Link>
        <h1 className="break-words text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">Cahiers des charges — {project.name}</h1>
        <Badge variant="secondary">{projectStatusLabels[project.status]}</Badge>
      </div>
      <Card><CardHeader><CardTitle><h2>{briefs.length ? "Préparer une nouvelle version" : "Générer le premier document"}</h2></CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Les versions précédentes sont conservées. Si les informations du projet n’ont pas changé, la version existante sera réutilisée.</p>
        <GenerateBriefButton projectId={project.id} readiness={readiness} regenerate={briefs.length > 0} />
      </CardContent></Card>
      <section className="space-y-4" aria-labelledby="versions-title">
        <h2 id="versions-title" className="text-xl font-semibold">Historique des versions</h2>
        {briefs.length ? briefs.map((brief) => (
          <Link key={brief.id} href={`/dashboard/projects/${project.id}/briefs/${brief.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="hover:bg-muted/50"><CardHeader><CardTitle><h3 className="break-words [overflow-wrap:anywhere]">{brief.version ? `Version ${brief.version}` : "Ancienne version"} · {brief.title}</h3></CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge variant={brief.draft ? "outline" : "secondary"}>{brief.draft ? "Brouillon" : "À valider avec le client"}</Badge>
              <time dateTime={brief.createdAt}>{new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date(brief.createdAt))}</time>
            </CardContent></Card>
          </Link>
        )) : <Card><CardContent className="pt-4 text-muted-foreground">Aucun cahier des charges pour l’instant. Complète l’interview puis génère ton premier document.</CardContent></Card>}
      </section>
    </div>
  );
}
