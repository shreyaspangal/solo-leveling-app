"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <Button type="submit" variant="outline" className="mt-6 h-11 w-full">
            Continue with Google
          </Button>
        </form>
        <form action={logInWithApple}>
          <Button type="submit" variant="outline" className="mt-3 h-11 w-full">
            Continue with Apple
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={formAction} className="space-y-3">
          {/* Audit finding U24: placeholder alone is not an accessible name --
              it disappears once typed (WCAG 3.3.2) and screen readers announce
              nothing (4.1.2/1.3.1). A real <Label> fixes both. */}
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            required
            className="h-11 rounded-lg"
          />
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            required
            className="h-11 rounded-lg"
          />

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? "Logging in…" : "Log In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
