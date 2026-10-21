"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-3"><p>Impossible de charger les consommations. Réessaie dans quelques instants.</p><button onClick={reset} className="rounded-lg border px-4 py-2">Réessayer</button></div>; }
