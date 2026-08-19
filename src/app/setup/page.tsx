import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { domainOptions } from "@/lib/domains";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { SetupForm } from "./setup-form";

// PRD "5. First-Time Setup": choose which areas to track. Per ADR-002, which
// domains a user "opted into" is implied by which goals they create, not a
// stored flag -- so this step is UX guidance into Phase 1's goal-creation
// flow, not a preference write. Finance/Fitness are shown but disabled since
// their entities don't exist yet (ADR-004/005, Phase 2).
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
        <h1 className="text-2xl font-semibold tracking-tight">
          What do you want to track?
        </h1>
        <p className="mt-3 text-muted-foreground">
          You&apos;ll set up your first goals in the next step. Every area you
          add contributes to your overall rank.
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
    </div>
  );
}
