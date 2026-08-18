"use client";

import Link from "next/link";
import { useState } from "react";

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
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Before you continue, please read and understand the following.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          {rules.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <label className="mt-8 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>I have read and understand these rules.</span>
        </label>

        <Link
          href="/signup"
          aria-disabled={!acknowledged}
          className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-full px-6 font-medium transition-colors ${
            acknowledged
              ? "bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
              : "pointer-events-none bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
          }`}
        >
          I Understand &amp; Continue
        </Link>
      </div>
    </div>
  );
}
