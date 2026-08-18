"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logInWithApple, logInWithEmail, logInWithGoogle } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(logInWithEmail, {
    error: null,
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>

        <form action={logInWithGoogle}>
          <button
            type="submit"
            className="mt-6 flex h-11 w-full items-center justify-center rounded-full border border-zinc-300 px-5 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Continue with Google
          </button>
        </form>
        <form action={logInWithApple}>
          <button
            type="submit"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-zinc-300 px-5 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Continue with Apple
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          or
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form action={formAction} className="space-y-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
          />

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="flex h-11 w-full items-center justify-center rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {pending ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
