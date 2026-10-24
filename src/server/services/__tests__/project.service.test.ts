import { beforeEach, expect, it, vi } from "vitest";
import { createOwnedProject } from "../project.service";
const mocks = vi.hoisted(() => ({ create: vi.fn<(input: unknown) => Promise<{ id: string }>>(async () => ({ id: "project" })) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (callback: (tx: unknown) => unknown) => callback({ project: { create: mocks.create } }) } }));
vi.mock("../usage.service", () => ({ assertProjectCapacity: vi.fn(async () => {}), lockUsage: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("persists the validated, trimmed description rather than its raw input", async () => {
  await createOwnedProject("owner", { name: "  Project  ", type: "WEBSITE", description: "   A short description   " });
  expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Project", type: "WEBSITE", description: "A short description", ownerId: "owner" }, select: { id: true } });
});
it("normalizes a whitespace-only description to null", async () => {
  await createOwnedProject("owner", { name: "Project", type: "WEBSITE", description: "   " });
  expect(mocks.create.mock.calls[0][0]).toMatchObject({ data: { description: null } });
});
