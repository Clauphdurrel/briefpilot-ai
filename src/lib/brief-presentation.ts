import { briefSections } from "@/config/brief-sections";
import type { GeneratedBrief, RequirementStatus } from "@/server/validators/brief.schema";

export type BriefSectionId = (typeof briefSections)[number][0];
export type BriefRequirement = { key: string; label: string; status: RequirementStatus; section: BriefSectionId };
export type BriefVersionSummary = { id: string; title: string; createdAt: string; version: number | null; draft: boolean };
const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();
const sectionFields: [BriefSectionId, (keyof GeneratedBrief)[]][] = [
  ["presentation", ["projectSummary"]], ["objectives", ["businessObjectives"]], ["audience", ["targetAudience"]],
  ["scope", ["projectScope", "assumptions"]], ["features", ["features"]], ["pages", ["pages"]], ["journeys", ["userJourneys"]],
  ["roles", ["userRoles"]], ["content", ["requiredContent"]], ["integrations", ["integrations"]],
  ["technical", ["technicalConstraints", "securityRequirements"]], ["non-functional", ["nonFunctionalRequirements"]],
  ["regulatory", ["regulatoryConsiderations"]], ["budget", ["budgetAndTimeline"]], ["risks", ["risks"]], ["acceptance", ["acceptanceCriteria"]],
];
// Each distinct statement/status is counted once; named features/pages/roles retain their IDs.
export function getBriefRequirements(document: GeneratedBrief): BriefRequirement[] {
  const records = new Map<string, BriefRequirement>();
  function visit(value: unknown, section: BriefSectionId) {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, section)); return; }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (["confirmed", "assumed", "recommended", "missing"].includes(String(node.status))) {
      const label = typeof node.text === "string" ? node.text : typeof node.name === "string" ? `${String(node.id)} · ${node.name}` : null;
      if (label) {
        const key = `${node.status}:${typeof node.text === "string" ? "statement" : section}:${normalize(label)}`;
        // Identical placeholders such as "À définir" in budget and deadlines are one distinct statement.
        if (!records.has(key)) records.set(key, { key, label, status: node.status as RequirementStatus, section });
      }
    }
    Object.values(node).forEach((item) => visit(item, section));
  }
  sectionFields.forEach(([section, fields]) => fields.forEach((field) => visit(document[field], section)));
  return [...records.values()];
}
export function getBriefInsights(document: GeneratedBrief) {
  const requirements = getBriefRequirements(document);
  return {
    features: document.features.length, pages: document.pages.length, roles: document.userRoles.length,
    risks: document.risks.length, missingInformation: document.missingInformation.length,
    assumptions: requirements.filter((item) => item.status === "assumed").length,
    confirmed: requirements.filter((item) => item.status === "confirmed").length,
    recommended: requirements.filter((item) => item.status === "recommended").length,
    missingStatements: requirements.filter((item) => item.status === "missing").length,
  };
}
export function filterBriefFeatures(document: GeneratedBrief["features"], search: string, priority: string) {
  const query = normalize(search);
  return document.filter((item) => (priority === "all" || item.priority === priority) && (!query || normalize([item.id, item.name, item.description, item.actor].join(" ")).includes(query)));
}
