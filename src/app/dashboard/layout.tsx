import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
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
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="min-w-0 space-y-1">
          <Link href="/dashboard" className="font-semibold">
            BriefPilot AI
          </Link>
          <p className="break-words text-sm text-muted-foreground">
            Bienvenue {session.user.name ?? session.user.email}
          </p>
        </div>

        <form action={logout}>
          <Button type="submit" variant="outline">
            Déconnexion
          </Button>
        </form>
      </header>

      <main>{children}</main>
    </div>
  );
}
