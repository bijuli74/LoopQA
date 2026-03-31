package controller

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"time"
)

// EmulatorManager handles launching and managing Wear OS emulators and Android emulators.
type EmulatorManager struct{}

func NewEmulatorManager() *EmulatorManager {
	return &EmulatorManager{}
}

// ListAVDs returns available Android Virtual Devices.
func (m *EmulatorManager) ListAVDs(ctx context.Context) ([]string, error) {
	out, err := exec.CommandContext(ctx, "emulator", "-list-avds").Output()
	if err != nil {
		return nil, fmt.Errorf("list avds: %w", err)
	}
	var avds []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			avds = append(avds, line)
		}
	}
	return avds, nil
}

// LaunchEmulator starts an AVD and waits for it to boot.
func (m *EmulatorManager) LaunchEmulator(ctx context.Context, avdName string) (string, error) {
	log.Printf("Launching emulator: %s", avdName)

	cmd := exec.CommandContext(ctx, "emulator", "-avd", avdName, "-no-window", "-no-audio", "-no-boot-anim")
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("start emulator: %w", err)
	}

	// Wait for device to appear in adb
	deviceID, err := m.waitForDevice(ctx, 60*time.Second)
	if err != nil {
		cmd.Process.Kill()
		return "", err
	}

	// Wait for boot complete
	if err := m.waitForBoot(ctx, deviceID, 120*time.Second); err != nil {
		return deviceID, fmt.Errorf("boot timeout: %w", err)
	}

	log.Printf("Emulator %s ready: %s", avdName, deviceID)
	return deviceID, nil
}

func (m *EmulatorManager) waitForDevice(ctx context.Context, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		out, err := exec.CommandContext(ctx, "adb", "devices").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				fields := strings.Fields(line)
				if len(fields) == 2 && fields[1] == "device" && strings.HasPrefix(fields[0], "emulator-") {
					return fields[0], nil
				}
			}
		}
		time.Sleep(2 * time.Second)
	}
	return "", fmt.Errorf("no emulator appeared within %v", timeout)
}

func (m *EmulatorManager) waitForBoot(ctx context.Context, deviceID string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		out, _ := exec.CommandContext(ctx, "adb", "-s", deviceID, "shell", "getprop", "sys.boot_completed").Output()
		if strings.TrimSpace(string(out)) == "1" {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("device %s did not finish booting within %v", deviceID, timeout)
}

// KillEmulator shuts down an emulator.
func (m *EmulatorManager) KillEmulator(ctx context.Context, deviceID string) error {
	return exec.CommandContext(ctx, "adb", "-s", deviceID, "emu", "kill").Run()
}
