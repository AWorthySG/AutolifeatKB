"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHousehold, joinHouseholdByInvite, rotateInviteCode, setActiveHousehold } from "@/app/actions/household";

interface Membership {
  household_id: string;
  role: string;
  household: { id: string; name: string; owner_user_id: string; invite_code: string };
}

export function HouseholdManager({
  memberships,
  activeHouseholdId,
  currentUserId,
}: {
  memberships: Membership[];
  activeHouseholdId: string | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [newName, setNewName] = useState("");

  function withTransition(fn: () => Promise<unknown>) {
    startTransition(async () => {
      setFeedback(null);
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <h2 className="font-semibold">Your households</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren&apos;t in any household yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {memberships.map((m) => {
              const isActive = m.household_id === activeHouseholdId;
              const isOwner = m.household.owner_user_id === currentUserId;
              return (
                <li key={m.household_id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">
                      {m.household.name}{" "}
                      {isActive ? <span className="ml-1 text-xs text-muted-foreground">(active)</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      role: {m.role}
                      {isOwner ? " · invite: " : ""}
                      {isOwner ? <code>{m.household.invite_code}</code> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isActive ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={isPending}
                        onClick={() =>
                          withTransition(async () => {
                            const r = await setActiveHousehold(m.household_id);
                            if (!r.ok) setFeedback(r.error);
                          })
                        }
                      >
                        Switch
                      </button>
                    ) : null}
                    {isOwner ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={isPending}
                        onClick={() =>
                          withTransition(async () => {
                            const r = await rotateInviteCode(m.household_id);
                            if (!r.ok) setFeedback(r.error);
                            else setFeedback(`New invite code: ${r.data.inviteCode}`);
                          })
                        }
                      >
                        Rotate code
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Join a household</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            withTransition(async () => {
              const r = await joinHouseholdByInvite(inviteCode);
              if (!r.ok) setFeedback(r.error);
              else {
                setFeedback("Joined.");
                setInviteCode("");
              }
            });
          }}
        >
          <input
            className="input flex-1"
            placeholder="Invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            disabled={isPending}
          />
          <button type="submit" className="btn-primary" disabled={isPending || inviteCode.length === 0}>
            Join
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Create another household</h2>
        <p className="text-xs text-muted-foreground">
          Useful if you also manage e.g. your parents&apos; fridge. You&apos;ll become its owner.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            withTransition(async () => {
              const r = await createHousehold(newName);
              if (!r.ok) setFeedback(r.error);
              else {
                setFeedback("Household created.");
                setNewName("");
              }
            });
          }}
        >
          <input
            className="input flex-1"
            placeholder="e.g. Parents' place"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            disabled={isPending}
          />
          <button type="submit" className="btn-primary" disabled={isPending || newName.trim().length === 0}>
            Create
          </button>
        </form>
      </section>

      {feedback ? <p className="text-sm">{feedback}</p> : null}
    </div>
  );
}
