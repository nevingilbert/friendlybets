"use client";

import { useFormStatus } from "react-dom";

import { Alert, GoogleButton } from "@/components/ui";
import { signInWithGoogle } from "@/server/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <GoogleButton type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Redirecting…" : label}
    </GoogleButton>
  );
}

/**
 * Google sign-in, shared by the landing page and the invite page.
 *
 * `redirectTo` is the path to come back to — that is what lets an invite link survive
 * the round trip through Google and land back on /join/<CODE>. `error` is a failure
 * Auth.js reported on the way back, so a broken sign-in says why instead of quietly
 * showing the button again.
 */
export function SignInButton({
  label = "Continue with Google",
  redirectTo,
  error,
}: {
  label?: string;
  redirectTo: string;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Alert>{error}</Alert>
      <form action={signInWithGoogle.bind(null, redirectTo)}>
        <Submit label={label} />
      </form>
      <p className="text-center text-xs text-zinc-500">We only ever read your name and profile picture.</p>
    </div>
  );
}
