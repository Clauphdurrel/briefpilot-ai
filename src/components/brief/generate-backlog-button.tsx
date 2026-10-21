"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

class BacklogGenerationError extends Error {}

export function GenerateBacklogButton({ projectId, sourceBriefId, requiresDraft, regenerate = false, disabled = false, onPendingChange, onStart }: {
  projectId: string; sourceBriefId: string; requiresDraft: boolean; regenerate?: boolean; disabled?: boolean; onPendingChange?: (pending: boolean) => void; onStart?: () => boolean;
}) {
  const router = useRouter();
  const [allowDraft, setAllowDraft] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const key = useRef<{ signature: string; id: string } | null>(null);
  async function generate() {
    if (running.current || disabled || (onStart && !onStart())) return;
    running.current = true; setPending(true); onPendingChange?.(true); setError(null);
    try {
      const signature = JSON.stringify({ sourceBriefId, allowDraft, regenerate });
      if (key.current?.signature !== signature) key.current = { signature, id: crypto.randomUUID() };
      const response = await fetch(`/api/projects/${projectId}/backlogs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: key.current.id, sourceBriefId, allowDraft, regenerate, language: "fr" }), signal: AbortSignal.timeout(60000) });
      const body = await response.json();
      if (!response.ok) throw new BacklogGenerationError(typeof body.error?.message === "string" ? body.error.message : "Impossible de générer le backlog.");
      const result = z.object({ data: z.object({ backlogId: z.string().regex(/^[a-zA-Z0-9_-]+$/) }) }).safeParse(body);
      if (!result.success) throw new BacklogGenerationError("La réponse reçue est invalide. Consulte les backlogs avant de réessayer.");
      key.current = null;
      router.push(`/dashboard/projects/${projectId}/backlogs/${result.data.data.backlogId}`); router.refresh();
    } catch (failure) { setError(failure instanceof BacklogGenerationError ? failure.message : "Connexion interrompue. Consulte les backlogs avant de réessayer."); }
    finally { running.current = false; setPending(false); onPendingChange?.(false); }
  }
  const checkboxId = `backlog-draft-${sourceBriefId}-${regenerate}`;
  return <div className="space-y-3 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:h-auto [&_button]:min-h-9">
    {requiresDraft && <div className="space-y-2 text-sm"><p className="text-muted-foreground">Ce brief est incomplet ou contient des hypothèses. Le backlog restera un brouillon à valider ; les manques seront conservés.</p><Label htmlFor={checkboxId} className="flex items-start gap-2"><input id={checkboxId} type="checkbox" checked={allowDraft} onChange={(event) => setAllowDraft(event.target.checked)} disabled={pending || disabled} className="mt-0.5" />J’accepte de générer un backlog brouillon.</Label></div>}
    {regenerate && <p className="text-sm text-muted-foreground">Une régénération crée une nouvelle version et utilise un appel IA. Les versions précédentes sont conservées.</p>}
    <Button onClick={generate} disabled={pending || disabled || (requiresDraft && !allowDraft)} aria-busy={pending}>{pending ? "Génération du backlog…" : regenerate ? "Régénérer le backlog" : "Générer le backlog"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
