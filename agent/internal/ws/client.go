package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
	"github.com/loopqa/agent/internal/ble"
	"github.com/loopqa/agent/internal/controller"
	"github.com/loopqa/agent/internal/health"
)

type Client struct {
	conn      *websocket.Conn
	agentID   string
	projectID string
	inspector *ble.Inspector
	healthMon *health.Monitor
}

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type ExecuteTestPayload struct {
	RunID      string           `json:"runId"`
	DeviceID   string           `json:"deviceId"`
	Steps      []map[string]any `json:"steps"`
}

func Connect(serverURL, agentID, projectID string) (*Client, error) {
	u, err := url.Parse(serverURL)
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("agentId", agentID)
	q.Set("projectId", projectID)
	u.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("dial: %w", err)
	}

	return &Client{conn: conn, agentID: agentID, projectID: projectID}, nil
}

func (c *Client) SetInspector(i *ble.Inspector) { c.inspector = i }
func (c *Client) SetHealthMonitor(m *health.Monitor) { c.healthMon = m }

func (c *Client) Close() {
	c.conn.Close()
}

func (c *Client) Send(msgType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	msg := Message{Type: msgType, Payload: data}
	return c.conn.WriteJSON(msg)
}

func (c *Client) StartHeartbeat() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		var status any
		if c.healthMon != nil {
			status = c.healthMon.GetStatus()
		} else {
			status = map[string]string{"status": "ok"}
		}
		if err := c.Send("heartbeat", status); err != nil {
			log.Printf("Heartbeat failed: %v", err)
			return
		}
	}
}

func (c *Client) Listen() {
	for {
		var msg Message
		if err := c.conn.ReadJSON(&msg); err != nil {
			log.Printf("Read error: %v", err)
			return
		}

		switch msg.Type {
		case "execute_test":
			go c.handleExecuteTest(msg.Payload)
		case "cancel_test":
			log.Printf("Received cancel command")
		case "health_check":
			c.Send("heartbeat", c.healthMon.GetStatus())
		default:
			log.Printf("Unknown command: %s", msg.Type)
		}
	}
}

func (c *Client) handleExecuteTest(payload json.RawMessage) {
	var p ExecuteTestPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("Invalid execute_test payload: %v", err)
		c.Send("test_result", map[string]any{
			"runId":  "",
			"status": "errored",
			"error":  err.Error(),
		})
		return
	}

	log.Printf("Executing test run %s on device %s (%d steps)", p.RunID, p.DeviceID, len(p.Steps))

	// Create controller for the device — detect type automatically
	var phone, watch controller.DeviceController
	phone = controller.NewAndroidController(p.DeviceID)

	// Check if a watch device ID was provided
	if watchID, ok := p.Steps[0]["watchDeviceId"].(string); ok && watchID != "" {
		watch = controller.NewWearOSController(watchID)
	}

	orch := controller.NewPairOrchestrator(phone, watch)
	steps := controller.StepsFromRaw(p.Steps)

	// Stream BLE packets during execution
	if c.inspector != nil {
		c.inspector.OnPacket(func(pkt ble.Packet) {
			c.Send("ble_packet", map[string]any{
				"runId":  p.RunID,
				"packet": pkt,
			})
		})
		c.inspector.OnEvent(func(evt ble.ConnectionEvent) {
			c.Send("ble_event", map[string]any{
				"runId": p.RunID,
				"event": evt,
			})
		})
	}

	// Run test
	result := orch.Run(context.Background(), steps, func(sr controller.StepResult) {
		// Stream step results in real-time
		c.Send("step_result", map[string]any{
			"runId":  p.RunID,
			"result": sr,
		})
	})

	// Send final result
	finalPayload := map[string]any{
		"runId":                 p.RunID,
		"status":                result.Status,
		"stepResults":           result.StepResults,
		"durationMs":            result.DurationMs,
		"failureClassification": result.FailureClassification,
	}

	if c.inspector != nil {
		finalPayload["bleSession"] = c.inspector.GetSession()
		c.inspector.Reset()
	}

	c.Send("test_result", finalPayload)
	log.Printf("Test run %s completed: %s (%dms)", p.RunID, result.Status, result.DurationMs)
}
