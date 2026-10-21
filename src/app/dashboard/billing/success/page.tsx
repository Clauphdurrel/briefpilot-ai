import { requireUser } from "@/server/services/auth.service";
import { BillingConfirmation } from "@/components/billing/billing-confirmation";
export default async function BillingSuccessPage() {
  await requireUser();
  return <main className="mx-auto max-w-2xl space-y-5 py-10"><p className="text-sm text-muted-foreground">Mode test Lemon Squeezy</p><h1 className="text-3xl font-bold">Confirmation de l’abonnement</h1><BillingConfirmation /></main>;
}
