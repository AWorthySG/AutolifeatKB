"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFromText } from "@/app/actions/addFromText";

export function AddForm() {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await addFromText(message);
      if (result.ok) {
        setFeedback({
          ok: true,
          text: `Added: ${result.added.map((a) => `${a.quantity} ${a.unit} ${a.name}`).join(", ")}`,
        });
        setMessage("");
        router.refresh();
      } else {
        setFeedback({ ok: false, text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <label htmlFor="message" className="text-sm font-medium">
        What did you buy?
      </label>
      <textarea
        id="message"
        rows={4}
        className="input min-h-[100px]"
        placeholder="e.g. 2L milk, 500g chicken thighs, a dozen eggs, half a watermelon"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isPending}
        required
      />
      <button type="submit" disabled={isPending || message.trim().length === 0} className="btn-primary">
        {isPending ? "Adding..." : "Add to inventory"}
      </button>
      {feedback ? (
        <p className={`text-sm ${feedback.ok ? "text-foreground" : "text-destructive"}`}>{feedback.text}</p>
      ) : null}
    </form>
  );
}
