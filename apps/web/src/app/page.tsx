"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

interface Run {
  id: string;
  status: string;
  durationMs: number | null;
  triggerSource: string;
  failureClassification: string | null;
  createdAt: string;
}

interface Stats {
  totalRuns: number;
  runsToday: number;
  passed: number;
  failed: number;
  passRate: number;
  flakinessRate: number;
  activeTests: number;
  onlineAgents: number;
  devicePairs: number;
}

export default function DashboardPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    loadData();
    const es = new EventSource("http://localhost:4000/events");
    es.addEventListener("run_completed", () => loadData());
    es.addEventListener("agent_status", () => loadData());
    return () => es.close();
  }, []);

  async function loadData() {
    try {
      const [s, r] = await Promise.all([
        api.stats.dashboard.query({ projectId: PROJECT_ID }),
        api.run.list.query({ projectId: PROJECT_ID, limit: 10 }),
      ]);
      setStats(s as Stats);
      setRuns(r as Run[]);
    } catch {}
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {/* Primary metrics */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Runs" value={stats?.totalRuns ?? "—"} />
        <StatCard label="Runs Today" value={stats?.runsToday ?? "—"} />
        <StatCard
          label="Pass Rate"
          value={stats ? `${stats.passRate}%` : "—"}
          color={stats && stats.passRate >= 90 ? "emerald" : stats && stats.passRate >= 70 ? "yellow" : "red"}
        />
        <StatCard
          label="Flakiness"
          value={stats ? `${stats.flakinessRate}%` : "—"}
          color={stats && stats.flakinessRate <= 3 ? "emerald" : stats && stats.flakinessRate <= 10 ? "yellow" : "red"}
        />
        <StatCard label="Agents Online" value={stats?.onlineAgents ?? "—"} color={stats && stats.onlineAgents > 0 ? "emerald" : "zinc"} />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Tests" value={stats?.activeTests ?? "—"} />
        <StatCard label="Device Pairs" value={stats?.devicePairs ?? "—"} />
        <StatCard label="Failed" value={stats?.failed ?? "—"} color={stats && stats.failed > 0 ? "red" : "zinc"} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent runs */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400">Recent Runs</h2>
            <a href="/runs" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</a>
          </div>
          {runs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No test runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <a key={run.id} href={`/runs/${run.id}`} className="flex items-center justify-between p-3 bg-zinc-900 rounded-md hover:bg-zinc-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <span className="text-sm font-mono">{run.id.slice(0, 8)}</span>
                    {run.failureClassification && (
                      <span className="text-xs text-red-400">{run.failureClassification}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">{run.triggerSource}</span>
                    <span className="text-xs text-zinc-500">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 p-6">
            <h2 className="text-sm font-medium text-zinc-400 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <a href="/tests" className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-md text-sm transition-colors text-center">
                ✨ New Test
              </a>
              <a href="/ble" className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-md text-sm transition-colors text-center">
                ⚡ BLE Inspector
              </a>
              <a href="/pairing" className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-md text-sm transition-colors text-center">
                🔗 Pairing Stats
              </a>
              <a href={`http://localhost:4000/api/export/csv?projectId=${PROJECT_ID}`} className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-md text-sm transition-colors text-center">
                📊 Export CSV
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 p-6">
            <h2 className="text-sm font-medium text-zinc-400 mb-4">Agent Status</h2>
            {stats && stats.onlineAgents > 0 ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm">{stats.onlineAgents} agent(s) online</span>
              </div>
            ) : (
              <div className="text-zinc-500 text-sm space-y-2">
                <p>No agents connected.</p>
                <div className="p-3 bg-zinc-900 rounded-md">
                  <code className="text-xs text-emerald-400 break-all">
                    go run ./cmd/agent --agent-id=&lt;id&gt; --project-id={PROJECT_ID}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const textColors: Record<string, string> = {
    emerald: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    zinc: "text-zinc-100",
  };
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${textColors[color ?? "zinc"]}`}>{value}</p>
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
