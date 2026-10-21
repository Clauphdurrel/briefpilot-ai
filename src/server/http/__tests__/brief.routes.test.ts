import { beforeEach, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/projects/[projectId]/briefs/route";
import { GET as detail } from "@/app/api/projects/[projectId]/briefs/[briefId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateBrief, getBrief, listBriefs } from "@/server/services/brief.service";
import { InterviewError } from "@/server/ai/errors";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/server/services/brief.service", () => ({ generateBrief: vi.fn(), getBrief: vi.fn(), listBriefs: vi.fn() }));
const context = { params: Promise.resolve({ projectId: "project-1", briefId: "brief-1" }) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { email: "owner@example.invalid" }, expires: "2027-01-01" } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner" } as never);
  vi.mocked(listBriefs).mockResolvedValue({ briefs: [], readiness: { hasInterview: false, requiresDraft: true, missingInformation: [], sourceRevision: "a".repeat(64) } });
  vi.mocked(generateBrief).mockResolvedValue({ briefId: "brief-1", reused: false });
});
function request(body: unknown = { requestId: crypto.randomUUID(), allowDraft: true }) {
  return new Request("http://localhost:3000/api/projects/project-1/briefs", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
it("requires a session on list, detail and generation", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  for (const operation of [GET, detail, POST]) expect((await operation(request(), context)).status).toBe(401);
  expect(listBriefs).not.toHaveBeenCalled(); expect(getBrief).not.toHaveBeenCalled(); expect(generateBrief).not.toHaveBeenCalled();
});
it("uses only the session owner and validates generation fields", async () => {
  const requestId = crypto.randomUUID();
  expect((await POST(request({ requestId, allowDraft: true }), context)).status).toBe(200);
  expect(generateBrief).toHaveBeenCalledWith("owner", "project-1", { requestId, allowDraft: true, language: "fr" });
  expect((await POST(request({ requestId, ownerId: "other" }), context)).status).toBe(400);
});
it("rejects cross-origin requests", async () => {
  const input = request(); input.headers.set("Origin", "https://attacker.invalid");
  expect((await POST(input, context)).status).toBe(403); expect(generateBrief).not.toHaveBeenCalled();
});
it("passes both document and project identifiers to the owned read", async () => {
  vi.mocked(getBrief).mockRejectedValue(new InterviewError("BRIEF_NOT_FOUND", 404, "Cahier des charges introuvable."));
  expect((await detail(new Request("http://localhost:3000/api/projects/project-1/briefs/brief-1"), context)).status).toBe(404);
  expect(getBrief).toHaveBeenCalledWith("owner", "project-1", "brief-1");
});
it("preserves draft-required errors and hides unexpected provider details", async () => {
  vi.mocked(generateBrief).mockRejectedValueOnce(new InterviewError("DRAFT_REQUIRED", 422, "Budget à préciser."));
  expect((await POST(request(), context)).status).toBe(422);
  vi.mocked(generateBrief).mockRejectedValueOnce(new Error("private-provider-details"));
  const response = await POST(request(), context); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private-provider-details");
});
