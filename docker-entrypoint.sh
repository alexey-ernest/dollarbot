#!/bin/bash
set -e

if [ -z "$TELEGRAM_API_TOKEN" ]; then
    echo "TELEGRAM_API_TOKEN environment variable required"
    exit 1
fi

if [ -n "$REDIS_PORT_6379_TCP_ADDR" ] && [ -n "$REDIS_PORT_6379_TCP_PORT" ]; then
  export REDIS_ADDRESS="${REDIS_PORT_6379_TCP_ADDR}"
  export REDIS_PORT="${REDIS_PORT_6379_TCP_PORT}"
fi
echo "USING REDIS: ${REDIS_ADDRESS}:${REDIS_PORT}"

# execute nodejs application
exec npm start