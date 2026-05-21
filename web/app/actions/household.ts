"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const InviteCodeSchema = z.string().trim().min(4).max(32);

export async function joinHouseholdByInvite(rawCode: string): Promise<ActionResult<{ householdId: string }>> {
  const parsed = InviteCodeSchema.safeParse(rawCode);
  if (!parsed.success) return { ok: false, error: "Invalid invite code" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_household_by_invite", {
    p_invite_code: parsed.data,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/household");
  return { ok: true, data: { householdId: data as string } };
}

export async function setActiveHousehold(householdId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_household", { p_household_id: householdId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/household");
  return { ok: true, data: undefined };
}

export async function rotateInviteCode(householdId: string): Promise<ActionResult<{ inviteCode: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_invite_code", { p_household_id: householdId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/household");
  return { ok: true, data: { inviteCode: data as string } };
}

const HouseholdNameSchema = z.string().trim().min(1).max(60);

export async function createHousehold(name: string): Promise<ActionResult<{ householdId: string }>> {
  const parsed = HouseholdNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Name must be 1-60 characters" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Generate invite code client-side here is harder; use a single SQL call via RPC-less insert + member insert.
  const { data: hh, error: hhErr } = await supabase
    .from("households")
    .insert({
      name: parsed.data,
      owner_user_id: user.id,
      invite_code: Math.random().toString(36).slice(2, 10).toUpperCase(),
    })
    .select("id")
    .single();
  if (hhErr || !hh) return { ok: false, error: hhErr?.message ?? "Could not create household" };

  const { error: memberErr } = await supabase.from("household_members").insert({
    household_id: hh.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberErr) return { ok: false, error: memberErr.message };

  await supabase.rpc("set_active_household", { p_household_id: hh.id });

  revalidatePath("/");
  revalidatePath("/household");
  return { ok: true, data: { householdId: hh.id } };
}
