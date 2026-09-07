#!/bin/bash
QUESTION="${*:-Como deseas continuar?}"
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"type\":\"question\",\"message\":\"Claude necesita tu input:\n\n${QUESTION}\",\"waitForResponse\":true}" \
  --max-time 310 "http://localhost:3456/hook" 2>/dev/null)
echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('response',''))" 2>/dev/null
