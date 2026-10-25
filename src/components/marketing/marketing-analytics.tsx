"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { trackMarketingEvent } from "@/server/actions/marketing.actions";
import type { MarketingEventInput } from "@/server/marketing/analytics";
const storageKey = "briefpilot-marketing-consent-v1",
  change = "briefpilot-marketing-consent";
let memory: string | null = null;
function snapshot() {
  try {
    return localStorage.getItem(storageKey) ?? memory;
  } catch {
    return memory;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(change, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(change, callback);
    window.removeEventListener("storage", callback);
  };
}
function choose(value: "granted" | "denied") {
  memory = value;
  try {
    localStorage.setItem(storageKey, value);
  } catch {}
  window.dispatchEvent(new Event(change));
}
export function MarketingAnalytics({
  enabled,
  page,
}: {
  enabled: boolean;
  page: MarketingEventInput["page"];
}) {
  const consent = useSyncExternalStore(
    subscribe,
    () => (enabled ? snapshot() : null),
    () => null,
  );
  const view = useRef<{ page: string; id: string; sent: Set<string> } | null>(
    null,
  );
  useEffect(() => {
    if (
      !enabled ||
      consent !== "granted" ||
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl
    )
      return;
    let anonymousId = crypto.randomUUID();
    try {
      const existing = sessionStorage.getItem("briefpilot-marketing-session");
      if (existing && /^[a-f0-9-]{36}$/.test(existing))
        anonymousId =
          existing as `${string}-${string}-${string}-${string}-${string}`;
      else sessionStorage.setItem("briefpilot-marketing-session", anonymousId);
    } catch {}
    if (!view.current || view.current.page !== page)
      view.current = { page, id: crypto.randomUUID(), sent: new Set() };
    const { id: viewId, sent } = view.current;
    function send(
      event: MarketingEventInput["event"],
      placement: MarketingEventInput["placement"],
    ) {
      if (snapshot() !== "granted" || sent.has(`${event}:${placement}`)) return;
      sent.add(`${event}:${placement}`);
      void trackMarketingEvent({
        consent: true,
        anonymousId,
        viewId,
        event,
        page,
        placement,
      }).catch(() => {});
    }
    if (page === "home") send("landing_viewed", "page");
    if (page === "pricing") send("pricing_viewed", "page");
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[data-marketing-signup]")
          : null;
      if (!target) return;
      const placement = target.dataset
        .marketingSignup as MarketingEventInput["placement"];
      if (!["header", "hero", "pricing", "final", "footer"].includes(placement))
        return;
      if (target.hasAttribute("data-marketing-hero"))
        send("hero_cta_clicked", "hero");
      send("signup_started", placement);
    };
    document.addEventListener("click", click);
    const pricing = document.getElementById("tarifs");
    const observer = pricing
      ? new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting))
              send("pricing_viewed", "pricing");
          },
          { threshold: 0.15 },
        )
      : null;
    if (pricing) observer?.observe(pricing);
    return () => {
      document.removeEventListener("click", click);
      observer?.disconnect();
    };
  }, [enabled, consent, page]);
  if (!enabled) return null;
  return (
    <aside
      className="mk-analytics"
      aria-label="Préférences des statistiques marketing"
    >
      <div className="mk-analytics-inner">
        <p>
          {consent === "granted"
            ? "Statistiques de navigation autorisées."
            : "Autoriser les statistiques de navigation pour améliorer cette vitrine ? Aucun texte de projet collecté."}{" "}
          <Link href="/privacy">En savoir plus</Link>
        </p>
        {consent !== "granted" && (
          <button onClick={() => choose("granted")} type="button">
            Autoriser
          </button>
        )}
        <button
          onClick={() => {
            choose("denied");
            try {
              sessionStorage.removeItem("briefpilot-marketing-session");
            } catch {}
          }}
          type="button"
        >
          {consent === "granted" ? "Retirer mon accord" : "Refuser"}
        </button>
      </div>
    </aside>
  );
}
