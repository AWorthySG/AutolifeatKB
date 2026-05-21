import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddForm } from "./add-form";

export default async function AddPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Add items</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Type what you bought in plain English. Receipt and fridge-photo uploads are coming in a later phase.
        </p>
      </header>

      <AddForm />

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
