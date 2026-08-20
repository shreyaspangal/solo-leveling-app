"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpWithApple, signUpWithEmail, signUpWithGoogle } from "./actions";

// PRD "3. Account Creation" / "4. Account Authentication".
export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, {
    error: null,
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>

        <form action={signUpWithGoogle}>
          <Button type="submit" variant="outline" className="mt-6 h-11 w-full">
            Continue with Google
          </Button>
        </form>
        <form action={signUpWithApple}>
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
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Name"
            required
            className="h-11 rounded-lg"
          />
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
            minLength={8}
            className="h-11 rounded-lg"
          />

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? "Creating account…" : "Sign Up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
