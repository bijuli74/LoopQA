package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/loopqa/agent/internal/ble"
	"github.com/loopqa/agent/internal/health"
	"github.com/loopqa/agent/internal/ws"
)

func main() {
	serverURL := flag.String("server", "ws://localhost:4001", "LoopQA cloud WebSocket URL")
	agentID := flag.String("agent-id", "", "Agent ID (assigned by LoopQA cloud)")
	projectID := flag.String("project-id", "", "Project ID")
	bleDevice := flag.String("ble-device", "", "ADB device ID for BLE capture (optional)")
	flag.Parse()

	if *agentID == "" || *projectID == "" {
		log.Fatal("--agent-id and --project-id are required")
	}

	log.Printf("LoopQA Agent starting (agent=%s, project=%s)", *agentID, *projectID)

	// Start device health monitor
	healthMon := health.NewMonitor()
	go healthMon.Start()

	// Initialize BLE inspector + capturer
	inspector := ble.NewInspector()
	if *bleDevice != "" {
		capturer := ble.NewCapturer(*bleDevice, inspector)
		go capturer.Start()
		log.Printf("BLE capture started for device %s", *bleDevice)
	}

	// Connect to cloud
	client, err := ws.Connect(*serverURL, *agentID, *projectID)
	if err != nil {
		log.Fatalf("Failed to connect to server: %v", err)
	}
	defer client.Close()

	client.SetInspector(inspector)
	client.SetHealthMonitor(healthMon)

	log.Printf("Connected to %s", *serverURL)

	go client.StartHeartbeat()
	go client.Listen()

	// Wait for shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Println("Shutting down agent...")
}
