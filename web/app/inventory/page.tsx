import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatQuantity } from "@/lib/utils";

const CATEGORY_ORDER = ["produce", "dairy", "meat", "seafood", "bakery", "frozen", "pantry", "condiment", "beverage", "other"];

export default async function InventoryPage() {
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

  const { data: items } = await supabase
    .from("items")
    .select("id, name, quantity, unit, category, expires_at, added_at")
    .eq("household_id", profile.active_household_id)
    .gt("quantity", 0)
    .order("expires_at", { ascending: true, nullsFirst: false });

  const grouped = new Map<string, typeof items>();
  for (const it of items ?? []) {
    const cat = it.category ?? "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(it);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Link href="/add" className="btn-primary">
          Add items
        </Link>
      </header>

      {grouped.size === 0 ? (
        <div className="card">
          <p className="text-muted-foreground">Nothing in the fridge yet.</p>
          <Link href="/add" className="btn-primary mt-3 inline-flex">
            Add the first item
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
            <section key={cat} className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h2>
              <ul className="divide-y divide-border">
                {grouped.get(cat)!.map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      {it.expires_at ? (
                        <div className="text-xs text-muted-foreground">expires {it.expires_at}</div>
                      ) : null}
                    </div>
                    <div className="text-sm">{formatQuantity(Number(it.quantity), it.unit)}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
