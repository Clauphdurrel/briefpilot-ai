import { beforeEach, expect, it, vi } from "vitest";
import { GET as brief } from "@/app/api/projects/[projectId]/exports/brief/[briefId]/route";
import { GET as backlog } from "@/app/api/projects/[projectId]/exports/backlog/[backlogId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exportBriefMarkdown, exportBacklogMarkdown, exportCodexTasksMarkdown } from "@/server/exports/export.service";
import { markdownResponse } from "@/server/http/markdown-export";
import { InterviewError } from "@/server/ai/errors";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/server/exports/export.service", () => ({ exportBriefMarkdown: vi.fn(), exportBacklogMarkdown: vi.fn(), exportCodexTasksMarkdown: vi.fn() }));
const context = { params: Promise.resolve({ projectId: "project-1", briefId: "brief-old", backlogId: "backlog-old" }) };
const request = (query = "") => new Request(`http://localhost:3000/api/projects/project-1/exports/backlog/backlog-old${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { email: "owner@example.invalid" }, expires: "2027-01-01" } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner" } as never);
  for (const operation of [exportBriefMarkdown, exportBacklogMarkdown, exportCodexTasksMarkdown]) vi.mocked(operation).mockResolvedValue({ content: "# Projet à Évry\n", filename: "evry-brief-v2.md" });
});
it.each([brief, backlog])("requires authentication before rendering", async (operation) => {
  vi.mocked(auth).mockResolvedValue(null as never);
  expect((await operation(request(), context)).status).toBe(401); expect(exportBriefMarkdown).not.toHaveBeenCalled(); expect(exportBacklogMarkdown).not.toHaveBeenCalled();
});
it("returns a UTF-8 private attachment rather than a JSON wrapper", async () => {
  const response = await brief(request(), context);
  expect(response.status).toBe(200); expect(await response.text()).toBe("# Projet à Évry\n");
  expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8"); expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="evry-brief-v2.md"'); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(exportBriefMarkdown).toHaveBeenCalledWith("owner", "project-1", "brief-old");
});
it("selects only controlled export variants", async () => {
  await backlog(request(), context); expect(exportBacklogMarkdown).toHaveBeenCalledWith("owner", "project-1", "backlog-old");
  await backlog(request("?format=codex-tasks"), context); expect(exportCodexTasksMarkdown).toHaveBeenCalledWith("owner", "project-1", "backlog-old");
});
it.each(["?format=pdf", "?format=backlog&format=codex-tasks", "?ownerId=intruder", "?format=", "?format=codex-tasks&extra=1"])("rejects malformed or unexpected query fields: %s", async (query) => {
  expect((await backlog(request(query), context)).status).toBe(400); expect(exportBacklogMarkdown).not.toHaveBeenCalled(); expect(exportCodexTasksMarkdown).not.toHaveBeenCalled();
});
it("rejects query fields on brief downloads", async () => {
  expect((await brief(request("?format=codex-tasks"), context)).status).toBe(400);
});
it("preserves not-found permissions errors and hides internal errors", async () => {
  vi.mocked(exportBriefMarkdown).mockRejectedValueOnce(new InterviewError("BRIEF_NOT_FOUND", 404, "Document introuvable."));
  expect((await brief(request(), context)).status).toBe(404);
  vi.mocked(exportBriefMarkdown).mockRejectedValueOnce(new Error("private-database-password"));
  const response = await brief(request(), context); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private-database-password");
});
it("rejects header injection before constructing a response", () => {
  expect(() => markdownResponse({ content: "x", filename: 'x.md"\r\nX-Token: injected' })).toThrow();
});
