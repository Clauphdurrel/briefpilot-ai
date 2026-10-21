"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Check, Copy, Loader2, MessageSquare, PanelRight, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { z } from "zod";

import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { InterviewProgress } from "@/components/brief/interview-progress";
import { InterviewSummary } from "@/components/brief/interview-summary";
import { ProjectContentChecklist } from "@/components/brief/project-content-checklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectStatusLabels, projectTypeLabels } from "@/config/projects";
import { collectedContents, composeInterviewMessage, contentStatusLabels, interviewErrorMessage, messageForCopy, parseContentMessage } from "@/lib/interview-presentation";
import { interviewStateSchema, type InterviewState } from "@/server/validators/interview-agent.schema";
import type { InterviewContent } from "@/server/validators/interview-content.schema";
import type { ProjectType } from "@/server/validators/interview.schema";
import type { BriefReadiness } from "@/types/brief";

const errorSchema = z.object({ error: z.object({ code: z.string() }) });
class ChatError extends Error {
  constructor(message: string, public code = "UNKNOWN") { super(message); }
}
type Mode = "start" | "message" | "refresh";
type Props = {
  projectId: string; initialState: InterviewState; readiness: BriefReadiness;
  project: { name: string; type: ProjectType; status: keyof typeof projectStatusLabels; description: string | null };
};

