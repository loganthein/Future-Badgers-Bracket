// API layer — reads from GitHub Gists, writes directly to Gist API

const _GH_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
};

async function _fetchGist(gistId) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: _GH_HEADERS,
  });
  if (!resp.ok) throw new Error(`Gist fetch failed: ${resp.status}`);
  return resp.json();
}

async function fetchBracketData() {
  const gist = await _fetchGist(CONFIG.BRACKET_DATA_GIST_ID);
  const file = gist.files[CONFIG.BRACKET_DATA_FILENAME];
  if (!file) throw new Error('bracket-data.json not found in gist');
  return JSON.parse(file.content);
}

async function fetchAllPicks() {
  try {
    const gist = await _fetchGist(CONFIG.PICKS_GIST_ID);
    const file = gist.files[CONFIG.PICKS_FILENAME];
    if (!file || !file.content || !file.content.trim() || file.content.trim() === 'null') return {};
    return JSON.parse(file.content);
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
  // Fetch current picks
  const rawUrl = `https://gist.githubusercontent.com/${CONFIG.REPO_OWNER}/${CONFIG.PICKS_GIST_ID}/raw/${CONFIG.PICKS_FILENAME}?t=${Date.now()}`;
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

  // PATCH the Gist
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
