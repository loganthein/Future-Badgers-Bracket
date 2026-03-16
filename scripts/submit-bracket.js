// submit-bracket.js
// Called by the submit-bracket.yml workflow to safely write a pick to the Gist.
// Exit codes: 0 = success, 2 = nickname already taken, 1 = other error.

const fetch = require('node-fetch');

const GIST_TOKEN = process.env.GIST_TOKEN;
const PICKS_GIST_ID = 'ce956d289985b0f4e5228f3fe4ade758';
const PICKS_FILENAME = 'bracket-picks.json';

if (!GIST_TOKEN) {
  console.error('GIST_TOKEN env var is missing.');
  process.exit(1);
}

const nickname   = (process.env.NICKNAME   || '').trim();
const type       = (process.env.TYPE       || '').trim();
const picksRaw   = (process.env.PICKS      || '').trim();
const tbRaw      = (process.env.TIEBREAKER || '').trim();

if (!nickname || !type || !picksRaw) {
  console.error('Missing required inputs.');
  process.exit(1);
}

async function main() {
  // Fetch current picks
  const rawUrl = `https://gist.githubusercontent.com/loganthein/${PICKS_GIST_ID}/raw/${PICKS_FILENAME}?t=${Date.now()}`;
  const rawResp = await fetch(rawUrl);
  let current = {};
  if (rawResp.ok) {
    const text = await rawResp.text();
    if (text.trim() && text.trim() !== 'null') {
      current = JSON.parse(text);
    }
  }

  // Duplicate check
  if (current[nickname]) {
    console.log('NICKNAME_TAKEN');
    process.exit(2);
  }

  // Add new entry
  current[nickname] = {
    picks:       JSON.parse(picksRaw),
    type,
    tiebreaker:  tbRaw !== '' ? parseInt(tbRaw, 10) : null,
    submittedAt: new Date().toISOString(),
  };

  // PATCH the Gist
  const patchResp = await fetch(`https://api.github.com/gists/${PICKS_GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'Content-Type':  'application/json',
      'Accept':        'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      files: { [PICKS_FILENAME]: { content: JSON.stringify(current, null, 2) } },
    }),
  });

  if (!patchResp.ok) {
    const err = await patchResp.json().catch(() => ({}));
    console.error('Gist PATCH failed:', err.message || patchResp.status);
    process.exit(1);
  }

  console.log(`{"success":true,"nickname":"${nickname}"}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
