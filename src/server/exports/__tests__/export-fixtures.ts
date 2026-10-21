import { documentFixture } from "@/server/agents/__tests__/brief-fixtures";
import { backlogFixture } from "@/server/agents/__tests__/backlog-fixtures";
export const briefFixture = (complete = false) => ({ schemaVersion: "brief.v1", document: documentFixture(complete), generation: { version: 2, requestId: "00000000-0000-4000-8000-000000000001", sourceRevision: "a".repeat(64), projectName: "Réservations à Évry", projectType: "WEBSITE", language: "fr", draft: !complete, generatedAt: "2026-10-21T10:00:00Z", model: "private-model" } });
export const storedBacklogFixture = () => ({ schemaVersion: "backlog.v1", document: backlogFixture(), generation: { model: "private-model", language: "fr", generatedAt: "2026-10-21T11:00:00Z", projectName: "Réservations à Évry", sourceBriefVersion: 2 } });
