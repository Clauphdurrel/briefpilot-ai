import { briefFixture, storedBacklogFixture } from "./export-fixtures";
import { expect, it } from "vitest";
import { briefToMarkdown } from "../markdown/brief-to-markdown";
import { backlogToMarkdown } from "../markdown/backlog-to-markdown";
import { codexTasksToMarkdown } from "../markdown/codex-tasks-to-markdown";
import { codeBlock, exportFilename, markdownTable } from "../markdown/markdown-utils";

const ref = { version: 3, createdAt: "2026-10-21T11:00:00Z" };
it.each([true, false])("exports a validated %s complete brief with metadata and seventeen sections", (complete) => {
  const source = briefFixture(complete), before = JSON.stringify(source);
  const markdown = briefToMarkdown(source);
  expect(markdown).toContain("Réservations à Évry"); expect(markdown).toContain("Version : 2");
  expect(markdown.match(/^## /gm)).toHaveLength(17); expect(markdown).toContain(complete ? "Document généré" : "Brouillon");
  expect(markdown).not.toContain("private-model"); expect(markdown).not.toContain("00000000-0000"); expect(markdown).not.toContain("message:answer-1");
  expect(JSON.stringify(source)).toBe(before); expect(markdown).toBe(briefToMarkdown(source));
});
it("exports backlog phases, stories, tasks, ranges, risks, constraints and tests", () => {
  const source = storedBacklogFixture(); source.document.tasks[0].estimation.estimatedEffort = { minHours: 2, maxHours: 5 };
  const before = JSON.stringify(source), result = backlogToMarkdown(source, ref, "DRAFT");
  for (const value of ["Foundation", "MVP", "V1", "Future", "E-001", "S-001", "T-001", "T-002", "2–5 h", "Tests attendus", "Dépendances", "Brouillon", "ne constituent ni un devis"]) expect(result).toContain(value);
  expect(result).toContain("Version : 3"); expect(result).toContain("source : version 2"); expect(JSON.stringify(source)).toBe(before);
  expect(result).toBe(backlogToMarkdown(source, ref, "DRAFT"));
});
it("supports a ready backlog without converting indicative effort to a guarantee", () => {
  const result = backlogToMarkdown(storedBacklogFixture(), ref, "READY");
  expect(result).toContain("à valider avec l’équipe"); expect(result).toContain("À estimer");
});
it("preserves prompts byte-for-byte inside fences longer than every nested fence", () => {
  const source = storedBacklogFixture();
  const prompt = 'Lire AGENTS.md\r\n```ts\nconst résultat = "é | [texte]";\n```\n`````\nSuite\\fin\n';
  source.document.tasks[0].codexPrompt = prompt;
  const before = JSON.stringify(source), markdown = codexTasksToMarkdown(source, ref);
  expect(markdown).toContain(`\`\`\`\`\`\`text\n${prompt}\`\`\`\`\`\``);
  expect(markdown).toContain("Critères d’acceptation"); expect(markdown).toContain("Tests attendus"); expect(markdown).toContain("Aucun prompt n’est exécuté");
  expect(JSON.stringify(source)).toBe(before); expect(markdown).toBe(codexTasksToMarkdown(source, ref));
});
it.each(["plain", "```\nx\n```", "````````\n", "<script>alert(1)</script>", "émoji 🚀"])("code blocks preserve all prompt text: %s", (prompt) => {
  expect(codeBlock(prompt)).toContain(prompt);
  const fence = codeBlock(prompt).split("\n")[0].replace("text", "");
  expect(fence.length).toBeGreaterThan(Math.max(2, ...[...prompt.matchAll(/`+/g)].map((match) => match[0].length)));
});
it("escapes table pipes, HTML, line breaks and Markdown syntax", () => {
  const table = markdownTable(["Titre", "Détail"], [["A | B\n# Faux", "<script>[x](javascript:evil)</script>"]]);
  expect(table.split("\n")).toHaveLength(3); expect(table).toContain("A \\| B"); expect(table).not.toContain("<script>"); expect(table).not.toContain("[x](javascript:evil)");
});
it.each(["Immo Connect", "Évry / Été", "../../etc/passwd\r\nX-Header: injected", "中文", 'a"; filename="bad', "a".repeat(500)])("creates a bounded safe attachment name for %s", (name) => {
  const file = exportFilename(name, "codex-tasks", 9);
  expect(file).toMatch(/^[a-z0-9][a-z0-9-]*-codex-tasks-v9\.md$/); expect(file.length).toBeLessThan(121);
});
it("rejects invalid documents instead of exporting partial model data", () => {
  expect(() => briefToMarkdown({})).toThrow(); expect(() => backlogToMarkdown({}, ref, "DRAFT")).toThrow(); expect(() => codexTasksToMarkdown({}, ref)).toThrow();
});
