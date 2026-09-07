/**
 * Claude Code <-> Slack Bridge Server
 * Slack Bolt SDK con Socket Mode
 *
 * Env vars requeridas:
 *   SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_CHANNEL_ID
 */

const { App } = require("@slack/bolt");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  port: process.env.PORT || 3456,
  slackBotToken: process.env.SLACK_BOT_TOKEN || "",
  slackAppToken: process.env.SLACK_APP_TOKEN || "",
  slackChannelId: process.env.SLACK_CHANNEL_ID || "",
  responseFile: process.env.RESPONSE_FILE || "/tmp/claude-slack-response.txt",
  logFile: path.join(__dirname, "../logs/bridge.log"),
};

const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function log(level, msg, data = {}) {
  const entry = `[${new Date().toISOString()}] [${level}] ${msg} ${
    Object.keys(data).length ? JSON.stringify(data) : ""
  }\n`;
  fs.appendFileSync(CONFIG.logFile, entry);
  console.log(entry.trim());
}

if (!CONFIG.slackBotToken || !CONFIG.slackAppToken || !CONFIG.slackChannelId) {
  log("ERROR", "Faltan variables de entorno", {
    SLACK_BOT_TOKEN: !!CONFIG.slackBotToken,
    SLACK_APP_TOKEN: !!CONFIG.slackAppToken,
    SLACK_CHANNEL_ID: !!CONFIG.slackChannelId,
  });
  process.exit(1);
}

const slackApp = new App({
  token: CONFIG.slackBotToken,
  appToken: CONFIG.slackAppToken,
  socketMode: true,
  logLevel: "warn",
});

let botUserId = null;

async function getBotUserId() {
  try {
    const result = await slackApp.client.auth.test();
    botUserId = result.user_id;
    log("INFO", "Bot conectado", { botUserId, team: result.team });
  } catch (err) {
    log("ERROR", "No se pudo obtener bot user ID", { error: err.message });
  }
}

async function sendToSlack(message, eventType = "info", threadTs = null) {
  const emoji = { question: "❓", error: "🔴", complete: "✅", start: "🚀", info: "ℹ️" }[eventType] || "🤖";
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `${emoji} *Claude Code — ${eventType.toUpperCase()}*\n\n${message}` } },
  ];
  if (eventType === "question") {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "💬 *Responde mencionando* `@Claude Code` *para continuar.*" } });
  }
  const result = await slackApp.client.chat.postMessage({
    channel: CONFIG.slackChannelId,
    text: `${emoji} Claude Code — ${eventType.toUpperCase()}: ${message}`,
    blocks,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });
  log("INFO", "Mensaje enviado a Slack", { ts: result.ts, type: eventType });
  return result.ts;
}

function waitForSlackResponse(timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(CONFIG.responseFile)) fs.unlinkSync(CONFIG.responseFile);
    log("INFO", "Esperando respuesta de Slack...");
    const interval = setInterval(() => {
      if (fs.existsSync(CONFIG.responseFile)) {
        const response = fs.readFileSync(CONFIG.responseFile, "utf8").trim();
        fs.unlinkSync(CONFIG.responseFile);
        clearInterval(interval);
        clearTimeout(timeout);
        log("INFO", "Respuesta recibida", { response });
        resolve(response);
      }
    }, 1000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Timeout esperando respuesta (5 min)"));
    }, timeoutMs);
  });
}

slackApp.event("app_mention", async ({ event, say }) => {
  if (event.bot_id || event.user === botUserId) return;
  const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
  log("INFO", "Mencion recibida", { user: event.user, text });
  fs.writeFileSync(CONFIG.responseFile, text);
  await say({ text: `✅ Recibido: _"${text}"_ — Claude continuara en breve.`, thread_ts: event.ts });
});

slackApp.message(async ({ message, say }) => {
  if (message.channel_type !== "im") return;
  if (message.bot_id || message.user === botUserId) return;
  const text = message.text?.trim();
  if (!text) return;
  log("INFO", "DM recibido", { user: message.user, text });
  fs.writeFileSync(CONFIG.responseFile, text);
  await say(`✅ Recibido: _"${text}"_ — Claude continuara en breve.`);
});

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.port}`);
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }

  if (req.method === "POST" && url.pathname === "/hook") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { type = "info", message = "", waitForResponse = false } = JSON.parse(body);
        log("INFO", "Hook recibido", { type, waitForResponse });
        const ts = await sendToSlack(message, type);
        if (waitForResponse) {
          try {
            const response = await waitForSlackResponse();
            await sendToSlack(`Claude retoma con: _"${response}"_`, "info", ts);
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, response }));
          } catch (err) {
            await sendToSlack("Timeout: no se recibio respuesta en 5 minutos.", "error", ts);
            res.writeHead(408);
            res.end(JSON.stringify({ ok: false, error: "timeout" }));
          }
        } else {
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        }
      } catch (err) {
        log("ERROR", "Error en /hook", { error: err.message });
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, botUserId, config: { channel: CONFIG.slackChannelId, socketMode: true } }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

(async () => {
  await slackApp.start();
  log("INFO", "Slack Bolt Socket Mode conectado");
  await getBotUserId();
  httpServer.listen(CONFIG.port, () => {
    log("INFO", `HTTP Server corriendo en puerto ${CONFIG.port}`);
    log("INFO", "Bridge listo");
  });
})();

process.on("SIGTERM", async () => {
  log("INFO", "Deteniendo bridge...");
  await slackApp.stop();
  httpServer.close();
});
