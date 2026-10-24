import { afterEach, expect, it, vi } from "vitest";
import { BODY_READ_TIMEOUT_MS, readBodyBytes } from "../read-body";
import { readJsonBody } from "../interview";
import { readRawWebhook } from "../billing";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
afterEach(() => vi.useRealTimers());
const encoder = new TextEncoder();
function request(body: ReadableStream<Uint8Array>, type = "application/json") {
  return new Request("http://localhost/api/test", { method: "POST", headers: { "Content-Type": type, "Content-Length": "1" }, body, duplex: "half" } as RequestInit);
}

it.each(["application/json", "application/json; charset=utf-8", "APPLICATION/JSON; charset=UTF-8"])("accepts only the JSON media type with optional parameters: %s", async (type) => {
  const req = new Request("http://localhost", { method: "POST", headers: { "Content-Type": type }, body: '{"answer":"été"}' });
  expect(await readJsonBody(req)).toEqual({ answer: "été" });
});
it.each(["application/jsonp", "application/json-invalid", "text/plain", "application/problem+json"])("rejects a misleading media type before reading: %s", async (type) => {
  const req = new Request("http://localhost", { method: "POST", headers: { "Content-Type": type }, body: "{}" });
  await expect(readJsonBody(req)).rejects.toMatchObject({ code: "INVALID_CONTENT_TYPE", status: 415 });
  expect(req.bodyUsed).toBe(false);
});
it("preserves exact webhook bytes, including Unicode and whitespace", async () => {
  const bytes = encoder.encode('{ "texte": "été" }\n');
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.subarray(0, 15)); c.enqueue(bytes.subarray(15)); c.close(); } });
  expect(await readRawWebhook(request(body))).toEqual(Buffer.from(bytes));
});
it.each([[readJsonBody, 20000, "BODY_TOO_LARGE"], [readRawWebhook, 256000, "WEBHOOK_TOO_LARGE"]] as const)("counts streamed bytes despite forged Content-Length: %s", async (read, limit, code) => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(limit)); c.enqueue(new Uint8Array(1)); }, cancel });
  await expect(read(request(body))).rejects.toMatchObject({ code, status: 413 });
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});
it.each([[readJsonBody, "BODY_TIMEOUT"], [readRawWebhook, "WEBHOOK_TIMEOUT"]] as const)("cancels an unfinished stream without waiting for the peer: %s", async (read, code) => {
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(encoder.encode("{")); }, cancel });
  const result = expect(read(request(body))).rejects.toMatchObject({ code, status: 408 });
  await vi.advanceTimersByTimeAsync(BODY_READ_TIMEOUT_MS);
  await result;
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});
it("accepts the exact byte limit and releases its deadline", async () => {
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(32)); c.close(); } });
  expect((await readBodyBytes(body, 32)).length).toBe(32);
  expect(body.locked).toBe(false);
});
