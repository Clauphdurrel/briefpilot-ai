"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function SubscriptionControls({ cancelAtPeriodEnd, accessEnded }: { cancelAtPeriodEnd: boolean; accessEnded: boolean }) {
  const router = useRouter(), running = useRef(false);
  const [pending, setPending] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  async function manage(action: "cancel" | "resume" | "portal") {
    if (running.current) return; running.current = true; setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/billing/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(35000) });
      const body = await response.json();
      if (!response.ok) { setError(response.status === 401 ? "Reconnecte-toi pour gérer ton abonnement." : "L’opération n’a pas pu être confirmée. Actualise l’abonnement avant de réessayer."); return; }
      if (action === "portal") {
        const url = new URL(body.data?.url);
        if (url.protocol !== "https:" || url.username || url.password || !/^(?:[a-z0-9-]+\.)?lemonsqueezy\.com$/.test(url.hostname)) throw new Error("Invalid portal");
        window.location.assign(url.toString());
      } else { setNotice(action === "cancel" ? "Annulation du renouvellement confirmée par le prestataire. L’accès reste valable jusqu’à son échéance." : "Reprise du renouvellement confirmée en mode test."); router.refresh(); }
    } catch { setError("Le prestataire ne répond pas. Actualise l’abonnement avant de réessayer."); }
    finally { running.current = false; setPending(false); }
  }
  return <section className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">Gérer l’abonnement de test</h2><p className="text-sm text-muted-foreground">Les moyens de paiement et les changements d’offre disponibles se gèrent dans le portail Lemon Squeezy.</p><div className="flex flex-wrap gap-3"><Button disabled={pending} variant="outline" onClick={() => void manage("portal")}>Ouvrir le portail client</Button>{!accessEnded && <Button disabled={pending} variant="outline" onClick={() => void manage(cancelAtPeriodEnd ? "resume" : "cancel")}>{cancelAtPeriodEnd ? "Reprendre le renouvellement" : "Annuler le renouvellement"}</Button>}</div>{pending && <p role="status" className="text-sm">Vérification auprès du prestataire…</p>}{notice && <p role="status" className="text-sm">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}
