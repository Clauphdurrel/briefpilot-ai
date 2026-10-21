import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { QuotaError } from "@/server/services/usage.service";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InterviewError } from "@/server/ai/errors";
import { projectIdSchema } from "@/server/validators/project.schema";

export type ProjectRouteContext = { params: Promise<{ projectId: string }> };

export async function withInterviewAccess<T>(
  request: Request, context: ProjectRouteContext,
  operation: (ownerId: string, projectId: string) => Promise<T>,
  responseFactory?: (data: T) => Response,
) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new InterviewError("UNAUTHENTICATED", 401, "Connecte-toi pour accéder au projet.");
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) throw new InterviewError("UNAUTHENTICATED", 401, "Connecte-toi pour accéder au projet.");
    const projectId = projectIdSchema.parse((await context.params).projectId);
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      const allowed = [new URL(request.url).origin];
      if (process.env.AUTH_URL) allowed.push(new URL(process.env.AUTH_URL).origin);
      if (!origin || !allowed.includes(origin)) throw new InterviewError("INVALID_ORIGIN", 403, "Origine de la demande invalide.");
    }
    const data = await operation(user.id, projectId);
    if (responseFactory) return responseFactory(data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof InterviewError ? error : error instanceof ZodError
      ? new InterviewError("INVALID_INPUT", 400, "Données invalides. Vérifie les champs de la demande.")
      : new InterviewError("INTERNAL_ERROR", 500, "Le service est momentanément indisponible. Réessaie.");
    return NextResponse.json({ error: { code: known.code, message: known.message, ...(known instanceof QuotaError ? { resource: known.resource, limit: known.limit, used: known.used, reserved: known.reserved, upgradeUrl: "/pricing" } : {}) } }, {
      status: known.status, headers: { "Cache-Control": "no-store", ...(known.status === 429 ? { "Retry-After": "60" } : {}) },
    });
  }
}

export { withInterviewAccess as withProjectAccess, readInterviewBody as readJsonBody };

export async function readInterviewBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new InterviewError("INVALID_CONTENT_TYPE", 415, "Un corps JSON est requis.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new InterviewError("INVALID_INPUT", 400, "Données manquantes.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 20000) {
        await reader.cancel();
        throw new InterviewError("BODY_TOO_LARGE", 413, "La demande est trop volumineuse.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new InterviewError("INVALID_JSON", 400, "Le format de la demande est invalide."); }
}
