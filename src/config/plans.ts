export const planNames = ["FREE", "PRO", "AGENCY", "ENTERPRISE"] as const;
export type PlanName = typeof planNames[number];
export const resources = ["AI_INTERVIEW", "AI_BRIEF", "AI_BACKLOG", "PDF_EXPORT", "ACTIVE_PROJECTS"] as const;
export type Resource = typeof resources[number];
export type Limits = Record<Resource, number | null>;
export type Features = { markdown: boolean; codexPrompts: boolean; pdf: boolean; historyVersions: number | null; documentCustomization: "none" | "limited" | "full"; futureTeamMembers: number | null; prioritySupport: boolean };
type Plan = { name: string; monthlyPriceEuro: number | null; limits: Limits; features: Features };
const base: Features = { markdown: true, codexPrompts: true, pdf: true, historyVersions: 2, documentCustomization: "none", futureTeamMembers: 1, prioritySupport: false };
export const plans: Record<PlanName, Plan> = {
  FREE: { name: "Free", monthlyPriceEuro: 0, limits: { ACTIVE_PROJECTS: 2, AI_INTERVIEW: 3, AI_BRIEF: 2, AI_BACKLOG: 1, PDF_EXPORT: 3 }, features: base },
  PRO: { name: "Pro", monthlyPriceEuro: 19, limits: { ACTIVE_PROJECTS: 20, AI_INTERVIEW: 50, AI_BRIEF: 30, AI_BACKLOG: 30, PDF_EXPORT: null }, features: { ...base, historyVersions: null, documentCustomization: "limited" } },
  AGENCY: { name: "Agency", monthlyPriceEuro: 59, limits: { ACTIVE_PROJECTS: 100, AI_INTERVIEW: 200, AI_BRIEF: 150, AI_BACKLOG: 150, PDF_EXPORT: null }, features: { ...base, historyVersions: null, documentCustomization: "full", futureTeamMembers: 5, prioritySupport: true } },
  ENTERPRISE: { name: "Enterprise", monthlyPriceEuro: null, limits: { ACTIVE_PROJECTS: null, AI_INTERVIEW: null, AI_BRIEF: null, AI_BACKLOG: null, PDF_EXPORT: null }, features: { ...base, historyVersions: null, documentCustomization: "full", futureTeamMembers: null, prioritySupport: true } },
};
export const resourceLabels: Record<Resource, string> = { ACTIVE_PROJECTS: "Projets actifs", AI_INTERVIEW: "Réponses IA d’interview", AI_BRIEF: "Cahiers des charges IA", AI_BACKLOG: "Backlogs IA", PDF_EXPORT: "Exports PDF" };
