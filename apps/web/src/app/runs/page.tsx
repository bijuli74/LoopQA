"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

interface Run {
  id: string;
  testId: string;
  status: string;
  triggerSource: string;
  durationMs: number | null;
  failureClassification: string | null;
  stepResults: any[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);

  useEffect(() => {
    loadRuns();

    // Auto-refresh every 5s
    const interval = setInterval(loadRuns, 5000);

    // SSE for instant updates
    const es = new EventSource("http://localhost:4000/events");
    es.addEventListener("run_completed", () => loadRuns());
    es.addEventListener("step_result", () => loadRuns());

    return () => {
      clearInterval(interval);
      es.close();
    };
  }, []);

  async function loadRuns() {
    try {
      const data = await api.run.list.query({ projectId: PROJECT_ID, limit: 50 });
      setRuns(data as Run[]);
    } catch {}
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Test Runs</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="text-left p-4 font-medium">Run ID</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Duration</th>
                <th className="text-left p-4 font-medium">Trigger</th>
                <th className="text-left p-4 font-medium">Failure</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No test runs yet.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => setSelected(run)}
                    className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${
                      selected?.id === run.id ? "bg-zinc-800/50" : "hover:bg-zinc-900"
                    }`}
                  >
                    <td className="p-4 font-mono text-xs">{run.id.slice(0, 8)}</td>
                    <td className="p-4"><StatusBadge status={run.status} /></td>
                    <td className="p-4 text-zinc-400">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="p-4 text-zinc-400">{run.triggerSource}</td>
                    <td className="p-4 text-xs text-zinc-500">{run.failureClassification ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Run detail panel */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Run Details</h2>
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500">ID</p>
                <p className="text-sm font-mono">{selected.id}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Status</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Duration</p>
                <p className="text-sm">{selected.durationMs ? `${(selected.durationMs / 1000).toFixed(1)}s` : "—"}</p>
              </div>
              {selected.failureClassification && (
                <div>
                  <p className="text-xs text-zinc-500">Failure Type</p>
                  <p className="text-sm text-red-400">{selected.failureClassification}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500 mb-2">Step Results</p>
                {selected.stepResults.length === 0 ? (
                  <p className="text-xs text-zinc-600">No step results yet</p>
                ) : (
                  <div className="space-y-1">
                    {selected.stepResults.map((sr: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-zinc-900 rounded text-xs">
                        <span className="font-mono">{sr.stepId}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">{sr.durationMs}ms</span>
                          <StatusBadge status={sr.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">Click a run to see details.</p>
          )}
        </div>
      </div>
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
    skipped: "bg-zinc-500/20 text-zinc-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors.queued}`}>
      {status}
    </span>
  );
}
