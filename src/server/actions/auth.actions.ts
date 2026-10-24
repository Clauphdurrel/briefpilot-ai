"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function signInWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/dashboard" });
  } catch (error) {
    // Raw Auth.js actions may throw AuthError with sensitive nested causes.
    // Keep these out of Next's unhandled-error logger; preserve redirects.
    if (error instanceof AuthError) redirect("/login?error=OAuthSignin");
    throw error;
  }
}

export async function logout() {
  try {
    await signOut({ redirectTo: "/login" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=Configuration");
    throw error;
  }
}
