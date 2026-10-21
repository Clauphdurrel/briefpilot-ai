"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function GenerateBacklogButton({ projectId, sourceBriefId, requiresDraft, regenerate = false }: {
  projectId: string; sourceBriefId: string; requiresDraft: boolean; regenerate?: boolean;
}) {
  const router = useRouter();
  const [allowDraft, setAllowDraft] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<{ signature: string; id: string } | null>(null);
  async function generate() {
    if (pending) return;
    setPending(true); setError(null);
    const signature = JSON.stringify({ sourceBriefId, allowDraft, regenerate });
    if (key.current?.signature !== signature) key.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch(`/api/projects/${projectId}/backlogs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: key.current.id, sourceBriefId, allowDraft, regenerate, language: "fr" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error?.message === "string" ? body.error.message : "Impossible de générer le backlog.");
      const result = z.object({ data: z.object({ backlogId: z.string().regex(/^[a-zA-Z0-9_-]+$/) }) }).parse(body);
      key.current = null;
      router.push(`/dashboard/projects/${projectId}/backlogs/${result.data.backlogId}`); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Impossible de générer le backlog."); }
    finally { setPending(false); }
  }
  const checkboxId = `backlog-draft-${sourceBriefId}-${regenerate}`;
  return <div className="space-y-3">
    {requiresDraft && <div className="space-y-2 text-sm"><p className="text-muted-foreground">Ce brief est incomplet ou contient des hypothèses. Le backlog restera un brouillon à valider ; les manques seront conservés.</p><Label htmlFor={checkboxId} className="flex items-start gap-2"><input id={checkboxId} type="checkbox" checked={allowDraft} onChange={(event) => setAllowDraft(event.target.checked)} disabled={pending} className="mt-0.5" />J’accepte de générer un backlog brouillon.</Label></div>}
    {regenerate && <p className="text-sm text-muted-foreground">Une régénération crée une nouvelle version et utilise un appel IA. Les versions précédentes sont conservées.</p>}
    <Button onClick={generate} disabled={pending || (requiresDraft && !allowDraft)} aria-busy={pending}>{pending ? "Génération du backlog…" : regenerate ? "Régénérer le backlog" : "Générer le backlog"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
