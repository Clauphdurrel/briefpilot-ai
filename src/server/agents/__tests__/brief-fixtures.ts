import { readFileSync } from "node:fs";

import { generatedBriefSchema, type GeneratedBrief } from "@/server/validators/brief.schema";
import type { BriefAgentInput } from "@/server/validators/brief-generator.schema";

export function documentFixture(complete = false): GeneratedBrief {
  const doc = generatedBriefSchema.parse(JSON.parse(readFileSync("docs/prompts/brief-generator.example.json", "utf8")));
  if (complete) {
    doc.budgetAndTimeline.budget = { text: "5 000 EUR", status: "confirmed", sourceIds: ["message:answer-1"] };
    doc.budgetAndTimeline.deadlines = [{ text: "15 janvier 2027", status: "confirmed", sourceIds: ["message:answer-1"] }];
    doc.missingInformation = [];
  }
  return doc;
}

export const briefInput: BriefAgentInput = {
  project: { name: "Restaurant test", type: "WEBSITE", description: "Réservation de tables et gestion des disponibilités." },
  sources: [{ id: "message:answer-1", kind: "answer", text: "Les clients réservent des créneaux disponibles. Le gestionnaire les modifie. Horaires et coordonnées fournis. Budget 5 000 EUR, livraison le 15 janvier 2027." }],
  history: [{ role: "user", content: "Je veux une réservation de tables." }],
  knownInformation: ["Réservation pour le restaurant"], missingInformation: ["Budget", "Délais"], language: "fr", draftRequested: true,
};
