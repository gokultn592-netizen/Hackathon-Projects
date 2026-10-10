# Docker Cleanup — Orbital Eye DBMS Edition

Use these commands after running `docker-compose up` (or `docker build`) to fully remove all images, containers, networks, and volumes created by this project.

---

## 1. Stop and remove running containers

```bash
docker-compose down --remove-orphans
```

- Stops `orbital-eye-backend` and `orbital-eye-frontend` containers.
- Removes the `orbital-net` network.
- Keeps images (see step 2 for removal).

---

## 2. Remove Docker images

```bash
# Remove the built images specifically
docker rmi $(docker images -q --filter "reference=orbital-eye-*") 2>/dev/null || echo "No matching images"

# Or remove all dangling / unused images
docker image prune -a -f
```

---

## 3. Remove build cache (optional — frees disk space)

```bash
docker builder prune -f
```

---

## 4. Remove volumes (optional — deletes any persistent data)

```bash
# List volumes first to confirm
docker volume ls

# Remove project volumes (if any were defined)
docker-compose down --volumes
docker volume prune -f
```

---

## 5. Full one-line cleanup (destructive)

```bash
docker-compose down --rmi all --volumes --remove-orphans && docker builder prune -f && docker system prune -a -f --volumes
```

> ⚠️ This deletes ALL unused Docker data on the machine — images, networks, volumes, build cache. Only run if you want a complete reset.

---

## Verification (after cleanup)

```bash
# Confirm no containers remain
docker ps -a --filter "name=orbital-eye"

# Confirm no images remain
docker images --filter "reference=orbital-eye-*"

# Confirm no networks remain
docker network ls | grep orbital-net
```

All should return empty results after cleanup.

---

## Re-run the project (after cleanup)

```bash
# Rebuild and start
docker-compose up --build
```

---

## Ready-to-paste commands (no comments)

```bash
docker-compose down --remove-orphans
docker rmi $(docker images -q --filter "reference=orbital-eye-*") 2>/dev/null || true
docker image prune -a -f
docker builder prune -f
docker-compose down --volumes
docker volume prune -f
docker-compose down --rmi all --volumes --remove-orphans && docker builder prune -f && docker system prune -a -f --volumes
docker ps -a --filter "name=orbital-eye"
docker images --filter "reference=orbital-eye-*"
docker network ls | grep orbital-net
docker-compose up --build
```

The `.env` file is loaded by `docker-compose.yml` and passed to both services. No credentials are embedded in Docker images or this markdown file — they remain in `.env` only (env-only, never hardcoded).
