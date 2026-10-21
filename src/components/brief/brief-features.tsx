"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BriefStatements, RequirementBadge } from "@/components/brief/brief-requirements-status";
import { filterBriefFeatures } from "@/lib/brief-presentation";
import type { GeneratedBrief } from "@/server/validators/brief.schema";

const complexityLabels = { unknown: "À définir", low: "Faible", medium: "Moyenne", high: "Élevée" };
export function BriefFeatures({ features }: { features: GeneratedBrief["features"] }) {
  const [search, setSearch] = useState(""), [priority, setPriority] = useState("all");
  const filtered = filterBriefFeatures(features, search, priority);
  if (!features.length) return <p className="text-muted-foreground">Aucune fonctionnalité renseignée. Poursuis l’interview pour préciser les besoins.</p>;
  return <div className="space-y-5">
    <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-[minmax(0,1fr)_130px]">
      <div className="min-w-0 space-y-1.5"><Label htmlFor="feature-search">Rechercher une fonctionnalité</Label><div className="relative"><Search aria-hidden="true" className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input id="feature-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} placeholder="Nom, identifiant, acteur…" className="pl-8" /></div></div>
      <div className="space-y-1.5"><Label htmlFor="feature-priority">Priorité</Label><select id="feature-priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Toutes</option>{["MUST", "SHOULD", "COULD", "WONT"].map((value) => <option key={value}>{value}</option>)}</select></div>
    </div>
    <p role="status" className="text-xs text-muted-foreground">{filtered.length} fonctionnalité{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""} sur {features.length}.</p>
    {!filtered.length && <p className="rounded-lg border border-dashed p-4 text-muted-foreground">Aucune fonctionnalité ne correspond à ta recherche ou à cette priorité.</p>}
    <div className="divide-y rounded-xl border">{filtered.map((item) => <article key={item.id} className="space-y-3 p-4" data-feature-id={item.id}>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">{item.priority}</Badge><RequirementBadge value={item.status} /></div>
      <h3 className="break-words font-semibold [overflow-wrap:anywhere]">{item.id} · {item.name}</h3>
      <p className="whitespace-pre-wrap">{item.description}</p><p className="text-xs text-muted-foreground">Acteur : {item.actor}</p>
      <details><summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Détails et critères d’acceptation</summary><div className="mt-4 space-y-4 text-sm"><p className="text-muted-foreground">Complexité : {complexityLabels[item.complexity]}</p><h4 className="font-medium">Règles métier</h4><BriefStatements items={item.businessRules} /><h4 className="font-medium">Critères d’acceptation</h4><BriefStatements items={item.acceptanceCriteria} /><h4 className="font-medium">Dépendances</h4><p className="text-muted-foreground">{item.dependencies.join(", ") || "Aucune dépendance déclarée."}</p></div></details>
    </article>)}</div>
  </div>;
}
