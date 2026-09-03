#!/bin/bash
set -e

echo "=== Updating SCADA Platform (Fast Live Update) ==="

BACKEND_CID=$(sudo docker compose ps -q backend)
FRONTEND_CID=$(sudo docker compose ps -q frontend)

if [ -z "$BACKEND_CID" ] || [ -z "$FRONTEND_CID" ]; then
  echo "Containers not running. Starting them first..."
  sudo docker compose up -d
  sleep 2
  BACKEND_CID=$(sudo docker compose ps -q backend)
  FRONTEND_CID=$(sudo docker compose ps -q frontend)
fi

echo "[1/3] Copying updated backend source and compiling TypeScript inside container..."
sudo docker cp apps/backend/src/. "${BACKEND_CID}:/repo/apps/backend/src/"
sudo docker compose exec -T backend pnpm -C apps/backend build

echo "[2/3] Copying updated frontend build into Nginx..."
sudo docker cp apps/frontend/dist/. "${FRONTEND_CID}:/usr/share/nginx/html/"

echo "[3/3] Restarting backend & reloading Nginx..."
sudo docker compose restart backend
sudo docker compose restart frontend

echo "=== UPDATE SUCCESSFUL! SCADA Platform is live and running. ==="
