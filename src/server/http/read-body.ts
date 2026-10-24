import "server-only";

export const BODY_READ_TIMEOUT_MS = 10000;
export class BodyReadError extends Error {
  constructor(public readonly reason: "size" | "timeout") {
    super(reason === "size" ? "Body exceeds limit" : "Body read timed out");
  }
}

/** Bound bytes before concatenation and time even when a peer never closes. */
export async function readBodyBytes(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer> {
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new BodyReadError("timeout")); cancel(); }, BODY_READ_TIMEOUT_MS);
  });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) return Buffer.concat(chunks);
      size += value.byteLength;
      if (size > maxBytes) { cancel(); throw new BodyReadError("size"); }
      chunks.push(value);
    }
  } finally {
    if (timer) clearTimeout(timer);
    reader.releaseLock();
  }
}
