#!/bin/bash
# Source .env then run deploy — avoids hardcoding and avoids set -e conflict
set -a
source ../.env
set +a
export ORACLE_USER ORACLE_PASS ORACLE_HOST ORACLE_PORT ORACLE_SERVICE
bash deploy.sh "$@"
