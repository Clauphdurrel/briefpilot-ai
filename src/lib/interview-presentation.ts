import { interviewContentSchema, type InterviewContent } from "@/server/validators/interview-content.schema";
import type { InterviewState } from "@/server/validators/interview-agent.schema";

const marker = "\n\n[Contenu projet]\n";
export const contentStatusLabels = { available: "Disponible", missing: "Manquant", not_applicable: "Non applicable" };
export const contentImportanceLabels = { high: "Prioritaire", medium: "Utile", low: "Secondaire" };
export const categoryLabels: Record<string, string> = {
  context: "Contexte", problem: "Problème à résoudre", objectives: "Objectifs", users: "Utilisateurs", features: "Fonctionnalités",
  pages: "Pages et écrans", journeys: "Parcours", roles: "Rôles et accès", content: "Contenus", branding: "Design et identité",
  integrations: "Intégrations", data: "Données", technical: "Contraintes techniques", regulatory: "Réglementation",
  budget: "Budget", timeline: "Délais", success: "Critères de réussite",
};
export function parseContentMessage(message: string): { text: string; content: InterviewContent | null } {
  const index = message.lastIndexOf(marker);
  if (index < 0) return { text: message, content: null };
  try {
    const parsed = interviewContentSchema.safeParse(JSON.parse(message.slice(index + marker.length)));
    return parsed.success ? { text: message.slice(0, index), content: parsed.data } : { text: message, content: null };
  } catch { return { text: message, content: null }; }
}
export function composeInterviewMessage(draft: string, content: InterviewContent | null): string {
  return content ? `${draft.trim() || "Voici un contenu pour le projet."}${marker}${JSON.stringify(interviewContentSchema.parse(content))}` : draft.trim();
}
export function messageForCopy(message: string): string {
  const { text, content } = parseContentMessage(message);
  return content ? `${text}\n\n${content.name} — ${contentStatusLabels[content.status]}\nImportance : ${contentImportanceLabels[content.importance]}\n${content.description}${content.url ? `\n${content.url}` : ""}` : text;
}
export function collectedContents(state: InterviewState): InterviewContent[] {
  const latest = new Map<string, InterviewContent>();
  for (const message of state.messages) {
    if (message.role !== "user") continue;
    const content = parseContentMessage(message.content).content;
    if (content) latest.set(content.name.normalize("NFKC").toLocaleLowerCase("fr"), content);
  }
  return [...latest.values()];
}

export function interviewErrorMessage(code: string, status?: number): string {
  if (code === "QUOTA_EXCEEDED") return "Ton quota de réponses IA pour cette période est atteint. Consulte les offres ou attends la remise à zéro. Ta réponse est conservée.";
  if (status === 401 || code === "UNAUTHENTICATED") return "Ta session a expiré. Reconnecte-toi pour reprendre l’interview. Ta réponse reste dans le champ de saisie.";
  if (status === 404 || code === "PROJECT_NOT_FOUND") return "Ce projet n’est plus accessible. Retourne à la liste des projets.";
  if (["AI_TIMEOUT", "TIMEOUT"].includes(code)) return "La réponse prend trop de temps. Actualise l’historique avant de réessayer : elle a peut-être été enregistrée.";
  if (["AI_QUOTA", "RATE_LIMIT", "RETRY_LIMIT"].includes(code)) return "L’assistant a atteint sa limite d’utilisation. Patiente avant de réessayer. Ta réponse est conservée dans ce champ.";
  if (["STALE_INTERVIEW", "STALE_REQUEST", "INTERVIEW_BUSY", "IDEMPOTENCY_CONFLICT"].includes(code)) return "La conversation a évolué ou une réponse est en cours. Actualise l’historique avant de poursuivre.";
  if (code === "AI_NOT_CONFIGURED") return "L’assistant n’est pas encore configuré. Contacte l’administrateur du projet.";
  if (code === "HISTORY_LIMIT") return "Cette interview a atteint sa limite de messages. Tu peux consulter les réponses et préparer le cahier des charges.";
  if (code === "INVALID_INPUT" || code === "BODY_TOO_LARGE") return "Vérifie ta réponse : elle doit contenir au maximum 4 000 caractères, fiche de contenu comprise.";
  return "Impossible de charger la réponse pour le moment. Actualise l’historique puis réessaie. Ta saisie est conservée.";
}
