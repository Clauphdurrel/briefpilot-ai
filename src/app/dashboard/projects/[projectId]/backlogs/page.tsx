import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/services/auth.service";
import { getProjectBacklogs } from "@/server/services/backlog.service";
import { getOwnedProject } from "@/server/services/project.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function BacklogsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser(), id = projectIdSchema.safeParse((await params).projectId);
  if (!id.success) notFound();
  const project = await getOwnedProject(user.id, id.data);
  if (!project) notFound();
  const versions = await getProjectBacklogs(user.id, project.id);
  return <div className="space-y-6"><Link className="text-sm underline" href={`/dashboard/projects/${project.id}`}>← Retour au projet</Link><h1 className="break-words text-3xl font-bold">Backlogs — {project.name}</h1><p className="text-muted-foreground">Chaque backlog est associé au cahier des charges choisi lors de sa génération.</p><Link className="inline-block underline" href={`/dashboard/projects/${project.id}/briefs`}>Choisir un cahier des charges pour générer un backlog</Link><section className="space-y-4" aria-label="Historique des backlogs">{versions.length ? versions.map((item) => <Link key={item.id} href={`/dashboard/projects/${project.id}/backlogs/${item.id}`} className="block rounded-xl focus-visible:ring-2"><Card><CardHeader><CardTitle>Version {item.version}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3 text-sm"><Badge variant="outline">{item.status === "DRAFT" ? "Brouillon à valider" : "À valider avec l’équipe"}</Badge><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("fr", { timeZone: "Africa/Abidjan" })}</time></CardContent></Card></Link>) : <Card><CardContent className="pt-4 text-muted-foreground">Aucun backlog. Ouvre un cahier des charges et clique sur « Générer le backlog ».</CardContent></Card>}</section></div>;
}
