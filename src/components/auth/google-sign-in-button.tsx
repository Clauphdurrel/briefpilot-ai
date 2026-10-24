"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
    {pending ? "Redirection vers Google…" : "Continuer avec Google"}
  </Button>;
}
