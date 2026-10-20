"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle><h1>Impossible de charger cette page</h1></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Une erreur est survenue. Réessaie dans quelques instants.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}>Réessayer</Button>
          <Button asChild variant="outline"><Link href="/dashboard">Retour au dashboard</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
