import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { InterviewProgress } from "@/components/brief/interview-progress";
import { InterviewSummary } from "@/components/brief/interview-summary";
import { ProjectContentChecklist } from "@/components/brief/project-content-checklist";
import { collectedContents, composeInterviewMessage, interviewErrorMessage, messageForCopy, parseContentMessage } from "@/lib/interview-presentation";
import { turn } from "@/server/agents/__tests__/fixtures";
import { interviewStateSchema, type InterviewState } from "../interview-agent.schema";
import { interviewContentSchema } from "../interview-content.schema";

const empty: InterviewState = { messages: [], completionScore: null, missingInformation: [], analysis: null };
const item = { name: "Logo", status: "available" as const, importance: "high" as const, description: "Version validée par le client.", url: "https://example.invalid/logo" };
it("preserves older state responses and validates stored enriched analysis", () => {
  expect(interviewStateSchema.parse({ messages: [], completionScore: null, missingInformation: [] }).analysis).toBeUndefined();
  expect(interviewStateSchema.parse({ ...empty, analysis: turn }).analysis?.nextQuestion?.category).toBe("users");
  expect(interviewStateSchema.safeParse({ ...empty, analysis: { ...turn, coverage: [] } }).success).toBe(false);
});
it("renders honest empty states without a fabricated zero percent or requirements", () => {
  const progress = renderToStaticMarkup(createElement(InterviewProgress, { state: empty }));
  expect(progress).toContain("À évaluer"); expect(progress).not.toContain("<progress");
  const summary = renderToStaticMarkup(createElement(InterviewSummary, { state: empty }));
  expect(summary).toContain("Aucune information collectée"); expect(summary).toContain("Aucune hypothèse");
  const contents = renderToStaticMarkup(createElement(ProjectContentChecklist, { items: [], disabled: true, onSelect: () => undefined }));
  expect(contents).toContain("Aucun contenu déclaré"); expect(contents).not.toContain('type="file"');
});
it("shows the actual saved score, collected information and separate assumptions", () => {
  const state = { ...empty, completionScore: 37, missingInformation: ["Budget à préciser"], analysis: { ...turn, knownInformation: ["Agences immobilières"], assumptions: ["Une seule langue envisagée"] } };
  const progress = renderToStaticMarkup(createElement(InterviewProgress, { state }));
  expect(progress).toContain("37 %"); expect(progress).toContain('value="37"'); expect(progress).toContain("Design et identité");
  const summary = renderToStaticMarkup(createElement(InterviewSummary, { state }));
  for (const text of ["Agences immobilières", "Hypothèses à confirmer", "Une seule langue envisagée", "Budget à préciser", "Prochaine clarification prioritaire", turn.nextQuestion!.question]) expect(summary).toContain(text);
});
it("round-trips declared contents without marking uploads as stored", () => {
  const message = composeInterviewMessage("Voici notre identité.", item);
  expect(message.length).toBeLessThan(4000); expect(parseContentMessage(message)).toEqual({ text: "Voici notre identité.", content: item });
  const copy = messageForCopy(message);
  expect(copy).toContain("Logo — Disponible"); expect(copy).not.toContain("[Contenu projet]"); expect(copy).not.toContain('"status"');
});
it("keeps the latest explicit client declaration and ignores assistant assertions", () => {
  const state: InterviewState = { ...empty, messages: [
    { id: "1", role: "user", content: composeInterviewMessage("", item), createdAt: new Date().toISOString() },
    { id: "2", role: "assistant", content: composeInterviewMessage("", { ...item, name: "Photos" }), createdAt: new Date().toISOString() },
    { id: "3", role: "user", content: composeInterviewMessage("", { ...item, name: "logo", status: "not_applicable" }), createdAt: new Date().toISOString() },
  ] };
  expect(collectedContents(state)).toHaveLength(1); expect(collectedContents(state)[0].status).toBe("not_applicable");
});
it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "https://user:password@example.invalid", "bad-url"])("rejects unsafe content links: %s", (url) => {
  expect(interviewContentSchema.safeParse({ ...item, url }).success).toBe(false);
  const raw = `Texte\n\n[Contenu projet]\n${JSON.stringify({ ...item, url })}`;
  expect(parseContentMessage(raw)).toEqual({ text: raw, content: null });
});
it("handles invalid content markers as plain text", () => {
  expect(parseContentMessage("Bonjour\n\n[Contenu projet]\nnot-json").content).toBeNull();
  expect(parseContentMessage("Bonjour")).toEqual({ text: "Bonjour", content: null });
});
it.each(["UNAUTHENTICATED", "PROJECT_NOT_FOUND", "AI_TIMEOUT", "AI_QUOTA", "RATE_LIMIT", "STALE_INTERVIEW", "INTERVIEW_BUSY", "AI_NOT_CONFIGURED", "HISTORY_LIMIT", "INVALID_INPUT", "UNKNOWN"])("maps public errors to safe actionable messages: %s", (code) => {
  expect(interviewErrorMessage(code).length).toBeGreaterThan(40);
  expect(interviewErrorMessage(code)).not.toMatch(/stack|private|sk-/);
});
