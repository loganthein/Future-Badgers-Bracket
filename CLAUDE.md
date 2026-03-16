# Future Badgers Bracket Challenge — Claude Code Instructions

## Auto-commit Hook

A PostToolUse hook is configured in `.claude/settings.json` that automatically runs
`git add . && git commit -m "Auto-update" && git push` after every Write or Edit
tool call that produces changes. You do not need to manually commit or push —
it happens automatically after each file save.

## Project Overview

Single-page bracket challenge app hosted on GitHub Pages. All logic lives in:
- `index.html` — all HTML, CSS, and inline JS (page routing, admin setup)
- `config.js` — constants; `GIST_TOKEN` loads from `localStorage` at runtime
- `api.js` — GitHub Gist read/write (public GETs use no auth header)
- `bracket.js` — 63-game bracket state, rendering, pick propagation, scoring
- `leaderboard.js` — tabs (Overall / Badgers / Future Badgers), tiebreaker sort

## Key Conventions

- The Gist write token is hardcoded (split) in `config.js` as `GIST_TOKEN`.
- All Gist reads are unauthenticated (public gists). Only `_patchGist` sends `Authorization`.
- No frameworks, no build tools — vanilla HTML/CSS/JS only.
- The bracket uses a flat array of 63 picks indexed by `getGameIndex(round, regionIdx, gameInRegion)`.
