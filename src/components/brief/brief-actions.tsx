"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { GenerateBacklogButton } from "@/components/brief/generate-backlog-button";
import type { BriefReadiness } from "@/types/brief";

export function BriefActions({ projectId, briefId, requiresDraft, readiness }: { projectId: string; briefId: string; requiresDraft: boolean; readiness: BriefReadiness }) {
  const running = useRef<"brief" | "backlog" | null>(null);
  const [pending, setPending] = useState<"brief" | "backlog" | null>(null);
  const acquire = (kind: "brief" | "backlog") => { if (running.current) return false; running.current = kind; return true; };
  const update = (kind: "brief" | "backlog", value: boolean) => { if (!value) running.current = null; setPending(value ? kind : null); };
  return <section className="space-y-5 border-t pt-5" aria-label="Actions du cahier des charges"><h2 className="font-semibold">Préparer la suite</h2>
    <nav className="flex flex-wrap gap-x-3 gap-y-2 text-xs" aria-label="Navigation depuis le brief"><Link className="underline" href={`/dashboard/projects/${projectId}`}>Retour au projet</Link><Link className="underline" href={`/dashboard/projects/${projectId}/interview`}>Continuer l’interview</Link><Link className="underline" href={`/dashboard/projects/${projectId}/backlogs`}>Consulter le backlog</Link></nav>
    <div className="space-y-3"><h3 className="text-sm font-medium">Générer le backlog</h3><p className="text-xs leading-relaxed text-muted-foreground">Le backlog utilisera précisément la version du cahier des charges actuellement consultée.</p><GenerateBacklogButton key={briefId} projectId={projectId} sourceBriefId={briefId} requiresDraft={requiresDraft} disabled={pending !== null} onStart={() => acquire("backlog")} onPendingChange={(value) => update("backlog", value)} /></div>
    <div className="space-y-3"><h3 className="text-sm font-medium">Actualiser le cahier des charges</h3><p className="text-xs leading-relaxed text-muted-foreground">La génération utilise l’interview actuelle. Les anciennes versions sont conservées ; si les informations sont identiques, le document existant sera réutilisé.</p><GenerateBriefButton projectId={projectId} readiness={readiness} regenerate disabled={pending !== null} showContinueLink={false} onStart={() => acquire("brief")} onPendingChange={(value) => update("brief", value)} /></div>
  </section>;
}
