// Display-only config for the 5 areas shown during onboarding (PRD "5.
// First-Time Setup"). Not a stored preference: per ADR-002, a domain with
// zero goals is simply absent from `dailyCompletion`'s active_goals set, so
// "which domains a user opted into" needs no dedicated column -- it's
// entirely implied by which goals they go on to create. All 5 are shown
// here for the full onboarding picture (per the PRD) even though only
// Quests has a route that can actually create a goal today.
//
// Audit finding U23: `available` must describe what a user can DO today,
// not what ADR-001's data model could eventually support. Spirituality and
// Learning's Goal rows would validate fine (ADR-001), but the only
// goal-creation route is /quests/new, hardcoded to domain "quest" --  so
// until Phase 2 gives them their own route, they're exactly as unavailable
// as Finance/Fitness, and this flag says so.
export interface DomainOption {
  id: "spirituality" | "finance" | "fitness" | "learning" | "quest";
  label: string;
  description: string;
  available: boolean;
}

export const domainOptions: DomainOption[] = [
  {
    id: "quest",
    label: "Quests / Goals",
    description: "Anything personal you want to track — the catch-all module.",
    available: true,
  },
  {
    id: "spirituality",
    label: "Spirituality",
    description: "Scripture, prayer, meditation, gratitude, and other practices you define.",
    available: false,
  },
  {
    id: "learning",
    label: "Learning",
    description: "Skills, courses, study — anything you want to learn.",
    available: false,
  },
  {
    id: "finance",
    label: "Finance",
    description: "Loans, expenses, savings. Coming in a later phase.",
    available: false,
  },
  {
    id: "fitness",
    label: "Fitness / Gym",
    description: "Meals, workouts, measurements. Coming in a later phase.",
    available: false,
  },
];
