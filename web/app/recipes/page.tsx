import Link from "next/link";

export default function RecipesPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Recipes</h1>
      <p className="text-muted-foreground">Coming in Phase 5 — save dishes you cook often and deduct ingredients in one tap.</p>
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
    </main>
  );
}
