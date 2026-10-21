import { backlogFixture, backlogInput } from "@/server/agents/__tests__/backlog-fixtures";
import { expect, it } from "vitest";
import { backlogSchema, generateBacklogRequestSchema, validateBacklog, buildDependencyGraph } from "../backlog.schema";

it("validates example input/output and derives a deterministic dependency graph", () => {
  const document = backlogFixture();
  expect(() => validateBacklog(document, backlogInput().brief)).not.toThrow();
  expect(buildDependencyGraph(document)).toContainEqual({ from: "T-002", to: "T-001", kind: "requires" });
});
it("requires UUID, source brief, strict fields and bounded criteria", () => {
  expect(generateBacklogRequestSchema.safeParse({ requestId: crypto.randomUUID(), sourceBriefId: "brief-1" }).success).toBe(true);
  expect(generateBacklogRequestSchema.safeParse({ requestId: "bad", sourceBriefId: "brief-1", ownerId: "other" }).success).toBe(false);
  const doc = backlogFixture(); doc.tasks[0].acceptanceCriteria = [];
  expect(backlogSchema.safeParse(doc).success).toBe(false);
});
it.each(["duplicate", "unknown-epic", "unknown-story", "cross-epic", "unknown-dependency", "cycle", "self", "parent-cycle", "future-dependency", "duplicate-phase", "duplicate-dependency", "unknown-feature", "excluded-feature", "inverted-effort", "absolute-file", "traversal-file"])("rejects invalid integrity: %s", (kind) => {
  const doc = backlogFixture(), input = backlogInput();
  if (kind === "duplicate") doc.tasks[1].id = doc.tasks[0].id;
  if (kind === "unknown-epic") doc.tasks[0].epicId = "E-404";
  if (kind === "unknown-story") doc.tasks[0].storyId = "S-404";
  if (kind === "cross-epic") { doc.epics.push({ ...doc.epics[0], id: "E-002" }); doc.tasks[0].epicId = "E-002"; }
  if (kind === "unknown-dependency") doc.tasks[0].dependencies = ["T-404"];
  if (kind === "cycle") doc.tasks[0].dependencies = ["T-002"];
  if (kind === "self") doc.tasks[0].dependencies = ["T-001"];
  if (kind === "parent-cycle") doc.epics[0].dependencies = ["T-001"];
  if (kind === "future-dependency") { doc.epics.push({ ...doc.epics[0], id: "E-002", phase: "Future" }); doc.tasks[0].dependencies = ["E-002"]; }
  if (kind === "duplicate-phase") doc.phases[1] = doc.phases[0];
  if (kind === "duplicate-dependency") doc.tasks[1].dependencies = ["T-001", "T-001"];
  if (kind === "unknown-feature") doc.tasks[0].sourceFeatureIds = ["F-404"];
  if (kind === "excluded-feature") input.brief.features[0].priority = "WONT";
  if (kind === "inverted-effort") doc.tasks[0].estimation.estimatedEffort = { minHours: 10, maxHours: 1 };
  if (kind === "absolute-file") doc.tasks[0].suggestedFiles = ["/etc/passwd"];
  if (kind === "traversal-file") doc.tasks[0].suggestedFiles = ["../secrets"];
  expect(() => validateBacklog(doc, input.brief)).toThrow();
});
it("never promotes unconfirmed source requirements into confirmed mandatory MVP work", () => {
  const doc = backlogFixture(), input = backlogInput(); input.brief.features[0].status = "recommended";
  expect(() => validateBacklog(doc, input.brief)).toThrow("recommandation");
  [...doc.epics, ...doc.stories, ...doc.tasks].forEach((node) => { node.basis = "recommended"; node.priority = "P1"; });
  expect(() => validateBacklog(doc, input.brief)).toThrow("MVP");
  doc.epics[0].phase = "V1";
  expect(() => validateBacklog(doc, input.brief)).not.toThrow();
});
it("permits unsourced technical foundations only as recommendations", () => {
  const doc = backlogFixture(), input = backlogInput(); input.brief.features = []; doc.epics[0].phase = "Foundation";
  [...doc.epics, ...doc.stories, ...doc.tasks].forEach((node) => { node.basis = "recommended"; node.sourceFeatureIds = []; });
  expect(() => validateBacklog(doc, input.brief)).not.toThrow();
  doc.epics[0].phase = "MVP";
  expect(() => validateBacklog(doc, input.brief)).toThrow("fondation");
});

it("rejects a foundation-only backlog that silently omits a confirmed MUST", () => {
  const doc = backlogFixture(); doc.epics[0].phase = "Foundation";
  [...doc.epics, ...doc.stories, ...doc.tasks].forEach((node) => { node.basis = "recommended"; node.sourceFeatureIds = []; });
  expect(() => validateBacklog(doc, backlogInput().brief)).toThrow("MUST confirmée");
});

it("requires task coverage for every confirmed MUST rather than just epic or story references", () => {
  const doc = backlogFixture(), input = backlogInput();
  input.brief.features.push({ ...input.brief.features[0], id: "F-002" });
  doc.epics[0].sourceFeatureIds.push("F-002"); doc.stories[0].sourceFeatureIds.push("F-002");
  expect(() => validateBacklog(doc, input.brief)).toThrow("MUST confirmée");
});
