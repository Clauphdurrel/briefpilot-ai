"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateAnalyticsConsent } from "@/server/actions/analytics.actions";

export function AnalyticsConsent({ consent }: { consent: boolean }) {
  const [state, action, pending] = useActionState(updateAnalyticsConsent, {});
  return <section className="mt-8 max-w-xl space-y-4 rounded-xl border p-5">
    <h2 className="text-lg font-semibold">Confidentialité</h2>
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" name="analyticsConsent" defaultChecked={consent} />
        <span>Autoriser les statistiques d’utilisation pour améliorer BriefPilot AI.</span></label>
      <p className="text-sm text-muted-foreground">Les statistiques n’incluent pas tes textes, documents ou adresses email. Tu peux retirer ton accord à tout moment.</p>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer ma préférence"}</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
    </form>
  </section>;
}
