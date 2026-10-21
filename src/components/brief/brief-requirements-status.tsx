import { Badge } from "@/components/ui/badge";
import { briefSections, requirementStatusLabels } from "@/config/brief-sections";
import type { BriefRequirement } from "@/lib/brief-presentation";
import type { RequirementStatus, Statement } from "@/server/validators/brief.schema";

export function RequirementBadge({ value }: { value: RequirementStatus }) {
  return <Badge variant={value === "confirmed" ? "secondary" : "outline"} className="max-w-full whitespace-normal">{requirementStatusLabels[value]}</Badge>;
}
export function BriefStatements({ items }: { items: Statement[] }) {
  return items.length ? <ul className="space-y-4">{items.map((item, index) => <li key={index} className="space-y-1.5"><RequirementBadge value={item.status} /><p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{item.text}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Aucun élément renseigné dans cette version.</p>;
}
export function BriefRequirementsStatus({ requirements }: { requirements: BriefRequirement[] }) {
  return <div className="space-y-3">
    <h3 className="font-medium">Statuts des éléments</h3>
    <p className="text-xs leading-relaxed text-muted-foreground">« Confirmé » reprend la classification enregistrée dans le brief. La consultation du document ne vaut pas approbation.</p>
    {(["confirmed", "assumed", "recommended", "missing"] as const).map((status) => {
      const items = requirements.filter((item) => item.status === status);
      return <details key={status} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{requirementStatusLabels[status]} ({items.length})</summary>{items.length ? <ul className="mt-3 space-y-3 text-xs">{items.map((item) => <li key={item.key} className="space-y-1 break-words [overflow-wrap:anywhere]"><p>{item.label}</p><a href={`#brief-${item.section}`} className="text-muted-foreground underline underline-offset-4">{briefSections.find(([id]) => id === item.section)?.[1]}</a></li>)}</ul> : <p className="mt-3 text-xs text-muted-foreground">Aucun élément de ce statut dans cette version.</p>}</details>;
    })}
  </div>;
}
