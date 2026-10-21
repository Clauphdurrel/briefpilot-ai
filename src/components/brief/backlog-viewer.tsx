"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Backlog, Phase } from "@/server/validators/backlog.schema";

const basisLabels = { confirmed: "Confirmé", assumed: "Hypothèse", recommended: "Recommandation" };
function Items({ values }: { values: string[] }) {
  return values.length ? <ul className="list-disc space-y-1 pl-5">{values.map((value, index) => <li key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value}</li>)}</ul> : <p className="text-muted-foreground">Aucun élément.</p>;
}
export function BacklogViewer({ document }: { document: Backlog }) {
  const [phase, setPhase] = useState("all"), [priority, setPriority] = useState("all"), [role, setRole] = useState("all");
  const [copyStatus, setCopyStatus] = useState("");
  const epicById = new Map(document.epics.map((epic) => [epic.id, epic]));
  const phaseOf = (epicId: string) => epicById.get(epicId)!.phase;
  const tasks = document.tasks.filter((task) => (phase === "all" || phaseOf(task.epicId) === phase) && (priority === "all" || task.priority === priority) && (role === "all" || task.role === role));
  const stories = document.stories.filter((story) => (phase === "all" || phaseOf(story.epicId) === phase) && ((role === "all" && (priority === "all" || story.priority === priority)) || tasks.some((task) => task.storyId === story.id)));
  const epics = document.epics.filter((epic) => (phase === "all" || epic.phase === phase) && ((role === "all" && (priority === "all" || epic.priority === priority)) || stories.some((story) => story.epicId === epic.id) || tasks.some((task) => task.epicId === epic.id)));
  const filter = (label: string, value: string, change: (value: string) => void, values: string[]) => <div className="space-y-1"><Label htmlFor={`filter-${label}`}>{label}</Label><select id={`filter-${label}`} value={value} onChange={(event) => change(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="all">Tous</option>{values.map((item) => <option key={item}>{item}</option>)}</select></div>;
  async function copy(id: string, prompt: string) {
    try { await navigator.clipboard.writeText(prompt); setCopyStatus(`Prompt ${id} copié.`); }
    catch { setCopyStatus("Copie impossible. Sélectionne le texte du prompt pour le copier manuellement."); }
  }
  return <div className="space-y-6 [overflow-wrap:anywhere]">
    <Card><CardHeader><CardTitle><h2>Résumé du backlog</h2></CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><p>{document.summary.objective}</p><p>{document.summary.scope}</p><h3 className="font-semibold">Hypothèses techniques à confirmer</h3><Items values={document.summary.technicalAssumptions} /><h3 className="font-semibold">Informations manquantes</h3><Items values={document.summary.missingInformation} /><p className="text-muted-foreground">Les efforts sont des fourchettes indicatives à confirmer après examen du repository. Ils ne constituent pas un devis. Les chemins proposés sont hypothétiques.</p></CardContent></Card>
    <section aria-label="Phases" className="grid gap-3 md:grid-cols-2">{document.phases.map((item) => <Card key={item.name}><CardHeader><CardTitle><h2>{item.name}</h2></CardTitle></CardHeader><CardContent className="text-sm">{item.objective}</CardContent></Card>)}</section>
    <Card><CardHeader><CardTitle><h2>Filtrer le backlog</h2></CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3">{filter("Phase", phase, setPhase, document.phases.map((item) => item.name))}{filter("Priorité", priority, setPriority, ["P0", "P1", "P2"])}{filter("Rôle", role, setRole, ["architect", "backend", "frontend", "ai-engineer", "qa", "devops", "security"])}</CardContent></Card>
    <section className="space-y-3" aria-label="Épics et user stories"><h2 className="text-xl font-semibold">Épics et user stories</h2>
      {epics.map((epic) => <Card key={epic.id}><CardHeader><CardTitle><h3>{epic.id} — {epic.title}</h3></CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex flex-wrap gap-2"><Badge>{epic.phase}</Badge><Badge variant="outline">{epic.priority}</Badge><Badge variant="secondary">{basisLabels[epic.basis]}</Badge></div><p>{epic.description}</p><p>Dépendances : {epic.dependencies.join(", ") || "Aucune"}</p><p>Fonctionnalités sources : {epic.sourceFeatureIds.join(", ") || "Fondation technique recommandée"}</p>
        {stories.filter((story) => story.epicId === epic.id).map((story) => <details key={story.id} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{story.id} — {story.title} · {story.priority} · {basisLabels[story.basis]}</summary><div className="mt-3 space-y-2"><p>{story.description}</p><p>Rôle : {story.userRole} · Valeur : {story.businessValue}</p><p>Dépendances : {story.dependencies.join(", ") || "Aucune"}</p><p>Sources : {story.sourceFeatureIds.join(", ") || "Fondation technique recommandée"}</p><h4 className="font-semibold">Critères d’acceptation</h4><Items values={story.acceptanceCriteria} /></div></details>)}</CardContent></Card>)}
    </section>
    <section className="space-y-3" aria-label="Tâches techniques"><h2 className="text-xl font-semibold">Tâches techniques ({tasks.length})</h2><p role="status" className="text-sm">{copyStatus}</p>
      {!tasks.length && <Card><CardContent className="pt-4 text-muted-foreground">Aucune tâche ne correspond aux filtres.</CardContent></Card>}
      {tasks.map((task) => <Card key={task.id}><CardContent className="pt-4"><details><summary className="cursor-pointer space-y-2"><span className="block font-semibold">{task.id} — {task.title}</span><span className="flex flex-wrap gap-2"><Badge>{task.priority}</Badge><Badge variant="outline">{task.role}</Badge><Badge variant="outline">{phaseOf(task.epicId) as Phase}</Badge><Badge variant="secondary">{basisLabels[task.basis]}</Badge></span></summary><div className="mt-4 space-y-4 text-sm"><p>{task.description}</p><p>Épic : {task.epicId} · Story : {task.storyId ?? "Sans story"}</p><p>Complexité : {task.estimation.complexity} · Effort indicatif : {task.estimation.estimatedEffort ? `${task.estimation.estimatedEffort.minHours}–${task.estimation.estimatedEffort.maxHours} h` : "À estimer"}</p><p>{task.estimation.rationale}</p><p>Dépendances : {task.dependencies.join(", ") || "Aucune"}</p><p>Fonctionnalités sources : {task.sourceFeatureIds.join(", ") || "Fondation technique recommandée"}</p><h3 className="font-semibold">Critères d’acceptation</h3><Items values={task.acceptanceCriteria} /><h3 className="font-semibold">Tests attendus</h3><Items values={task.testingRequirements} /><h3 className="font-semibold">Contraintes</h3><Items values={task.constraints} /><h3 className="font-semibold">Risques</h3><Items values={task.risks} /><h3 className="font-semibold">Fichiers suggérés à vérifier</h3><Items values={task.suggestedFiles} /><h3 className="font-semibold">Prompt Codex</h3><p className="text-muted-foreground">À relire et copier dans Codex. Aucune exécution automatique.</p><Button variant="outline" onClick={() => copy(task.id, task.codexPrompt)}>Copier le prompt Codex</Button><pre className="max-w-full whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-xs">{task.codexPrompt}</pre></div></details></CardContent></Card>)}
    </section>
  </div>;
}
