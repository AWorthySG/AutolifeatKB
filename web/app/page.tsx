import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, active_household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.active_household_id) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="mt-4">Your account is being set up. Refresh in a moment.</p>
      </main>
    );
  }

  const householdId = profile.active_household_id;

  const [{ data: items }, { data: shopping }, { data: events }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, quantity, unit, expires_at")
      .eq("household_id", householdId)
      .gt("quantity", 0)
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("shopping_list")
      .select("id, name, quantity_wanted, unit")
      .eq("household_id", householdId)
      .eq("done", false)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("events")
      .select("id, kind, raw_text, payload_json, actor_user_id, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Hi {profile.display_name || "there"} 👋</h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s what&apos;s happening in your fridge.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/add" className="card hover:bg-muted">
          <h2 className="font-semibold">Add items</h2>
          <p className="mt-1 text-sm text-muted-foreground">Type, photograph a receipt, or snap the fridge.</p>
        </Link>
        <Link href="/cook" className="card hover:bg-muted">
          <h2 className="font-semibold">Log a meal</h2>
          <p className="mt-1 text-sm text-muted-foreground">Deduct what you cooked.</p>
        </Link>
        <Link href="/shopping" className="card hover:bg-muted">
          <h2 className="font-semibold">Shopping list</h2>
          <p className="mt-1 text-sm text-muted-foreground">What&apos;s running low or used up.</p>
        </Link>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top of the fridge</h2>
          <Link href="/inventory" className="text-sm text-muted-foreground hover:underline">
            See all →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {items && items.length > 0 ? (
            items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2">
                <span>{it.name}</span>
                <span className="text-sm text-muted-foreground">
                  {it.quantity} {it.unit}
                </span>
              </li>
            ))
          ) : (
            <li className="py-2 text-sm text-muted-foreground">Nothing here yet. Add something →</li>
          )}
        </ul>
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Shopping list</h2>
          <Link href="/shopping" className="text-sm text-muted-foreground hover:underline">
            See all →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {shopping && shopping.length > 0 ? (
            shopping.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>{s.name}</span>
                <span className="text-sm text-muted-foreground">
                  {s.quantity_wanted ?? ""} {s.unit ?? ""}
                </span>
              </li>
            ))
          ) : (
            <li className="py-2 text-sm text-muted-foreground">Nothing on the list. ✨</li>
          )}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <ul className="mt-3 divide-y divide-border">
          {events && events.length > 0 ? (
            events.map((e) => (
              <li key={e.id} className="py-2 text-sm">
                <span className="font-medium capitalize">{e.kind.replace("_", " ")}</span>
                {e.raw_text ? <> — {e.raw_text}</> : null}
                <span className="ml-2 text-muted-foreground">{relativeTime(e.created_at)}</span>
              </li>
            ))
          ) : (
            <li className="py-2 text-sm text-muted-foreground">Nothing yet.</li>
          )}
        </ul>
      </section>

      <nav className="text-sm text-muted-foreground">
        <Link href="/household" className="hover:underline">
          Household
        </Link>
        {" · "}
        <Link href="/settings" className="hover:underline">
          Settings
        </Link>
      </nav>
    </main>
  );
}
