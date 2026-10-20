export const projectTypes = [
  "WEBSITE", "ECOMMERCE", "SAAS", "MOBILE_APP", "INTERNAL_TOOL", "AUTOMATION", "OTHER",
] as const;

export const projectTypeLabels: Record<(typeof projectTypes)[number], string> = {
  WEBSITE: "Site vitrine",
  ECOMMERCE: "E-commerce",
  SAAS: "SaaS",
  MOBILE_APP: "Application mobile",
  INTERNAL_TOOL: "Outil interne / ERP",
  AUTOMATION: "Automatisation métier",
  OTHER: "Autre",
};

export const projectStatusLabels = {
  DRAFT: "Brouillon",
  INTERVIEW: "Interview",
  BRIEF_GENERATED: "Brief généré",
  VALIDATED: "Validé",
  ARCHIVED: "Archivé",
} as const;
