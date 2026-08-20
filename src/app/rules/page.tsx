"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { Card, PanelHeader } from "@/components/ui/card";
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
        <Card brackets>
          <PanelHeader as="h1" icon={Shield}>
            Rules &amp; Warning
          </PanelHeader>
          <div className="p-6">
            <p className="text-muted-foreground">
              Before you continue, please read and understand the following.
            </p>

            <ul className="mt-4 space-y-1">
              {rules.map((rule, i) => (
                <li
                  key={rule}
                  className="flex gap-3 border-b border-border/50 py-2 text-sm last:border-b-0"
                >
                  <span className="min-w-[22px] font-heading text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>

            <label className="mt-6 flex items-start gap-3 text-sm">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <span>I have read and understand these rules.</span>
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                aria-disabled={!acknowledged}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 flex-1",
                  !acknowledged && "pointer-events-none opacity-40",
                )}
              >
                I Understand &amp; Continue
              </Link>
              <Link href="/welcome" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12")}>
                Back
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
