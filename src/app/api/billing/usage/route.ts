import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUsage } from "@/server/services/usage.service";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const session = await auth();
    const user = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }) : null;
    if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Connecte-toi pour consulter tes quotas." } }, { status: 401, headers });
    return Response.json({ data: await getUsage(user.id) }, { headers });
  } catch { return Response.json({ error: { code: "USAGE_UNAVAILABLE", message: "Impossible de charger les consommations. Réessaie." } }, { status: 500, headers }); }
}
