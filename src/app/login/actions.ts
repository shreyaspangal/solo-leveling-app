"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInWithOAuth } from "@/lib/supabase/oauth";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export async function logInWithEmail(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function logInWithGoogle() {
  await signInWithOAuth("google", "/login?error=oauth");
}

export async function logInWithApple() {
  await signInWithOAuth("apple", "/login?error=oauth");
}
