import { beforeEach, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/projects/[projectId]/interview/route";
import { POST as send } from "@/app/api/projects/[projectId]/interview/messages/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InterviewError } from "@/server/ai/errors";
import { advanceInterview, getInterview } from "@/server/services/interview.service";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/server/services/interview.service", () => ({ advanceInterview: vi.fn(), getInterview: vi.fn() }));

const context = { params: Promise.resolve({ projectId: "project-1" }) };
const empty = { messages: [], completionScore: null, missingInformation: [] };
const session = { user: { email: "owner@example.invalid" }, expires: "2026-10-21T00:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(session as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner" } as never);
  vi.mocked(getInterview).mockResolvedValue(empty);
  vi.mocked(advanceInterview).mockResolvedValue(empty);
});

function request(body: unknown = { requestId: crypto.randomUUID() }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/projects/project-1/interview", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
  });
}

it("requires authentication before any GET or POST operation", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  for (const operation of [GET, POST, send]) {
    const response = await operation(request(), context);
    expect(response.status).toBe(401);
  }
  expect(getInterview).not.toHaveBeenCalled();
  expect(advanceInterview).not.toHaveBeenCalled();
});

it("rejects sessions that no longer have a database user", async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  expect((await GET(new Request("http://localhost:3000/api/projects/project-1/interview"), context)).status).toBe(401);
});

it("passes only the authenticated owner and validated project to the history service", async () => {
  const response = await GET(new Request("http://localhost:3000/api/projects/project-1/interview"), context);
  expect(getInterview).toHaveBeenCalledWith("owner", "project-1");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ data: empty });
});

it("returns the same safe not-found error for foreign or nonexistent projects", async () => {
  vi.mocked(getInterview).mockRejectedValue(new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable."));
  const response = await GET(new Request("http://localhost:3000/api/projects/project-1/interview"), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: { code: "PROJECT_NOT_FOUND", message: "Projet introuvable." } });
});

it("rejects malformed project identifiers before invoking the service", async () => {
  expect((await GET(new Request("http://localhost:3000/api/projects/bad/interview"), { params: Promise.resolve({ projectId: "bad id" }) })).status).toBe(400);
  expect(getInterview).not.toHaveBeenCalled();
});

it("rejects cross-origin and missing-origin mutations", async () => {
  expect((await POST(request(undefined, "https://attacker.invalid"), context)).status).toBe(403);
  const withoutOrigin = request(); withoutOrigin.headers.delete("Origin");
  expect((await POST(withoutOrigin, context)).status).toBe(403);
  expect(advanceInterview).not.toHaveBeenCalled();
});

it("validates start input and supplies the language default", async () => {
  const requestId = crypto.randomUUID();
  expect((await POST(request({ requestId }), context)).status).toBe(200);
  expect(advanceInterview).toHaveBeenCalledWith("owner", "project-1", { requestId, language: "fr" }, "start");
  expect((await POST(request({ requestId, ownerId: "intruder" }), context)).status).toBe(400);
});

it("validates replies, rejects empty and oversized content, and requires a prior message", async () => {
  for (const body of [
    { requestId: crypto.randomUUID(), content: " " },
    { requestId: crypto.randomUUID(), content: "x".repeat(4001), expectedLastMessageId: "last" },
    { requestId: crypto.randomUUID(), content: "Texte" },
  ]) expect((await send(request(body), context)).status).toBe(400);
  expect(advanceInterview).not.toHaveBeenCalled();
  const body = { requestId: crypto.randomUUID(), content: "Agences", expectedLastMessageId: "last" };
  expect((await send(request(body), context)).status).toBe(200);
  expect(advanceInterview).toHaveBeenCalledWith("owner", "project-1", { ...body, language: "fr" }, "message");
});

it("bounds JSON body size and handles malformed JSON and content types", async () => {
  const oversized = new Request("http://localhost:3000/api/projects/project-1/interview", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: "x".repeat(20001) });
  expect((await POST(oversized, context)).status).toBe(413);
  const malformed = new Request("http://localhost:3000/api/projects/project-1/interview", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: "{" });
  expect((await POST(malformed, context)).status).toBe(400);
  const unsupported = request(); unsupported.headers.set("Content-Type", "text/plain");
  expect((await POST(unsupported, context)).status).toBe(415);
});

it("never exposes unexpected server or SDK errors", async () => {
  vi.mocked(advanceInterview).mockRejectedValue(new Error("private-sdk-details"));
  const response = await POST(request(), context);
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-sdk-details");
});

it("reports rate limits with a retry hint", async () => {
  vi.mocked(advanceInterview).mockRejectedValue(new InterviewError("RATE_LIMIT", 429, "Patiente."));
  const response = await POST(request(), context);
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("60");
});
