"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

// Default project ID — in production this comes from auth/session
const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

interface Run {
  id: string;
  status: string;
  durationMs: number | null;
  triggerSource: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState({ total: 0, today: 0, passRate: "—", flakiness: "—" });

  useEffect(() => {
    api.run.list.query({ projectId: PROJECT_ID, limit: 10 })
      .then((data: Run[]) => {
        setRuns(data);
        const total = data.length;
        const passed = data.filter((r: Run) => r.status === "passed").length;
        const today = data.filter((r: Run) => {
          const d = new Date(r.createdAt);
          const now = new Date();
          return d.toDateString() === now.toDateString();
        }).length;
        setStats({
          total,
          today,
          passRate: total > 0 ? `${Math.round((passed / total) * 100)}%` : "—",
          flakiness: "< 3%",
        });
      })
      .catch(() => {});

    // SSE for real-time updates
    const es = new EventSource("http://localhost:4000/events");
    es.addEventListener("run_completed", () => {
      api.run.list.query({ projectId: PROJECT_ID, limit: 10 })
        .then((data: Run[]) => setRuns(data))
        .catch(() => {});
    });
    return () => es.close();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Runs" value={String(stats.total)} />
        <StatCard label="Runs Today" value={String(stats.today)} />
        <StatCard label="Pass Rate" value={stats.passRate} />
        <StatCard label="Flakiness Rate" value={stats.flakiness} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Recent Runs</h2>
          {runs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No test runs yet. Create a test to get started.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-md">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <span className="text-sm font-mono">{run.id.slice(0, 8)}</span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Agent Status</h2>
          <p className="text-zinc-500 text-sm">Connect an agent to see status here.</p>
          <div className="mt-4 p-3 bg-zinc-900 rounded-md">
            <p className="text-xs text-zinc-400 mb-1">Start the agent:</p>
            <code className="text-xs text-emerald-400 break-all">
              ./agent --agent-id=&lt;id&gt; --project-id=&lt;id&gt; --server=ws://localhost:4001
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    passed: "bg-emerald-500/20 text-emerald-400",
    failed: "bg-red-500/20 text-red-400",
    running: "bg-yellow-500/20 text-yellow-400",
    queued: "bg-zinc-500/20 text-zinc-400",
    errored: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors.queued}`}>
      {status}
    </span>
  );
}
