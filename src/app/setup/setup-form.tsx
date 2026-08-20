"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeSetup } from "./actions";

// Timezone is set on the hidden input at submit time, not rendered into the
// initial HTML -- Intl.DateTimeFormat().resolvedOptions().timeZone reflects
// the browser's timezone, which the server can't know during SSR, and
// setting it during render would risk a hydration mismatch if the SSR pass
// (running on the server, in whatever timezone that process has) disagreed.
// ADR-006.
export function SetupForm() {
  const timezoneRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={completeSetup}
      onSubmit={() => {
        if (timezoneRef.current) {
          timezoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
      }}
    >
      <Input ref={timezoneRef} type="hidden" name="timezone" />
      <Button type="submit" size="lg" className="mt-8 h-12 w-full">
        Continue
      </Button>
    </form>
  );
}
