"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { interviewStateSchema, type InterviewState } from "@/server/validators/interview-agent.schema";

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
class ChatError extends Error {}

export function InterviewChat({ projectId, initialState }: { projectId: string; initialState: InterviewState }) {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<{ signature: string; requestId: string } | null>(null);
  const sending = useRef(false);
  const historyRef = useRef<HTMLOListElement>(null);
  const endpoint = `/api/projects/${projectId}/interview`;
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [state.messages.length]);

  async function send(mode: "start" | "message" | "refresh") {
    if (sending.current) return;
    sending.current = true; setPending(true); setError("");
    const content = draft.trim();
    try {
      const payload = mode === "message"
        ? { content, expectedLastMessageId: state.messages.at(-1)?.id, language: "fr" }
        : { language: "fr" };
      const signature = JSON.stringify({ mode, ...payload });
      if (mode !== "refresh" && operation.current?.signature !== signature) {
        operation.current = { signature, requestId: crypto.randomUUID() };
      }
      const response = await fetch(mode === "message" ? `${endpoint}/messages` : endpoint, {
        method: mode === "refresh" ? "GET" : "POST",
        headers: mode === "refresh" ? undefined : { "Content-Type": "application/json" },
        body: mode === "refresh" ? undefined : JSON.stringify({ ...payload, requestId: operation.current?.requestId }),
        cache: "no-store", signal: AbortSignal.timeout(60000),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(body);
        throw new ChatError(parsed.success ? parsed.data.error.message : "Impossible de charger l’interview.");
      }
      const parsed = z.object({ data: interviewStateSchema }).safeParse(body);
      if (!parsed.success) throw new ChatError("La réponse reçue est invalide. Actualise l’historique.");
      if (mode === "message" || (mode === "refresh" && parsed.data.data.messages.length > state.messages.length &&
        [...parsed.data.data.messages].reverse().find((item) => item.role === "user")?.content === content)) setDraft("");
      setState(parsed.data.data);
      window.dispatchEvent(new Event("briefpilot:interview-updated"));
      operation.current = null;
    } catch (failure) {
      setError(failure instanceof ChatError
        ? failure.message : "Connexion interrompue. Actualise l’historique avant de réessayer.");
    } finally { sending.current = false; setPending(false); }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="min-w-0">
        <CardHeader><CardTitle><h2>Conversation de cadrage</h2></CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {state.messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">L’IA s’appuiera sur la description du projet pour poser une question à la fois. Tes échanges seront enregistrés.</p>
              <Button disabled={pending} onClick={() => send("start")}>Démarrer l’interview</Button>
            </div>
          ) : (
            <ol ref={historyRef} aria-label="Historique de l’interview" aria-live="polite" aria-relevant="additions" className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {state.messages.map((message) => (
                <li key={message.id} className={`rounded-lg p-4 ${message.role === "user" ? "ml-4 bg-muted" : "mr-4 border"}`}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{message.role === "user" ? "Vous" : "BriefPilot AI"}</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{message.content}</p>
                </li>
              ))}
            </ol>
          )}
          {pending && <p role="status" className="text-sm text-muted-foreground">Chargement de l’interview…</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {state.messages.length > 0 && (
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void send("message"); }}>
              <Label htmlFor="interview-answer">Votre réponse</Label>
              <Textarea id="interview-answer" value={draft} onChange={(event) => setDraft(event.target.value)}
                maxLength={4000} rows={4} disabled={pending} required placeholder="Décris ton besoin ou précise ta réponse…" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{draft.length}/4 000 caractères</p>
                <Button disabled={pending || !draft.trim()} type="submit">Envoyer</Button>
              </div>
            </form>
          )}
          <Button disabled={pending} variant="outline" onClick={() => send("refresh")}>Actualiser l’historique</Button>
        </CardContent>
      </Card>
      <aside className="min-w-0 space-y-4">
        <Card>
          <CardHeader><CardTitle><h2>Complétude du brief</h2></CardTitle></CardHeader>
          <CardContent className="space-y-3" aria-live="polite">
            <p className="text-3xl font-bold">{state.completionScore === null ? "À évaluer" : `${state.completionScore} %`}</p>
            <progress aria-label="Complétude du brief" className="h-2 w-full accent-primary" value={state.completionScore ?? 0} max={100} />
            <p className="text-xs text-muted-foreground">Estimation de la couverture des besoins, à vérifier avec le client.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>Informations à préciser</h2></CardTitle></CardHeader>
          <CardContent>
            {state.missingInformation.length ? (
              <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                {state.missingInformation.map((item, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{state.completionScore === null ? "L’analyse apparaîtra après le premier échange." : "Aucun manque signalé par l’IA à ce stade."}</p>}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
