import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ShoppingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("active_household_id")
    .eq("id", user.id)
    .single();
  if (!profile?.active_household_id) redirect("/");

  const { data: rows } = await supabase
    .from("shopping_list")
    .select("id, name, quantity_wanted, unit, source, created_at")
    .eq("household_id", profile.active_household_id)
    .eq("done", false)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shopping list</h1>
      </header>

      <p className="text-sm text-muted-foreground">
        Auto-populated from items that run out or fall below their low-stock threshold. Phase 3 will add manual entries,
        check-off, and the auto-close behavior when you add things back to inventory.
      </p>

      <ul className="card divide-y divide-border">
        {rows && rows.length > 0 ? (
          rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.source.replace("_", " ")}</div>
              </div>
              <div className="text-sm">
                {r.quantity_wanted ?? ""} {r.unit ?? ""}
              </div>
            </li>
          ))
        ) : (
          <li className="py-2 text-sm text-muted-foreground">Nothing here yet.</li>
        )}
      </ul>

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
