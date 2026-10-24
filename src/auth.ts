import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authLogger } from "@/server/auth/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: authLogger,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: [Google],
  pages: {
    signIn: "/login",
  },
});
