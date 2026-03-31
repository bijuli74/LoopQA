package controller

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// AndroidController drives Android phones and Wear OS watches via ADB.
type AndroidController struct {
	DeviceID string
}

func NewAndroidController(deviceID string) *AndroidController {
	return &AndroidController{DeviceID: deviceID}
}

func (c *AndroidController) Type() string { return "android" }

func (c *AndroidController) Connect(ctx context.Context) error {
	out, err := exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "get-state").Output()
	if err != nil {
		return fmt.Errorf("device %s not reachable: %w", c.DeviceID, err)
	}
	if string(out) != "device\n" {
		return fmt.Errorf("device %s in unexpected state: %s", c.DeviceID, out)
	}
	return nil
}

func (c *AndroidController) Execute(ctx context.Context, step TestStep) (StepResult, error) {
	start := time.Now()
	result := StepResult{StepID: step.ID, Status: "passed"}

	var err error
	switch step.Action {
	case "launch_app":
		err = c.launchApp(ctx, step.Target)
	case "tap":
		// TODO: integrate with Appium for UI automation
		err = fmt.Errorf("tap action requires Appium — not yet implemented")
	case "close_app":
		err = c.closeApp(ctx, step.Target)
	default:
		err = fmt.Errorf("unsupported action: %s", step.Action)
	}

	result.DurationMs = time.Since(start).Milliseconds()
	if err != nil {
		result.Status = "failed"
		result.Error = err.Error()
	}
	return result, nil
}

func (c *AndroidController) Capture(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "exec-out", "screencap", "-p").Output()
}

func (c *AndroidController) Disconnect() error {
	return nil // ADB doesn't need explicit disconnect
}

func (c *AndroidController) launchApp(ctx context.Context, pkg string) error {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell",
		"monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1").Run()
}

func (c *AndroidController) closeApp(ctx context.Context, pkg string) error {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell", "am", "force-stop", pkg).Run()
}
