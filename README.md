# 🦡 Future Badgers Bracket Challenge

A kid-friendly March Madness bracket challenge site hosted on GitHub Pages.
Wisconsin red-and-white themed, built for elementary school kids on phones and tablets.

## Live Site

> `https://<your-username>.github.io/future-badgers-bracket/`

---

## How It Works

1. **Kid enters a nickname** on the welcome screen.
2. **Picks winners** round-by-round through the visual bracket (left half and right half meet at the Championship).
3. **Locks in bracket** — saved to GitHub Gist.
4. **Leaderboard** shows all entries ranked by score, auto-refreshing every 5 minutes.

### Scoring

| Round | Points |
|-------|--------|
| Round of 64 | 1 pt |
| Round of 32 | 2 pts |
| Sweet 16 | 4 pts |
| Elite 8 | 8 pts |
| Final Four | 16 pts |
| Championship | 32 pts |

---

## Admin: Setting Up `bracket-data.json`

You manage this file manually in the **Bracket Data Gist** (`798906720fa8cb351ffb485d9631a07f`).

### Initial setup (before tournament starts)

Create/update the file with all 64 teams. Regions: `East`, `West`, `South`, `Midwest`.

```json
{
  "teams": [
    { "seed": 1,  "name": "Connecticut",    "region": "East" },
    { "seed": 16, "name": "Stetson",        "region": "East" },
    { "seed": 8,  "name": "Florida Atlantic","region": "East" },
    { "seed": 9,  "name": "Northwestern",   "region": "East" },
    { "seed": 5,  "name": "San Diego State","region": "East" },
    { "seed": 12, "name": "UAB",            "region": "East" },
    { "seed": 4,  "name": "Auburn",         "region": "East" },
    { "seed": 13, "name": "Yale",           "region": "East" },
    { "seed": 6,  "name": "BYU",            "region": "East" },
    { "seed": 11, "name": "Duquesne",       "region": "East" },
    { "seed": 3,  "name": "Illinois",       "region": "East" },
    { "seed": 14, "name": "Morehead State", "region": "East" },
    { "seed": 7,  "name": "Washington State","region": "East" },
    { "seed": 10, "name": "Drake",          "region": "East" },
    { "seed": 2,  "name": "Iowa State",     "region": "East" },
    { "seed": 15, "name": "South Dakota St","region": "East" },
    ... (repeat for West, South, Midwest)
  ],
  "results": {}
}
```

---

### Updating results as games complete

Add winners to the `results` object under the appropriate round key.

**Round keys:** `round1` through `round6`
**gameId format:**
- Rounds 1–4: `{RegionLetter}{GameNumber}` — region letter (`E`/`W`/`S`/`M`), game number 1–8 (R1), 1–4 (R2), 1–2 (R3), `1` (R4)
- Round 5 (Final Four): `FF1` (East/West) or `FF2` (South/Midwest)
- Round 6 (Championship): `CHAMP`

**Game number reference (per region, Round 1):**
```
Game 1 → Seed 1  vs 16
Game 2 → Seed 8  vs 9
Game 3 → Seed 5  vs 12
Game 4 → Seed 4  vs 13
Game 5 → Seed 6  vs 11
Game 6 → Seed 3  vs 14
Game 7 → Seed 7  vs 10
Game 8 → Seed 2  vs 15
```

**Example after Round 1 completes:**
```json
{
  "teams": [...],
  "results": {
    "round1": [
      { "winner": "Connecticut",     "gameId": "E1" },
      { "winner": "Florida Atlantic","gameId": "E2" },
      { "winner": "San Diego State", "gameId": "E3" },
      { "winner": "Auburn",          "gameId": "E4" },
      { "winner": "BYU",             "gameId": "E5" },
      { "winner": "Illinois",        "gameId": "E6" },
      { "winner": "Washington State","gameId": "E7" },
      { "winner": "Iowa State",      "gameId": "E8" },
      ...West, South, Midwest games...
    ]
  }
}
```

**Example after Final Four + Championship:**
```json
"round5": [
  { "winner": "Connecticut", "gameId": "FF1" },
  { "winner": "Alabama",     "gameId": "FF2" }
],
"round6": [
  { "winner": "Connecticut", "gameId": "CHAMP" }
]
```

---

## File Structure

```
future-badgers-bracket/
├── index.html       ← Main app (all pages in one file)
├── config.js        ← Gist IDs and token
├── api.js           ← GitHub Gist read/write
├── bracket.js       ← Bracket state + rendering
├── leaderboard.js   ← Leaderboard scoring + display
└── .github/
    └── workflows/
        └── deploy.yml  ← GitHub Pages auto-deploy
```

## Gists

| Gist | Purpose |
|------|---------|
| `798906720fa8cb351ffb485d9631a07f` | `bracket-data.json` — teams + results (admin updates) |
| `ce956d289985b0f4e5228f3fe4ade758` | `bracket-picks.json` — all submitted brackets (app writes) |

## Deployment

Push to `main` → GitHub Actions builds and deploys to the `gh-pages` branch automatically.

Enable GitHub Pages in repo Settings → Pages → Source: `gh-pages` branch.
