import { beforeEach, expect, it, vi } from "vitest";
import { getBrief } from "@/server/services/brief.service";
import { getBacklogById } from "@/server/services/backlog.service";
import { briefFixture, storedBacklogFixture } from "../../__tests__/export-fixtures";
import { renderPdf } from "../pdf-renderer";
import { generateBriefPdf, generateBacklogPdf, generateProjectPdf } from "../pdf.service";
vi.mock("@/server/services/brief.service", () => { const read = vi.fn(); return { getBrief: read, getBriefForSource: read }; });
vi.mock("@/server/services/backlog.service", () => ({ getBacklogById: vi.fn() }));
vi.mock("../pdf-renderer", () => ({ renderPdf: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBrief).mockResolvedValue({ ...briefFixture(), id: "brief-old", title: "Brief", createdAt: "2026-10-21T10:00:00Z" } as never);
  vi.mocked(getBacklogById).mockResolvedValue({ ...storedBacklogFixture(), id: "backlog-old", version: 3, sourceBriefId: "brief-old", status: "DRAFT", createdAt: "2026-10-21T11:00:00Z" } as never);
  vi.mocked(renderPdf).mockResolvedValue(Buffer.from("%PDF-test"));
});
it("exports the requested old brief and safe filename", async () => {
  expect((await generateBriefPdf("owner", "project", "brief-old")).filename).toBe("reservations-a-evry-brief-v2.pdf");
  expect(getBrief).toHaveBeenCalledWith("owner", "project", "brief-old");
});
it("exports the backlog and compatible project dossier with both versions in filename", async () => {
  expect((await generateBacklogPdf("owner", "project", "backlog-old")).filename).toContain("backlog-v3.pdf");
  expect((await generateProjectPdf("owner", "project", "brief-old", "backlog-old")).filename).toContain("project-brief-v2-backlog-v3.pdf");
});
it("supports a dossier without selecting a backlog", async () => {
  await generateProjectPdf("owner", "project", "brief-old");
  expect(getBacklogById).not.toHaveBeenCalled(); expect(vi.mocked(renderPdf).mock.calls[0][0]).toContain("Backlog non disponible");
});
it("refuses different source brief IDs even if version numbers match", async () => {
  await expect(generateProjectPdf("owner", "project", "other-brief", "backlog-old")).rejects.toMatchObject({ status: 422 }); expect(renderPdf).not.toHaveBeenCalled();
});
it("refuses incompatible source versions", async () => {
  const row = await getBacklogById("o", "p", "b"); row.generation.sourceBriefVersion = 1;
  await expect(generateBacklogPdf("o", "p", "b")).rejects.toMatchObject({ status: 422 }); expect(renderPdf).not.toHaveBeenCalled();
});
it.each(["projectName", "document"])("rejects credential-like content in %s before rendering", async (field) => {
  const row = await getBrief("o", "p", "b");
  if (field === "projectName") row.generation.projectName = "api_key=abc_defghijkl1234";
  else row.document.projectSummary.executiveSummary.text = "api_key=abc_defghijkl1234";
  await expect(generateBriefPdf("o", "p", "b")).rejects.toMatchObject({ status: 422 }); expect(renderPdf).not.toHaveBeenCalled();
});
it("propagates ownership failure before launching Chromium", async () => {
  vi.mocked(getBrief).mockRejectedValueOnce(new Error("not owned"));
  await expect(generateBriefPdf("other", "project", "brief")).rejects.toThrow(); expect(renderPdf).not.toHaveBeenCalled();
});

it("validates graph cycles before rendering", async () => {
  const row = await getBacklogById("o", "p", "b"); row.document.tasks[0].dependencies = ["T-002"];
  await expect(generateBacklogPdf("o", "p", "b")).rejects.toMatchObject({ status: 422 }); expect(renderPdf).not.toHaveBeenCalled();
});

vi.mock("@/server/services/usage.service", () => ({ reserveUsage: async () => ({ id: "ticket", userId: "owner" }), startUsage: async () => {}, commitUsage: async () => {}, releaseUsage: async () => {} }));
