#!/bin/bash
MSG="${*:-Tarea completada}"
curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"type\":\"complete\",\"message\":\"Tarea completada:\n${MSG}\",\"waitForResponse\":false}" \
  "http://localhost:3456/hook" > /dev/null 2>&1
exit 0
