import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { logout } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">BriefPilot AI</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        <form action={logout}>
          <Button type="submit" variant="outline">
            Déconnexion
          </Button>
        </form>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">
          Bienvenue {session.user.name ?? session.user.email}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Ton espace BriefPilot AI est prêt. La prochaine étape sera de créer le
          module projets.
        </p>
      </section>
    </main>
  );
}
