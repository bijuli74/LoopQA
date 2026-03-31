import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/loopqa");

async function seed() {
  // Organization
  await sql`INSERT INTO organizations (id, name) VALUES (
    '00000000-0000-0000-0000-000000000000', 'LoopQA Demo'
  ) ON CONFLICT (id) DO NOTHING`;

  // Project
  await sql`INSERT INTO projects (id, org_id, name, description) VALUES (
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
    'boAt Wave Pro', 'Testing boAt Wave Pro companion app + BLE sync'
  ) ON CONFLICT (id) DO NOTHING`;

  // Test Suite
  await sql`INSERT INTO test_suites (id, project_id, name, description) VALUES (
    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
    'Regression Suite', 'Core regression tests for pairing and sync'
  ) ON CONFLICT (id) DO NOTHING`;

  // Devices
  await sql`INSERT INTO devices (id, project_id, name, model, os, os_version, connection_type) VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
     'boAt Wave Pro', 'Wave Pro', 'rtos', '2.1', 'usb'),
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
     'Pixel 8', 'Pixel 8', 'android', '14', 'usb')
  ON CONFLICT (id) DO NOTHING`;

  // Device Pair
  await sql`INSERT INTO device_pairs (id, project_id, name, watch_id, phone_id) VALUES (
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
    'boAt Wave Pro + Pixel 8',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011'
  ) ON CONFLICT (id) DO NOTHING`;

  // Agent
  await sql`INSERT INTO agents (id, project_id, name, status) VALUES (
    '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001',
    'local-agent-1', 'offline'
  ) ON CONFLICT (id) DO NOTHING`;

  // Sample test
  await sql`INSERT INTO tests (id, suite_id, name, description, steps, code_view, tags, flakiness_score, status) VALUES (
    '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002',
    'BLE Pairing + HR Sync', 'Pair watch, read heart rate, verify sync',
    ${JSON.stringify([
      { id: "step-0", order: 0, action: "launch_app", target: "com.boat.smartwatch" },
      { id: "step-1", order: 1, action: "tap", target: "Add Device" },
      { id: "step-2", order: 2, action: "ble_pair", params: { deviceName: "boAt Wave Pro", timeoutMs: 15000 } },
      { id: "step-3", order: 3, action: "ble_assert_connected" },
      { id: "step-4", order: 4, action: "tap", target: "Heart Rate" },
      { id: "step-5", order: 5, action: "wait", params: { ms: 5000 } },
      { id: "step-6", order: 6, action: "assert_value", target: "hr_display", assertion: "> 0" },
    ])}::jsonb,
    'steps:
  - action: launch_app
    target: "com.boat.smartwatch"
  - action: tap
    target: "Add Device"
  - action: ble_pair
    params:
      deviceName: "boAt Wave Pro"
      timeoutMs: 15000
  - action: ble_assert_connected
  - action: tap
    target: "Heart Rate"
  - action: wait
    params: { ms: 5000 }
  - action: assert_value
    target: "hr_display"
    assertion: "> 0"',
    ARRAY['ble', 'pairing', 'hr'],
    0,
    'active'
  ) ON CONFLICT (id) DO NOTHING`;

  console.log("✅ Seed data inserted");
  await sql.end();
}

seed().catch(console.error);
