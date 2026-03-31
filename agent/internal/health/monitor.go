package health

import (
	"log"
	"os/exec"
	"strings"
	"sync"
	"time"
)

type DeviceStatus struct {
	ID        string `json:"id"`
	Connected bool   `json:"connected"`
	Type      string `json:"type"` // "android", "ios", "wear_os"
	Model     string `json:"model"`
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

	// Check ADB devices (Android phones + Wear OS watches)
	if adbDevices, err := getADBDevices(); err == nil {
		devices = append(devices, adbDevices...)
	}

	m.mu.Lock()
	m.status = Status{
		Devices:   devices,
		Timestamp: time.Now(),
	}
	m.mu.Unlock()
}

func getADBDevices() ([]DeviceStatus, error) {
	out, err := exec.Command("adb", "devices", "-l").Output()
	if err != nil {
		return nil, err
	}

	var devices []DeviceStatus
	lines := strings.Split(string(out), "\n")
	for _, line := range lines[1:] { // skip header
		fields := strings.Fields(line)
		if len(fields) < 2 || fields[1] != "device" {
			continue
		}

		model := "unknown"
		for _, f := range fields[2:] {
			if strings.HasPrefix(f, "model:") {
				model = strings.TrimPrefix(f, "model:")
			}
		}

		devices = append(devices, DeviceStatus{
			ID:        fields[0],
			Connected: true,
			Type:      "android", // TODO: detect wear_os vs android
			Model:     model,
		})
	}

	log.Printf("Found %d ADB device(s)", len(devices))
	return devices, nil
}
