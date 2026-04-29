import { useCallback, useEffect, useState } from "react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

type CampaignJobRow = {
  id: string;
  status: string | null;
  product_name: string | null;
  product_price: string | null;
  created_at: string | null;
};

export function CampaignJobsTestPanel() {
  const [jobs, setJobs] = useState<CampaignJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign-jobs", { method: "GET" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJobs([]);
        setError(typeof j?.error === "string" ? j.error : "Could not load jobs.");
        return;
      }
      setJobs(Array.isArray(j?.jobs) ? (j.jobs as CampaignJobRow[]) : []);
    } catch {
      setJobs([]);
      setError("Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function createTestJob() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign-jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: "iPhone 15 Pro",
          product_image: "https://placehold.co/600x600",
          product_price: "3999 RON",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j?.error === "string" ? j.error : "Could not create job.");
        return;
      }
      await loadJobs();
    } catch {
      setError("Could not create job.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="border-white/[0.08] bg-white/[0.03]">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              Campaign Jobs (test)
            </p>
            <h3 className="mt-2 text-base font-semibold text-white">
              Temporary test panel (safe to delete)
            </h3>
            <p className="mt-1 text-sm text-white/55">
              Creates a pending job, then reloads and lists jobs for your current workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => void loadJobs()}
              disabled={loading || creating}
            >
              Refresh
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => void createTestJob()}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create test job"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
          {loading ? (
            <p className="text-sm text-white/60">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-white/60">No jobs yet.</p>
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {job.product_name ?? "Untitled product"}{" "}
                      <span className="text-white/40">
                        {job.product_price ? `· ${job.product_price}` : ""}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] font-mono text-white/40">
                      {job.id.slice(0, 10)}…{" "}
                      {job.created_at ? `· ${new Date(job.created_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-bold text-white/70">
                    {job.status ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

