// update-results.js
// Fetches completed NCAA tournament games from ESPN and updates bracket-data.json Gist.

const fetch = require('node-fetch');

// ── Date guard: only run during tournament window ──────────────────────────
const now   = new Date();
const START = new Date('2026-03-19T00:00:00Z');
const END   = new Date('2026-04-07T00:00:00Z');
if (now < START || now >= END) {
  console.log(`Outside tournament window (${now.toISOString()}). Nothing to do.`);
  process.exit(0);
}

// ── Constants ──────────────────────────────────────────────────────────────
const GIST_ID    = '798906720fa8cb351ffb485d9631a07f';
const GIST_TOKEN = process.env.GIST_TOKEN;
if (!GIST_TOKEN) { console.error('GIST_TOKEN env var is missing.'); process.exit(1); }

const REGIONS       = ['East', 'West', 'South', 'Midwest'];
const REGION_LETTER = { East: 'E', West: 'W', South: 'S', Midwest: 'M' };
const SEED_PAIRS    = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

// ESPN round number (1–6) → bracket-data.json key
const ROUND_KEY = { 1:'round1', 2:'round2', 3:'round3', 4:'round4', 5:'round5', 6:'round6' };

// Date ranges for 2026 NCAA tournament rounds (UTC-based, end is exclusive day)
// Verify these against the official bracket release if needed.
const ROUND_DATE_RANGES = [
  { round: 1, start: '2026-03-19', end: '2026-03-21' }, // R64:  Thu–Fri
  { round: 2, start: '2026-03-21', end: '2026-03-23' }, // R32:  Sat–Sun
  { round: 3, start: '2026-03-26', end: '2026-03-28' }, // S16:  Thu–Fri
  { round: 4, start: '2026-03-28', end: '2026-03-30' }, // E8:   Sat–Sun
  { round: 5, start: '2026-04-04', end: '2026-04-05' }, // FF:   Sat
  { round: 6, start: '2026-04-06', end: '2026-04-07' }, // Champ: Mon
];

// ESPN display name → our bracket team name (add entries as needed)
const ESPN_NAME_MAP = {
  'Connecticut':       'UConn',
  'Michigan St.':      'Michigan State',
  'North Dakota St.':  'North Dakota State',
  "St. John's (NY)":   "St. John's",
  'Miami':             'Miami (FL)',
  'Miami OH':          'Miami (OH)',
  'N.C. State':        'NC State',
  'Prairie View':      'Prairie View A&M',
  'Tennessee St.':     'Tennessee State',
  'Wright St.':        'Wright State',
  'Kennesaw St.':      'Kennesaw State',
};

function mapName(espnName) {
  return ESPN_NAME_MAP[espnName] || espnName;
}

// ── Round detection ────────────────────────────────────────────────────────

function detectRound(event) {
  // 1. Try ESPN's own round/type fields (most reliable when present)
  const typeId = parseInt(event?.competitions?.[0]?.type?.id, 10);
  if (typeId >= 1 && typeId <= 6) return typeId;

  // 2. Parse event name / notes
  const name = (event?.name || event?.shortName || '').toLowerCase();
  if (name.includes('first round')   || name.includes('round of 64'))  return 1;
  if (name.includes('second round')  || name.includes('round of 32'))  return 2;
  if (name.includes('sweet 16')      || name.includes('sweet sixteen')) return 3;
  if (name.includes('elite eight')   || name.includes('elite 8'))       return 4;
  if (name.includes('final four'))                                       return 5;
  if (name.includes('championship')  || name.includes('national final')) return 6;

  // 3. Fall back to game date
  const d = (event?.date || '').slice(0, 10);
  for (const { round, start, end } of ROUND_DATE_RANGES) {
    if (d >= start && d < end) return round;
  }

  return null;
}

// ── Bracket helpers ────────────────────────────────────────────────────────

function getTeamInfo(name, teams) {
  for (const region of REGIONS) {
    const t = (teams[region] || []).find(t => t.name === name);
    if (t) return { ...t, region };
  }
  return null;
}

// Returns the 0-based index (0–7) of the seed pair this seed belongs to
function seedPairIndex(seed) {
  return SEED_PAIRS.findIndex(pair => pair.includes(seed));
}

