import { expect, it } from "vitest";
import { briefFixture, storedBacklogFixture } from "../../__tests__/export-fixtures";
import { buildBriefHtml } from "../brief-pdf";
import { buildBacklogHtml } from "../backlog-pdf";
import { buildProjectHtml } from "../project-pdf";
import { markdownBlocks } from "../pdf-templates";
const reference = { version: 3, createdAt: "2026-10-21T11:00:00Z" };
it.each([true, false])("renders validated complete/draft brief: %s", (complete) => {
  const html = buildBriefHtml(briefFixture(complete));
  expect(html).toContain("Réservations à Évry"); expect(html).toContain("21 octobre 2026");
  expect(html.match(/<h2 id=/g)).toHaveLength(17);
  expect(html).toContain('href="#chapter-0-section-16"'); expect(html).not.toMatch(/private-model|requestId|sourceRevision/);
  expect(html).toContain(complete ? "Document généré" : "Brouillon");
});
it.each(["DRAFT", "READY"] as const)("renders a %s backlog with estimates and dependencies", (status) => {
  const html = buildBacklogHtml(storedBacklogFixture(), reference, status);
  for (const text of ["T-001", "T-002", "Dépendances", "indicatifs", "<thead>", "Complexité", "Version 3"]) expect(html).toContain(text);
});
it("assembles exact source versions and explicitly handles an absent backlog", () => {
  expect(buildProjectHtml(briefFixture(), storedBacklogFixture(), reference)).toContain("Cahier des charges v2 · Backlog v3");
  expect(buildProjectHtml(briefFixture())).toContain("Backlog non disponible");
  const wrong = storedBacklogFixture(); wrong.generation.sourceBriefVersion = 1;
  expect(() => buildProjectHtml(briefFixture(), wrong, reference)).toThrow();
});
it("treats malicious HTML and Markdown links as inert text", () => {
  const raw = briefFixture(); raw.generation.projectName = '<img src="http://127.0.0.1">';
  raw.document.projectSummary.executiveSummary.text = '<script>fetch("file:///etc/passwd")</script>';
  const html = buildBriefHtml(raw);
  expect(html).not.toContain("<img"); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
  expect(markdownBlocks('- [click](http://internal)')).not.toContain("<a");
});
it("keeps an escaped table pipe in one cell and handles long values", () => {
  const html = markdownBlocks('| Clé | Valeur |\n| --- | --- |\n| A\\|B | ' + 'é'.repeat(2000) + ' |');
  expect(html.match(/<td>/g)).toHaveLength(2); expect(html).toContain("A|B");
});
it("rejects incomplete storage shapes", () => {
  expect(() => buildBriefHtml({})).toThrow(); expect(() => buildBacklogHtml({}, reference, "DRAFT")).toThrow();
});
