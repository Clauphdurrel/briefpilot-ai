import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInWithGoogle } from "@/server/actions/auth.actions";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const oauthErrors: Record<string, string> = {
  AccessDenied: "La connexion a été refusée. Tu peux réessayer avec ton compte Google.",
  OAuthAccountNotLinked: "Cette adresse utilise déjà une autre méthode de connexion.",
  OAuthSignin: "Impossible de démarrer la connexion Google. Réessaie.",
  OAuthCallback: "La connexion Google n’a pas abouti. Réessaie.",
  Configuration: "La connexion est momentanément indisponible. Réessaie plus tard.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;
  const errorMessage = typeof error === "string" && Object.hasOwn(oauthErrors, error) ? oauthErrors[error] : error ? "La connexion n’a pas abouti. Réessaie." : null;

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
            <GoogleSignInButton />
          </form>
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
