import { redirect } from "next/navigation";

// Slice 4 folded this page's content into /dashboard (the real Home
// Dashboard v1) -- see src/app/dashboard/page.tsx. Kept as a redirect
// rather than deleted so any stale bookmark/link to /quests still lands
// somewhere real, instead of 404ing.
export default function QuestsPage() {
  redirect("/dashboard");
}
