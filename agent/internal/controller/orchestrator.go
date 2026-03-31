package controller

import (
	"context"
	"fmt"
	"log"
	"time"
)

type TestRunResult struct {
	Status                string       `json:"status"` // passed, failed, errored
	StepResults           []StepResult `json:"stepResults"`
	DurationMs            int64        `json:"durationMs"`
	FailureClassification string       `json:"failureClassification,omitempty"`
}

type Orchestrator struct {
	controller     DeviceController
	defaultTimeout time.Duration
	maxRetries     int
}

func NewOrchestrator(ctrl DeviceController) *Orchestrator {
	return &Orchestrator{
		controller:     ctrl,
		defaultTimeout: 30 * time.Second,
		maxRetries:     2,
	}
}

func (o *Orchestrator) Run(ctx context.Context, steps []TestStep, onStep func(StepResult)) TestRunResult {
	start := time.Now()
	result := TestRunResult{Status: "passed"}

	if err := o.controller.Connect(ctx); err != nil {
		return TestRunResult{
			Status:                "errored",
			DurationMs:            time.Since(start).Milliseconds(),
			FailureClassification: "infra_failure",
		}
	}
	defer o.controller.Disconnect()

	for _, step := range steps {
		sr := o.executeWithRetry(ctx, step)
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

func (o *Orchestrator) executeWithRetry(ctx context.Context, step TestStep) StepResult {
	timeout := o.defaultTimeout
	if step.TimeoutMs > 0 {
		timeout = time.Duration(step.TimeoutMs) * time.Millisecond
	}

	var lastResult StepResult
	retries := 0

	for {
		stepCtx, cancel := context.WithTimeout(ctx, timeout)
		lastResult, _ = o.controller.Execute(stepCtx, step)
		cancel()

		if lastResult.Status == "passed" {
			return lastResult
		}

		classification := classifyFailure(lastResult.Error)
		isRetryable := classification == "ble_timeout" || classification == "device_hung" || classification == "infra_failure"

		if !isRetryable || retries >= o.maxRetries {
			return lastResult
		}

		retries++
		log.Printf("Retrying step %s (attempt %d/%d, reason: %s)", step.ID, retries+1, o.maxRetries+1, classification)
		time.Sleep(time.Duration(retries) * time.Second) // exponential-ish backoff
	}
}

func classifyFailure(errMsg string) string {
	if errMsg == "" {
		return ""
	}
	switch {
	case contains(errMsg, "timeout", "timed out", "deadline exceeded"):
		return "ble_timeout"
	case contains(errMsg, "not found", "no such element", "selector"):
		return "ui_element_not_found"
	case contains(errMsg, "device", "adb", "not reachable", "offline"):
		return "device_hung"
	case contains(errMsg, "crash", "stopped", "ANR"):
		return "app_crash"
	case contains(errMsg, "assert", "expected", "mismatch"):
		return "test_logic_error"
	default:
		return "infra_failure"
	}
}

func contains(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}

func StepsFromRaw(raw []map[string]any) []TestStep {
	var steps []TestStep
	for i, r := range raw {
		s := TestStep{Order: i}
		if v, ok := r["id"].(string); ok {
			s.ID = v
		} else {
			s.ID = fmt.Sprintf("step-%d", i)
		}
		if v, ok := r["action"].(string); ok {
			s.Action = v
		}
		if v, ok := r["target"].(string); ok {
			s.Target = v
		}
		if v, ok := r["assertion"].(string); ok {
			s.Assertion = v
		}
		if v, ok := r["timeoutMs"].(float64); ok {
			s.TimeoutMs = int(v)
		}
		if v, ok := r["params"].(map[string]any); ok {
			s.Params = v
		}
		steps = append(steps, s)
	}
	return steps
}
