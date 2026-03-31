"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_SUITE_ID = "00000000-0000-0000-0000-000000000002";
const DEFAULT_DEVICE_PAIR_ID = "00000000-0000-0000-0000-000000000003";

interface Test {
  id: string;
  name: string;
  status: string;
  flakinessScore: number;
  codeView: string;
  steps: any[];
  tags: string[];
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [codeView, setCodeView] = useState("");
  const [testName, setTestName] = useState("");
  const [nlPrompt, setNlPrompt] = useState("");
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"code" | "nl">("nl");

  useEffect(() => { loadTests(); }, []);

  async function loadTests() {
    try {
      const data = await api.test.list.query({ suiteId: DEFAULT_SUITE_ID });
      setTests(data as Test[]);
    } catch {}
  }

  async function handleGenerate() {
    if (!nlPrompt.trim()) return;
    setGenerating(true);
    setMessage("");
    try {
      const result = await api.ai.generateSteps.mutate({ prompt: nlPrompt });
      setCodeView((result as any).codeView);
      setMode("code");
      setMessage(`Generated (${Math.round((result as any).confidence * 100)}% confidence) — review and edit below`);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (!testName.trim()) { setMessage("Enter a test name"); return; }
    if (!codeView.trim()) { setMessage("Generate or write test steps first"); return; }
    setSaving(true);
    setMessage("");
    try {
      const created = await api.test.create.mutate({
        suiteId: DEFAULT_SUITE_ID,
        name: testName,
        codeView,
        nlSource: nlPrompt || undefined,
        steps: parseYAMLSteps(codeView),
        tags: [],
      });
      setMessage("Test saved ✓");
      setSelectedTest(created as Test);
      loadTests();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
    setSaving(false);
  }

  async function handleRun() {
    const testId = selectedTest?.id;
    if (!testId) { setMessage("Save or select a test first"); return; }
    setRunning(true);
    setMessage("");
    try {
      const run = await api.run.trigger.mutate({
        testId,
        projectId: PROJECT_ID,
        devicePairId: DEFAULT_DEVICE_PAIR_ID,
        triggeredBy: "dashboard",
        triggerSource: "manual",
      });
      setMessage(`Run triggered: ${(run as any).id.slice(0, 8)}...`);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
    setRunning(false);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Tests</h1>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Test list */}
        <div className="col-span-2 rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Tests ({tests.length})</h2>
          {tests.length === 0 ? (
            <p className="text-zinc-500 text-sm">No tests yet.</p>
          ) : (
            <div className="space-y-1">
              {tests.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTest(t);
                    setTestName(t.name);
                    setCodeView(t.codeView);
                    setMode("code");
                  }}
                  className={`w-full text-left p-3 rounded-md text-sm transition-colors ${
                    selectedTest?.id === t.id
                      ? "bg-emerald-600/20 border border-emerald-600/40"
                      : "bg-zinc-900 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      t.status === "active" ? "text-emerald-400" : "text-amber-400"
                    }`}>{t.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="col-span-3 rounded-lg border border-zinc-800 p-6">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setMode("nl")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === "nl" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              ✨ Natural Language
            </button>
            <button
              onClick={() => setMode("code")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === "code" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              Code View (YAML)
            </button>
          </div>

          <input
            type="text"
            placeholder="Test name..."
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="w-full mb-3 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm focus:outline-none focus:border-emerald-500"
          />

          {mode === "nl" ? (
            <>
              <textarea
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                rows={4}
                placeholder="Describe your test in plain English...&#10;&#10;Example: Open the boAt app, pair with Wave Pro, start a heart rate reading, verify the value syncs to the phone within 10 seconds"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm focus:outline-none focus:border-emerald-500 resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
              >
                {generating ? "Generating..." : "✨ Generate Steps"}
              </button>

              {codeView && (
                <div className="mt-4">
                  <p className="text-xs text-zinc-400 mb-2">Generated code (review & edit):</p>
                  <textarea
                    value={codeView}
                    onChange={(e) => setCodeView(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm font-mono focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              )}
            </>
          ) : (
            <textarea
              value={codeView}
              onChange={(e) => setCodeView(e.target.value)}
              rows={16}
              placeholder="steps:&#10;  - action: launch_app&#10;    target: &quot;com.boat.smartwatch&quot;"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm font-mono focus:outline-none focus:border-emerald-500 resize-none"
            />
          )}

          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors">
              {saving ? "Saving..." : "Save Test"}
            </button>
            <button onClick={handleRun} disabled={running}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-md text-sm font-medium transition-colors">
              {running ? "Triggering..." : "▶ Run Test"}
            </button>
            {message && (
              <span className={`text-xs ${message.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseYAMLSteps(yaml: string): any[] {
  const steps: any[] = [];
  const lines = yaml.split("\n");
  let current: any = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- action:")) {
      if (current) steps.push(current);
      current = { id: `step-${steps.length}`, order: steps.length, action: trimmed.replace("- action:", "").trim() };
    } else if (current && trimmed.startsWith("target:")) {
      current.target = trimmed.replace("target:", "").trim().replace(/"/g, "");
    } else if (current && trimmed.startsWith("assertion:")) {
      current.assertion = trimmed.replace("assertion:", "").trim().replace(/"/g, "");
    }
  }
  if (current) steps.push(current);
  return steps;
}
