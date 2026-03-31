package health

import (
	"log"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

type DeviceStatus struct {
	ID             string `json:"id"`
	Connected      bool   `json:"connected"`
	Type           string `json:"type"` // android, wear_os, emulator
	Model          string `json:"model"`
	BatteryLevel   int    `json:"batteryLevel"`
	BatteryCharging bool  `json:"batteryCharging"`
}

type Status struct {
	Devices   []DeviceStatus `json:"devices"`
	Timestamp time.Time      `json:"timestamp"`
}

type Monitor struct {
	mu     sync.RWMutex
	status Status
}

func NewMonitor() *Monitor {
	return &Monitor{}
}

func (m *Monitor) Start() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		m.refresh()
	}
}

func (m *Monitor) GetStatus() Status {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *Monitor) refresh() {
	var devices []DeviceStatus

	out, err := exec.Command("adb", "devices", "-l").Output()
	if err != nil {
		return
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines[1:] {
		fields := strings.Fields(line)
		if len(fields) < 2 || fields[1] != "device" {
			continue
		}

		id := fields[0]
		model := "unknown"
		for _, f := range fields[2:] {
			if strings.HasPrefix(f, "model:") {
				model = strings.TrimPrefix(f, "model:")
			}
		}

		devType := detectDeviceType(id)
		battery, charging := getBattery(id)

		devices = append(devices, DeviceStatus{
			ID:              id,
			Connected:       true,
			Type:            devType,
			Model:           model,
			BatteryLevel:    battery,
			BatteryCharging: charging,
		})
	}

	m.mu.Lock()
	m.status = Status{Devices: devices, Timestamp: time.Now()}
	m.mu.Unlock()

	if len(devices) > 0 {
		log.Printf("Devices: %d connected", len(devices))
	}
}

func detectDeviceType(deviceID string) string {
	if strings.HasPrefix(deviceID, "emulator-") {
		// Check if it's a Wear OS emulator
		out, _ := exec.Command("adb", "-s", deviceID, "shell", "getprop", "ro.build.characteristics").Output()
		if strings.Contains(string(out), "watch") {
			return "wear_os"
		}
		return "emulator"
	}

	out, _ := exec.Command("adb", "-s", deviceID, "shell", "getprop", "ro.build.characteristics").Output()
	if strings.Contains(string(out), "watch") {
		return "wear_os"
	}
	return "android"
}

func getBattery(deviceID string) (int, bool) {
	out, err := exec.Command("adb", "-s", deviceID, "shell", "dumpsys", "battery").Output()
	if err != nil {
		return -1, false
	}

	level := -1
	charging := false
	for _, line := range strings.Split(string(out), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "level:") {
			val := strings.TrimSpace(strings.TrimPrefix(trimmed, "level:"))
			if n, err := strconv.Atoi(val); err == nil {
				level = n
			}
		}
		if strings.HasPrefix(trimmed, "status:") {
			// 2 = charging, 5 = full
			val := strings.TrimSpace(strings.TrimPrefix(trimmed, "status:"))
			if n, err := strconv.Atoi(val); err == nil {
				charging = n == 2 || n == 5
			}
		}
	}
	return level, charging
}
