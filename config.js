// Future Badgers Bracket Challenge — Configuration
const GIST_TOKEN     = null; // writes handled via GitHub Actions
const WORKFLOW_TOKEN = "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";// needs only actions:write scope — safe to expose publicly

const CONFIG = {
  BRACKET_DATA_GIST_ID:  '798906720fa8cb351ffb485d9631a07f',
  PICKS_GIST_ID:         'ce956d289985b0f4e5228f3fe4ade758',
  BRACKET_DATA_FILENAME: 'bracket-data.json',
  PICKS_FILENAME:        'bracket-picks.json',
  REPO_OWNER:            'loganthein',
  REPO_NAME:             'Future-Badgers-Bracket',
  LEADERBOARD_REFRESH_MS: 5 * 60 * 1000, // 5 minutes
};
