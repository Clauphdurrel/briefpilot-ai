import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">Chargement de votre espace de travail…</span>
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-9 w-48 rounded bg-muted" />
      </div>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="motion-safe:animate-pulse">
            <CardHeader><div className="h-5 w-28 rounded bg-muted" /></CardHeader>
            <CardContent><div className="h-12 rounded bg-muted" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
