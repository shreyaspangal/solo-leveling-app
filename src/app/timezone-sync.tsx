"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Audit finding P1-6: /setup captures the user's timezone only once, at
// onboarding. An account that completed setup before this existed (or
// whose browser's timezone changes, e.g. travel) would otherwise stay on
// ADR-006's UTC fallback permanently, silently reproducing the exact
// day-boundary bug the ADR exists to fix -- with no path back to correct
// once setup is behind them. This opportunistically captures/refreshes it
// on any authenticated page it's mounted on, not just at setup.
//
// Renders nothing; only writes when the stored value differs from the
// detected one, so it's a no-op read-and-compare on every other visit.
export function TimezoneSync() {
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && user.user_metadata?.timezone !== detected) {
        supabase.auth.updateUser({ data: { timezone: detected } });
      }
    });
  }, []);

  return null;
}
