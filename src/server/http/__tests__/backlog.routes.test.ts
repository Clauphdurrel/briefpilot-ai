import { beforeEach, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/projects/[projectId]/backlogs/route";
import { GET as detail } from "@/app/api/projects/[projectId]/backlogs/[backlogId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateBacklog, getBacklogById, getProjectBacklogs } from "@/server/services/backlog.service";
import { InterviewError } from "@/server/ai/errors";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/server/services/backlog.service", () => ({ generateBacklog: vi.fn(), getBacklogById: vi.fn(), getProjectBacklogs: vi.fn() }));
const context = { params: Promise.resolve({ projectId: "project-1", backlogId: "backlog-1" }) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { email: "owner@example.invalid" }, expires: "2027-01-01" } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner" } as never);
  vi.mocked(getProjectBacklogs).mockResolvedValue([]);
  vi.mocked(generateBacklog).mockResolvedValue({ backlogId: "backlog-1", reused: false });
});
function request(body: unknown = { requestId: crypto.randomUUID(), sourceBriefId: "brief-1", allowDraft: true }) {
  return new Request("http://localhost:3000/api/projects/project-1/backlogs", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
it("requires a session on list, detail and generation", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  for (const operation of [GET, detail, POST]) expect((await operation(request(), context)).status).toBe(401);
  expect(getProjectBacklogs).not.toHaveBeenCalled(); expect(getBacklogById).not.toHaveBeenCalled(); expect(generateBacklog).not.toHaveBeenCalled();
});
it("passes only the session owner with the submitted generation options", async () => {
  const requestId = crypto.randomUUID();
  expect((await POST(request({ requestId, sourceBriefId: "brief-1", allowDraft: true }), context)).status).toBe(200);
  expect(generateBacklog).toHaveBeenCalledWith("owner", "project-1", { requestId, sourceBriefId: "brief-1", allowDraft: true });
});
it("rejects cross-origin requests", async () => {
  const input = request(); input.headers.set("Origin", "https://attacker.invalid");
  expect((await POST(input, context)).status).toBe(403); expect(generateBacklog).not.toHaveBeenCalled();
});
it("passes both document and project identifiers to the owned read", async () => {
  vi.mocked(getBacklogById).mockRejectedValue(new InterviewError("BACKLOG_NOT_FOUND", 404, "Cahier des charges introuvable."));
  expect((await detail(new Request("http://localhost:3000/api/projects/project-1/backlogs/backlog-1"), context)).status).toBe(404);
  expect(getBacklogById).toHaveBeenCalledWith("owner", "project-1", "backlog-1");
});
it("preserves draft-required errors and hides unexpected provider details", async () => {
  vi.mocked(generateBacklog).mockRejectedValueOnce(new InterviewError("DRAFT_REQUIRED", 422, "Budget à préciser."));
  expect((await POST(request(), context)).status).toBe(422);
  vi.mocked(generateBacklog).mockRejectedValueOnce(new Error("private-provider-details"));
  const response = await POST(request(), context); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private-provider-details");
});
