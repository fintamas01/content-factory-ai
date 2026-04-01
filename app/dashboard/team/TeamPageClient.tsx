"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  UserMinus,
  Copy,
  Check,
  Mail,
  Shield,
  Crown,
  User,
  Sparkles,
  X,
  Link2,
} from "lucide-react";
import { cn } from "@/app/lib/cn";
import {
  canInvite,
  canRemoveMember,
  parseClientRole,
  type ClientRole,
} from "@/lib/clients/roles";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  email: string | null;
  createdAt: string;
  isYou: boolean;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  createdAt: string;
};

function initialsFromEmail(email: string | null, userId: string): string {
  if (email && email.includes("@")) {
    const local = email.split("@")[0]?.trim() ?? "";
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    if (local.length === 1) return (local + local).toUpperCase();
  }
  return userId.replace(/-/g, "").slice(0, 2).toUpperCase() || "??";
}

function formatJoined(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function RoleBadge({ role }: { role: ClientRole | string }) {
  const r = typeof role === "string" ? parseClientRole(role) ?? "member" : role;
  const config = {
    owner: {
      label: "Owner",
      className:
        "border-amber-400/35 bg-amber-500/[0.12] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
      icon: Crown,
    },
    admin: {
      label: "Admin",
      className:
        "border-violet-400/30 bg-violet-500/[0.12] text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
      icon: Shield,
    },
    member: {
      label: "Member",
      className:
        "border-white/[0.12] bg-white/[0.06] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      icon: User,
    },
  }[r];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        config.className
      )}
    >
      <Icon className="h-3 w-3 opacity-90" aria-hidden />
      {config.label}
    </span>
  );
}

