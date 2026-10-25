"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/services/auth.service";
import { analyticsConsentSchema } from "@/server/validators/analytics.schema";

export type AnalyticsConsentState = { message?: string; error?: string };
export async function updateAnalyticsConsent(_previous: AnalyticsConsentState, form: FormData): Promise<AnalyticsConsentState> {
  const user = await requireUser();
  const raw = form.get("analyticsConsent");
  if (raw !== null && raw !== "on") return { error: "Préférence invalide. Réessaie." };
  const { analyticsConsent } = analyticsConsentSchema.parse({ analyticsConsent: raw === "on" });
  try {
    await prisma.user.update({ where: { id: user.id }, data: { analyticsConsent } });
    revalidatePath("/dashboard/settings");
    return { message: "Ta préférence a été enregistrée." };
  } catch { return { error: "Impossible d’enregistrer ta préférence. Réessaie." }; }
}
