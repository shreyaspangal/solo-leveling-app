import { Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, PanelHeader } from "@/components/ui/card";

// PRD "1. Welcome Screen": briefly explain the concept before rules/signup.
// ADR-007 panel-wiring pass: matches the reference's `phase === "welcome"`
// screen -- a single centered bracket panel with a PHead (icon Zap, "⟨
// System ⟩ Notification"), not a bare centered column. The reference also
// runs a `.scanline` animated light-sweep across this panel; deliberately
// not added here -- it's an ambient decorative loop, not one of ADR-007's
// two scoped-in animated components, and the ADR's own "animate every
// entrance the reference animates" alternative was already rejected for
// the same reason (novelty investment this project's hypothesis explicitly
// defers). A silent-but-considered cut, not an oversight.
//
// Audit finding U31: unlike login/signup/rules/setup, this panel's label
// ("⟨ System ⟩ Notification") is chrome, not the page's actual subject --
// "Individual Development System" is. PanelHeader defaults to `as="h2"`
// precisely so a page can decide which heading is real; this is the one
// screen so far that needs the non-default choice.
export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <Card brackets>
          <PanelHeader icon={Zap}>⟨ System ⟩ Notification</PanelHeader>
          <div className="p-6 text-center">
            <p className="font-heading text-xs tracking-[3px] text-secondary uppercase">
              You have been selected as a Player
            </p>
            <h1 className="mt-1.5 font-heading text-2xl text-foreground [text-shadow:0_0_18px_var(--primary)]">
              Individual Development System
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              An individual development dashboard for real-life consistency —
              track daily goals across Quests, Spirituality, and Learning, and
              watch your rank climb from{" "}
              <span className="text-primary">E → D → C → B → A → S</span> as
              you stay consistent.
            </p>

            <ul className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
              <li>• How personal development is tracked, day by day</li>
              <li>• How daily goals and quests work</li>
              <li>• How the ranking system works (E → D → C → B → A → S)</li>
              <li>• How consistency affects your progression</li>
            </ul>

            <Button asChild size="lg" className="mt-8 h-12 w-full">
              <Link href="/rules">Get Started</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
