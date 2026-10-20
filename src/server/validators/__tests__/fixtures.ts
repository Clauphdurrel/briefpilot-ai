import type { Brief } from "../brief.schema";
import type { InterviewAnalysis, Question } from "../interview.schema";

// Fictional examples used only for validation tests.
export const question: Question = {
  id: "target_users",
  question: "Qui utilisera principalement cette application ?",
  category: "users",
  priority: "high",
  required: true,
};

export const analysis: InterviewAnalysis = {
  summary: "Application de réservation pour restaurants",
  completionScore: 30,
  knownInformation: ["Le projet concerne la réservation de restaurants"],
  missingInformation: ["Utilisateurs cibles", "Gestion des disponibilités"],
  assumptions: [],
  nextQuestion: question,
};

export const brief: Brief = {
  projectSummary: "Site de présentation d’un restaurant fictif",
  businessObjectives: ["Présenter le restaurant"],
  targetAudience: ["Visiteurs du restaurant"],
  projectScope: "Présenter les informations fournies par le client.",
  userRoles: ["Visiteur"],
  features: [{
    id: "view_menu",
    name: "Consulter la carte",
    description: "Afficher les plats communiqués par le restaurant.",
    priority: "high",
    complexity: "unknown",
    acceptanceCriteria: ["La carte fournie est lisible sur mobile."],
  }],
  pages: [{ id: "menu", name: "La carte", description: "Les plats du restaurant." }],
  integrations: [],
  technicalConstraints: [],
  securityRequirements: [],
  requiredContent: ["Carte du restaurant"],
  assumptions: [],
  missingInformation: ["Contraintes d’hébergement"],
  risks: ["Contenus non fournis"],
  acceptanceCriteria: ["Le client valide le contenu de la carte."],
};
