import Link from "next/link";
import { Button } from "@/components/ui/button";

// PRD "1. Welcome Screen": briefly explain the concept before rules/signup.
export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Solo Leveling</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          An individual development dashboard for real-life consistency —
          track daily goals across Quests, Spirituality, and Learning, and
          watch your rank climb from E to S as you stay consistent.
        </p>

        <ul className="mt-8 space-y-2 text-left text-sm text-muted-foreground">
          <li>• How personal development is tracked, day by day</li>
          <li>• How daily goals and quests work</li>
          <li>
            • How the ranking system works (E → D → C → B → A → S)
          </li>
          <li>• How consistency affects your progression</li>
        </ul>

        <Button asChild size="lg" className="mt-10 h-12 w-full">
          <Link href="/rules">Get Started</Link>
        </Button>
      </div>
    </div>
  );
}
