"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BriefReadiness } from "@/types/brief";

const responseSchema = z.object({ data: z.object({ briefId: z.string().regex(/^[a-zA-Z0-9_-]+$/), reused: z.boolean() }) });
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const readinessResponseSchema = z.object({ data: z.object({ readiness: z.object({
  hasInterview: z.boolean(), requiresDraft: z.boolean(), missingInformation: z.array(z.string()), sourceRevision: z.string(),
}) }) });

export function GenerateBriefButton({ projectId, readiness: initialReadiness, regenerate = false, label, disabled = false, onPendingChange, onStart, showContinueLink = true }: {
  projectId: string; readiness: BriefReadiness; regenerate?: boolean; label?: string; disabled?: boolean; onPendingChange?: (pending: boolean) => void; onStart?: () => boolean; showContinueLink?: boolean;
}) {
  const router = useRouter();
  const [updatedReadiness, setUpdatedReadiness] = useState<BriefReadiness | null>(null);
  const readiness = updatedReadiness ?? initialReadiness;
  const [allowDraft, setAllowDraft] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const running = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/api/projects/${projectId}/briefs`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const parsed = readinessResponseSchema.safeParse(await response.json());
        if (parsed.success) setUpdatedReadiness(parsed.data.data.readiness);
      } catch { /* The generation endpoint still rechecks current interview readiness. */ }
    }
    window.addEventListener("briefpilot:interview-updated", refresh);
    return () => { controller.abort(); window.removeEventListener("briefpilot:interview-updated", refresh); };
  }, [projectId]);

  async function generate() {
    if (running.current || disabled || (onStart && !onStart())) return;
    running.current = true; setPending(true); onPendingChange?.(true); setError("");
    try {
      const signature = JSON.stringify({ allowDraft, sourceRevision: readiness.sourceRevision });
      if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
      const response = await fetch(`/api/projects/${projectId}/briefs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: operation.current.id, allowDraft, language: "fr" }), signal: AbortSignal.timeout(60000),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const failure = errorSchema.safeParse(body);
        setError(failure.success ? failure.data.error.message : "La génération a échoué. Réessaie."); return;
      }
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) { setError("La réponse reçue est invalide. Actualise les versions."); return; }
      router.push(`/dashboard/projects/${projectId}/briefs/${parsed.data.data.briefId}`);
      router.refresh();
    } catch { setError("Connexion interrompue. Consulte les versions avant de réessayer."); }
    finally { running.current = false; setPending(false); onPendingChange?.(false); }
  }

  return (
    <div className="space-y-3 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:h-auto [&_button]:min-h-9">
      {!readiness.hasInterview ? (
        <p className="text-sm text-muted-foreground">Démarre l’interview pour préparer ton cahier des charges.</p>
      ) : (
        <>
          {readiness.requiresDraft && <p className="text-sm text-muted-foreground">Des informations restent à préciser. Continue l’interview ou génère explicitement un brouillon.</p>}
          {readiness.requiresDraft && readiness.missingInformation.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {readiness.missingInformation.slice(0, 5).map((item, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{item}</li>)}
            </ul>
          )}
          <Label className="flex items-start gap-2 leading-relaxed">
            <input type="checkbox" checked={allowDraft} onChange={(event) => setAllowDraft(event.target.checked)} disabled={pending || disabled} className="mt-1 size-4 shrink-0 accent-primary" />
            Autoriser un brouillon si des informations manquent
          </Label>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={pending || disabled || !readiness.hasInterview || (readiness.requiresDraft && !allowDraft)} onClick={generate}>
          {pending ? "Génération en cours…" : label ?? (regenerate ? "Régénérer" : "Générer le cahier des charges")}
        </Button>
        {showContinueLink && <Button asChild variant="outline"><Link href={`/dashboard/projects/${projectId}/interview`}>Continuer l’interview</Link></Button>}
      </div>
      {pending && <p role="status" className="text-sm text-muted-foreground">Le document est en préparation. Cette opération peut prendre quelques secondes.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
