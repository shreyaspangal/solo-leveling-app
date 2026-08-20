import { Target } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, PanelHeader } from "@/components/ui/card";
import { domainOptions } from "@/lib/domains";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { SetupForm } from "./setup-form";

// PRD "5. First-Time Setup": an overview of what you can track. Per ADR-002,
// which domains a user "opted into" is implied by which goals they create,
// not a stored flag -- there is nothing here for a selection to persist
// into, so (audit finding U22, owner decision 2026-08-20) these cards are
// deliberately non-interactive; the copy below describes rather than asks,
// instead of presenting a choice the screen can't accept. Finance/Fitness/
// Spirituality/Learning show "Coming later" -- only Quests has a route that
// can create a goal today (audit finding U23); ADR-004/005 (Finance/Fitness)
// and Phase 2 (Spirituality/Learning) are all still ahead.
export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <Card brackets>
          <PanelHeader as="h1" icon={Target}>
            First-Time Setup
          </PanelHeader>
          <div className="p-6">
            <p className="text-muted-foreground">
              Here&apos;s what you can track. You&apos;ll set up your first
              goals in the next step, and every area you add contributes to
              your overall rank.
            </p>

            <ul className="mt-6 space-y-3">
              {domainOptions.map((domain) => (
                <li key={domain.id}>
                  <Card className={cn("p-4", !domain.available && "opacity-60")}>
                    <p className="font-medium">
                      {domain.label}
                      {!domain.available && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Coming later
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{domain.description}</p>
                  </Card>
                </li>
              ))}
            </ul>

            <SetupForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
