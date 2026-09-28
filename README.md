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

## Development
Node comes from `.tool-versions` (asdf). Then:
```
npm install
npx playwright install chromium webkit
cp .dev.vars.example .dev.vars
npm run db:migrate:local && npm run db:seed
npm run dev
```
The full setup, the Cloudflare and Google checklist, and deploying are in `docs/setup.md`.
