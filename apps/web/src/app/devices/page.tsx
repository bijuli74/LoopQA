"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

interface Device { id: string; name: string; model: string; os: string; osVersion: string; connectionType: string; }
interface DevicePair { id: string; name: string; watchId: string; phoneId: string; }
interface Agent { id: string; name: string; status: string; lastHeartbeat: string | null; }

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairs, setPairs] = useState<DevicePair[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", model: "", os: "android", osVersion: "", connectionType: "usb" });

  useEffect(() => {
    load();
    const es = new EventSource("http://localhost:4000/events");
    es.addEventListener("agent_status", () => loadAgents());
    return () => es.close();
  }, []);

  async function load() {
    try {
      const [d, p, a] = await Promise.all([
        api.device.listDevices.query({ projectId: PROJECT_ID }),
        api.device.listPairs.query({ projectId: PROJECT_ID }),
        api.device.listAgents.query({ projectId: PROJECT_ID }),
      ]);
      setDevices(d as Device[]);
      setPairs(p as DevicePair[]);
      setAgents(a as Agent[]);
    } catch {}
  }

  async function loadAgents() {
    try {
      const a = await api.device.listAgents.query({ projectId: PROJECT_ID });
      setAgents(a as Agent[]);
    } catch {}
  }

  async function handleAddDevice() {
    try {
      await api.device.createDevice.mutate({ projectId: PROJECT_ID, ...form } as any);
      setShowForm(false);
      setForm({ name: "", model: "", os: "android", osVersion: "", connectionType: "usb" });
      load();
    } catch {}
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Devices & Agents</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Devices */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400">Devices</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors"
            >
              + Add
            </button>
          </div>

          {showForm && (
            <div className="mb-4 p-3 bg-zinc-900 rounded-md space-y-2">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs focus:outline-none focus:border-emerald-500" />
              <input placeholder="Model" value={form.model} onChange={e => setForm({...form, model: e.target.value})}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs focus:outline-none focus:border-emerald-500" />
              <select value={form.os} onChange={e => setForm({...form, os: e.target.value})}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs">
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="wear_os">Wear OS</option>
                <option value="watchos">watchOS</option>
                <option value="rtos">RTOS</option>
              </select>
              <input placeholder="OS Version" value={form.osVersion} onChange={e => setForm({...form, osVersion: e.target.value})}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs focus:outline-none focus:border-emerald-500" />
              <button onClick={handleAddDevice}
                className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-medium transition-colors">
                Save Device
              </button>
            </div>
          )}

          {devices.length === 0 ? (
            <p className="text-zinc-500 text-sm">No devices registered.</p>
          ) : (
            <div className="space-y-1">
              {devices.map(d => (
                <div key={d.id} className="p-2 bg-zinc-900 rounded text-xs">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-zinc-500 ml-2">{d.model} · {d.os} {d.osVersion}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device Pairs */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Device Pairs</h2>
          {pairs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No pairs configured.</p>
          ) : (
            <div className="space-y-1">
              {pairs.map(p => (
                <div key={p.id} className="p-2 bg-zinc-900 rounded text-xs">
                  <span className="font-medium">{p.name}</span>
                  <div className="text-zinc-500 mt-1">
                    ⌚ {p.watchId.slice(0,8)} ↔ 📱 {p.phoneId.slice(0,8)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agents */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Agents</h2>
          {agents.length === 0 ? (
            <div className="text-zinc-500 text-sm space-y-3">
              <p>No agents registered.</p>
              <div className="p-3 bg-zinc-900 rounded-md">
                <p className="text-xs text-zinc-400 mb-1">Start the agent:</p>
                <code className="text-xs text-emerald-400 break-all">
                  go run ./cmd/agent --agent-id=&lt;id&gt; --project-id={PROJECT_ID}
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {agents.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-zinc-900 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      a.status === "online" ? "bg-emerald-400" : "bg-zinc-600"
                    }`} />
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <span className="text-zinc-500">{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
