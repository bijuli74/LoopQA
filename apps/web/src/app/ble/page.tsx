"use client";

import { useEffect, useRef, useState } from "react";

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

export default function BLEInspectorPage() {
  const [packets, setPackets] = useState<BLEPacket[]>([]);
  const [events, setEvents] = useState<BLEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedSession, setRecordedSession] = useState<BLEPacket[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("http://localhost:4000/events");

    es.addEventListener("ble_packet", (e) => {
      const data = JSON.parse(e.data);
      const pkt = data.packet as BLEPacket;
      setPackets(prev => [...prev.slice(-200), pkt]); // keep last 200
      setConnected(true);
      if (recording) {
        setRecordedSession(prev => [...prev, pkt]);
      }
    });

    es.addEventListener("ble_event", (e) => {
      const data = JSON.parse(e.data);
      setEvents(prev => [...prev.slice(-50), data.event as BLEEvent]);
    });

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [recording]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [packets]);

  const pps = packets.length > 1
    ? Math.round(packets.length / Math.max(1, (Date.now() - new Date(packets[0]?.timestamp).getTime()) / 1000))
    : 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">BLE Inspector</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Real-time BLE packet inspection, session replay, and fault injection.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatusCard label="Connection" value={connected ? "Live" : "No device"} status={connected ? "online" : "offline"} />
        <StatusCard label="Packets captured" value={String(packets.length)} status={packets.length > 0 ? "online" : "offline"} />
        <StatusCard label="Events" value={String(events.length)} status={events.length > 0 ? "online" : "offline"} />
      </div>

      {/* Connection timeline */}
      <div className="rounded-lg border border-zinc-800 p-6 mb-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Connection Timeline</h2>
        {events.length === 0 ? (
          <div className="h-12 bg-zinc-900 rounded-md flex items-center justify-center">
            <p className="text-zinc-600 text-xs">Connect an agent to see BLE events</p>
          </div>
        ) : (
          <div className="flex gap-1 overflow-x-auto py-2">
            {events.map((evt, i) => (
              <div key={i} className={`flex-shrink-0 px-2 py-1 rounded text-xs ${
                evt.event === "connected" ? "bg-emerald-500/20 text-emerald-400" :
                evt.event === "disconnected" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"
              }`}>
                {evt.event}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Packet stream */}
      <div className="rounded-lg border border-zinc-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">Packet Stream</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (recording) {
                  setRecording(false);
                } else {
                  setRecordedSession([]);
                  setRecording(true);
                }
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                recording ? "bg-red-600 hover:bg-red-500" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {recording ? `⏹ Stop (${recordedSession.length} pkts)` : "⏺ Record Session"}
            </button>
            <button
              onClick={() => setPackets([])}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div ref={logRef} className="bg-zinc-900 rounded-md p-4 font-mono text-xs h-64 overflow-auto">
          {packets.length === 0 ? (
            <p className="text-zinc-600">Waiting for BLE packets...</p>
          ) : (
            packets.map((pkt, i) => (
              <div key={i} className="flex gap-3 py-0.5">
                <span className="text-zinc-600 w-20 flex-shrink-0">
                  {new Date(pkt.timestamp).toLocaleTimeString()}
                </span>
                <span className={`w-3 flex-shrink-0 ${
                  pkt.direction === "watch_to_phone" ? "text-blue-400" : "text-emerald-400"
                }`}>
                  {pkt.direction === "watch_to_phone" ? "←" : "→"}
                </span>
                <span className="text-zinc-400 w-24 flex-shrink-0 truncate">{pkt.characteristic || "—"}</span>
                <span className="text-zinc-300">{pkt.value || "—"}</span>
                <span className="text-zinc-600 ml-auto">{pkt.size}B</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fault injection */}
      <div className="rounded-lg border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Fault Injection</h2>
        <div className="flex gap-3">
          <FaultButton label="Drop Packets" description="Drop next 5 packets" disabled />
          <FaultButton label="Add Latency" description="Inject 500ms delay" disabled />
          <FaultButton label="Corrupt Payload" description="Flip random bits" disabled />
          <FaultButton label="Force Disconnect" description="Toggle airplane mode" disabled={!connected} />
        </div>
        <p className="text-xs text-zinc-600 mt-3">
          Drop/Latency/Corrupt require BLE proxy (Phase 2). Force Disconnect works via airplane mode toggle.
        </p>
      </div>
    </div>
  );
}

function StatusCard({ label, value, status }: { label: string; value: string; status: "online" | "offline" }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${status === "online" ? "text-emerald-400" : "text-zinc-500"}`}>{value}</p>
    </div>
  );
}

function FaultButton({ label, description, disabled }: { label: string; description: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="flex-1 p-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-md text-left transition-colors"
    >
      <p className="text-sm font-medium text-red-400">{label}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
    </button>
  );
}
