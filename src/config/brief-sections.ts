export const briefSections = [
  ["presentation", "Présentation générale"], ["objectives", "Objectifs"], ["audience", "Utilisateurs cibles"],
  ["scope", "Périmètre du projet"], ["features", "Fonctionnalités"], ["pages", "Pages et écrans"],
  ["journeys", "Parcours utilisateurs"], ["roles", "Rôles et permissions"], ["content", "Contenus nécessaires"],
  ["integrations", "Intégrations"], ["technical", "Contraintes techniques et sécurité"],
  ["non-functional", "Exigences non fonctionnelles"], ["regulatory", "Sujets réglementaires à vérifier"],
  ["budget", "Budget et planning"], ["risks", "Risques"], ["missing", "Informations manquantes"],
  ["acceptance", "Critères de validation"],
] as const;

export const requirementStatusLabels = {
  confirmed: "Confirmé", assumed: "Hypothèse", recommended: "Recommandé", missing: "À préciser",
} as const;
