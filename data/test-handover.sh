#!/bin/bash
# Builds a handover request from events.json + night-logs.md and sends to the API.
# Usage: ./data/test-handover.sh [base_url]
#   base_url defaults to http://localhost:3000

BASE_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

EVENTS=$(jq '.events' "$SCRIPT_DIR/events.json")
HOTEL=$(jq '.hotel' "$SCRIPT_DIR/events.json")
NIGHT_LOG_CONTENT=$(cat "$SCRIPT_DIR/night-logs.md")

jq -n \
  --argjson hotel "$HOTEL" \
  --argjson events "$EVENTS" \
  --arg nightLogContent "$NIGHT_LOG_CONTENT" \
  --arg targetDate "2026-05-30" \
  '{
    hotel: $hotel,
    events: $events,
    nightLogs: [{ date: "2026-05-27", content: $nightLogContent }],
    targetDate: $targetDate
  }' | curl -s -X POST "$BASE_URL/api/handover/generate" \
    -H "Content-Type: application/json" \
    -d @- | jq .
