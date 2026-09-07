#!/bin/bash
set -e

BRIDGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"

echo "Instalando Claude Code <-> Slack Bridge..."

mkdir -p "$HOOKS_DIR" "$BRIDGE_DIR/logs"

cp "$BRIDGE_DIR/hooks/"*.sh "$HOOKS_DIR/"
chmod +x "$HOOKS_DIR/"*.sh
echo "Hooks instalados en $HOOKS_DIR"

if [ ! -f "$BRIDGE_DIR/.env" ]; then
  cp "$BRIDGE_DIR/.env.example" "$BRIDGE_DIR/.env"
  echo "Archivo .env creado — completa SLACK_APP_TOKEN, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID"
fi

SETTINGS_FILE="$CLAUDE_DIR/settings.local.json"
if [ -f "$SETTINGS_FILE" ]; then
  echo "Ya existe $SETTINGS_FILE — fusiona manualmente con $BRIDGE_DIR/config/claude-settings.json"
else
  sed "s|/opt/claude-slack-bridge/hooks|$HOOKS_DIR|g" \
    "$BRIDGE_DIR/config/claude-settings.json" > "$SETTINGS_FILE"
  echo "$SETTINGS_FILE creado"
fi

cat > "$BRIDGE_DIR/start.sh" << STARTEOF
#!/bin/bash
set -a && source "$BRIDGE_DIR/.env" && set +a
node "$BRIDGE_DIR/server/index.js"
STARTEOF
chmod +x "$BRIDGE_DIR/start.sh"

if command -v systemctl &> /dev/null; then
  read -p "Instalar como servicio systemd? [y/N]: " -n 1 -r && echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo tee /etc/systemd/system/claude-slack-bridge.service > /dev/null << SERVICEEOF
[Unit]
Description=Claude Code Slack Bridge
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BRIDGE_DIR/server
EnvironmentFile=$BRIDGE_DIR/.env
ExecStart=/usr/bin/node $BRIDGE_DIR/server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF
    sudo systemctl daemon-reload
    sudo systemctl enable claude-slack-bridge
    sudo systemctl start claude-slack-bridge
    echo "Servicio instalado y corriendo"
  fi
fi

echo ""
echo "Instalacion completa."
echo "Prueba: bash $HOOKS_DIR/on-complete.sh 'Hola desde el bridge'"
