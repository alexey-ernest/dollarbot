#!/bin/bash
set -e

if [ -z "$TELEGRAM_API_TOKEN" ]; then
    echo "TELEGRAM_API_TOKEN environment variable required"
    exit 1
fi

# execute nodejs application
exec npm start