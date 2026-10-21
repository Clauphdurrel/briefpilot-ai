import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectStatusLabels, projectTypeLabels } from "@/config/projects";
import { requireUser } from "@/server/services/auth.service";
import { getOwnedProject } from "@/server/services/project.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function ProjectDetailPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser();
  const parsed = projectIdSchema.safeParse((await params).projectId);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(user.id, parsed.data);
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <Link href="/dashboard/projects" className="text-sm text-muted-foreground hover:text-foreground">
            ← Retour aux projets
          </Link>
          <h1 className="mt-3 break-words text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{project.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{projectTypeLabels[project.type]}</Badge>
            <Badge variant="secondary">{projectStatusLabels[project.status]}</Badge>
          </div>
        </div>
        <div className="w-full space-y-2 sm:w-auto sm:shrink-0">
          <Button asChild><Link href={`/dashboard/projects/${project.id}/interview`}>Lancer l’interview IA</Link></Button>
          <Button asChild variant="outline"><Link href={`/dashboard/projects/${project.id}/briefs`}>Cahiers des charges</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle><h2>Description</h2></CardTitle></CardHeader>
        <CardContent>
          <p className="whitespace-pre-line break-words text-muted-foreground [overflow-wrap:anywhere]">
            {project.description || "Aucune description pour ce projet."}
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><h2>Interview IA</h2></CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{project._count.interviews}</p>
            <p className="text-sm text-muted-foreground">Messages enregistrés pour ce projet.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>Briefs</h2></CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{project._count.briefs}</p>
            <p className="text-sm text-muted-foreground">Cahiers des charges générés.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
