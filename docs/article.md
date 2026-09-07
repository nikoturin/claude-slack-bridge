# I built a Slack bridge for Claude Code so I don't have to watch the terminal

When you start using Claude Code for real work — not demos, but actual features, refactors, bug fixes across multiple projects — you quickly hit the same problem: the agent is working autonomously, but it still needs you at key moments.

Should it delete that legacy file? Which of the two approaches should it take? Should it restart the server after that config change?

Without a way to communicate back, you're either glued to the terminal or Claude makes an assumption and keeps going — sometimes right, sometimes not.

So I built a bidirectional bridge between Claude Code and Slack. It's been running in production on two projects for a few weeks now, and it changed how I work with the agent.

---

## What it does

```
Claude Code hits a decision point
        │
        │  fires on-question.sh hook
        ▼
   Slack notification on your phone
        │
        │  @Claude Code Bridge yes, proceed
        ▼
   Claude reads your response and continues
```

Claude also notifies you when it finishes a task — no more wondering if it's still working or waiting for you.

**No ngrok. No public URL.** It uses Slack Socket Mode, which means Slack opens a WebSocket connection to your server — your server doesn't need to be reachable from the internet.

---

## Architecture

Three moving parts:

**1. Shell hooks** — tiny bash scripts that Claude Code calls automatically via its hook system (`settings.local.json`).

**2. Bridge server** — Node.js + Slack Bolt SDK running as a systemd service. Receives hook calls, sends messages to Slack, listens for your replies via Socket Mode.

**3. Response file** — `/tmp/claude-slack-response.txt`. The simplest possible IPC between the server and the hooks. When you reply in Slack, the server writes your message to this file. The hook reads it and returns the text to Claude Code.

```
Claude Code
    │
    │  hook (bash script)
    ▼
Bridge Server (:3456)  ──────►  Slack
    ▲                              │
    │   your reply via @mention    │
    └──────────────────────────────┘
```

---

## How the question/response flow works

The `on-question.sh` hook sends the question and blocks until it gets a response:

```bash
#!/bin/bash
QUESTION="${*:-How do you want to continue?}"

RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"question\",\"message\":\"$QUESTION\",\"waitForResponse\":true}" \
  --max-time 310 \
  "http://localhost:3456/hook")

echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('response', ''))
except:
    pass
"
```

The bridge server listens for `app_mention` events via Socket Mode:

```javascript
slackApp.event("app_mention", async ({ event, say }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

  fs.writeFileSync(CONFIG.responseFile, text);

  await say({
    text: `✅ Got it: _"${text}"_ — Claude will continue shortly.`,
    thread_ts: event.ts,
  });
});
```

The server polls the response file every second. When it appears, it returns the content back through the HTTP response to the hook, which prints it to stdout — which Claude Code receives as the result of the bash command.

---

## Teaching Claude Code when to ask

Claude Code reads `~/.claude/CLAUDE.md` in every session. You can use this to define behavioral rules that apply across all your projects:

```markdown
## Slack Notifications

When you need user input, use the question hook:

RESPONSE=$(bash /opt/claude-slack-bridge/hooks/on-question.sh "YOUR QUESTION")
echo "User responded: $RESPONSE"

Always ask before:
- Modifying docker-compose.yml or infrastructure files
- Deleting existing files or code
- Changes that require restarting the server
- When there are two valid implementation options
```

For per-project rules, add a `.claude/CLAUDE.md` inside each project. Claude Code merges both automatically, with the project file taking priority.

---

## Per-project configuration

Each project gets two files in its `.claude/` directory:

**`.claude/settings.local.json`** — registers the completion hook:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/opt/claude-slack-bridge/hooks/on-complete.sh \"[my-project] Claude finished a task\""
          }
        ]
      }
    ]
  }
}
```

**`.claude/CLAUDE.md`** — project-specific rules for when to ask:

```markdown
# my-project

## Slack Notifications

RESPONSE=$(bash /opt/claude-slack-bridge/hooks/on-question.sh "[my-project] QUESTION")

Ask before:
- Modifying nginx config
- Database migrations
- Changes requiring server restart

No need to ask for:
- Frontend changes
- New files
- API endpoint changes
```

The `[my-project]` prefix in messages lets you identify which project sent the notification when running multiple projects on the same server — which is the whole point of running the bridge as a shared service.

---

## Why Socket Mode

Most Slack bot tutorials push you toward HTTP webhooks, which require a public URL. That means ngrok in development, or DNS + SSL setup in production.

Socket Mode flips this: your server opens a persistent WebSocket connection to Slack. Events flow through it. No inbound connections, no firewall rules, no cert management.

The tradeoff: Socket Mode is designed for internal tools, not apps distributed to other workspaces. For this use case — a bridge running on your own server for your own team — it's exactly right.

---

## What I learned

**Simple IPC is fine.** I considered Redis pub/sub, named pipes, unix sockets. Writing to a file and polling every second feels primitive but it's reliable, debuggable, and has zero extra dependencies. I'd choose it again.

**PostToolUse hooks are too aggressive for notifications.** My first version fired an error notification after every bash command. Claude Code runs dozens of bash commands per task — that's a lot of noise. The `Stop` hook fires once when Claude finishes working. That's the right granularity.

**CLAUDE.md is underused for behavioral rules.** Most people use it for project context. But you can use it to define how Claude behaves — when to ask, when to proceed, what to avoid. It's essentially a behavioral config file that applies across all your projects.

---

## What's next

The natural extension is CI/CD pipeline integration — using the same hooks inside GitHub Actions to ask for human approval when tests fail before deploying. The infrastructure is ready, but I'm not running that in production yet so I won't write it up as a feature until it is.

---

## Get the code

Everything is on GitHub — server, hooks, setup script, and examples for per-project configuration:

👉 **[github.com/YOUR_USERNAME/claude-slack-bridge](https://github.com/YOUR_USERNAME/claude-slack-bridge)**

Setup takes about 15 minutes if you already have Claude Code running on Linux.

---

*Running this in production on two projects. If you try it and hit issues, open an issue — happy to help.*
