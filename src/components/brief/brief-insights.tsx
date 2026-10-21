import { BriefRequirementsStatus } from "@/components/brief/brief-requirements-status";
import { getBriefInsights, getBriefRequirements } from "@/lib/brief-presentation";
import type { GeneratedBrief } from "@/server/validators/brief.schema";

export function BriefInsights({ document }: { document: GeneratedBrief }) {
  const stats = getBriefInsights(document);
  const numbers = [
    ["Fonctionnalités", stats.features, "features"], ["Pages et écrans", stats.pages, "pages"], ["Rôles", stats.roles, "roles"],
    ["Risques", stats.risks, "risks"], ["Informations manquantes", stats.missingInformation, "missing"], ["Hypothèses distinctes", stats.assumptions, null],
  ] as const;
  return <section className="space-y-5" aria-label="Analyse du brief">
    <div className="space-y-3"><h2 className="font-semibold">Analyse de cette version</h2><dl className="grid grid-cols-2 gap-2">{numbers.map(([label, count, section]) => <div key={label} className="rounded-lg border p-3"><dt className="text-xs leading-relaxed text-muted-foreground">{section ? <a href={`#brief-${section}`} className="underline-offset-4 hover:underline">{label}</a> : label}</dt><dd className="mt-1 text-2xl font-semibold" data-stat={section ?? "assumptions"}>{count}</dd></div>)}</dl><p className="text-xs leading-relaxed text-muted-foreground">Chiffres calculés depuis le document enregistré. Les énoncés identiques de même statut sont comptés une seule fois ; les fonctionnalités, pages, parcours et rôles restent distincts. Aucun score de qualité n’est attribué.</p></div>
    {document.risks.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">Risques à examiner</h3><ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">{document.risks.slice(0, 3).map((risk, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{risk.text}</li>)}</ul><a className="inline-block text-xs underline" href="#brief-risks">Consulter tous les risques</a></div>}
    {document.missingInformation.length > 0 && <div className="space-y-2 rounded-lg bg-muted/40 p-3"><h3 className="text-sm font-medium">À préciser avec le client</h3><ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">{document.missingInformation.slice(0, 3).map((item, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{item.description}</li>)}</ul><a href="#brief-missing" className="inline-block text-xs underline">Voir toutes les questions manquantes</a></div>}
    <BriefRequirementsStatus requirements={getBriefRequirements(document)} />
  </section>;
}
