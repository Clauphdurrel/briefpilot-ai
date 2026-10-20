import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Projet introuvable</h1>
      <p className="text-muted-foreground">Ce projet est indisponible ou tu n’y as pas accès.</p>
      <Button asChild variant="outline"><Link href="/dashboard/projects">Retour aux projets</Link></Button>
    </div>
  );
}
