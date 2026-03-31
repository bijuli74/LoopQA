// Sends notifications on test failures via webhooks (Slack, Teams, custom).
// Configured per-project via environment or DB settings.

interface NotificationPayload {
  runId: string;
  testName: string;
  status: string;
  durationMs: number;
  failureClassification?: string;
  error?: string;
  dashboardUrl: string;
}

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const TEAMS_WEBHOOK = process.env.TEAMS_WEBHOOK_URL;
const CUSTOM_WEBHOOK = process.env.CUSTOM_WEBHOOK_URL;
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3000";

export async function notifyTestResult(payload: NotificationPayload) {
  if (payload.status === "passed") return; // only notify on failures

  const promises: Promise<void>[] = [];

  if (SLACK_WEBHOOK) promises.push(sendSlack(payload));
  if (TEAMS_WEBHOOK) promises.push(sendTeams(payload));
  if (CUSTOM_WEBHOOK) promises.push(sendCustom(payload));

  await Promise.allSettled(promises);
}

async function sendSlack(p: NotificationPayload) {
  const color = p.status === "failed" ? "#e74c3c" : "#e67e22";
  const body = {
    attachments: [{
      color,
      title: `LoopQA: Test ${p.status.toUpperCase()}`,
      title_link: `${p.dashboardUrl}/runs/${p.runId}`,
      fields: [
        { title: "Test", value: p.testName, short: true },
        { title: "Duration", value: `${((p.durationMs ?? 0) / 1000).toFixed(1)}s`, short: true },
        ...(p.failureClassification ? [{ title: "Failure", value: p.failureClassification, short: true }] : []),
        ...(p.error ? [{ title: "Error", value: p.error.slice(0, 200), short: false }] : []),
      ],
    }],
  };

  await fetch(SLACK_WEBHOOK!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendTeams(p: NotificationPayload) {
  const body = {
    "@type": "MessageCard",
    themeColor: p.status === "failed" ? "e74c3c" : "e67e22",
    summary: `LoopQA: ${p.testName} ${p.status}`,
    sections: [{
      activityTitle: `Test ${p.status.toUpperCase()}: ${p.testName}`,
      facts: [
        { name: "Status", value: p.status },
        { name: "Duration", value: `${((p.durationMs ?? 0) / 1000).toFixed(1)}s` },
        ...(p.failureClassification ? [{ name: "Failure Type", value: p.failureClassification }] : []),
      ],
    }],
    potentialAction: [{
      "@type": "OpenUri",
      name: "View in LoopQA",
      targets: [{ os: "default", uri: `${p.dashboardUrl}/runs/${p.runId}` }],
    }],
  };

  await fetch(TEAMS_WEBHOOK!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendCustom(p: NotificationPayload) {
  await fetch(CUSTOM_WEBHOOK!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
}
