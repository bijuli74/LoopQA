package controller

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// PairOrchestrator coordinates test execution across a watch + phone pair.
// BLE actions route to the phone controller (pairing is initiated from phone).
// Watch UI actions route to the watch controller.
type PairOrchestrator struct {
	phone          DeviceController
	watch          DeviceController // nil for RTOS watches
	defaultTimeout time.Duration
	maxRetries     int
}

func NewPairOrchestrator(phone, watch DeviceController) *PairOrchestrator {
	return &PairOrchestrator{
		phone:          phone,
		watch:          watch,
		defaultTimeout: 30 * time.Second,
		maxRetries:     2,
	}
}

func (o *PairOrchestrator) Run(ctx context.Context, steps []TestStep, onStep func(StepResult)) TestRunResult {
	start := time.Now()
	result := TestRunResult{Status: "passed"}

	// Connect both devices
	if err := o.phone.Connect(ctx); err != nil {
		return TestRunResult{Status: "errored", DurationMs: time.Since(start).Milliseconds(), FailureClassification: "device_hung"}
	}
	defer o.phone.Disconnect()

	if o.watch != nil {
		if err := o.watch.Connect(ctx); err != nil {
			return TestRunResult{Status: "errored", DurationMs: time.Since(start).Milliseconds(), FailureClassification: "device_hung"}
		}
		defer o.watch.Disconnect()
	}

	for _, step := range steps {
		ctrl := o.routeStep(step)
		sr := o.executeWithRetry(ctx, ctrl, step)
		result.StepResults = append(result.StepResults, sr)

		if onStep != nil {
			onStep(sr)
		}

		if sr.Status == "failed" || sr.Status == "errored" {
			result.Status = sr.Status
			result.FailureClassification = classifyFailure(sr.Error)
			break
		}
	}

	result.DurationMs = time.Since(start).Milliseconds()
	return result
}

// routeStep decides which controller handles a step.
func (o *PairOrchestrator) routeStep(step TestStep) DeviceController {
	switch step.Action {
	// BLE actions always go through phone (pairing initiated from companion app)
	case "ble_pair", "ble_disconnect", "ble_assert_connected", "ble_assert_synced",
		"ble_start_proxy", "ble_inject_fault":
		return o.phone

	// Watch-specific actions
	case "watch_tap", "watch_swipe", "watch_assert_visible", "watch_press_button":
		if o.watch != nil {
			return o.watch
		}
		return o.phone // fallback for RTOS — skip or error

	// Default: phone companion app
	default:
		return o.phone
	}
}

func (o *PairOrchestrator) executeWithRetry(ctx context.Context, ctrl DeviceController, step TestStep) StepResult {
	timeout := o.defaultTimeout
	if step.TimeoutMs > 0 {
		timeout = time.Duration(step.TimeoutMs) * time.Millisecond
	}

	// For watch_ prefixed actions, strip prefix and route to watch controller
	execStep := step
	if len(step.Action) > 6 && step.Action[:6] == "watch_" {
		execStep.Action = step.Action[6:]
	}

	var lastResult StepResult
	for attempt := 0; attempt <= o.maxRetries; attempt++ {
		stepCtx, cancel := context.WithTimeout(ctx, timeout)
		lastResult, _ = ctrl.Execute(stepCtx, execStep)
		cancel()

		if lastResult.Status == "passed" {
			return lastResult
		}

		classification := classifyFailure(lastResult.Error)
		isRetryable := classification == "ble_timeout" || classification == "device_hung" || classification == "infra_failure"
		if !isRetryable || attempt >= o.maxRetries {
			return lastResult
		}

		time.Sleep(time.Duration(attempt+1) * time.Second)
	}
	return lastResult
}

// DetectControllerType returns the appropriate controller for a device ID.
func DetectControllerType(deviceID string) (DeviceController, error) {
	// Check if it's a Wear OS device
	out, err := exec.CommandContext(context.Background(), "adb", "-s", deviceID, "shell",
		"getprop", "ro.build.characteristics").Output()
	if err != nil {
		return nil, fmt.Errorf("cannot detect device type: %w", err)
	}

	if containsStr(string(out), "watch") {
		return NewWearOSController(deviceID), nil
	}
	return NewAndroidController(deviceID), nil
}

func containsStr(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && findSubstring(s, sub))
}

func findSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
