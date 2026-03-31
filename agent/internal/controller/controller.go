package controller

import "context"

// DeviceController is the unified interface for all device types (PRD §8 DAL).
// Each controller exposes the same lifecycle: Connect → Execute → Capture → Disconnect.
type DeviceController interface {
	Connect(ctx context.Context) error
	Execute(ctx context.Context, step TestStep) (StepResult, error)
	Capture(ctx context.Context) ([]byte, error) // screenshot
	Disconnect() error
	Type() string
}

type TestStep struct {
	ID        string            `json:"id"`
	Order     int               `json:"order"`
	Action    string            `json:"action"`
	Target    string            `json:"target,omitempty"`
	Params    map[string]any    `json:"params,omitempty"`
	Assertion string            `json:"assertion,omitempty"`
	TimeoutMs int               `json:"timeoutMs,omitempty"`
}

type StepResult struct {
	StepID        string `json:"stepId"`
	Status        string `json:"status"` // passed, failed, skipped, errored
	ScreenshotURL string `json:"screenshotUrl,omitempty"`
	Error         string `json:"error,omitempty"`
	DurationMs    int64  `json:"durationMs"`
}
