import type { ReactNode } from "react";
import { BriefFeatures } from "@/components/brief/brief-features";
import { BriefStatements as Statements, RequirementBadge as Status } from "@/components/brief/brief-requirements-status";

import { briefSections } from "@/config/brief-sections";
import type { GeneratedBrief } from "@/server/validators/brief.schema";

export function BriefViewer({ document: doc }: { document: GeneratedBrief }) {
  const sections: Record<(typeof briefSections)[number][0], ReactNode> = {
    presentation: <Statements items={[doc.projectSummary.context, doc.projectSummary.executiveSummary, doc.projectSummary.problem]} />,
    objectives: <Statements items={doc.businessObjectives} />, audience: <Statements items={doc.targetAudience} />,
    scope: <div className="space-y-5">{([
      ["Inclus", doc.projectScope.included], ["Exclus", doc.projectScope.excluded],
      ["Hypothèses", [...doc.projectScope.assumptions, ...doc.assumptions]], ["Limites", doc.projectScope.limits],
    ] as const).map(([label, items]) => <div key={label} className="space-y-2"><h3 className="font-medium">{label}</h3><Statements items={[...items]} /></div>)}</div>,
    features: <BriefFeatures features={doc.features} />,
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
    <article id="document-start" tabIndex={-1} aria-label="Document du cahier des charges" className="min-w-0 rounded-xl border bg-background px-5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-7">
      {briefSections.map(([id, title], index) => <section key={id} id={`brief-${id}`} data-brief-section tabIndex={-1} aria-labelledby={`section-heading-${id}`} className="min-w-0 scroll-mt-24 space-y-5 border-b py-7 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-baseline gap-3"><span className="text-xs font-medium tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><h2 id={`section-heading-${id}`} className="break-words text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h2></div>
        <div className="space-y-4 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{sections[id]}</div>
      </section>)}
    </article>
  );
}
