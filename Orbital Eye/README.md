# 🛰️ Orbital Eye — Satellite Collision Avoidance System
### DBMS Edition · Oracle XE · FastAPI · React · TypeScript

[![Watch the Orbital Eye Cinematic Showcase](https://img.youtube.com/vi/AuykokUP0FY/maxresdefault.jpg)](https://youtu.be/AuykokUP0FY)

> **📺 [Watch the Official 2-Minute Cinematic Motion Graphic on YouTube](https://youtu.be/AuykokUP0FY)**

---

## 🌌 Overview

**Orbital Eye** is an enterprise-grade space traffic management and satellite collision prediction system designed to monitor active low-Earth orbit (LEO) satellites, predict high-risk close-encounter events, and prevent catastrophic orbital collisions.

In 2009, the **Iridium 33 × Cosmos 2251** disaster marked the first accidental hypervelocity collision between two artificial satellites, creating over 2,000 pieces of trackable space debris that remain in orbit today. With over **27,000 objects** now orbiting Earth, Orbital Eye provides the relational database power and real-time visualization needed to ensure space remains collision-free.

---

## 🎬 2-Minute Cinematic Motion Graphic

A procedural 13-scene motion graphic was built from scratch using **HyperFrames** and **GSAP**, rendered in 1080p Full HD, and scored with a custom procedural cinematic soundtrack:

| Feature | Details |
|---|---|
| **YouTube Video** | **[Watch on YouTube](https://youtu.be/AuykokUP0FY)** |
| **Local Master Video** | [`motion_graphic/orbital_eye_master.mp4`](./motion_graphic/orbital_eye_master.mp4) |
| **Duration** | **120.00s (2:00.00)** — 3,600 frames @ 30fps |
| **Resolution** | 1920 × 1080 Full HD |
| **Audio** | 48 kHz Stereo AAC @ 320 kbps (Procedural Ambient Drone → Sci-Fi Thriller Percussion → Space Opera Crescendo) |

### Scenes Breakdown
* **Scene 1–3**: The Threat in the Void (27,000 satellites, dramatic Orbital Eye title reveal).
* **Scene 4–5**: Problem Statement (2009 Iridium 33 collision and expanding debris particle field).
* **Scene 6–10**: How It Works (TLE data ingestion, Oracle XE database, collision prediction engine, dashboard, production tech stack).
* **Scene 11–13**: Impact numbers (`< 5km` critical alerts, team reveal, and cinematic horizon resolve).

---

## 🛠️ Production Architecture

```
                 ┌────────────────────────────────────────┐
                 │       TLE Ingestion (CelesTrak)        │
                 │  Starlink · OneWeb · Science · Weather │
                 └───────────────────┬────────────────────┘
                                     │
                                     ▼
                 ┌────────────────────────────────────────┐
                 │         orbital_eye_etl.py             │
                 │      SGP4 Orbital Propagator           │
                 └───────────────────┬────────────────────┘
                                     │
                                     ▼
                 ┌────────────────────────────────────────┐
                 │     Oracle Database 21c XE             │
                 │  OPERATORS · SATELLITES · TLE_SETS     │
                 │  ENCOUNTER_PAIRS · EVENTS · DEBRIS     │
                 └───────────────────┬────────────────────┘
                                     │
                                     ▼
                 ┌────────────────────────────────────────┐
                 │          FastAPI Backend               │
                 │    Connection Pooling & Prediction     │
                 └───────────────────┬────────────────────┘
                                     │
                                     ▼
                 ┌────────────────────────────────────────┐
                 │      React + TypeScript Frontend       │
                 │     @tanstack/react-virtual Table      │
                 └────────────────────────────────────────┘
```

---

## ⚡ Key Features

- **Dataset Toggle**: Seamlessly switch between `REALTIME` active orbital telemetry and the historical `ACCIDENT` dataset (Iridium 33 × Cosmos 2251).
- **Collision Prediction Engine**:
  - 🔴 **Miss Distance < 5 km** → `CRITICAL ALERT`
  - 🟡 **Miss Distance 5–20 km** → `WARNING`
  - 🟢 **Miss Distance > 20 km** → `NOMINAL / SAFE`
- **Virtualized High-Performance Table**: Powered by `@tanstack/react-virtual` to smoothly render hundreds of concurrent orbital encounters at 60 FPS.
- **Relational Integrity**: 6 interconnected Oracle tables with strict foreign key constraints, `CHECK` dataset tags, and parameterized bind variables.
- **CSV Telemetry Export**: One-click timestamped telemetry export for mission planning and post-pass orbital analysis.
- **Resilient UI**: Error boundaries, automated health checking, and bi-directional URL synchronization supporting browser history navigation.

---

## 💻 Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| **Database** | Oracle Database XE (21c) | Relational storage for operators, satellites, encounters, and debris |
| **Backend** | Python / FastAPI / cx_Oracle | Asynchronous REST API, connection pooling, and collision calculation |
| **Frontend** | React 18, TypeScript, Vite | Mission control dashboard and real-time visualization |
| **Table Virtualization** | `@tanstack/react-virtual` | 60 FPS rendering of dense orbital encounter telemetry |
| **Containerization** | Docker & Docker Compose | Isolated multi-container deployment |
| **Motion Graphics** | HyperFrames & GSAP 3 | Cinematic 120s explainer video with procedural audio |

---

## 🚀 Quickstart

### Prerequisites
- Python 3.10+
- Oracle Database XE (or Docker)
- Node.js 18+

### One-Click Launch (Windows)
Run the automated launcher:
```cmd
run.bat
```
This script will:
1. Validate database connection to Oracle XE (`XEPDB1`).
2. Run database health checks.
3. Start the FastAPI backend server (`http://localhost:8000`).
4. Start the React frontend dev server (`http://localhost:5173`).
5. Open the Orbital Eye dashboard automatically in your browser.

---

## 👥 The Team

**VIT Vellore — Integrated M.Tech Data Science**
* **Gokulnath**
* **Tamilmani**
* **Harish**

> *"Built with passion. Built to last."*
