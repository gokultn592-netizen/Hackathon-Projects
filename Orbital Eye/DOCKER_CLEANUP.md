# 🐳 Docker Management & Cleanup — OrbitalEye DBMS Edition

Use these commands to easily start, inspect, or fully reset Docker containers for OrbitalEye.

---

## 🚀 1. Starting the Project

### Option A: Standard (Connects to host Oracle XE)
```bash
docker compose up --build
```

### Option B: All-in-One (Includes containerized Oracle DB — no local Oracle install needed)
```bash
docker compose --profile with-db up --build
```

### Run in background (Detached mode)
```bash
docker compose up -d
```

---

## 🛑 2. Stopping Containers

```bash
docker compose down
```

To stop containers and also remove Docker networks created by the project:
```bash
docker compose down --remove-orphans
```

---

## 🧹 3. Quick Image Cleanup

Remove only the images built for OrbitalEye without touching other projects:
```bash
docker rmi orbital-eye-backend orbital-eye-frontend 2>/dev/null || true
```

---

## 🗑️ 4. Full Reset (Complete Cleanup)

Stops containers, removes networks, and purges project volumes:
```bash
docker compose down --volumes --remove-orphans
```

To prune unused build cache and dangling images:
```bash
docker builder prune -f
docker image prune -f
```

---

## 🔍 5. Verification

Check if any OrbitalEye containers are running:
```bash
docker ps -a --filter "name=orbital-eye"
```
Check project networks:
```bash
docker network ls | grep orbital-net
```
