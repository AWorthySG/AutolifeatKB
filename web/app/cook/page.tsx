import Link from "next/link";

export default function CookPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Cook</h1>
      <p className="text-muted-foreground">
        Coming in Phase 2 — describe what you cooked and the bot will fuzzy-match ingredients against your inventory and
        deduct them.
      </p>
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
