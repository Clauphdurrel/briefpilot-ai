"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, sentryOptions } from "@/lib/observability/sentry-options";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!sentryOptions("client").enabled) return;
    try { Sentry.captureEvent(scrubSentryEvent({ tags: { module: "global-error", errorCode: "UNEXPECTED_ERROR" } })); }
    catch { /* Reporting must not break the recovery screen. */ }
  }, [error]);
  return <html lang="fr"><body><main style={{ margin: "4rem auto", maxWidth: "36rem", padding: "1.5rem", fontFamily: "sans-serif" }}>
    <h1>Une erreur est survenue</h1><p>Le service est momentanément indisponible. Réessaie dans quelques instants.</p>
    <button type="button" onClick={reset}>Réessayer</button>
  </main></body></html>;
}
