package ble

import (
	"fmt"
	"log"
	"os/exec"
	"time"
)

// FaultInjector simulates BLE failures for testing resilience.
type FaultInjector struct {
	deviceID string
}

func NewFaultInjector(deviceID string) *FaultInjector {
	return &FaultInjector{deviceID: deviceID}
}

// ForceDisconnect kills BLE by toggling airplane mode.
func (f *FaultInjector) ForceDisconnect() error {
	log.Printf("Fault injection: forcing BLE disconnect on %s", f.deviceID)

	if err := f.adb("settings", "put", "global", "airplane_mode_on", "1"); err != nil {
		return fmt.Errorf("enable airplane mode: %w", err)
	}
	if err := f.adb("am", "broadcast", "-a", "android.intent.action.AIRPLANE_MODE"); err != nil {
		return fmt.Errorf("broadcast airplane mode: %w", err)
	}

	time.Sleep(2 * time.Second)

	if err := f.adb("settings", "put", "global", "airplane_mode_on", "0"); err != nil {
		return fmt.Errorf("disable airplane mode: %w", err)
	}
	if err := f.adb("am", "broadcast", "-a", "android.intent.action.AIRPLANE_MODE"); err != nil {
		return fmt.Errorf("broadcast airplane mode off: %w", err)
	}

	return nil
}

// DropPackets is a stub — requires BLE proxy layer (Phase 2).
func (f *FaultInjector) DropPackets(count int) error {
	log.Printf("Fault injection: drop %d packets (stub — requires BLE proxy)", count)
	return fmt.Errorf("not implemented: requires BLE proxy layer")
}

// InjectLatency is a stub — requires BLE proxy layer (Phase 2).
func (f *FaultInjector) InjectLatency(ms int) error {
	log.Printf("Fault injection: inject %dms latency (stub — requires BLE proxy)", ms)
	return fmt.Errorf("not implemented: requires BLE proxy layer")
}

func (f *FaultInjector) adb(args ...string) error {
	cmdArgs := append([]string{"-s", f.deviceID, "shell"}, args...)
	return exec.Command("adb", cmdArgs...).Run()
}
