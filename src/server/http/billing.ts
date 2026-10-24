import "server-only";
import { withOperation } from "@/server/observability/context";
import { reportError } from "@/server/observability/errors";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InterviewError } from "@/server/ai/errors";
import { BodyReadError, readBodyBytes } from "./read-body";
export function billingError(error: unknown) {
  const known = error instanceof InterviewError ? error : error instanceof ZodError ? new InterviewError("INVALID_INPUT", 400, "Demande invalide.") : new InterviewError("BILLING_UNAVAILABLE", 500, "Le service de facturation est momentanément indisponible.");
  if (known.status >= 500) reportError(error, { module: "billing" });
  return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers: { "Cache-Control": "private, no-store" } });
}
export async function withBillingUser(request: Request, action: (userId: string) => Promise<unknown>) {
  return withOperation({ module: "billing" }, async () => {
    try {
      const session = await auth();
      const user = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }) : null;
      if (!user) throw new InterviewError("UNAUTHENTICATED", 401, "Connecte-toi pour gérer ton abonnement.");
      if (request.method !== "GET") {
        const allowed = [new URL(request.url).origin, ...(process.env.AUTH_URL ? [new URL(process.env.AUTH_URL).origin] : [])];
        if (!allowed.includes(request.headers.get("origin") ?? "")) throw new InterviewError("INVALID_ORIGIN", 403, "Origine de la demande invalide.");
      }
      return Response.json({ data: await withOperation({ userId: user.id }, () => action(user.id)) }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return billingError(error); }
  });
}
export async function readRawWebhook(request: Request): Promise<Buffer> {
  if (!request.body) throw new InterviewError("INVALID_WEBHOOK", 400, "Webhook vide.");
  try {
    return await readBodyBytes(request.body, 256000);
  } catch (error) {
    if (error instanceof BodyReadError) {
      throw error.reason === "size"
        ? new InterviewError("WEBHOOK_TOO_LARGE", 413, "Webhook trop volumineux.")
        : new InterviewError("WEBHOOK_TIMEOUT", 408, "La lecture du webhook a expiré.");
    }
    throw error;
  }
}
