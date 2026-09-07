#!/bin/bash
ERROR_MSG="${*:-Error desconocido}"
curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"type\":\"error\",\"message\":\"Error encontrado:\n${ERROR_MSG}\",\"waitForResponse\":false}" \
  "http://localhost:3456/hook" > /dev/null 2>&1
exit 0
