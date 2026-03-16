// API layer — reads/writes GitHub Gists

async function _fetchGist(gistId) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!resp.ok) throw new Error(`Gist fetch failed: ${resp.status}`);
  return resp.json();
}

async function _patchGist(gistId, filename, content) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ files: { [filename]: { content } } }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Gist PATCH failed: ${resp.status}`);
  }
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

// picks: array of 63 team name strings
// type: 'badger' | 'future_badger'
// tiebreaker: integer (Wisconsin 3-point guess)
async function submitPicks(nickname, picks, type, tiebreaker) {
  const current = await fetchAllPicks();
  current[nickname] = {
    picks,
    type,
    tiebreaker,
    submittedAt: new Date().toISOString(),
  };
  await _patchGist(
    CONFIG.PICKS_GIST_ID,
    CONFIG.PICKS_FILENAME,
    JSON.stringify(current, null, 2)
  );
}
