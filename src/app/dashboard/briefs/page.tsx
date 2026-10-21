import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/services/auth.service";
import { listWorkspaceBriefs } from "@/server/services/brief.service";

export default async function BriefsPage() {
  const user = await requireUser();
  const briefs = await listWorkspaceBriefs(user.id);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Cahiers des charges</p>
      <h1 className="text-3xl font-bold tracking-tight">Briefs</h1>
      <p className="text-muted-foreground">Les 50 derniers documents de tes projets. Toutes les versions restent accessibles dans chaque projet.</p>
      {briefs.length ? <div className="grid gap-4">{briefs.map((brief) => <Link key={brief.id} href={`/dashboard/projects/${brief.projectId}/briefs/${brief.id}`} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="hover:bg-muted/50"><CardHeader><CardTitle><h2 className="break-words [overflow-wrap:anywhere]">{brief.title}</h2></CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground"><span>{brief.projectName}</span><Badge variant="outline">{brief.version ? `Version ${brief.version}` : "Ancienne version"}</Badge><Badge variant="secondary">{brief.draft ? "Brouillon" : "À valider"}</Badge><time dateTime={brief.createdAt}>{new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeZone: "Africa/Abidjan" }).format(new Date(brief.createdAt))}</time></CardContent></Card>
      </Link>)}</div> : <Card><CardHeader><CardTitle>Aucun cahier des charges pour l’instant</CardTitle></CardHeader><CardContent><Link href="/dashboard/projects" className="underline underline-offset-4">Ouvrir mes projets pour préparer un document</Link></CardContent></Card>}
    </div>
  );
}
