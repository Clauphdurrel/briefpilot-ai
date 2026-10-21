import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { briefSections, requirementStatusLabels } from "@/config/brief-sections";
import type { GeneratedBrief, RequirementStatus, Statement } from "@/server/validators/brief.schema";

function Status({ value }: { value: RequirementStatus }) {
  return <Badge variant={value === "confirmed" ? "secondary" : "outline"}>{requirementStatusLabels[value]}</Badge>;
}
function Statements({ items }: { items: Statement[] }) {
  return items.length ? <ul className="space-y-3">{items.map((item, index) => <li key={index} className="space-y-1"><Status value={item.status} /><p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{item.text}</p></li>)}</ul>
    : <p className="text-muted-foreground">À définir.</p>;
}

export function BriefViewer({ document: doc }: { document: GeneratedBrief }) {
  const sections: Record<(typeof briefSections)[number][0], ReactNode> = {
    presentation: <Statements items={[doc.projectSummary.context, doc.projectSummary.executiveSummary, doc.projectSummary.problem]} />,
    objectives: <Statements items={doc.businessObjectives} />, audience: <Statements items={doc.targetAudience} />,
    scope: <div className="space-y-5">{([
      ["Inclus", doc.projectScope.included], ["Exclus", doc.projectScope.excluded],
      ["Hypothèses", [...doc.projectScope.assumptions, ...doc.assumptions]], ["Limites", doc.projectScope.limits],
    ] as const).map(([label, items]) => <div key={label} className="space-y-2"><h3 className="font-medium">{label}</h3><Statements items={[...items]} /></div>)}</div>,
    features: doc.features.length ? <div className="space-y-6">{doc.features.map((item) => <article key={item.id} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap gap-2"><Status value={item.status} /><Badge variant="outline">{item.priority}</Badge><Badge variant="outline">{item.complexity === "unknown" ? "Complexité à définir" : `Complexité : ${item.complexity}`}</Badge></div>
      <h3 className="break-words font-semibold [overflow-wrap:anywhere]">{item.id} · {item.name}</h3><p>{item.description}</p>
      <p className="text-muted-foreground">Acteur : {item.actor}</p>
      <h4 className="font-medium">Règles métier</h4><Statements items={item.businessRules} />
      <h4 className="font-medium">Critères d’acceptation</h4><Statements items={item.acceptanceCriteria} />
      <p className="text-muted-foreground">Dépendances : {item.dependencies.join(", ") || "Aucune déclarée"}</p>
    </article>)}</div> : <p className="text-muted-foreground">Fonctionnalités à préciser avec le client.</p>,
    pages: doc.pages.length ? <div className="space-y-6">{doc.pages.map((item) => <article key={item.id} className="space-y-3 rounded-lg border p-4">
      <Status value={item.status} /><h3 className="font-semibold">{item.name}</h3><p>{item.description}</p><Statements items={[item.objective]} />
      <p className="text-muted-foreground">Utilisateurs : {item.users.join(", ") || "À définir"}</p>
      <h4 className="font-medium">Contenus</h4><Statements items={item.requiredContent} />
      <h4 className="font-medium">Composants</h4><Statements items={item.components} />
      <h4 className="font-medium">Interactions</h4><Statements items={item.interactions} />
    </article>)}</div> : <p className="text-muted-foreground">Pages et écrans à définir.</p>,
    journeys: doc.userJourneys.length ? <div className="space-y-5">{doc.userJourneys.map((item) => <article key={item.id} className="space-y-3"><Status value={item.status} /><h3 className="font-semibold">{item.name}</h3><Statements items={item.steps} /><h4 className="font-medium">Résultat attendu</h4><Statements items={[item.expectedResult]} /></article>)}</div> : <p className="text-muted-foreground">Parcours à définir.</p>,
    roles: doc.userRoles.length ? <div className="space-y-5">{doc.userRoles.map((item) => <article key={item.id} className="space-y-3"><Status value={item.status} /><h3 className="font-semibold">{item.name}</h3><h4 className="font-medium">Permissions</h4><Statements items={item.permissions} /><h4 className="font-medium">Restrictions</h4><Statements items={item.restrictions} /></article>)}</div> : <p className="text-muted-foreground">Rôles à définir.</p>,
    content: <Statements items={doc.requiredContent} />, integrations: <Statements items={doc.integrations} />,
    technical: <Statements items={[...doc.technicalConstraints, ...doc.securityRequirements]} />,
    "non-functional": <Statements items={doc.nonFunctionalRequirements} />, regulatory: <Statements items={doc.regulatoryConsiderations} />,
    budget: <div className="space-y-5"><h3 className="font-medium">Budget communiqué</h3><Statements items={[doc.budgetAndTimeline.budget]} /><h3 className="font-medium">Échéances</h3><Statements items={doc.budgetAndTimeline.deadlines} /><h3 className="font-medium">Contraintes de livraison</h3><Statements items={doc.budgetAndTimeline.deliveryConstraints} /><h3 className="font-medium">Hypothèses</h3><Statements items={doc.budgetAndTimeline.assumptions} /></div>,
    risks: <Statements items={doc.risks} />,
    missing: doc.missingInformation.length ? <ul className="space-y-4">{doc.missingInformation.map((item, index) => <li key={index} className="space-y-1"><p className="font-medium">{item.category} · {item.importance === "high" ? "Important" : item.importance === "medium" ? "À préciser" : "Secondaire"}</p><p>{item.description}</p><p className="text-muted-foreground">Question au client : {item.question}</p></li>)}</ul> : <p className="text-muted-foreground">Aucun manque signalé. La validation du client reste nécessaire.</p>,
    acceptance: <Statements items={doc.acceptanceCriteria} />,
  };
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle><h2>Sommaire</h2></CardTitle></CardHeader><CardContent>
        <nav aria-label="Sommaire du cahier des charges"><ol className="grid gap-2 text-sm sm:grid-cols-2">{briefSections.map(([id, title], index) => <li key={id}><a href={`#brief-${id}`} className="underline-offset-4 hover:underline">{String(index + 1).padStart(2, "0")}. {title}</a></li>)}</ol></nav>
      </CardContent></Card>
      {briefSections.map(([id, title], index) => <Card key={id} id={`brief-${id}`} className="min-w-0 scroll-mt-24"><CardHeader><CardTitle><h2>{String(index + 1).padStart(2, "0")}. {title}</h2></CardTitle></CardHeader><CardContent className="space-y-4 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{sections[id]}</CardContent></Card>)}
    </div>
  );
}
