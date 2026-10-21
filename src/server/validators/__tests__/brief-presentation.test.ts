import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BriefViewer } from "@/components/brief/brief-viewer";
import { BriefFeatures } from "@/components/brief/brief-features";
import { BriefInsights } from "@/components/brief/brief-insights";
import { BriefRequirementsStatus } from "@/components/brief/brief-requirements-status";
import { BriefToc } from "@/components/brief/brief-toc";
import { BriefVersions } from "@/components/brief/brief-versions";
import { documentFixture } from "@/server/agents/__tests__/brief-fixtures";
import { filterBriefFeatures, getBriefInsights, getBriefRequirements } from "@/lib/brief-presentation";
import { briefSections } from "@/config/brief-sections";

it("computes collection counts directly from saved JSON without a quality score", () => {
  const document = documentFixture(), stats = getBriefInsights(document);
  expect(stats).toMatchObject({ features: 1, pages: 1, roles: 1, risks: 1, missingInformation: 2, assumptions: 1 });
  expect(Object.keys(stats)).not.toContain("score");
  const html = renderToStaticMarkup(createElement(BriefInsights, { document }));
  expect(html).toContain("Analyse de cette version"); expect(html).toContain("Aucun score de qualité");
});
it("deduplicates repeated statements by status without promoting hypotheses", () => {
  const document = documentFixture();
  document.assumptions.push({ text: "Une langue envisagée", status: "assumed", sourceIds: [] });
  document.projectScope.assumptions.push({ text: " Une langue envisagée ", status: "assumed", sourceIds: [] });
  const records = getBriefRequirements(document);
  expect(records.filter((item) => item.label.trim() === "Une langue envisagée")).toHaveLength(1);
  expect(records.find((item) => item.label.includes("Une langue envisagée"))?.status).toBe("assumed");
  expect(records.filter((item) => item.label === "Horaires et coordonnées du restaurant.")).toHaveLength(1);
});
it("keeps differently classified identical statements distinct", () => {
  const document = documentFixture();
  document.assumptions.push({ text: document.businessObjectives[0].text, status: "assumed", sourceIds: [] });
  expect(getBriefRequirements(document).filter((item) => item.label === document.businessObjectives[0].text)).toHaveLength(2);
});
it("counts nested hypotheses in functional and technical sections", () => {
  const document = documentFixture(); document.features[0].businessRules[0].status = "assumed";
  expect(getBriefInsights(document).assumptions).toBe(2);
});
it.each(["F-001", "GESTION DES DISPONIBILITÉS", "gestionnaire", "créneaux"])("searches feature fields case-insensitively: %s", (search) => {
  expect(filterBriefFeatures(documentFixture().features, search, "all")).toHaveLength(1);
});
it("combines search and MoSCoW filters without modifying the canonical brief", () => {
  const document = documentFixture(), before = JSON.stringify(document);
  expect(filterBriefFeatures(document.features, "gestion", "MUST")).toHaveLength(1);
  expect(filterBriefFeatures(document.features, "gestion", "WONT")).toHaveLength(0);
  expect(filterBriefFeatures(document.features, "inexistant", "all")).toHaveLength(0);
  expect(JSON.stringify(document)).toBe(before);
});
it("renders all fields needed to review a feature and its acceptance criteria", () => {
  const features = documentFixture().features;
  const html = renderToStaticMarkup(createElement(BriefFeatures, { features }));
  for (const text of ["F-001", "MUST", "Confirmé", "Gestionnaire du restaurant", "Règles métier", "Critères d’acceptation", "Aucune dépendance déclarée", features[0].acceptanceCriteria[0].text]) expect(html).toContain(text);
});
it("displays an empty functional scope without invented features", () => {
  const html = renderToStaticMarkup(createElement(BriefFeatures, { features: [] }));
  expect(html).toContain("Aucune fonctionnalité renseignée"); expect(html).not.toContain("F-001");
});
it("every table-of-contents anchor targets an actual rendered section", () => {
  const document = documentFixture(); document.integrations = [];
  const html = renderToStaticMarkup(createElement(BriefViewer, { document }));
  const toc = renderToStaticMarkup(createElement(BriefToc));
  for (const [id] of briefSections) {
    expect(html).toContain(`id="brief-${id}"`); expect(toc).toContain(`href="#brief-${id}"`);
  }
  expect(html.match(/data-brief-section/g)).toHaveLength(17);
  expect(html).toContain("Aucun élément renseigné dans cette version.");
});
it("escapes untrusted text rather than rendering model HTML", () => {
  const document = documentFixture(); document.projectSummary.context.text = '<img src=x onerror="alert(1)">';
  const html = renderToStaticMarkup(createElement(BriefViewer, { document }));
  expect(html).toContain("&lt;img"); expect(html).not.toContain("<img");
});
it("separates the four saved statuses and keeps missing questions visible", () => {
  const document = documentFixture();
  const html = renderToStaticMarkup(createElement(BriefRequirementsStatus, { requirements: getBriefRequirements(document) }));
  for (const text of ["Confirmé (", "Hypothèse (", "Recommandé (", "À préciser (", "ne vaut pas approbation"]) expect(html).toContain(text);
  const viewer = renderToStaticMarkup(createElement(BriefViewer, { document }));
  expect(viewer).toContain(document.missingInformation[0].question);
});
it("shows actual version numbers, dates and current/latest navigation", () => {
  const versions = [{ id: "new", title: "Nouveau brief", version: 9, draft: false, createdAt: "2026-10-21T10:00:00Z" }, { id: "old", title: "Ancien brief", version: 3, draft: true, createdAt: "2026-10-20T10:00:00Z" }];
  const html = renderToStaticMarkup(createElement(BriefVersions, { versions, currentId: "old", projectId: "project-1" }));
  expect(html).toContain("Version 9"); expect(html).toContain("Version 3"); expect(html).not.toContain("Version 2");
  expect(html).toContain("Version consultée"); expect(html).toContain("Revenir à la dernière version"); expect(html).toContain('dateTime="2026-10-21T10:00:00Z"');
});
it("does not fabricate version numbers for legacy documents", () => {
  const html = renderToStaticMarkup(createElement(BriefVersions, { versions: [{ id: "legacy", title: "Ancien", version: null, draft: true, createdAt: "2026-10-20T10:00:00Z" }], currentId: "legacy", projectId: "p" }));
  expect(html).toContain("Ancienne version"); expect(html).not.toContain("Version 1");
});
