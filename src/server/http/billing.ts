import "server-only";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InterviewError } from "@/server/ai/errors";
export function billingError(error: unknown) {
  const known = error instanceof InterviewError ? error : error instanceof ZodError ? new InterviewError("INVALID_INPUT", 400, "Demande invalide.") : new InterviewError("BILLING_UNAVAILABLE", 500, "Le service de facturation est momentanément indisponible.");
  return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers: { "Cache-Control": "private, no-store" } });
}
export async function withBillingUser(request: Request, action: (userId: string) => Promise<unknown>) {
  try {
    const session = await auth();
    const user = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }) : null;
    if (!user) throw new InterviewError("UNAUTHENTICATED", 401, "Connecte-toi pour gérer ton abonnement.");
    if (request.method !== "GET") {
      const allowed = [new URL(request.url).origin, ...(process.env.AUTH_URL ? [new URL(process.env.AUTH_URL).origin] : [])];
      if (!allowed.includes(request.headers.get("origin") ?? "")) throw new InterviewError("INVALID_ORIGIN", 403, "Origine de la demande invalide.");
    }
    return Response.json({ data: await action(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return billingError(error); }
}
export async function readRawWebhook(request: Request): Promise<Buffer> {
  const reader = request.body?.getReader(); if (!reader) throw new InterviewError("INVALID_WEBHOOK", 400, "Webhook vide.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 256000) { await reader.cancel(); throw new InterviewError("WEBHOOK_TOO_LARGE", 413, "Webhook trop volumineux."); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
