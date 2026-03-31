package controller

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// WearOSController drives Wear OS watches (Samsung Galaxy Watch, Pixel Watch)
// via ADB. Works with both emulators and physical devices over Wi-Fi/USB.
type WearOSController struct {
	DeviceID string
}

func NewWearOSController(deviceID string) *WearOSController {
	return &WearOSController{DeviceID: deviceID}
}

func (c *WearOSController) Type() string { return "wear_os" }

func (c *WearOSController) Connect(ctx context.Context) error {
	out, err := exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "get-state").Output()
	if err != nil {
		return fmt.Errorf("wear os device %s not reachable: %w", c.DeviceID, err)
	}
	if strings.TrimSpace(string(out)) != "device" {
		return fmt.Errorf("wear os device %s state: %s", c.DeviceID, out)
	}

	// Verify it's actually a Wear OS device
	feat, _ := exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell", "getprop", "ro.build.characteristics").Output()
	if !strings.Contains(string(feat), "watch") {
		// Not fatal — emulators may not set this
	}
	return nil
}

func (c *WearOSController) Execute(ctx context.Context, step TestStep) (StepResult, error) {
	start := time.Now()
	result := StepResult{StepID: step.ID, Status: "passed"}

	var err error
	switch step.Action {
	case "launch_app":
		err = c.launchApp(ctx, step.Target)
	case "tap":
		err = c.tap(ctx, step.Target)
	case "swipe":
		err = c.swipe(ctx, step.Params)
	case "assert_visible":
		err = c.assertVisible(ctx, step.Target)
	case "assert_text":
		err = c.assertText(ctx, step.Target, step.Assertion)
	case "close_app":
		err = c.closeApp(ctx, step.Target)
	case "press_button":
		err = c.pressButton(ctx, step.Target)
	case "wait":
		ms := 1000
		if v, ok := step.Params["ms"].(float64); ok {
			ms = int(v)
		}
		time.Sleep(time.Duration(ms) * time.Millisecond)
	default:
		err = fmt.Errorf("unsupported wear os action: %s", step.Action)
	}

	result.DurationMs = time.Since(start).Milliseconds()
	if err != nil {
		result.Status = "failed"
		result.Error = err.Error()
	}
	return result, nil
}

func (c *WearOSController) Capture(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "exec-out", "screencap", "-p").Output()
}

func (c *WearOSController) Disconnect() error { return nil }

func (c *WearOSController) launchApp(ctx context.Context, pkg string) error {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell",
		"monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1").Run()
}

func (c *WearOSController) closeApp(ctx context.Context, pkg string) error {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell", "am", "force-stop", pkg).Run()
}

func (c *WearOSController) pressButton(ctx context.Context, button string) error {
	keycodes := map[string]string{
		"home":   "KEYCODE_HOME",
		"back":   "KEYCODE_BACK",
		"power":  "KEYCODE_POWER",
		"crown":  "KEYCODE_STEM_PRIMARY",
		"crown1": "KEYCODE_STEM_1",
		"crown2": "KEYCODE_STEM_2",
	}
	kc, ok := keycodes[strings.ToLower(button)]
	if !ok {
		kc = button // allow raw keycode
	}
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell", "input", "keyevent", kc).Run()
}

// tap uses UIAutomator to find and click a UI element by text.
func (c *WearOSController) tap(ctx context.Context, target string) error {
	// Dump UI hierarchy and find element
	dump, err := exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell",
		"uiautomator", "dump", "/dev/tty").Output()
	if err != nil {
		return fmt.Errorf("ui dump failed: %w", err)
	}

	// Find bounds for the target text
	bounds, found := findBoundsForText(string(dump), target)
	if !found {
		return fmt.Errorf("ui element not found: %s", target)
	}

	// Tap center of bounds
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell",
		"input", "tap", fmt.Sprintf("%d", bounds.cx), fmt.Sprintf("%d", bounds.cy)).Run()
}

func (c *WearOSController) swipe(ctx context.Context, params map[string]any) error {
	dir, _ := params["direction"].(string)
	switch strings.ToLower(dir) {
	case "up":
		return c.adbSwipe(ctx, 180, 300, 180, 100)
	case "down":
		return c.adbSwipe(ctx, 180, 100, 180, 300)
	case "left":
		return c.adbSwipe(ctx, 300, 180, 60, 180)
	case "right":
		return c.adbSwipe(ctx, 60, 180, 300, 180)
	default:
		return fmt.Errorf("unknown swipe direction: %s", dir)
	}
}

func (c *WearOSController) adbSwipe(ctx context.Context, x1, y1, x2, y2 int) error {
	return exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell", "input", "swipe",
		fmt.Sprintf("%d", x1), fmt.Sprintf("%d", y1),
		fmt.Sprintf("%d", x2), fmt.Sprintf("%d", y2), "300").Run()
}

func (c *WearOSController) assertVisible(ctx context.Context, target string) error {
	dump, err := exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell",
		"uiautomator", "dump", "/dev/tty").Output()
	if err != nil {
		return fmt.Errorf("ui dump failed: %w", err)
	}
	if !strings.Contains(string(dump), target) {
		return fmt.Errorf("element not visible: %s", target)
	}
	return nil
}

func (c *WearOSController) assertText(ctx context.Context, target, expected string) error {
	dump, err := exec.CommandContext(ctx, "adb", "-s", c.DeviceID, "shell",
		"uiautomator", "dump", "/dev/tty").Output()
	if err != nil {
		return fmt.Errorf("ui dump failed: %w", err)
	}
	content := string(dump)
	if !strings.Contains(content, target) {
		return fmt.Errorf("element not found: %s", target)
	}
	if expected != "" && !strings.Contains(content, expected) {
		return fmt.Errorf("expected text '%s' not found near '%s'", expected, target)
	}
	return nil
}

type elementBounds struct {
	cx, cy int
}

func findBoundsForText(xml, text string) (elementBounds, bool) {
	// Find text="<target>" in UI dump, then extract bounds="[x1,y1][x2,y2]"
	idx := strings.Index(xml, fmt.Sprintf(`text="%s"`, text))
	if idx < 0 {
		// Try content-desc
		idx = strings.Index(xml, fmt.Sprintf(`content-desc="%s"`, text))
	}
	if idx < 0 {
		// Try case-insensitive partial match
		lower := strings.ToLower(xml)
		idx = strings.Index(lower, strings.ToLower(text))
	}
	if idx < 0 {
		return elementBounds{}, false
	}

	// Find bounds after this index
	boundsIdx := strings.Index(xml[idx:], `bounds="`)
	if boundsIdx < 0 {
		return elementBounds{180, 180}, true // fallback to center of round watch
	}

	boundsStr := xml[idx+boundsIdx+8:]
	endIdx := strings.Index(boundsStr, `"`)
	if endIdx < 0 {
		return elementBounds{180, 180}, true
	}
	boundsStr = boundsStr[:endIdx]

	// Parse [x1,y1][x2,y2]
	var x1, y1, x2, y2 int
	fmt.Sscanf(boundsStr, "[%d,%d][%d,%d]", &x1, &y1, &x2, &y2)

	return elementBounds{cx: (x1 + x2) / 2, cy: (y1 + y2) / 2}, true
}
