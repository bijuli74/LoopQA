import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

// NL → YAML code generation. Phase 1: rule-based parser.
// Phase 4: LLM-backed (GPT-4/Claude).
export const aiRouter = router({
  generateSteps: publicProcedure
    .input(z.object({ prompt: z.string().min(5) }))
    .mutation(({ input }) => {
      const yaml = nlToYAML(input.prompt);
      const steps = yamlToSteps(yaml);
      return { codeView: yaml, steps, confidence: 0.75 };
    }),
});

function nlToYAML(prompt: string): string {
  const lines: string[] = ["steps:"];
  const lower = prompt.toLowerCase();

  // App launch detection
  const appMatch = lower.match(/(?:open|launch|start)\s+(?:the\s+)?(\w+)\s+(?:companion\s+)?app/);
  if (appMatch) {
    lines.push(`  - action: launch_app`);
    lines.push(`    target: "com.${appMatch[1].toLowerCase()}.smartwatch"`);
  }

  // Pairing detection
  if (lower.includes("pair")) {
    const deviceMatch = prompt.match(/pair\s+(?:with\s+)?(?:the\s+)?([A-Za-z0-9 ]+?)(?:,|\.|$)/i);
    const deviceName = deviceMatch?.[1]?.trim() || "Unknown Device";
    lines.push(`  - action: tap`);
    lines.push(`    target: "Add Device"`);
    lines.push(`  - action: ble_pair`);
    lines.push(`    params:`);
    lines.push(`      deviceName: "${deviceName}"`);
    lines.push(`      timeoutMs: 15000`);
    lines.push(`  - action: ble_assert_connected`);
  }

  // Workout / activity detection
  if (lower.includes("workout") || lower.includes("exercise") || lower.includes("activity")) {
    lines.push(`  - action: tap`);
    lines.push(`    target: "Workout"`);
    lines.push(`  - action: tap`);
    lines.push(`    target: "Start"`);
  }

  // Heart rate detection
  if (lower.includes("heart rate") || lower.includes("hr")) {
    lines.push(`  - action: tap`);
    lines.push(`    target: "Heart Rate"`);
    lines.push(`  - action: wait`);
    lines.push(`    params: { ms: 5000 }`);
  }

  // Steps/pedometer detection
  if (lower.match(/\bsteps\b/) && !lower.includes("test steps")) {
    lines.push(`  - action: tap`);
    lines.push(`    target: "Steps"`);
  }

  // SpO2 detection
  if (lower.includes("spo2") || lower.includes("oxygen")) {
    lines.push(`  - action: tap`);
    lines.push(`    target: "SpO2"`);
    lines.push(`  - action: wait`);
    lines.push(`    params: { ms: 10000 }`);
  }

  // Sleep detection
  if (lower.includes("sleep")) {
    lines.push(`  - action: tap`);
    lines.push(`    target: "Sleep"`);
  }

  // Sync verification
  if (lower.includes("sync") || lower.includes("verify") || lower.includes("check")) {
    const timeoutMatch = lower.match(/within\s+(\d+)\s*(?:s|sec|seconds)/);
    const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) * 1000 : 10000;
    lines.push(`  - action: ble_assert_synced`);
    lines.push(`    params:`);
    lines.push(`      timeoutMs: ${timeout}`);
  }

  // Value assertion
  if (lower.includes("verify") && (lower.includes("value") || lower.includes("display") || lower.includes("shows"))) {
    lines.push(`  - action: assert_value`);
    lines.push(`    target: "data_display"`);
    lines.push(`    assertion: "> 0"`);
  }

  // Disconnect
  if (lower.includes("disconnect") || lower.includes("unpair")) {
    lines.push(`  - action: ble_disconnect`);
  }

  // Fallback if nothing matched
  if (lines.length === 1) {
    lines.push(`  # Could not parse: "${prompt}"`);
    lines.push(`  # Please write steps manually or rephrase.`);
  }

  return lines.join("\n");
}

function yamlToSteps(yaml: string): Array<Record<string, unknown>> {
  const steps: Array<Record<string, unknown>> = [];
  const lines = yaml.split("\n");
  let current: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- action:")) {
      if (current) steps.push(current);
      current = {
        id: `step-${steps.length}`,
        order: steps.length,
        action: trimmed.replace("- action:", "").trim(),
      };
    } else if (current && trimmed.startsWith("target:")) {
      current.target = trimmed.replace("target:", "").trim().replace(/"/g, "");
    } else if (current && trimmed.startsWith("assertion:")) {
      current.assertion = trimmed.replace("assertion:", "").trim().replace(/"/g, "");
    }
  }
  if (current) steps.push(current);
  return steps;
}
