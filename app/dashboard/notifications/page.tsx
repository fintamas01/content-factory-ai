import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import { requireActiveClientId } from "@/lib/clients/server";
import type { NotificationRow, NotificationSeverity } from "@/lib/notifications/types";
import { NotificationSettingsCard } from "@/app/components/NotificationSettingsCard";

function severityPill(sev: NotificationSeverity) {
  if (sev === "critical") return "border-red-500/25 bg-red-500/10 text-red-200";
  if (sev === "warning") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  if (sev === "success") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
}

function severityLabel(sev: NotificationSeverity) {
  if (sev === "critical") return "Urgent";
  if (sev === "warning") return "Attention";
  if (sev === "success") return "Ready";
  return "FYI";
}

function moduleLabel(source: string): string {
  if (source === "autopilot") return "AutoPilot";
  if (source === "products") return "Products";
  if (source === "audit") return "Audit";
  if (source === "sprint") return "Sprint";
  if (source === "competitor") return "Competitors";
  if (source === "playbooks") return "Playbooks";
  return "System";
}

function clip(s: string, n: number): string {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 text-white">
        <p className="text-white/60">Server configuration error.</p>
      </div>
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* ignore */
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 text-white">
        <p className="text-white/60">Please sign in.</p>
      </div>
    );
  }

  let clientId: string;
  try {
    const active = await requireActiveClientId(supabase, cookieStore, user.id);
    clientId = active.clientId;
  } catch {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 text-white">
        <p className="text-white/60">No active client.</p>
      </div>
    );
  }

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(120);

  const items = (data ?? []) as unknown as NotificationRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20 p-4 sm:p-6 lg:p-8 text-white">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
            Alerts
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Inbox
          </h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            Actionable insights across AutoPilot and Products—scoped to your active workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action="/api/notifications/read-all" method="post">
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[11px] font-semibold text-white/80 hover:border-white/20 hover:bg-white/[0.07]">
              <CheckCheck className="h-4 w-4" />
              Clear unread
            </button>
          </form>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-[11px] font-semibold text-violet-950 hover:bg-violet-400"
          >
            Command Center <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <NotificationSettingsCard />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
          <Bell className="mx-auto h-12 w-12 text-white/35" />
          <p className="mt-4 font-semibold text-white/75">Your inbox is empty</p>
          <p className="mt-2 text-sm text-white/45">
            Run AutoPilot or Product Health to surface high-signal actions here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border bg-white/[0.03] p-5 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.9)] ${
                n.is_read ? "border-white/10" : "border-violet-500/20"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${severityPill(n.severity)}`}>
                      {severityLabel(n.severity)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/55">
                      {moduleLabel(n.source_module)}
                    </span>
                    {!n.is_read ? (
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-200">
                        new
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                    {n.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {clip(n.message, 320)}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-start gap-2 sm:items-end">
                  <p className="text-[11px] font-mono text-white/40">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {!n.is_read ? (
                      <form action={`/api/notifications/${n.id}/read`} method="post">
                        <button className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/75 hover:border-white/20 hover:bg-white/[0.07]">
                          Mark seen
                        </button>
                      </form>
                    ) : null}
                    {n.action_url ? (
                      <Link
                        href={n.action_url}
                        className="rounded-xl bg-violet-500 px-3 py-2 text-[11px] font-semibold text-violet-950 hover:bg-violet-400"
                      >
                        {n.action_label || "Open"} <ArrowRight className="inline h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

