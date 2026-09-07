#!/bin/bash
EVENT_TYPE="${1:-info}"
MESSAGE="${2:-Sin mensaje}"
WAIT_FLAG="${3:-}"
BRIDGE_URL="http://localhost:3456/hook"

if [ "$WAIT_FLAG" = "--wait" ]; then
  PAYLOAD="{\"type\":\"$EVENT_TYPE\",\"message\":\"$MESSAGE\",\"waitForResponse\":true}"
else
  PAYLOAD="{\"type\":\"$EVENT_TYPE\",\"message\":\"$MESSAGE\",\"waitForResponse\":false}"
fi

RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$PAYLOAD" --max-time 310 "$BRIDGE_URL" 2>/dev/null)

if [ "$WAIT_FLAG" = "--wait" ]; then
  echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('response',''))" 2>/dev/null
fi
exit 0
