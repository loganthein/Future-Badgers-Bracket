// Future Badgers Bracket Challenge — Configuration
const CONFIG = {
  GIST_TOKEN:            localStorage.getItem('gist_token') || null,
  BRACKET_DATA_GIST_ID:  '798906720fa8cb351ffb485d9631a07f',
  PICKS_GIST_ID:         'ce956d289985b0f4e5228f3fe4ade758',
  BRACKET_DATA_FILENAME: 'bracket-data.json',
  PICKS_FILENAME:        'bracket-picks.json',
  LEADERBOARD_REFRESH_MS: 5 * 60 * 1000, // 5 minutes
};
