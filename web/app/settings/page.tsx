import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, link_code, telegram_user_id")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <section className="card space-y-2">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm">
          Signed in as <strong>{user.email}</strong>
        </p>
        <p className="text-sm">Display name: {profile?.display_name || "(not set)"}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Telegram (Phase 6)</h2>
        {profile?.telegram_user_id ? (
          <p className="text-sm">Linked to Telegram user {profile.telegram_user_id}.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Once the bot is deployed, send <code>/link {profile?.link_code}</code> in Telegram to bind your account.
            </p>
            <code className="block rounded bg-muted px-2 py-1 font-mono text-sm">{profile?.link_code}</code>
          </>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Sign out</h2>
        <form action={signOut}>
          <button type="submit" className="btn-secondary">
            Sign out
          </button>
        </form>
      </section>

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
