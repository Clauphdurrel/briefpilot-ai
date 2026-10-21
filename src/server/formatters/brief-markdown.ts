import { briefSections, requirementStatusLabels } from "@/config/brief-sections";
import { generatedBriefSchema, type GeneratedBrief, type Statement } from "@/server/validators/brief.schema";

export function escapeMarkdown(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+.!|])/g, "\\$1").replace(/[\r\n]+/g, " ");
}

function line(item: Statement) {
  return `- **${requirementStatusLabels[item.status]}** : ${escapeMarkdown(item.text)}`;
}
function list(items: Statement[]) { return items.length ? items.map(line).join("\n") : "À définir."; }

export function renderBriefMarkdown(raw: GeneratedBrief, title: string, draft: boolean) {
  const doc = generatedBriefSchema.parse(raw);
  const sections: Record<(typeof briefSections)[number][0], string> = {
    presentation: [line(doc.projectSummary.context), line(doc.projectSummary.executiveSummary), line(doc.projectSummary.problem)].join("\n"),
    objectives: list(doc.businessObjectives), audience: list(doc.targetAudience),
    scope: `### Inclus\n${list(doc.projectScope.included)}\n\n### Exclus\n${list(doc.projectScope.excluded)}\n\n### Hypothèses\n${list([...doc.projectScope.assumptions, ...doc.assumptions])}\n\n### Limites\n${list(doc.projectScope.limits)}`,
    features: doc.features.map((item) => `### ${escapeMarkdown(item.id)} — ${escapeMarkdown(item.name)}\n\n${line({ text: item.description, status: item.status, sourceIds: item.sourceIds })}\n\nPriorité : ${item.priority} · Acteur : ${escapeMarkdown(item.actor)} · Complexité : ${item.complexity}\n\nRègles métier :\n${list(item.businessRules)}\n\nCritères d’acceptation :\n${list(item.acceptanceCriteria)}\n\nDépendances : ${item.dependencies.map(escapeMarkdown).join(", ") || "Aucune déclarée"}`).join("\n\n") || "À définir.",
    pages: doc.pages.map((item) => `### ${escapeMarkdown(item.name)}\n\n${line({ text: item.description, status: item.status, sourceIds: item.sourceIds })}\n\nObjectif :\n${line(item.objective)}\n\nUtilisateurs : ${item.users.map(escapeMarkdown).join(", ") || "À définir"}\n\nContenus :\n${list(item.requiredContent)}\n\nComposants :\n${list(item.components)}\n\nInteractions :\n${list(item.interactions)}`).join("\n\n") || "À définir.",
    journeys: doc.userJourneys.map((item) => `### ${escapeMarkdown(item.name)} (${requirementStatusLabels[item.status]})\n\n${list(item.steps)}\n\nRésultat :\n${line(item.expectedResult)}`).join("\n\n") || "À définir.",
    roles: doc.userRoles.map((item) => `### ${escapeMarkdown(item.name)} (${requirementStatusLabels[item.status]})\n\nPermissions :\n${list(item.permissions)}\n\nRestrictions :\n${list(item.restrictions)}`).join("\n\n") || "À définir.",
    content: list(doc.requiredContent), integrations: list(doc.integrations),
    technical: list([...doc.technicalConstraints, ...doc.securityRequirements]),
    "non-functional": list(doc.nonFunctionalRequirements), regulatory: list(doc.regulatoryConsiderations),
    budget: `${line(doc.budgetAndTimeline.budget)}\n\n### Échéances\n${list(doc.budgetAndTimeline.deadlines)}\n\n### Livraison\n${list(doc.budgetAndTimeline.deliveryConstraints)}\n\n### Hypothèses\n${list(doc.budgetAndTimeline.assumptions)}`,
    risks: list(doc.risks),
    missing: doc.missingInformation.map((item) => `- **${escapeMarkdown(item.category)}** (${item.importance}) : ${escapeMarkdown(item.description)} — Question : ${escapeMarkdown(item.question)}`).join("\n") || "Aucun manque signalé ; validation client requise.",
    acceptance: list(doc.acceptanceCriteria),
  };
  return `# ${escapeMarkdown(title)}\n\n${draft ? "Brouillon — informations à compléter." : "Document généré — à valider avec le client."}\n\n` +
    briefSections.map(([id, name], index) => `## ${String(index + 1).padStart(2, "0")}. ${name}\n\n${sections[id]}`).join("\n\n") + "\n";
}
