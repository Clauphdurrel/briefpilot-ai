import { interviewCategories, type InterviewAgentInput, type InterviewTurn } from "@/server/validators/interview-agent.schema";

export const turn: InterviewTurn = {
  summary: "Plateforme immobilière fictive",
  message: "Quels profils utiliseront cette plateforme ?",
  completionScore: 0,
  knownInformation: [], missingInformation: ["Utilisateurs cibles"], assumptions: [],
  nextQuestion: {
    id: "target_users", question: "Quels profils utiliseront cette plateforme ?",
    category: "users", priority: "high", required: true,
  },
  coverage: interviewCategories.map((category) => ({ category, status: "missing", evidence: null })),
};

export const wire = { ...turn, nextQuestion: { ...turn.nextQuestion!, helpText: null } };
export const input: InterviewAgentInput = {
  project: { name: "Immo test", type: "SAAS", description: "Gestion immobilière au Sénégal." },
  history: [], knownInformation: [], previousAnalysis: null, language: "fr",
};
