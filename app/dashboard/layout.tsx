import type { ReactNode } from "react";

/**
 * Shared shell for all /dashboard/* routes.
 * Root layout already renders Sidebar + main; this segment is the extension point for
 * dashboard-only providers or wrappers later without touching the whole app.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="dashboard-root min-h-full w-full">{children}</div>;
}
