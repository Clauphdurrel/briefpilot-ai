import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authLogger } from "@/server/auth/logger";
import { captureBusinessEvent } from "@/server/observability/analytics";
import { randomUUID } from "node:crypto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: authLogger,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: [Google],
  events: {
    async signIn({ user }) {
      try { if (user.id) await captureBusinessEvent(user.id, "user_signed_in", randomUUID()); } catch { /* Analytics cannot fail sign-in. */ }
    },
  },
  pages: {
    signIn: "/login",
  },
});
