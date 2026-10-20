import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    title: "01 · Cadrer le besoin",
    description:
      "Rassembler la demande initiale, les objectifs et les informations à clarifier avec le client.",
  },
  {
    title: "02 · Structurer le projet",
    description:
      "Organiser les pages, les fonctionnalités et les contraintes dans un cahier des charges exploitable.",
  },
  {
    title: "03 · Préparer les tâches",
    description:
      "Décomposer le travail en étapes concrètes pour préparer le backlog et les prompts Codex.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b">
        <nav
          aria-label="Navigation principale"
          className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5"
        >
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileText aria-hidden="true" className="size-5" />
            BriefPilot AI
          </Link>
          <Button asChild variant="outline">
            <Link href="/login">Se connecter</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 sm:py-24">
        <section aria-labelledby="welcome-title" className="max-w-3xl space-y-6">
          <Badge variant="secondary">Pour les développeurs et les agences</Badge>
          <h1
            id="welcome-title"
            className="text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            Un projet clair commence par un brief structuré.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            BriefPilot AI a pour objectif de transformer les demandes de tes
            clients en cahiers des charges, fonctionnalités et tâches de
            développement. Un espace pour préparer tes projets avant de coder.
          </p>
          <Button asChild size="lg">
            <Link href="/login">
              Accéder à mon espace
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>

        <section aria-labelledby="workflow-title" className="mt-16 space-y-6">
          <h2 id="workflow-title" className="text-2xl font-semibold tracking-tight">
            Du besoin client au plan de travail
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.title}>
                <CardHeader>
                  <CardTitle><h3>{step.title}</h3></CardTitle>
                </CardHeader>
                <CardContent className="leading-relaxed text-muted-foreground">
                  {step.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        BriefPilot AI · Du besoin client au projet structuré.
      </footer>
    </div>
  );
}
