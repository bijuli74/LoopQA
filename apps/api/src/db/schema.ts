import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  real,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

// === Enums ===

export const deviceOsEnum = pgEnum("device_os", [
  "android", "ios", "wear_os", "watchos", "rtos",
]);

export const connectionTypeEnum = pgEnum("connection_type", [
  "usb", "wifi", "simulator", "emulator",
]);

export const testStatusEnum = pgEnum("test_status", [
  "active", "quarantined", "archived",
]);

export const runStatusEnum = pgEnum("run_status", [
  "queued", "running", "passed", "failed", "errored",
]);

export const triggerSourceEnum = pgEnum("trigger_source", [
  "manual", "ci", "schedule",
]);

export const failureClassEnum = pgEnum("failure_classification", [
  "ble_timeout", "ui_element_not_found", "device_hung",
  "app_crash", "test_logic_error", "infra_failure", "data_mismatch",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "screenshot", "video", "log", "ble_capture",
]);

// === Tables ===

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  model: text("model").notNull(),
  os: deviceOsEnum("os").notNull(),
  osVersion: text("os_version").notNull(),
  connectionType: connectionTypeEnum("connection_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const devicePairs = pgTable("device_pairs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  watchId: uuid("watch_id").notNull().references(() => devices.id),
  phoneId: uuid("phone_id").notNull().references(() => devices.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testSuites = pgTable("test_suites", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tests = pgTable("tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").notNull().references(() => testSuites.id),
  name: text("name").notNull(),
  description: text("description"),
  steps: jsonb("steps").notNull().$type<Array<{
    id: string;
    order: number;
    action: string;
    target?: string;
    params?: Record<string, unknown>;
    assertion?: string;
    timeoutMs?: number;
  }>>(),
  codeView: text("code_view").notNull(),
  nlSource: text("nl_source"),
  tags: text("tags").array().notNull().default([]),
  flakinessScore: real("flakiness_score").notNull().default(0),
  status: testStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const testRuns = pgTable("test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  testId: uuid("test_id").notNull().references(() => tests.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  triggeredBy: text("triggered_by").notNull(),
  triggerSource: triggerSourceEnum("trigger_source").notNull(),
  devicePairId: uuid("device_pair_id").notNull().references(() => devicePairs.id),
  status: runStatusEnum("status").notNull().default("queued"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  stepResults: jsonb("step_results").notNull().default([]).$type<Array<{
    stepId: string;
    status: string;
    screenshotUrl?: string;
    error?: string;
    durationMs: number;
  }>>(),
  bleSession: jsonb("ble_session").$type<{
    packets: Array<Record<string, unknown>>;
    connectionEvents: Array<Record<string, unknown>>;
    throughputBytesPerSec?: number;
    avgLatencyMs?: number;
  }>(),
  artifacts: jsonb("artifacts").notNull().default([]).$type<Array<{
    id: string;
    type: string;
    url: string;
    timestamp: string;
  }>>(),
  failureClassification: failureClassEnum("failure_classification"),
  healingSuggestions: jsonb("healing_suggestions").notNull().default([]).$type<Array<{
    stepId: string;
    oldSelector: string;
    newSelector: string;
    confidence: number;
    applied: boolean;
  }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  apiKey: text("api_key").unique(),
  lastHeartbeat: timestamp("last_heartbeat"),
  status: text("status").notNull().default("offline"), // online | offline | degraded
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduledRuns = pgTable("scheduled_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  suiteId: uuid("suite_id").notNull().references(() => testSuites.id),
  devicePairId: uuid("device_pair_id").notNull().references(() => devicePairs.id),
  cronExpression: text("cron_expression").notNull(),
  enabled: integer("enabled").notNull().default(1),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
