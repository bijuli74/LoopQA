"use client";

import { useState } from "react";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const SUITE_ID = "00000000-0000-0000-0000-000000000002";

export default function SettingsPage() {
  const [keyName, setKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateKey() {
    if (!keyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("http://localhost:4000/api/ci/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: PROJECT_ID, name: keyName, scopes: ["ci"] }),
      });
      const data = await res.json();
      setGeneratedKey(data.key);
      setKeyName("");
    } catch {}
    setCreating(false);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* API Keys */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">API Keys</h2>
          <p className="text-zinc-500 text-xs mb-4">Create keys for CI/CD integration and agent authentication.</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Key name (e.g. GitHub Actions)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleCreateKey}
              disabled={creating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
            >
              Create
            </button>
          </div>

          {generatedKey && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-md">
              <p className="text-xs text-emerald-400 mb-1">Save this key — it won't be shown again:</p>
              <code className="text-xs text-emerald-300 break-all select-all">{generatedKey}</code>
            </div>
          )}
        </div>

        {/* CI/CD Integration */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">CI/CD Integration</h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-400 mb-2">GitHub Actions — trigger on push:</p>
              <pre className="p-3 bg-zinc-900 rounded-md text-xs text-zinc-300 overflow-x-auto">{`# .github/workflows/loopqa.yml
name: LoopQA Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger LoopQA
        run: |
          curl -X POST \\
            https://your-loopqa.com/api/ci/trigger \\
            -H "Authorization: Bearer \${{ secrets.LOOPQA_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{"suiteId": "${SUITE_ID}"}'`}</pre>
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-2">Webhook — auto-trigger on push to main:</p>
              <pre className="p-3 bg-zinc-900 rounded-md text-xs text-zinc-300 overflow-x-auto">{`POST /api/ci/webhook
Authorization: Bearer <your-key>
X-GitHub-Event: push

# Add as GitHub webhook URL:
# https://your-loopqa.com/api/ci/webhook`}</pre>
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-2">Check run status:</p>
              <pre className="p-3 bg-zinc-900 rounded-md text-xs text-zinc-300 overflow-x-auto">{`curl /api/ci/status/<run-id>`}</pre>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Notifications</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Slack</p>
                <p className="text-xs text-zinc-500">Notify on test failures</p>
              </div>
              <span className="text-xs text-zinc-600 px-2 py-1 bg-zinc-900 rounded">Coming soon</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Email</p>
                <p className="text-xs text-zinc-500">Daily digest of test results</p>
              </div>
              <span className="text-xs text-zinc-600 px-2 py-1 bg-zinc-900 rounded">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="rounded-lg border border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Project</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Project ID</span>
              <code className="text-xs text-zinc-300">{PROJECT_ID}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Suite ID</span>
              <code className="text-xs text-zinc-300">{SUITE_ID}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">API Base URL</span>
              <code className="text-xs text-zinc-300">http://localhost:4000</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
