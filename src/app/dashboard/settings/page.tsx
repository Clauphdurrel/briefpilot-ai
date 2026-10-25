import Link from "next/link";
import { AnalyticsConsent } from "@/components/settings/analytics-consent";
import { requireUser } from "@/server/services/auth.service";
import { prisma } from "@/lib/prisma";
export default async function SettingsPage() {
  const user = await requireUser();
  const preferences = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { analyticsConsent: true } });
  return (
    <div>
      <p className="text-sm text-muted-foreground">Configuration</p>
      <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
      <p className="mt-4 text-muted-foreground">
        <Link href="/dashboard/settings/subscription" className="underline">Gérer mon abonnement et consulter mes quotas</Link>
      </p>
      <AnalyticsConsent consent={preferences.analyticsConsent} />
    </div>
  );
}
