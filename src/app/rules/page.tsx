"use client";

import Link from "next/link";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// PRD "2. Rules & Warning": user must acknowledge before proceeding to signup.
const rules = [
  "You're responsible for setting realistic and achievable goals.",
  "The platform is designed to encourage consistency and discipline.",
  "Don't create unrealistic or harmful goals just to increase your rank.",
  "Missing a goal may affect your progress, streak, or rank depending on the system's rules.",
  "Financial information you enter is for personal tracking and organization only — it is not financial advice.",
  "Review your goals and information carefully before starting.",
];

export default function RulesPage() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Rules &amp; Warning</h1>
        <p className="mt-3 text-muted-foreground">
          Before you continue, please read and understand the following.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-foreground/90">
          {rules.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <label className="mt-8 flex items-start gap-3 text-sm">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            className="mt-0.5"
          />
          <span>I have read and understand these rules.</span>
        </label>

        <Link
          href="/signup"
          aria-disabled={!acknowledged}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-6 h-12 w-full",
            !acknowledged && "pointer-events-none bg-muted text-muted-foreground",
          )}
        >
          I Understand &amp; Continue
        </Link>
      </div>
    </div>
  );
}
