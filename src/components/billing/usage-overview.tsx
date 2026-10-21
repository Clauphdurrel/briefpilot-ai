import { resourceLabels } from "@/config/plans";
import type { getUsage } from "@/server/services/usage.service";
export function UsageOverview({ usage }: { usage: Awaited<ReturnType<typeof getUsage>>["usage"] }) {
  return <div className="grid gap-4 sm:grid-cols-2">{usage.map((row) => <section key={row.resource} className="rounded-xl border p-5"><h2 className="font-medium">{resourceLabels[row.resource]}</h2><p className="my-2 text-sm">{row.used} utilisé(s){row.reserved > 0 ? ` · ${row.reserved} en cours` : ""} · {row.limit === null ? "Sans limite de plan" : `${row.limit} autorisé(s)`}</p>{row.limit !== null && <><progress aria-label={resourceLabels[row.resource]} className="h-2 w-full accent-primary" value={Math.min(row.used + row.reserved, row.limit)} max={Math.max(1, row.limit)} /><p className="mt-2 text-xs text-muted-foreground">{row.remaining} restant(s){row.resource === "ACTIVE_PROJECTS" ? " · Les projets archivés sont exclus." : " sur la période."}</p></>}</section>)}</div>;
}
