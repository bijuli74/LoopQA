// LoopQA Shared Types — Data Model (PRD §11)

// === Enums ===

export type DeviceOS = "android" | "ios" | "wear_os" | "watchos" | "rtos";

export type ConnectionType = "usb" | "wifi" | "simulator" | "emulator";

export type TestStatus = "active" | "quarantined" | "archived";

export type RunStatus = "queued" | "running" | "passed" | "failed" | "errored";

export type TriggerSource = "manual" | "ci" | "schedule";

export type FailureClassification =
  | "ble_timeout"
  | "ui_element_not_found"
  | "device_hung"
  | "app_crash"
  | "test_logic_error"
  | "infra_failure"
  | "data_mismatch";

export type ArtifactType = "screenshot" | "video" | "log" | "ble_capture";

export type StepAction =
  | "tap"
  | "swipe"
  | "type_text"
  | "assert_visible"
  | "assert_text"
  | "assert_value"
  | "wait"
  | "ble_start_proxy"
  | "ble_pair"
  | "ble_disconnect"
  | "ble_assert_connected"
  | "ble_assert_synced"
  | "ble_inject_fault"
  | "launch_app"
  | "close_app";

// === Core Entities ===

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface Device {
  id: string;
  projectId: string;
  name: string;
  model: string;
  os: DeviceOS;
  osVersion: string;
  connectionType: ConnectionType;
}

export interface DevicePair {
  id: string;
  projectId: string;
  name: string;
  watchId: string;
  phoneId: string;
}

export interface TestStep {
  id: string;
  order: number;
  action: StepAction;
  target?: string; // selector or device identifier
  params?: Record<string, unknown>;
  assertion?: string;
  timeoutMs?: number;
}

export interface Test {
  id: string;
  suiteId: string;
  name: string;
  description?: string;
  steps: TestStep[];
  codeView: string; // YAML/TS source of truth
  nlSource?: string; // original natural language if authored via NL
  tags: string[];
  flakinessScore: number;
  status: TestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface StepResult {
  stepId: string;
  status: "passed" | "failed" | "skipped" | "errored";
  screenshotUrl?: string;
  error?: string;
  durationMs: number;
}

export interface BLEPacket {
  timestamp: Date;
  direction: "watch_to_phone" | "phone_to_watch";
  service: string;
  characteristic: string;
  value: string; // hex-encoded
  size: number;
}

export interface BLEConnectionEvent {
  timestamp: Date;
  event: "connected" | "disconnected" | "reconnecting" | "pair_started" | "pair_completed" | "pair_failed";
  metadata?: Record<string, unknown>;
}

export interface BLESession {
  packets: BLEPacket[];
  connectionEvents: BLEConnectionEvent[];
  throughputBytesPerSec?: number;
  avgLatencyMs?: number;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  url: string;
  timestamp: Date;
}

export interface HealingSuggestion {
  stepId: string;
  oldSelector: string;
  newSelector: string;
  confidence: number;
  applied: boolean;
}

export interface TestRun {
  id: string;
  testId: string;
  projectId: string;
  triggeredBy: string;
  triggerSource: TriggerSource;
  devicePairId: string;
  status: RunStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  stepResults: StepResult[];
  bleSession?: BLESession;
  artifacts: Artifact[];
  failureClassification?: FailureClassification;
  healingSuggestions: HealingSuggestion[];
}

// === Agent Communication ===

export interface AgentHeartbeat {
  agentId: string;
  projectId: string;
  timestamp: Date;
  devicePairs: AgentDevicePairStatus[];
}

export interface AgentDevicePairStatus {
  devicePairId: string;
  watchConnected: boolean;
  phoneConnected: boolean;
  watchBattery?: number;
  phoneBattery?: number;
  busy: boolean;
}

export interface AgentCommand {
  type: "execute_test" | "cancel_test" | "health_check" | "reset_device";
  payload: Record<string, unknown>;
}

export interface AgentResult {
  type: "test_result" | "heartbeat" | "device_event" | "ble_packet";
  payload: Record<string, unknown>;
}
