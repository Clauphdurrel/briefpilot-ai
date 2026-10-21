"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function CheckoutButton({ plan, configured }: { plan: "PRO" | "AGENCY"; configured: boolean }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const running = useRef(false);
  async function checkout() {
    if (running.current) return; running.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }), signal: AbortSignal.timeout(45000) });
      if (response.status === 401) { setError("Connecte-toi avant de choisir une offre."); return; }
      const body = await response.json();
      if (!response.ok) { setError(response.status === 409 ? "Un abonnement ou un checkout existe déjà. Consulte la gestion de ton abonnement." : "Le checkout de test est indisponible. Réessaie plus tard."); return; }
      const url = new URL(body.data?.url);
      if (!body.data?.testMode || url.protocol !== "https:" || url.username || url.password || !/^(?:[a-z0-9-]+\.)?lemonsqueezy\.com$/.test(url.hostname)) throw new Error("Invalid checkout URL");
      window.location.assign(url.toString());
    } catch { setError("Le checkout de test n’a pas pu être ouvert. Réessaie."); }
    finally { running.current = false; setPending(false); }
  }
  return <div className="space-y-2"><Button onClick={() => void checkout()} disabled={!configured || pending} variant="outline" className="w-full" aria-busy={pending}>{pending ? "Préparation du checkout…" : plan === "PRO" ? "Passer à Pro" : "Choisir Agency"}</Button><p className="text-xs text-muted-foreground">{configured ? "Checkout Lemon Squeezy en mode test uniquement." : "Paiement de test indisponible : configuration de la boutique en attente."}</p>{error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Link href="/login" className="underline">Se connecter</Link>{" · "}<Link href="/dashboard/settings/subscription" className="underline">Gérer mon abonnement</Link></div>}</div>;
}
