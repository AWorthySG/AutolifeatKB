"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AddItemsSchema, runTextPrompt } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/utils";

const InputSchema = z.object({ message: z.string().min(1).max(2000) });

export type AddFromTextResult =
  | { ok: true; added: { name: string; quantity: number; unit: string }[] }
  | { ok: false; error: string };

export async function addFromText(message: string): Promise<AddFromTextResult> {
  const parsed = InputSchema.safeParse({ message });
  if (!parsed.success) {
    return { ok: false, error: "Message required (max 2000 chars)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("users")
    .select("active_household_id")
    .eq("id", user.id)
    .single();
  if (!profile?.active_household_id) {
    return { ok: false, error: "No active household" };
  }
  const householdId = profile.active_household_id;

  let llmResult: z.infer<typeof AddItemsSchema>;
  try {
    llmResult = await runTextPrompt("parse-add-text", { message }, AddItemsSchema);
  } catch (err) {
    return { ok: false, error: `Could not parse: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (llmResult.items.length === 0) {
    return { ok: false, error: "No food items recognized in that message." };
  }

  const added: { name: string; quantity: number; unit: string }[] = [];

  for (const item of llmResult.items) {
    const normalized = normalizeName(item.name);

    const { data: existing } = await supabase
      .from("items")
      .select("id, quantity, unit")
      .eq("household_id", householdId)
      .eq("normalized_name", normalized)
      .gt("quantity", 0)
      .maybeSingle();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + item.expires_in_days);

    if (existing && existing.unit === item.unit) {
      await supabase
        .from("items")
        .update({ quantity: Number(existing.quantity) + item.quantity })
        .eq("id", existing.id);
    } else {
      await supabase.from("items").insert({
        household_id: householdId,
        created_by_user_id: user.id,
        name: item.name,
        normalized_name: normalized,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        expires_at: expiresAt.toISOString().slice(0, 10),
        low_threshold: item.low_threshold,
        typical_purchase_quantity: item.typical_purchase_quantity,
      });
    }

    added.push({ name: item.name, quantity: item.quantity, unit: item.unit });
  }

  await supabase.from("events").insert({
    household_id: householdId,
    actor_user_id: user.id,
    kind: "add",
    raw_text: message,
    payload_json: { items: llmResult.items },
    llm_response: llmResult,
  });

  revalidatePath("/inventory");
  revalidatePath("/");

  return { ok: true, added };
}
