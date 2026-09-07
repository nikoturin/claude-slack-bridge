# my-project — Claude Code Instructions

## Slack Notifications

When you need user input:

```bash
RESPONSE=$(bash /opt/claude-slack-bridge/hooks/on-question.sh "[my-project] YOUR QUESTION")
echo "User responded: $RESPONSE"
```

### Always ask before:
- Modifying docker-compose.yml or infrastructure files
- Deleting existing files or code
- Changes that require restarting the server
- When there are two valid implementation options

### No need to ask for:
- Creating new files
- Frontend/backend changes that don't affect infrastructure

## Stack
- Describe your stack here
