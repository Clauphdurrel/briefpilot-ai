"use client";
import { useActionState } from "react";
import Link from "next/link";
import { archiveProject } from "@/server/actions/project.actions";
import { Button } from "@/components/ui/button";
export function ProjectCapacityAction({ projectId, archived }: { projectId: string; archived: boolean }) {
  const [state, action, pending] = useActionState(archiveProject, {});
  return <form action={action} className="space-y-2"><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="archived" value={String(!archived)} /><Button disabled={pending} variant="outline">{pending ? "Mise à jour…" : archived ? "Réactiver le projet" : "Archiver le projet"}</Button>{state.message && <p role="status" className="text-sm">{state.message} <Link href="/pricing" className="underline">Voir les offres</Link></p>}</form>;
}
