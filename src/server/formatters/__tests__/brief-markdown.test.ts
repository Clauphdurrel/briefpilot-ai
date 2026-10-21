import { expect, it } from "vitest";

import { documentFixture } from "@/server/agents/__tests__/brief-fixtures";
import { renderBriefMarkdown } from "../brief-markdown";

it("derives all seventeen sections and feature details from the validated JSON", () => {
  const markdown = renderBriefMarkdown(documentFixture(), "Restaurant test", true);
  expect(markdown.match(/^## /gm)).toHaveLength(17);
  expect(markdown).toContain("Brouillon"); expect(markdown).toContain("MUST");
  expect(markdown).toContain("Gestionnaire du restaurant");
  expect(markdown).toContain("À définir"); expect(markdown).toContain("Recommandé");
  expect(markdown).toContain("Critères d’acceptation");
});

it("escapes untrusted Markdown and HTML and never exposes source identifiers", () => {
  const doc = documentFixture(); doc.projectSummary.context.text = '<script>alert(1)</script>\n# Injected [link](javascript:evil)';
  const markdown = renderBriefMarkdown(doc, "Titre\n# Faux titre", false);
  expect(markdown).not.toContain("<script>");
  expect(markdown).not.toContain("\n# Injected");
  expect(markdown).not.toContain("[link](javascript:evil)");
  expect(markdown).not.toContain("message:answer-1");
});

it("is deterministic and rejects invalid documents", () => {
  const doc = documentFixture();
  expect(renderBriefMarkdown(doc, "Titre", false)).toBe(renderBriefMarkdown(doc, "Titre", false));
  expect(() => renderBriefMarkdown({ ...doc, projectSummary: null } as unknown as typeof doc, "Titre", true)).toThrow();
});
