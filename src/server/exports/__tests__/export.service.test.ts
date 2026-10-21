import { beforeEach, expect, it, vi } from "vitest";
import { getBrief } from "@/server/services/brief.service";
import { getBacklogById } from "@/server/services/backlog.service";
import { InterviewError } from "@/server/ai/errors";
import { exportBacklogMarkdown, exportBriefMarkdown, exportCodexTasksMarkdown } from "../export.service";
import { briefFixture, storedBacklogFixture } from "./export-fixtures";

vi.mock("@/server/services/brief.service", () => { const read = vi.fn(); return { getBrief: read, getBriefForSource: read }; });
vi.mock("@/server/services/backlog.service", () => ({ getBacklogById: vi.fn() }));
const ref = { id: "b-1", version: 3, status: "DRAFT" as const, sourceBriefId: "brief-old", createdAt: "2026-10-21T11:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBrief).mockResolvedValue({ ...briefFixture(), id: "brief-old", title: "Titre privé", createdAt: "2026-10-21T10:00:00Z" } as Awaited<ReturnType<typeof getBrief>>);
  vi.mocked(getBacklogById).mockResolvedValue({ ...ref, ...storedBacklogFixture() } as Awaited<ReturnType<typeof getBacklogById>>);
});
it("exports the precise owned brief with a safe versioned filename", async () => {
  const result = await exportBriefMarkdown("owner", "project-1", "brief-old");
  expect(getBrief).toHaveBeenCalledWith("owner", "project-1", "brief-old");
  expect(result.filename).toBe("reservations-a-evry-brief-v2.md"); expect(result.content).toContain("Version : 2");
});
it.each([exportBacklogMarkdown, exportCodexTasksMarkdown])("checks the source brief and exports the precise backlog", async (operation) => {
  const result = await operation("owner", "project-1", "b-1");
  expect(getBacklogById).toHaveBeenCalledWith("owner", "project-1", "b-1"); expect(getBrief).toHaveBeenCalledWith("owner", "project-1", "brief-old");
  expect(result.filename).toContain("-v3.md"); expect(result.content).toContain("source : version 2");
});
it.each([exportBriefMarkdown, exportBacklogMarkdown, exportCodexTasksMarkdown])("preserves access failures without returning document contents", async (operation) => {
  vi.mocked(getBrief).mockRejectedValue(new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable."));
  vi.mocked(getBacklogById).mockRejectedValue(new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable."));
  await expect(operation("intruder", "project-1", "missing")).rejects.toMatchObject({ status: 404 });
});
it("rejects valid-schema but cyclic or mismatched-source backlogs", async () => {
  const row = { ...ref, ...storedBacklogFixture() }; row.document.tasks[0].dependencies = ["T-002"];
  vi.mocked(getBacklogById).mockResolvedValue(row as Awaited<ReturnType<typeof getBacklogById>>);
  await expect(exportBacklogMarkdown("owner", "project-1", "b-1")).rejects.toMatchObject({ code: "EXPORT_INVALID_DOCUMENT" });
  const mismatch = { ...ref, ...storedBacklogFixture() }; mismatch.generation.sourceBriefVersion = 99;
  vi.mocked(getBacklogById).mockResolvedValue(mismatch as Awaited<ReturnType<typeof getBacklogById>>);
  await expect(exportCodexTasksMarkdown("owner", "project-1", "b-1")).rejects.toMatchObject({ code: "EXPORT_INVALID_DOCUMENT" });
});
it("rejects credential-like document data instead of altering or leaking saved prompts", async () => {
  const row = { ...ref, ...storedBacklogFixture() }; row.document.tasks[0].codexPrompt = "api_key=privatecredential123456";
  vi.mocked(getBacklogById).mockResolvedValue(row as Awaited<ReturnType<typeof getBacklogById>>);
  await expect(exportCodexTasksMarkdown("owner", "project-1", "b-1")).rejects.toMatchObject({ code: "EXPORT_SENSITIVE_CONTENT" });
});
it("never serializes server configuration or model metadata", async () => {
  vi.stubEnv("OPENAI_API_KEY", "server-private-key-must-not-export");
  try { const result = await exportCodexTasksMarkdown("owner", "project-1", "b-1"); expect(result.content).not.toContain("server-private"); expect(result.content).not.toContain("private-model"); }
  finally { vi.unstubAllEnvs(); }
});

it("checks project names before Markdown escaping or filename normalization", async () => {
  const row = { ...briefFixture(), id: "brief-old", title: "Titre", createdAt: "2026-10-21T10:00:00Z" };
  row.generation.projectName = "api_key=abcd_efgh1234";
  vi.mocked(getBrief).mockResolvedValue(row as Awaited<ReturnType<typeof getBrief>>);
  await expect(exportBriefMarkdown("owner", "project-1", "brief-old")).rejects.toMatchObject({ code: "EXPORT_SENSITIVE_CONTENT" });
});

it("checks raw brief text before formatting can escape credential markers", async () => {
  const row = { ...briefFixture(), id: "brief-old", title: "Titre", createdAt: "2026-10-21T10:00:00Z" };
  row.document.projectSummary.context.text = "api_key=abcd_efgh1234";
  vi.mocked(getBrief).mockResolvedValue(row as Awaited<ReturnType<typeof getBrief>>);
  await expect(exportBriefMarkdown("owner", "project-1", "brief-old")).rejects.toMatchObject({ code: "EXPORT_SENSITIVE_CONTENT" });
});
