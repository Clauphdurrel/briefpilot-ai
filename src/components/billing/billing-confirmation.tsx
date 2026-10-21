"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export function BillingConfirmation() {
  const [refresh, setRefresh] = useState(0), [state, setState] = useState<"pending" | "confirmed" | "waiting" | "error">("pending"), [plan, setPlan] = useState("");
  useEffect(() => {
    let canceled = false, attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch("/api/billing/subscription", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
        if (!response.ok) throw new Error("Cannot check subscription");
        const { data } = await response.json();
        if (canceled) return;
        if (data.configuredSubscription && data.plan !== "FREE") { setPlan(data.plan); setState("confirmed"); return; }
        attempts++;
        if (attempts >= 15) setState("waiting"); else timer = setTimeout(() => void check(), 4000);
      } catch { if (!canceled) setState("error"); }
    }
    void check(); return () => { canceled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [refresh]);
  return <div className="space-y-4"><p role="status">{state === "confirmed" ? `Abonnement ${plan} de test synchronisé avec le prestataire.` : state === "error" ? "Impossible de vérifier ton abonnement pour le moment." : state === "waiting" ? "La confirmation n’est pas encore arrivée. Tu peux actualiser ou consulter ton abonnement." : "Confirmation du prestataire en cours. Tes droits seront mis à jour après vérification de l’abonnement."}</p><p className="text-sm text-muted-foreground">Cette page n’active aucun plan. Un retour du checkout ou un paramètre dans l’URL ne prouve pas qu’un paiement a été confirmé.</p><Button variant="outline" onClick={() => { setState("pending"); setRefresh((value) => value + 1); }}>Vérifier à nouveau</Button><Link href="/dashboard/settings/subscription" className="block underline">Consulter mon abonnement</Link></div>;
}
