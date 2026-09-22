# 🏥 Hospital Queue Management System

A lightweight, mobile-friendly Hospital Queue Management System built with Node.js, Express, and WebSockets. It provides instant real-time synchronization between patients, doctors, and waiting room displays.

---

## 🚀 Quick Start

### 1. Start the Server
```bash
npm start
```
The server will start at:
- **Web App**: `http://localhost:3000`
- **Patient View**: `http://localhost:3000/#patient`
- **Doctor Console**: `http://localhost:3000/#doctor`
- **Public TV Display**: `http://localhost:3000/#display`

> **Mobile Access**: To test on actual smartphones on the same Wi-Fi network, open `http://<YOUR_COMPUTER_IP>:3000` in the phone's mobile browser.

---

## ✨ Features

### 1. 🩺 Patient Portal (Self-Registration & Live Status)
- **Fast 15-second registration**: Enter Patient Name, optional Age, Department, and Reason for visit.
- **Instant Digital Token**: Automatically assigns sequential tokens (e.g. `A-001`, `A-002`).
- **Live Queue Tracking**:
  - Displays token number, current status badge (*Waiting in Queue*, *Now Serving*, *Completed*, *Missed*).
  - Shows exact number of patients ahead.
  - Dynamically calculates estimated wait time (`people ahead × avg consultation time`).
  - Automatically updates in real time without refreshing.
- **Turn Alert Banner & Chime**: When called by the doctor, the patient's phone flashes an alert banner, vibrates (on mobile), and plays an audio announcement to proceed to the consultation room.
- **Token Lookup**: Patients who close their tab can re-enter their token number to resume live tracking.

### 2. 👨‍⚕️ Doctor Dashboard
- **Now In Consultation Card**: Displays current patient's token, name, age, reason, and a live consultation elapsed timer (`⏱️ 04:12`).
- **One-Click Controls**:
  - **Call Next Patient**: Advances the queue, marks the previous patient completed, and broadcasts the new turn instantly.
  - **Complete Consultation**: Finishes current consultation.
  - **No-Show / Skip**: Moves absent patient to the Skipped list.
  - **Re-Announce / Recall**: Plays the audio chime again or restores a skipped patient back to the front of the queue.
- **Live Waiting Queue**: Real-time list ordered by arrival time with instant skip actions.
- **Dynamic Calibration**: Live slider/input to adjust average consultation time (e.g., 5 to 20 minutes) which immediately recalculates estimated wait times for all waiting patients.
- **Summary Statistics**: Real-time counter of Waiting, Now Serving, Completed, and Skipped patients.

### 3. 📺 Public Waiting Room TV Display
- High-contrast, large-font clinical display designed for clinic TV monitors.
- Shows giant **NOW SERVING** token, Room Number, Patient Name, and the next 4 upcoming tokens.
- Live digital clock and audio announcements.

### 4. ⚡ Real-Time Architecture
- Zero database setup required: Uses in-memory state with JSON persistence (`queue-state.json`).
- WebSocket synchronization broadcasts all actions across all open devices in <10ms.
- Built-in `BroadcastChannel` fallback for multi-tab browser synchronization.
- Web Audio API synthetic 2-tone hospital chime + speech synthesis.

---

## 📁 Project Structure

```
├── server.js              # Express & WebSocket server with queue state logic
├── package.json           # Dependencies (express, ws)
├── queue-state.json       # Auto-saved snapshot of the queue
└── public/
    ├── index.html         # Responsive Single Page Application (3 views)
    ├── style.css          # Healthcare-themed, soothing responsive CSS
    ├── audio.js           # Web Audio API chime and voice announcement
    └── app.js             # Client WebSocket sync, routing, and UI controllers
```
