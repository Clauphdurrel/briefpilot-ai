import Link from "next/link";

import { CreateProjectForm } from "@/components/dashboard/projects/create-project-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectStatusLabels, projectTypeLabels } from "@/config/projects";
import { requireUser } from "@/server/services/auth.service";
import { listOwnedProjects } from "@/server/services/project.service";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listOwnedProjects(user.id);

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 space-y-6" aria-labelledby="projects-title">
        <div>
          <p className="text-sm text-muted-foreground">Gestion des projets</p>
          <h1 id="projects-title" className="text-3xl font-bold tracking-tight">Projets</h1>
          <p className="mt-2 text-muted-foreground">
            Crée un projet client pour préparer son cadrage et ses futurs briefs.
          </p>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardHeader><CardTitle><h2>Aucun projet pour l’instant</h2></CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">
              Crée ton premier projet avec le formulaire « Nouveau projet ».
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="transition hover:bg-muted/50">
                  <CardHeader className="min-w-0">
                    <CardTitle className="min-w-0"><h2 className="break-words [overflow-wrap:anywhere]">{project.name}</h2></CardTitle>
                    <Badge variant="secondary" className="w-fit">{projectStatusLabels[project.status]}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge variant="outline">{projectTypeLabels[project.type]}</Badge>
                    <p className="line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {project.description || "Aucune description."}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      <aside className="min-w-0"><CreateProjectForm /></aside>
    </div>
  );
}
