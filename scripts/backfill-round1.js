// One-time script: backfills missing East/South round 1 results into the Gist.
// Run with: GIST_TOKEN=your_token node scripts/backfill-round1.js

const fetch = require('node-fetch');

const GIST_ID    = '798906720fa8cb351ffb485d9631a07f';
const GIST_TOKEN = process.env.GIST_TOKEN;
if (!GIST_TOKEN) { console.error('GIST_TOKEN env var is missing.'); process.exit(1); }

const MISSING = [
  { gameId: 'E1', winner: 'Duke' },
  { gameId: 'E2', winner: 'TCU' },
  { gameId: 'E5', winner: 'Louisville' },
  { gameId: 'E6', winner: 'Michigan State' },
  { gameId: 'S3', winner: 'Vanderbilt' },
  { gameId: 'S4', winner: 'Nebraska' },
  { gameId: 'S5', winner: 'VCU' },
  { gameId: 'S6', winner: 'Illinois' },
  { gameId: 'S7', winner: 'Texas A&M' },
  { gameId: 'S8', winner: 'Houston' },
];

async function main() {
  const rawUrl = `https://gist.githubusercontent.com/loganthein/${GIST_ID}/raw/bracket-data.json?t=${Date.now()}`;
  const rawResp = await fetch(rawUrl);
  if (!rawResp.ok) throw new Error(`Failed to fetch Gist: ${rawResp.status}`);
  const bracketData = await rawResp.json();

  let results = bracketData.results;
  if (!results || Array.isArray(results)) results = {};
  for (let r = 1; r <= 6; r++) {
    if (!results[`round${r}`]) results[`round${r}`] = [];
  }

  let added = 0;
  for (const entry of MISSING) {
    const already = results.round1.find(e => e.gameId === entry.gameId);
    if (already) {
      console.log(`[skip] ${entry.gameId} already has winner: ${already.winner}`);
      continue;
    }
    results.round1.push(entry);
    console.log(`[add]  ${entry.gameId}: ${entry.winner}`);
    added++;
  }

  if (added === 0) {
    console.log('Nothing to add — all entries already present.');
    return;
  }

  const patchResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'Content-Type':  'application/json',
      'Accept':        'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      files: { 'bracket-data.json': { content: JSON.stringify({ ...bracketData, results }, null, 2) } },
    }),
  });

  if (!patchResp.ok) {
    const err = await patchResp.json().catch(() => ({}));
    throw new Error(err.message || `Gist PATCH failed: ${patchResp.status}`);
  }

  console.log(`\nDone — added ${added} results. Gist updated.`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
