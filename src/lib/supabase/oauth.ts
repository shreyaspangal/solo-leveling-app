import { redirect } from "next/navigation";
import { createClient } from "./server";

// Shared by every auth entry point (signup, login, and any future
// password-reset/auth-adjacent action) that offers Google/Apple sign-in --
// don't copy this body into a new action, import it instead.
export async function signInWithOAuth(
  provider: "google" | "apple",
  errorRedirect: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect(errorRedirect);
  }

  redirect(data.url);
}
