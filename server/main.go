package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

/* =====================
   TYPES
===================== */

type Client struct {
	conn *websocket.Conn
	key  string
}

type Room struct {
	id      string
	clients []*Client
}

/* =====================
   GLOBALS
===================== */

var (
	rooms = make(map[string]*Room)
	lock  sync.Mutex
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

/* =====================
   UTILS
===================== */

func genID() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}

/* =====================
   PAIRING
===================== */

func createRoom(w http.ResponseWriter, r *http.Request) {
	lock.Lock()
	defer lock.Unlock()

	id := genID()
	rooms[id] = &Room{id: id}

	json.NewEncoder(w).Encode(map[string]string{
		"room": id,
	})
}

func joinRoom(roomID string, c *Client) (*Room, bool) {
	lock.Lock()
	defer lock.Unlock()

	room, ok := rooms[roomID]
	if !ok {
		return nil, false
	}

	if len(room.clients) >= 2 {
		return nil, false
	}

	room.clients = append(room.clients, c)
	return room, true
}

/* =====================
   WEBSOCKET
===================== */

func wsHandler(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		http.Error(w, "room required", 400)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &Client{conn: conn}

	room, ok := joinRoom(roomID, client)
	if !ok {
		conn.Close()
		return
	}

	// read messages
	for {
		var msg map[string]string
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}

		// receive public key
		if msg["type"] == "key" {
			client.key = msg["key"]

			// if both keys exist → exchange
			if len(room.clients) == 2 &&
				room.clients[0].key != "" &&
				room.clients[1].key != "" {

				for i, c := range room.clients {
					peer := room.clients[1-i]
					c.conn.WriteJSON(map[string]string{
						"type": "peer-key",
						"key":  peer.key,
					})
				}
			}
			continue
		}

		// relay encrypted message
		if msg["type"] == "msg" {
			for _, c := range room.clients {
				if c != client {
					c.conn.WriteJSON(msg)
				}
			}
		}
	}
}

/* =====================
   MAIN
===================== */

func main() {
	http.HandleFunc("/pair/create", createRoom)
	http.HandleFunc("/ws", wsHandler)

	log.Println("Server running on :8080")
	http.ListenAndServe(":8080", nil)
}