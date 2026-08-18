"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInWithOAuth } from "@/lib/supabase/oauth";
import { createClient } from "@/lib/supabase/server";

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signUpWithEmail(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/setup");
}

export async function signUpWithGoogle() {
  await signInWithOAuth("google", "/signup?error=oauth");
}

export async function signUpWithApple() {
  await signInWithOAuth("apple", "/signup?error=oauth");
}
