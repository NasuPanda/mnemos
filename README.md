# Mnemos
## Setup
Onetime setup inside Claude Code:
```
/plugin marketplace add cloudflare/skills
/plugin install cloudflare@cloudflare
```
Then in the terminal:
```
claude mcp add --transport http cloudflare-docs https://docs.mcp.cloudflare.com/mcp
claude mcp add playwright npx @playwright/mcp@latest
```
