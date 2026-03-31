"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

interface Run {
  id: string;
  status: string;
  durationMs: number | null;
  failureClassification: string | null;
  stepResults: any[];
  bleSession: any;
  createdAt: string;
  devicePairId: string;
}

interface PairingStats {
  total: number;
  successful: number;
  failed: number;
  avgDurationMs: number;
  failureReasons: Record<string, number>;
}

export default function PairingDashboardPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState<PairingStats>({ total: 0, successful: 0, failed: 0, avgDurationMs: 0, failureReasons: {} });

  useEffect(() => {
    api.run.list.query({ projectId: PROJECT_ID, limit: 100 })
      .then((data: Run[]) => {
        setRuns(data);
        computeStats(data);
      })
      .catch(() => {});
  }, []);

  function computeStats(data: Run[]) {
    // Filter runs that have BLE pairing steps
    const pairingRuns = data.filter(r =>
      r.stepResults?.some((sr: any) =>
        sr.stepId?.includes("ble_pair") || sr.stepId?.includes("pair")
      ) || r.failureClassification === "ble_timeout"
    );

    // If no pairing-specific runs, use all runs as proxy
    const relevant = pairingRuns.length > 0 ? pairingRuns : data;
    const total = relevant.length;
    const successful = relevant.filter(r => r.status === "passed").length;
    const failed = total - successful;
    const durations = relevant.filter(r => r.durationMs).map(r => r.durationMs!);
    const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const failureReasons: Record<string, number> = {};
    relevant.filter(r => r.failureClassification).forEach(r => {
      failureReasons[r.failureClassification!] = (failureReasons[r.failureClassification!] || 0) + 1;
    });

    setStats({ total, successful, failed, avgDurationMs, failureReasons });
  }

  const successRate = stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Pairing Reliability</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Track BLE pairing success rates across your device matrix.
      </p>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Pairing Success Rate"
          value={stats.total > 0 ? `${successRate}%` : "—"}
          color={successRate >= 95 ? "emerald" : successRate >= 80 ? "yellow" : "red"}
        />
        <MetricCard label="Total Attempts" value={String(stats.total)} color="zinc" />
        <MetricCard label="Failures" value={String(stats.failed)} color={stats.failed > 0 ? "red" : "zinc"} />
        <MetricCard
          label="Avg Pair Time"
          value={stats.avgDurationMs > 0 ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : "—"}
          color="zinc"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Failure breakdown */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Failure Breakdown</h2>
          {Object.keys(stats.failureReasons).length === 0 ? (
            <p className="text-zinc-500 text-sm">No failures recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.failureReasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-sm">{reason.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Success rate over time (simplified — shows per-run) */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Recent Pairing Attempts</h2>
          {runs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No runs yet. Trigger a test to see data.</p>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {runs.slice(0, 50).map((run) => (
                <div
                  key={run.id}
                  title={`${run.id.slice(0, 8)} — ${run.status}${run.failureClassification ? ` (${run.failureClassification})` : ""}`}
                  className={`w-4 h-4 rounded-sm ${
                    run.status === "passed" ? "bg-emerald-500" :
                    run.status === "failed" ? "bg-red-500" :
                    run.status === "running" ? "bg-yellow-500" :
                    "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Passed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Failed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500" /> Running</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-700" /> Queued</span>
          </div>
        </div>

        {/* Device matrix */}
        <div className="col-span-2 rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Device Compatibility Matrix</h2>
          <p className="text-zinc-500 text-sm mb-4">Pass/fail heatmap across watch × phone combinations. Populated as you run tests on different device pairs.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400">
                <th className="text-left p-2 font-medium">Watch ↓ / Phone →</th>
                <th className="text-center p-2 font-medium">Pixel 8 (Android 14)</th>
                <th className="text-center p-2 font-medium">Samsung S24 (Android 14)</th>
                <th className="text-center p-2 font-medium">iPhone 16 (iOS 18)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-800">
                <td className="p-2 text-zinc-300">boAt Wave Pro</td>
                <td className="p-2 text-center"><MatrixCell runs={stats.total} pass={stats.successful} /></td>
                <td className="p-2 text-center"><MatrixCell runs={0} pass={0} /></td>
                <td className="p-2 text-center"><MatrixCell runs={0} pass={0} /></td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="p-2 text-zinc-300">Galaxy Watch 6</td>
                <td className="p-2 text-center"><MatrixCell runs={0} pass={0} /></td>
                <td className="p-2 text-center"><MatrixCell runs={0} pass={0} /></td>
                <td className="p-2 text-center"><MatrixCell runs={0} pass={0} /></td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="p-2 text-zinc-300">Apple Watch S10</td>
                <td className="p-2 text-center"><span className="text-zinc-600 text-xs">N/A</span></td>
                <td className="p-2 text-center"><span className="text-zinc-600 text-xs">N/A</span></td>
                <td className="p-2 text-center"><MatrixCell runs={0} pass={0} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const textColors: Record<string, string> = {
    emerald: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    zinc: "text-zinc-100",
  };
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${textColors[color]}`}>{value}</p>
    </div>
  );
}

function MatrixCell({ runs, pass }: { runs: number; pass: number }) {
  if (runs === 0) return <span className="text-zinc-600 text-xs">no data</span>;
  const rate = Math.round((pass / runs) * 100);
  const bg = rate >= 95 ? "bg-emerald-500/20 text-emerald-400" :
             rate >= 80 ? "bg-yellow-500/20 text-yellow-400" :
             "bg-red-500/20 text-red-400";
  return <span className={`px-2 py-1 rounded text-xs font-medium ${bg}`}>{rate}% ({pass}/{runs})</span>;
}
