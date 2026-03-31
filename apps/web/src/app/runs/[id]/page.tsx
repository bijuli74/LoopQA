"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";
import { useParams } from "next/navigation";

interface StepResult {
  stepId: string;
  status: string;
  error?: string;
  durationMs: number;
}

interface BLEPacket {
  timestamp: string;
  direction: string;
  service: string;
  characteristic: string;
  value: string;
  size: number;
}

interface BLEEvent {
  timestamp: string;
  event: string;
}

interface Run {
  id: string;
  testId: string;
  status: string;
  triggerSource: string;
  durationMs: number | null;
  failureClassification: string | null;
  stepResults: StepResult[];
  bleSession: {
    packets: BLEPacket[];
    connectionEvents: BLEEvent[];
    throughputBytesPerSec?: number;
    avgLatencyMs?: number;
  } | null;
  artifacts: any[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export default function RunDetailPage() {
  const params = useParams();
  const [run, setRun] = useState<Run | null>(null);
  const [tab, setTab] = useState<"steps" | "ble" | "timeline">("steps");

  useEffect(() => {
    if (params.id) {
      api.run.get.query({ id: params.id as string })
        .then((data: any) => setRun(data))
        .catch(() => {});
    }
  }, [params.id]);

  if (!run) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">Loading run...</p>
      </div>
    );
  }

  const packets = run.bleSession?.packets ?? [];
  const bleEvents = run.bleSession?.connectionEvents ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <a href="/runs" className="text-zinc-500 hover:text-zinc-300 text-sm">← Runs</a>
        <h1 className="text-2xl font-bold">Run {run.id.slice(0, 8)}</h1>
        <StatusBadge status={run.status} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card label="Duration" value={run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"} />
        <Card label="Steps" value={`${run.stepResults.filter(s => s.status === "passed").length}/${run.stepResults.length} passed`} />
        <Card label="Trigger" value={run.triggerSource} />
        <Card label="BLE Packets" value={String(packets.length)} />
        <Card label="Failure" value={run.failureClassification ?? "none"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["steps", "ble", "timeline"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "steps" ? "Step Results" : t === "ble" ? "BLE Session" : "Timeline"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "steps" && (
        <div className="rounded-lg border border-zinc-800 p-6">
          {run.stepResults.length === 0 ? (
            <p className="text-zinc-500 text-sm">No step results.</p>
          ) : (
            <div className="space-y-2">
              {run.stepResults.map((sr, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-md border ${
                  sr.status === "passed" ? "border-emerald-800/30 bg-emerald-950/20" :
                  sr.status === "failed" ? "border-red-800/30 bg-red-950/20" :
                  "border-zinc-800 bg-zinc-900"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-6">{i + 1}</span>
                    <span className="font-mono text-sm">{sr.stepId}</span>
                    <StatusBadge status={sr.status} />
                  </div>
                  <div className="flex items-center gap-4">
                    {sr.error && <span className="text-xs text-red-400 max-w-xs truncate">{sr.error}</span>}
                    <span className="text-xs text-zinc-500">{sr.durationMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "ble" && (
        <div className="space-y-4">
          {/* BLE stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card label="Packets" value={String(packets.length)} />
            <Card label="Throughput" value={run.bleSession?.throughputBytesPerSec ? `${run.bleSession.throughputBytesPerSec} B/s` : "—"} />
            <Card label="Avg Latency" value={run.bleSession?.avgLatencyMs ? `${run.bleSession.avgLatencyMs}ms` : "—"} />
          </div>

          {/* Connection events */}
          {bleEvents.length > 0 && (
            <div className="rounded-lg border border-zinc-800 p-4">
              <h3 className="text-xs text-zinc-400 mb-2">Connection Events</h3>
              <div className="flex gap-1 flex-wrap">
                {bleEvents.map((evt, i) => (
                  <span key={i} className={`px-2 py-1 rounded text-xs ${
                    evt.event === "connected" ? "bg-emerald-500/20 text-emerald-400" :
                    evt.event === "disconnected" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {evt.event}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Packet log */}
          <div className="rounded-lg border border-zinc-800 p-4">
            <h3 className="text-xs text-zinc-400 mb-2">Packet Log</h3>
            <div className="bg-zinc-900 rounded-md p-3 font-mono text-xs max-h-80 overflow-auto">
              {packets.length === 0 ? (
                <p className="text-zinc-600">No BLE packets captured.</p>
              ) : (
                packets.map((pkt, i) => (
                  <div key={i} className="flex gap-3 py-0.5">
                    <span className="text-zinc-600 w-20">{new Date(pkt.timestamp).toLocaleTimeString()}</span>
                    <span className={pkt.direction === "watch_to_phone" ? "text-blue-400" : "text-emerald-400"}>
                      {pkt.direction === "watch_to_phone" ? "←" : "→"}
                    </span>
                    <span className="text-zinc-400 w-24 truncate">{pkt.characteristic}</span>
                    <span className="text-zinc-300">{pkt.value || "—"}</span>
                    <span className="text-zinc-600 ml-auto">{pkt.size}B</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="rounded-lg border border-zinc-800 p-6">
          <h3 className="text-xs text-zinc-400 mb-4">Unified Timeline</h3>
          <div className="space-y-1">
            {run.stepResults.map((sr, i) => (
              <div key={`step-${i}`} className="flex items-center gap-3 text-xs py-1">
                <span className="text-zinc-600 w-16">{sr.durationMs}ms</span>
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-zinc-300">Step: {sr.stepId}</span>
                <StatusBadge status={sr.status} />
              </div>
            ))}
            {bleEvents.map((evt, i) => (
              <div key={`ble-${i}`} className="flex items-center gap-3 text-xs py-1">
                <span className="text-zinc-600 w-16">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-zinc-300">BLE: {evt.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
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
    none: "bg-zinc-500/20 text-zinc-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors.queued}`}>
      {status}
    </span>
  );
}
