import { redirect } from "next/navigation";
import { domainOptions } from "@/lib/domains";
import { createClient } from "@/lib/supabase/server";
import { completeSetup } from "./actions";

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
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          You&apos;ll set up your first goals in the next step. Every area you
          add contributes to your overall rank.
        </p>

        <ul className="mt-6 space-y-3">
          {domainOptions.map((domain) => (
            <li
              key={domain.id}
              className={`rounded-lg border p-4 ${
                domain.available
                  ? "border-zinc-300 dark:border-zinc-700"
                  : "border-zinc-200 opacity-60 dark:border-zinc-800"
              }`}
            >
              <p className="font-medium">
                {domain.label}
                {!domain.available && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    Coming later
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{domain.description}</p>
            </li>
          ))}
        </ul>

        <form action={completeSetup}>
          <button
            type="submit"
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-6 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
