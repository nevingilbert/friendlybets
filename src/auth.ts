import NextAuth, { type DefaultSession, type Session } from "next-auth";
import Google from "next-auth/providers/google";

import { getMe } from "@/lib/db/queries";
import { upsertUser } from "@/lib/db/mutations";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  isDatabaseConfigured,
  isGoogleAuthConfigured,
  isSessionSecretConfigured,
} from "@/lib/env";
import type { Me } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: {
      /** our users.id, not Google's subject */
      id: string;
    } & DefaultSession["user"];
  }
}

/**
 * Google sign-in via Auth.js — the same shape as the other apps in this folder.
 *
 * JWT sessions, no database adapter: the only thing to persist is the person, and
 * `upsert_user` does that on every sign-in. A session check therefore never touches
 * the database, which matters because every open lobby screen polls.
 *
 * The token carries our own `users.id`, so every action is attributed to a real row
 * without trusting anything the browser sends.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: isGoogleAuthConfigured()
    ? [
        Google({
          clientId: getGoogleClientId(),
          clientSecret: getGoogleClientSecret(),
          authorization: { params: { prompt: "select_account" } },
        }),
      ]
    : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  // Both land on the home page, which shows the sign-in screen and reads ?error=.
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Only on a fresh sign-in: record the person and remember our own id.
      if (account && profile) {
        const result = await upsertUser({
          googleSub:
            typeof profile.sub === "string" ? profile.sub : String(account.providerAccountId),
          email: typeof profile.email === "string" ? profile.email : "",
          name: typeof profile.name === "string" ? profile.name : "",
          avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
        });
        token.userId = result.user_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
});

/**
 * The session, or null — never a thrown configuration error. Auth.js throws when
 * AUTH_SECRET is unset, which would turn every page into a 500 and bury the actual
 * problem; the setup notice names it instead.
 */
export async function safeAuth(): Promise<Session | null> {
  if (!isSessionSecretConfigured()) return null;
  try {
    return await auth();
  } catch {
    return null;
  }
}

export async function currentUserId(): Promise<string | null> {
  const session = await safeAuth();
  return session?.user?.id ?? null;
}

/**
 * The signed-in person, or null. A valid cookie whose user row no longer exists (a
 * reset database) is treated as signed out rather than as a broken page.
 */
export async function currentUser(): Promise<Me | null> {
  if (!isDatabaseConfigured()) return null;
  const userId = await currentUserId();
  return userId ? getMe(userId) : null;
}
