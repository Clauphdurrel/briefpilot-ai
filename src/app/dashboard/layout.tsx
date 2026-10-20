import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import { Button } from "@/components/ui/button";
import { logout } from "@/server/actions/auth.actions";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex-1 bg-muted/30">
      <a
        href="#dashboard-content"
        className="sr-only z-30 rounded-md bg-background p-3 focus:fixed focus:left-4 focus:top-4 focus:not-sr-only"
      >
        Aller au contenu
      </a>

      <aside className="border-b bg-background px-4 py-5 md:fixed md:inset-y-0 md:left-0 md:w-64 md:overflow-y-auto md:border-r md:border-b-0 md:py-6">
        <div className="mb-5 md:mb-8">
          <p className="text-sm text-muted-foreground">BriefPilot</p>
          <Link href="/dashboard" className="text-xl font-bold">
            BriefPilot AI
          </Link>
        </div>
        <DashboardNavigation />
      </aside>

      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Espace de travail</p>
            <p className="break-all text-xs text-muted-foreground">
              {session.user.email ?? session.user.name}
            </p>
          </div>

          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Déconnexion
            </Button>
          </form>
        </header>

        <main id="dashboard-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
