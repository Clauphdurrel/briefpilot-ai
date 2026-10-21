import { beforeEach, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateBriefPdf, generateBacklogPdf, generateProjectPdf } from "@/server/exports/pdf/pdf.service";
import { GET as brief } from "@/app/api/projects/[projectId]/exports/pdf/brief/[briefId]/route";
import { GET as backlog } from "@/app/api/projects/[projectId]/exports/pdf/backlog/[backlogId]/route";
import { GET as project } from "@/app/api/projects/[projectId]/exports/pdf/project/route";
import { pdfResponse } from "../pdf-export";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/server/exports/pdf/pdf.service", () => ({ generateBriefPdf: vi.fn(), generateBacklogPdf: vi.fn(), generateProjectPdf: vi.fn() }));
const context = { params: Promise.resolve({ projectId: "project-1", briefId: "brief-old", backlogId: "backlog-old" }) };
const request = (query = "") => new Request(`http://localhost/api/projects/project-1/exports/pdf/project${query}`);
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(auth).mockResolvedValue({ user: { email: "owner@example.invalid" } } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner" } as never);
  for (const operation of [generateBriefPdf, generateBacklogPdf, generateProjectPdf]) vi.mocked(operation).mockResolvedValue({ content: Buffer.from("%PDF-1.7 test"), filename: "evry-brief-v2.pdf" });
});
it.each([brief, backlog, project])("requires a session before generating", async (operation) => {
  vi.mocked(auth).mockResolvedValue(null as never); expect((await operation(request(), context)).status).toBe(401); expect(generateBriefPdf).not.toHaveBeenCalled(); expect(generateBacklogPdf).not.toHaveBeenCalled(); expect(generateProjectPdf).not.toHaveBeenCalled();
});
it("sends a private PDF attachment with exact version identifiers", async () => {
  const response = await project(request("?briefId=brief-old&backlogId=backlog-old"), context);
  expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("application/pdf"); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="evry-brief-v2.pdf"');
  expect(await response.text()).toBe("%PDF-1.7 test"); expect(generateProjectPdf).toHaveBeenCalledWith("owner", "project-1", "brief-old", "backlog-old");
});
it("routes briefs and backlogs using session owner and explicit path IDs", async () => {
  await brief(request(), context); await backlog(request(), context);
  expect(generateBriefPdf).toHaveBeenCalledWith("owner", "project-1", "brief-old"); expect(generateBacklogPdf).toHaveBeenCalledWith("owner", "project-1", "backlog-old");
});
it.each(["", "?briefId=a&briefId=b", "?briefId=brief-old&ownerId=other", "?briefId=", "?backlogId=backlog-old"])("rejects ambiguous dossier parameters %s", async (query) => {
  expect((await project(request(query), context)).status).toBe(400); expect(generateProjectPdf).not.toHaveBeenCalled();
});
it("rejects query fields for direct document exports", async () => { expect((await brief(request("?url=http://internal"), context)).status).toBe(400); });
it("hides internal browser errors", async () => {
  vi.mocked(generateBriefPdf).mockRejectedValueOnce(new Error("private chromium path"));
  const response = await brief(request(), context); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private chromium");
});
it("refuses header injection and non PDF results", () => {
  expect(() => pdfResponse({ content: Buffer.from("%PDF-x"), filename: 'x.pdf"\r\nInjected: yes' })).toThrow();
  expect(() => pdfResponse({ content: Buffer.from("html"), filename: "x.pdf" })).toThrow();
});

it("accepts a controlled PDF operation key and refuses malformed keys", async () => {
  const operationId = "00000000-0000-4000-8000-000000000001";
  const req = new Request("http://localhost/pdf", { headers: { "Idempotency-Key": operationId } });
  await brief(req, context); expect(generateBriefPdf).toHaveBeenCalledWith("owner", "project-1", "brief-old", operationId);
  expect((await brief(new Request("http://localhost/pdf", { headers: { "Idempotency-Key": "not-valid" } }), context)).status).toBe(400);
});
