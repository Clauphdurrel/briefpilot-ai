import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInWithGoogle } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connexion à BriefPilot AI</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connecte-toi pour créer tes projets, générer des briefs et préparer
            tes tâches Codex.
          </p>

          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full">
              Continuer avec Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
