import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewQuestForm } from "./new-quest-form";

export default async function NewQuestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create a Quest</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Anything you want to track — the possibilities are open-ended.
        </p>
        <NewQuestForm />
      </div>
    </div>
  );
}
