import Link from "next/link";
import { requireUser } from "@/server/services/auth.service";
import { getUsage } from "@/server/services/usage.service";
import { plans } from "@/config/plans";
import { UsageOverview } from "@/components/billing/usage-overview";
const statuses: Record<string, string> = { ACTIVE: "Actif", TRIALING: "Période d’essai", PAST_DUE: "Échéance non réglée", CANCELED: "Annulé", EXPIRED: "Expiré" };
export default async function SubscriptionPage() {
  const user = await requireUser(), data = await getUsage(user.id);
  const format = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Compte et utilisation</p><h1 className="text-3xl font-bold">Abonnement {plans[data.plan].name}</h1><p className="mt-2">Statut : {statuses[data.status]}</p><p className="mt-2 text-sm text-muted-foreground">Période : {format(data.periodStart)} au {format(data.periodEnd)} (UTC). Prochaine remise à zéro : {format(data.periodEnd)}. La capacité de projets actifs ne se réinitialise pas.</p></div><UsageOverview usage={data.usage} /><section className="space-y-2 rounded-xl border p-5"><h2 className="font-semibold">Fonctionnalités disponibles</h2><p>Exports Markdown, prompts Codex et PDF {data.plan === "FREE" ? "(3 par mois)" : "sans quota mensuel de plan"}. Historique : {data.features.historyVersions === null ? "versions conservées accessibles" : `${data.features.historyVersions} dernières versions par type de document et projet`}.</p><p className="text-sm text-muted-foreground">Une réponse IA d’interview, y compris la première question, consomme une unité. Les régénérations consomment leur quota ; les exports ne consomment aucune unité IA. Les appels envoyés au fournisseur comptent même en cas d’échec.</p></section><p className="text-sm">Les paiements seront disponibles prochainement. Les fonctions d’équipe et de personnalisation avancée sont prévues pour une étape ultérieure.</p><Link href="/pricing" className="inline-block rounded-lg border px-4 py-2 font-medium">Voir les offres</Link></div>;
}
