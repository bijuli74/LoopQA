package ble

import (
	"log"
	"sync"
	"time"
)

// Packet represents a captured BLE GATT packet.
type Packet struct {
	Timestamp      time.Time `json:"timestamp"`
	Direction      string    `json:"direction"` // watch_to_phone, phone_to_watch
	Service        string    `json:"service"`
	Characteristic string    `json:"characteristic"`
	Value          string    `json:"value"` // hex-encoded
	Size           int       `json:"size"`
}

// ConnectionEvent represents a BLE connection state change.
type ConnectionEvent struct {
	Timestamp time.Time      `json:"timestamp"`
	Event     string         `json:"event"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// Session holds a recorded BLE session for replay.
type Session struct {
	Packets          []Packet          `json:"packets"`
	ConnectionEvents []ConnectionEvent `json:"connectionEvents"`
	StartedAt        time.Time         `json:"startedAt"`
	EndedAt          time.Time         `json:"endedAt"`
}

// Inspector captures and inspects BLE traffic.
// Phase 1: captures via HCI logs from Android (adb shell btsnoop).
// Future: Go-native BLE proxy via BlueZ bindings.
type Inspector struct {
	mu       sync.RWMutex
	packets  []Packet
	events   []ConnectionEvent
	onPacket func(Packet)
	onEvent  func(ConnectionEvent)
}

func NewInspector() *Inspector {
	return &Inspector{}
}

func (i *Inspector) OnPacket(fn func(Packet))           { i.onPacket = fn }
func (i *Inspector) OnEvent(fn func(ConnectionEvent))    { i.onEvent = fn }

func (i *Inspector) RecordPacket(p Packet) {
	i.mu.Lock()
	i.packets = append(i.packets, p)
	i.mu.Unlock()

	if i.onPacket != nil {
		i.onPacket(p)
	}
	log.Printf("BLE packet: %s %s/%s (%d bytes)", p.Direction, p.Service, p.Characteristic, p.Size)
}

func (i *Inspector) RecordEvent(e ConnectionEvent) {
	i.mu.Lock()
	i.events = append(i.events, e)
	i.mu.Unlock()

	if i.onEvent != nil {
		i.onEvent(e)
	}
	log.Printf("BLE event: %s", e.Event)
}

func (i *Inspector) GetSession() Session {
	i.mu.RLock()
	defer i.mu.RUnlock()

	s := Session{
		Packets:          make([]Packet, len(i.packets)),
		ConnectionEvents: make([]ConnectionEvent, len(i.events)),
	}
	copy(s.Packets, i.packets)
	copy(s.ConnectionEvents, i.events)

	if len(s.Packets) > 0 {
		s.StartedAt = s.Packets[0].Timestamp
		s.EndedAt = s.Packets[len(s.Packets)-1].Timestamp
	}
	return s
}

func (i *Inspector) Reset() {
	i.mu.Lock()
	i.packets = nil
	i.events = nil
	i.mu.Unlock()
}
