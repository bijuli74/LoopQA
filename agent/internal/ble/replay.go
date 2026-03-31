package ble

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"
)

// Replayer replays a recorded BLE session, feeding packets to an Inspector
// at the original timing intervals. Used for regression testing without
// a physical watch.
type Replayer struct {
	inspector *Inspector
	session   Session
	speed     float64 // 1.0 = real-time, 2.0 = 2x speed
	stopCh    chan struct{}
}

func NewReplayer(inspector *Inspector, session Session) *Replayer {
	return &Replayer{
		inspector: inspector,
		session:   session,
		speed:     1.0,
		stopCh:    make(chan struct{}),
	}
}

func (r *Replayer) SetSpeed(speed float64) {
	if speed > 0 {
		r.speed = speed
	}
}

func (r *Replayer) Play() {
	log.Printf("BLE replay started: %d packets, %d events (%.1fx speed)",
		len(r.session.Packets), len(r.session.ConnectionEvents), r.speed)

	// Replay connection events first
	go r.replayEvents()

	// Replay packets with timing
	for i, pkt := range r.session.Packets {
		select {
		case <-r.stopCh:
			log.Println("BLE replay stopped")
			return
		default:
		}

		// Calculate delay to next packet
		if i > 0 {
			prev := r.session.Packets[i-1].Timestamp
			delay := pkt.Timestamp.Sub(prev)
			if delay > 0 {
				time.Sleep(time.Duration(float64(delay) / r.speed))
			}
		}

		r.inspector.RecordPacket(pkt)
	}

	log.Println("BLE replay completed")
}

func (r *Replayer) Stop() {
	close(r.stopCh)
}

func (r *Replayer) replayEvents() {
	for _, evt := range r.session.ConnectionEvents {
		select {
		case <-r.stopCh:
			return
		default:
		}
		r.inspector.RecordEvent(evt)
		time.Sleep(time.Duration(float64(100*time.Millisecond) / r.speed))
	}
}

// SaveSession writes a BLE session to a JSON file.
func SaveSession(session Session, path string) error {
	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// LoadSession reads a BLE session from a JSON file.
func LoadSession(path string) (Session, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Session{}, fmt.Errorf("read session: %w", err)
	}
	var session Session
	if err := json.Unmarshal(data, &session); err != nil {
		return Session{}, fmt.Errorf("unmarshal session: %w", err)
	}
	return session, nil
}
