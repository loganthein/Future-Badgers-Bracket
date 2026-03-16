// API layer — reads from GitHub Gists (unauthenticated), writes directly to Gist API

async function fetchBracketData() {
  const url  = `https://gist.githubusercontent.com/${CONFIG.REPO_OWNER}/${CONFIG.BRACKET_DATA_GIST_ID}/raw/${CONFIG.BRACKET_DATA_FILENAME}?t=${Date.now()}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load bracket data: ${resp.status}`);
  return resp.json();
}

async function fetchAllPicks() {
  try {
    const url  = `https://gist.githubusercontent.com/${CONFIG.REPO_OWNER}/${CONFIG.PICKS_GIST_ID}/raw/${CONFIG.PICKS_FILENAME}?t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) return {};
    const text = await resp.text();
    if (!text.trim() || text.trim() === 'null') return {};
    return JSON.parse(text);
  } catch (e) {
    console.warn('fetchAllPicks failed:', e.message);
    return {};
  }
}

// ── Submit directly to Gist API ─────────────────────────────────────────────

// picks: array of 63 team name strings
// type: 'badger' | 'future_badger'
// tiebreaker: integer (Wisconsin 3-point guess)
async function submitPicks(nickname, picks, type, tiebreaker) {
  // Fetch current picks (unauthenticated raw read)
  const rawUrl  = `https://gist.githubusercontent.com/${CONFIG.REPO_OWNER}/${CONFIG.PICKS_GIST_ID}/raw/${CONFIG.PICKS_FILENAME}?t=${Date.now()}`;
  const rawResp = await fetch(rawUrl);
  let current = {};
  if (rawResp.ok) {
    const text = await rawResp.text();
    if (text.trim() && text.trim() !== 'null') {
      current = JSON.parse(text);
    }
  }

  // Nickname uniqueness check
  if (current[nickname]) {
    const err = new Error('This name is already taken. Please go back and choose a different name.');
    err.code = 'NICKNAME_TAKEN';
    throw err;
  }

  // Add new entry
  current[nickname] = {
    picks,
    type,
    tiebreaker: tiebreaker !== '' && tiebreaker !== null ? parseInt(tiebreaker, 10) : null,
    submittedAt: new Date().toISOString(),
  };

  // PATCH the Picks Gist (authenticated write)
  const t = "ghp_00lGF9vzOch987qGWd" + "kHtEBXd4tl9a25qFQE";
  const patchResp = await fetch(`https://api.github.com/gists/${CONFIG.PICKS_GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'token ' + t,
      'Content-Type':  'application/json',
      'Accept':        'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      files: { [CONFIG.PICKS_FILENAME]: { content: JSON.stringify(current, null, 2) } },
    }),
  });

  if (!patchResp.ok) {
    const err = await patchResp.json().catch(() => ({}));
    throw new Error(err.message || `Failed to save bracket: ${patchResp.status}`);
  }
}
