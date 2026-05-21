import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HouseholdManager } from "./household-manager";

export default async function HouseholdPage() {
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

  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id, role, joined_at, household:households(id, name, owner_user_id, invite_code)")
    .eq("user_id", user.id);

  type Membership = {
    household_id: string;
    role: string;
    household: { id: string; name: string; owner_user_id: string; invite_code: string } | null;
  };

  const items: Membership[] = (memberships ?? []).map((m) => {
    const raw = m.household as unknown;
    const hh = Array.isArray(raw) ? raw[0] ?? null : (raw as Membership["household"]);
    return {
      household_id: m.household_id,
      role: m.role,
      household: hh,
    };
  });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Household</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your fridge with the people you live with. Invite them with a code; everyone sees the same inventory.
        </p>
      </header>

      <HouseholdManager
        memberships={items.filter((m): m is Membership & { household: NonNullable<Membership["household"]> } => m.household !== null)}
        activeHouseholdId={profile?.active_household_id ?? null}
        currentUserId={user.id}
      />

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