export function InterviewChat({ projectId, project, initialState, readiness }: Props) {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [contentSheet, setContentSheet] = useState<InterviewContent | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingMode, setPendingMode] = useState<Mode>("refresh");
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [newMessages, setNewMessages] = useState(false);
  const [showProject, setShowProject] = useState(false), [showProgress, setShowProgress] = useState(false);
  const operation = useRef<{ signature: string; requestId: string } | null>(null);
  const failedMode = useRef<Mode>("refresh");
  const sending = useRef(false), nearBottom = useRef(true), forceScroll = useRef(false);
  const historyRef = useRef<HTMLOListElement>(null), inputRef = useRef<HTMLTextAreaElement>(null);
  const endpoint = `/api/projects/${projectId}/interview`;
  const busy = pending || generatingBrief;
  const answer = composeInterviewMessage(draft, contentSheet);
  const status = project.status === "DRAFT" && state.messages.length ? "INTERVIEW" : project.status;
  const lastMessageId = state.messages.at(-1)?.id;
  useEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    if (nearBottom.current || forceScroll.current) {
      history.scrollTop = history.scrollHeight; nearBottom.current = true; forceScroll.current = false;
    } else setNewMessages(true);
  }, [lastMessageId]);

  function latest() {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
    nearBottom.current = true; setNewMessages(false);
  }
  async function send(mode: Mode) {
    if (sending.current || generatingBrief || (mode === "message" && (!answer || answer.length > 4000))) return;
    sending.current = true; setPending(true); setError(null); setNotice(""); setPendingMode(mode); failedMode.current = mode;
    const content = answer;
    try {
      const payload = mode === "message"
        ? { content, expectedLastMessageId: state.messages.at(-1)?.id, language: "fr" }
        : { language: "fr" };
      const signature = JSON.stringify({ mode, ...payload });
      if (mode !== "refresh" && operation.current?.signature !== signature) operation.current = { signature, requestId: crypto.randomUUID() };
      const response = await fetch(mode === "message" ? `${endpoint}/messages` : endpoint, {
        method: mode === "refresh" ? "GET" : "POST",
        headers: mode === "refresh" ? undefined : { "Content-Type": "application/json" },
        body: mode === "refresh" ? undefined : JSON.stringify({ ...payload, requestId: operation.current?.requestId }),
        cache: "no-store", signal: AbortSignal.timeout(60000),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(body), code = parsed.success ? parsed.data.error.code : "UNKNOWN";
        throw new ChatError(interviewErrorMessage(code, response.status), code);
      }
      const parsed = z.object({ data: interviewStateSchema }).safeParse(body);
      if (!parsed.success) throw new ChatError("La réponse reçue est invalide. Actualise l’historique avant de poursuivre.");
      const data = parsed.data.data;
      const recovered = mode === "refresh" && data.messages.at(-1)?.id !== state.messages.at(-1)?.id && [...data.messages].reverse().find((item) => item.role === "user")?.content === content;
      if (mode === "message" || recovered) { setDraft(""); setContentSheet(null); }
      if (mode !== "refresh" || recovered) operation.current = null;
      forceScroll.current = mode !== "refresh" || recovered;
      setState(data);
      setNotice(mode === "refresh" ? "Historique synchronisé. Tu peux reprendre la conversation." : "Réponse enregistrée.");
      window.dispatchEvent(new Event("briefpilot:interview-updated"));
    } catch (failure) {
      const known = failure instanceof ChatError;
      setError({ message: known ? failure.message : failure instanceof DOMException && failure.name === "TimeoutError" ? interviewErrorMessage("TIMEOUT") : "Connexion interrompue. Ta saisie est conservée. Actualise l’historique avant de réessayer.", code: known ? failure.code : "NETWORK" });
    } finally { sending.current = false; setPending(false); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }
  }
  function selectContent(item: InterviewContent) {
    setContentSheet(item); setShowProgress(false); setShowProject(false);
    setNotice("Fiche préparée. Clique sur Envoyer pour l’enregistrer dans la conversation.");
    inputRef.current?.focus();
  }
  async function copyMessage(message: string, index: number) {
    try { await navigator.clipboard.writeText(messageForCopy(message)); setNotice(`Message ${index + 1} copié.`); }
    catch { setNotice("Copie impossible. Tu peux sélectionner le texte du message pour le copier."); }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 xl:hidden">
      <Button variant="outline" size="sm" onClick={() => setShowProject(!showProject)} aria-expanded={showProject} aria-controls="interview-project">Projet et navigation</Button>
      <Button variant="outline" size="sm" onClick={() => setShowProgress(!showProgress)} aria-expanded={showProgress} aria-controls="interview-followup"><PanelRight className="size-4" aria-hidden="true" />Suivi du projet</Button>
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[170px_minmax(0,1fr)_280px]">
      <aside id="interview-project" className={`order-2 min-w-0 space-y-4 xl:order-1 xl:block ${showProject ? "block" : "hidden"}`} aria-label="Contexte et navigation du projet">
        <Card><CardHeader><CardTitle><h2>Votre projet</h2></CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><p className="break-words font-medium [overflow-wrap:anywhere]">{project.name}</p><div className="flex flex-wrap gap-2"><Badge variant="outline" className="max-w-full whitespace-normal">{projectTypeLabels[project.type]}</Badge><Badge variant="secondary">{projectStatusLabels[status]}</Badge></div><p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{project.description || "Le contexte sera précisé ensemble pendant l’interview."}</p><nav aria-label="Navigation du projet" className="space-y-1">{[["", "Vue générale"], ["/interview", "Interview"], ["/briefs", "Cahiers des charges"], ["/backlogs", "Backlogs"]].map(([path, title]) => <Link key={path} href={`/dashboard/projects/${projectId}${path}`} aria-current={path === "/interview" ? "page" : undefined} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${path === "/interview" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}>{title}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /></Link>)}</nav></CardContent></Card>
      </aside>
      <Card className="order-1 min-w-0 overflow-hidden xl:order-2">
        <CardHeader className="border-b bg-muted/20"><div className="flex items-start gap-3"><div className="rounded-xl border bg-background p-2.5"><Sparkles className="size-5" aria-hidden="true" /></div><div className="min-w-0 space-y-1"><CardTitle><h2>Conversation de cadrage</h2></CardTitle><p className="text-xs leading-relaxed text-muted-foreground">Une question à la fois pour transformer ton idée en projet clair.</p></div></div></CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Check className="size-3.5" aria-hidden="true" />{state.messages.length ? "Échanges envoyés enregistrés" : "Enregistrement après chaque échange"}</span>{state.messages.length > 0 && <Button disabled={busy} variant="ghost" size="sm" onClick={() => send("refresh")}><RefreshCw className="size-3.5" aria-hidden="true" />Reprendre l’interview</Button>}</div>
          {state.messages.length === 0 ? <div className="space-y-5 rounded-xl border border-dashed px-5 py-8 text-center"><MessageSquare className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><h3 className="font-medium">Parlons de votre projet</h3><p className="text-sm leading-relaxed text-muted-foreground">Décris ton besoin avec tes mots. Tu n’as pas besoin de connaître les termes techniques ; l’assistant t’aidera à préciser les informations manquantes.</p><Button disabled={busy} onClick={() => send("start")}>Démarrer l’interview</Button></div> : <>
            <ol ref={historyRef} aria-label="Historique de l’interview" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => { const el = historyRef.current; if (el) { nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 72; if (nearBottom.current) setNewMessages(false); } }} className="max-h-[55vh] space-y-5 overflow-y-auto overscroll-contain rounded-lg pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {state.messages.map((message, index) => {
                const parsed = message.role === "user" ? parseContentMessage(message.content) : { text: message.content, content: null };
                return <li key={message.id} className={`rounded-xl p-4 ${message.role === "user" ? "ml-4 bg-muted" : "mr-4 border bg-background"}`}><div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{message.role === "user" ? "Vous" : "BriefPilot AI"}</p><Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => copyMessage(message.content, index)} aria-label={`Copier le message ${index + 1}`}><Copy className="size-3.5" aria-hidden="true" /></Button></div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{parsed.text}</p>{parsed.content && <div className="mt-3 space-y-1 rounded-lg border p-3 text-xs"><p className="break-words font-medium [overflow-wrap:anywhere]">{parsed.content.name} — {contentStatusLabels[parsed.content.status]}</p><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{parsed.content.description}</p>{parsed.content.url && <a className="block break-all underline" href={parsed.content.url} target="_blank" rel="noopener noreferrer">Lien fourni pour ce contenu</a>}</div>}<time dateTime={message.createdAt} className="mt-2 block text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(message.createdAt))}</time></li>;
              })}
            </ol>
            {newMessages && <Button type="button" variant="outline" size="sm" onClick={latest}><ArrowDown className="size-3.5" aria-hidden="true" />Voir les nouveaux messages</Button>}
          </>}
          {pending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{pendingMode === "refresh" ? "Reprise de l’historique…" : "L’assistant prépare sa réponse…"}</p>}
          <p role="status" className="text-xs text-muted-foreground">{notice}</p>
          {error && <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>{error.message}</p><div className="flex flex-wrap gap-2">{error.code === "UNAUTHENTICATED" ? <Button asChild variant="outline" size="sm"><Link href="/login">Se reconnecter</Link></Button> : error.code === "PROJECT_NOT_FOUND" ? <Button asChild variant="outline" size="sm"><Link href="/dashboard/projects">Mes projets</Link></Button> : <><Button disabled={busy} variant="outline" size="sm" onClick={() => send("refresh")}>Actualiser l’historique</Button><Button disabled={busy} variant="ghost" size="sm" onClick={() => send(failedMode.current)}>Réessayer</Button></>}</div></div>}
          {state.messages.length > 0 && <form className="space-y-3 border-t pt-4" onSubmit={(event) => { event.preventDefault(); void send("message"); }}>
            {state.analysis?.nextQuestion?.helpText && <p className="text-xs text-muted-foreground">Conseil : {state.analysis.nextQuestion.helpText}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="interview-answer">Votre réponse</Label><Button type="button" variant="ghost" size="sm" disabled={busy || !!draft.trim()} onClick={() => { setDraft("Je ne sais pas encore."); inputRef.current?.focus(); }}>Je ne sais pas encore</Button></div>
            {contentSheet && <div className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-xs"><p className="break-words [overflow-wrap:anywhere]">Fiche prête à envoyer : <strong>{contentSheet.name}</strong> — {contentStatusLabels[contentSheet.status]}</p><Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" disabled={busy} aria-label="Retirer la fiche de contenu" onClick={() => setContentSheet(null)}><X className="size-3.5" aria-hidden="true" /></Button></div>}
            <Textarea ref={inputRef} id="interview-answer" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={4} disabled={busy} placeholder="Décris ton besoin ou précise ta réponse…" onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (answer && answer.length <= 4000) void send("message"); }
            }} aria-describedby="interview-answer-help" />
            <div className="flex flex-wrap items-center justify-between gap-3"><p id="interview-answer-help" className="text-[11px] leading-relaxed text-muted-foreground">{answer.length}/4 000 caractères{contentSheet ? " · fiche comprise" : ""}<br />Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne.<br />La saisie non envoyée reste dans cet onglet jusqu’au rechargement.</p><Button disabled={busy || !answer || answer.length > 4000} type="submit"><Send className="size-3.5" aria-hidden="true" />Envoyer</Button></div>
            {answer.length > 4000 && <p role="alert" className="text-xs text-destructive">Raccourcis ta réponse ou la fiche de contenu pour rester sous 4 000 caractères.</p>}
          </form>}
        </CardContent>
      </Card>
      <aside id="interview-followup" className={`order-3 min-w-0 space-y-4 xl:block ${showProgress ? "block" : "hidden"}`} aria-label="Suivi du brief">
        <InterviewProgress state={state} />
        <InterviewSummary state={state} />
        <ProjectContentChecklist items={collectedContents(state)} disabled={busy || !state.messages.length || !!contentSheet} onSelect={selectContent} />
        <Card><CardHeader><CardTitle><h2>Passer au cahier des charges</h2></CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-xs leading-relaxed text-muted-foreground">Le document utilisera les réponses enregistrées. Les versions précédentes resteront consultables.</p><GenerateBriefButton projectId={projectId} readiness={readiness} label="Générer mon cahier des charges" disabled={pending} onPendingChange={setGeneratingBrief} showContinueLink={false} /><Link href={`/dashboard/projects/${projectId}/briefs`} className="inline-block text-xs underline">Consulter les cahiers des charges</Link></CardContent></Card>
      </aside>
    </div>
  </div>;
}