export function TeamPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<ClientRole | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [inviteHighlight, setInviteHighlight] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/clients/team", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Failed to load team.");
      setLoading(false);
      return;
    }
    setMyRole(parseClientRole(data.myRole));
    setMembers(Array.isArray(data.members) ? data.members : []);
    setInvites(Array.isArray(data.invites) ? data.invites : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const token = searchParams.get("invite");
    if (!token) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      const res = await fetch("/api/clients/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!cancelled) {
          setError(typeof data?.error === "string" ? data.error : "Could not accept invite.");
        }
        setBusy(false);
        return;
      }
      router.replace("/dashboard/team");
      router.refresh();
      await load();
      setInviteHighlight(true);
      setTimeout(() => setInviteHighlight(false), 2400);
      setBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, load]);

  const submitInvite = async () => {
    if (!canInvite(myRole ?? "member")) return;
    const email = inviteEmail.trim();
    if (!email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Invite failed.");
      setBusy(false);
      return;
    }
    setInviteEmail("");
    await load();
    setBusy(false);
  };

  const removeMember = async (userId: string, targetRole: string, isYou: boolean) => {
    const tr = parseClientRole(targetRole);
    const ar = myRole;
    if (!tr || !ar) return;
    if (!isYou && !canRemoveMember(ar, tr)) return;
    const msg = isYou
      ? "Leave this workspace? You will lose access until invited again."
      : "Remove this member from the workspace?";
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients/team/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Could not remove.");
      setBusy(false);
      return;
    }
    await load();
    if (isYou) {
      router.refresh();
    }
    setBusy(false);
  };

  const copyLink = async (token: string) => {
    const path = `/dashboard/team?invite=${encodeURIComponent(token)}`;
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const canManage = myRole && canInvite(myRole);
  const soloWorkspace = members.length === 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-[24px] bg-white/[0.04] ring-1 ring-white/[0.06]" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
              </div>
              <div className="h-7 w-20 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-[13px] text-rose-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-lg p-1 text-rose-200/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {inviteHighlight ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-[13px] font-medium text-emerald-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          You joined this workspace. Welcome to the team.
        </div>
      ) : null}

      {/* Invite — primary, uncluttered */}
      {canManage ? (
        <section
          className={cn(
            "relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] transition-[box-shadow,border-color] duration-300",
            "ring-1 ring-white/[0.04]"
          )}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-[15px] font-semibold tracking-tight">Invite someone</h2>
              </div>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/45">
                We&apos;ll create a secure link. Share it with your teammate — no email from us in
                this version.
              </p>
            </div>
          </div>

          <div className="relative mt-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="team-invite-email"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/35"
              >
                Work email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="team-invite-email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitInvite();
                    }
                  }}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/[0.1] bg-black/35 py-2.5 pl-10 pr-3 text-[13px] text-white shadow-inner outline-none ring-0 transition placeholder:text-white/30 focus:border-cyan-400/35 focus:bg-black/45"
                />
              </div>
            </div>
            <div className="w-full lg:w-[160px]">
              <label
                htmlFor="team-invite-role"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/35"
              >
                Role
              </label>
              <select
                id="team-invite-role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value === "admin" ? "admin" : "member")
                }
                className="w-full cursor-pointer rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2.5 text-[13px] text-white outline-none transition focus:border-cyan-400/35"
              >
                <option value="member">Member — use tools</option>
                <option value="admin">Admin — manage team</option>
              </select>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitInvite()}
              className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-[13px] font-semibold text-cyan-950 shadow-[0_16px_40px_-24px_rgba(34,211,238,0.75)] transition hover:bg-cyan-300 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Link2 className="h-4 w-4 opacity-90" />
                  Create invite
                </>
              )}
            </button>
          </div>
        </section>
      ) : null}

      {/* Solo hint */}
      {canManage && soloWorkspace ? (
        <p className="text-center text-[13px] text-white/40">
          You&apos;re solo in this workspace — invite a teammate to collaborate.
        </p>
      ) : null}

      {/* Members */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">
              People
            </h2>
            <p className="mt-1 text-[13px] text-white/45">
              {members.length} {members.length === 1 ? "person" : "people"} with access
            </p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.12] bg-white/[0.02] px-8 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/35">
              <User className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-4 text-[15px] font-medium text-white/80">No members yet</p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-white/40">
              Something went wrong loading this workspace. Try refreshing the page.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const role = parseClientRole(m.role) ?? "member";
              const joined = formatJoined(m.createdAt);
              return (
                <li key={m.id}>
                  <div
                    className={cn(
                      "group flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition duration-200 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                      "hover:border-white/[0.12] hover:bg-white/[0.035]"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.04] text-[12px] font-bold tracking-tight text-white/90 ring-1 ring-white/[0.08]"
                        aria-hidden
                      >
                        {initialsFromEmail(m.email, m.userId)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[14px] font-medium text-white/95">
                            {m.email ?? `Member ${m.userId.slice(0, 8)}…`}
                          </span>
                          {m.isYou ? (
                            <span className="shrink-0 rounded-md border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200/90">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[12px] text-white/38">
                          {joined ? `Joined ${joined}` : "Member"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <RoleBadge role={role} />
                      {myRole &&
                      (m.isYou ||
                        canRemoveMember(myRole, parseClientRole(m.role) ?? "member")) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeMember(m.userId, m.role, m.isYou)}
                          className={cn(
                            "rounded-xl px-3 py-2 text-[12px] font-semibold transition",
                            m.isYou
                              ? "text-white/50 hover:bg-white/[0.06] hover:text-white/85"
                              : "text-rose-300/80 opacity-90 hover:bg-rose-500/10 hover:text-rose-200"
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {m.isYou ? (
                              <UserMinus className="h-3.5 w-3.5" />
                            ) : null}
                            {m.isYou ? "Leave" : "Remove"}
                          </span>
                        </button>
                      ) : (
                        <span className="w-16 sm:w-20" aria-hidden />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pending invites */}
      {canManage && invites.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">
            Pending invites
          </h2>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-white/90">{inv.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <RoleBadge role={inv.role === "admin" ? "admin" : "member"} />
                    <span className="text-[11px] text-white/35">Awaiting acceptance</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => copyLink(inv.token)}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-semibold transition",
                    copiedToken === inv.token
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-white/85 hover:border-cyan-400/25 hover:bg-cyan-500/10"
                  )}
                >
                  {copiedToken === inv.token ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedToken === inv.token ? "Link copied" : "Copy link"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