function buildGameId(roundNum, info1, info2) {
  // Championship
  if (roundNum === 6) return 'CHAMP';

  // Final Four: FF1 = East/South, FF2 = West/Midwest
  if (roundNum === 5) {
    const r1 = info1?.region;
    const r2 = info2?.region;
    const leftRegions = new Set(['East', 'South']);
    if ((leftRegions.has(r1) || leftRegions.has(r2))) return 'FF1';
    return 'FF2';
  }

  // Regional rounds 1–4
  const roundIdx = roundNum - 1; // convert to 0-based
  // Use whichever team we have info for (prefer the one with a valid seed pair)
  const info = [info1, info2].find(i => i && seedPairIndex(i.seed) >= 0);
  if (!info) return null;

  const letter  = REGION_LETTER[info.region];
  const r64Slot = seedPairIndex(info.seed);            // 0–7
  const gameNum = Math.floor(r64Slot / Math.pow(2, roundIdx)) + 1; // 1-based
  return `${letter}${gameNum}`;
}

// ── API calls ──────────────────────────────────────────────────────────────

async function fetchBracketData() {
  const url  = `https://gist.githubusercontent.com/loganthein/${GIST_ID}/raw/bracket-data.json?t=${Date.now()}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Bracket data fetch failed: ${resp.status}`);
  return resp.json();
}

function espnDateStr(d) {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}${mm}${dd}`;
}

async function fetchESPN() {
  // Fetch yesterday + today so games that finished late the previous day are included.
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const dateRange = `${espnDateStr(yesterday)}-${espnDateStr(today)}`;

  const url  = `http://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=200&dates=${dateRange}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ESPN API failed: ${resp.status}`);
  return resp.json();
}

async function patchGist(data) {
  const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'Content-Type':  'application/json',
      'Accept':        'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      files: { 'bracket-data.json': { content: JSON.stringify(data, null, 2) } },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Gist PATCH failed: ${resp.status}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const [bracketData, espnData] = await Promise.all([fetchBracketData(), fetchESPN()]);

  const teams = bracketData.teams || {};

  // Normalise results to the object format (handles flat-array Gist content too)
  let results = bracketData.results;
  if (!results || Array.isArray(results)) results = {};
  for (let r = 1; r <= 6; r++) {
    if (!results[`round${r}`]) results[`round${r}`] = [];
  }

  let changed = false;

  for (const event of (espnData.events || [])) {
    const comp = event.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;

    const competitors = comp.competitors || [];
    const winnerComp  = competitors.find(c => c.winner);
    if (!winnerComp) continue;

    const winnerName = mapName(winnerComp.team?.displayName || winnerComp.team?.name || '');
    const name1 = mapName(competitors[0]?.team?.displayName || competitors[0]?.team?.name || '');
    const name2 = mapName(competitors[1]?.team?.displayName || competitors[1]?.team?.name || '');

    const roundNum = detectRound(event);
    if (!roundNum) {
      console.warn(`  [skip] Could not detect round: ${name1} vs ${name2}`);
      continue;
    }

    const roundKey = ROUND_KEY[roundNum];
    const info1    = getTeamInfo(name1, teams);
    const info2    = getTeamInfo(name2, teams);
    const gameId   = buildGameId(roundNum, info1, info2);

    if (!gameId) {
      console.warn(`  [skip] Could not build gameId: ${name1} vs ${name2} (round ${roundNum})`);
      continue;
    }

    const existing = results[roundKey].find(e => e.gameId === gameId);
    if (existing) {
      if (existing.winner !== winnerName) {
        existing.winner = winnerName;
        changed = true;
        console.log(`  [update] ${roundKey} ${gameId}: ${winnerName}`);
      }
      continue;
    }

    results[roundKey].push({ winner: winnerName, gameId });
    changed = true;
    console.log(`  [add] ${roundKey} ${gameId}: ${winnerName}`);
  }

  if (!changed) {
    console.log('No new results. Gist unchanged.');
    return;
  }

  await patchGist({ ...bracketData, results });
  console.log('Gist updated successfully.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
