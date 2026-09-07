# Claude Code <-> Slack Bridge

> Keep Claude Code moving without staying glued to the terminal.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![Platform](https://img.shields.io/badge/platform-Linux-lightgrey.svg)
![Status](https://img.shields.io/badge/status-production-brightgreen.svg)

## What it does

```
Claude Code hits a decision point
        |
        |  fires on-question.sh
        v
   Slack notification -> your phone
        |
        |  @Claude Code Bridge yes, proceed
        v
   Claude reads response and continues
```

No ngrok. No public URL. Uses Slack Socket Mode.

## Project Structure

```
claude-slack-bridge/
├── README.md
├── LICENSE
├── .gitignore                      <- node_modules, .env, logs excluded
├── .env.example                    <- copy to .env and fill tokens
├── package.json
├── server/
│   └── index.js                    <- Slack Bolt + Socket Mode
├── hooks/
│   ├── on-complete.sh              <- task finished notification
│   ├── on-error.sh                 <- error notification
│   ├── on-question.sh              <- ask and wait for Slack response
│   └── notify.sh                   <- generic hook
├── config/
│   └── claude-settings.json        <- base for ~/.claude/settings.local.json
├── scripts/
│   └── setup.sh                    <- auto-installer (hooks + systemd)
├── examples/
│   ├── project-settings.json       <- template: .claude/settings.local.json
│   ├── project-CLAUDE.md           <- template: .claude/CLAUDE.md
│   └── github-actions.yml          <- CI/CD integration (experimental)
├── docs/
│   └── article.md                  <- Dev.to / Hashnode article
└── logs/                           <- runtime logs (git ignored)
```

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/claude-slack-bridge.git
cd claude-slack-bridge
npm install
cp .env.example .env && nano .env
bash scripts/setup.sh
bash hooks/on-complete.sh "Bridge is working!"
```

## Slack App Setup

Go to https://api.slack.com/apps -> Create New App -> From a manifest:

```yaml
display_information:
  name: Claude Code Bridge
  background_color: "#1a1a2e"
features:
  bot_user:
    display_name: Claude Code
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write
      - channels:history
      - channels:read
      - groups:history
      - im:history
      - im:write
      - app_mentions:read
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  socket_mode_enabled: true
  token_rotation_enabled: false
```

| Token | Where |
|-------|-------|
| SLACK_APP_TOKEN (xapp-...) | Basic Information -> App-Level Tokens -> scope: connections:write |
| SLACK_BOT_TOKEN (xoxb-...) | OAuth & Permissions -> Install to Workspace |
| SLACK_CHANNEL_ID | Right-click channel -> View channel details |

Then invite the bot: `/invite @Claude Code Bridge`

## Per-project integration

```bash
cp examples/project-settings.json /your-project/.claude/settings.local.json
cp examples/project-CLAUDE.md     /your-project/.claude/CLAUDE.md
```

Edit both files replacing `my-project` with your project name.

## Hooks

| Hook | Use | Waits |
|------|-----|-------|
| on-complete.sh | Task finished | No |
| on-error.sh | Error | No |
| on-question.sh | Needs input | Yes (5 min) |
| notify.sh | Generic | Optional |

## Troubleshooting

| Error | Fix |
|-------|-----|
| missing_scope | Add scopes in OAuth & Permissions, reinstall app |
| channel_not_found | /invite @Claude Code Bridge |
| SLACK_APP_TOKEN false | Add xapp-... to .env, restart service |
| Service exits | Run node server/index.js directly to see error |

## Roadmap

- [ ] CI/CD pipeline integration (GitHub Actions self-hosted runner)
- [ ] Multi-channel routing per project
- [ ] Response history log

## License

MIT
