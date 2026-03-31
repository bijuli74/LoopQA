package ble

import (
	"log"
	"os/exec"
	"strings"
	"time"
)

// Capturer polls Android BLE state via ADB and feeds events to an Inspector.
type Capturer struct {
	deviceID  string
	inspector *Inspector
	stopCh    chan struct{}
	lastState string
}

func NewCapturer(deviceID string, inspector *Inspector) *Capturer {
	return &Capturer{
		deviceID:  deviceID,
		inspector: inspector,
		stopCh:    make(chan struct{}),
	}
}

func (c *Capturer) Start() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	log.Printf("BLE capturer started for device %s", c.deviceID)

	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.poll()
		}
	}
}

func (c *Capturer) Stop() {
	close(c.stopCh)
}

func (c *Capturer) poll() {
	// Get Bluetooth connection state
	out, err := exec.Command("adb", "-s", c.deviceID, "shell", "dumpsys", "bluetooth_manager").Output()
	if err != nil {
		return
	}

	output := string(out)
	state := parseBTState(output)

	if state != c.lastState && c.lastState != "" {
		event := "disconnected"
		if state == "connected" {
			event = "connected"
		} else if state == "connecting" {
			event = "reconnecting"
		}
		c.inspector.RecordEvent(ConnectionEvent{
			Timestamp: time.Now(),
			Event:     event,
			Metadata:  map[string]any{"raw_state": state},
		})
	}
	c.lastState = state

	// Parse GATT operations from log
	gattOps := parseGATTOps(output)
	for _, op := range gattOps {
		c.inspector.RecordPacket(op)
	}
}

func parseBTState(output string) string {
	for _, line := range strings.Split(output, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "state:") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "state:"))
		}
		if strings.Contains(trimmed, "ProfileService") && strings.Contains(trimmed, "Connected") {
			return "connected"
		}
	}
	return "unknown"
}

func parseGATTOps(output string) []Packet {
	var packets []Packet
	for _, line := range strings.Split(output, "\n") {
		trimmed := strings.TrimSpace(line)
		if !strings.Contains(trimmed, "GATT") {
			continue
		}

		p := Packet{
			Timestamp: time.Now(),
			Direction: "unknown",
			Service:   "unknown",
		}

		if strings.Contains(trimmed, "WRITE") || strings.Contains(trimmed, "write") {
			p.Direction = "phone_to_watch"
		} else if strings.Contains(trimmed, "READ") || strings.Contains(trimmed, "NOTIFY") {
			p.Direction = "watch_to_phone"
		}

		// Extract characteristic UUID if present
		if idx := strings.Index(trimmed, "uuid:"); idx >= 0 {
			rest := trimmed[idx+5:]
			if spaceIdx := strings.IndexByte(rest, ' '); spaceIdx > 0 {
				p.Characteristic = rest[:spaceIdx]
			} else {
				p.Characteristic = strings.TrimSpace(rest)
			}
		}

		if p.Direction != "unknown" {
			packets = append(packets, p)
		}
	}
	return packets
}
