// API layer — reads from GitHub / writes via Actions workflow_dispatch

async function _fetchGist(gistId) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
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
    const url = `https://raw.githubusercontent.com/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/main/bracket-picks.json?t=${Date.now()}`;
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

// picks: array of 63 team name strings
// type: 'badger' | 'future_badger'
// tiebreaker: integer (Wisconsin 3-point guess)
async function submitPicks(nickname, picks, type, tiebreaker) {
  const token = localStorage.getItem('workflow_token');
  if (!token) throw new Error('No workflow token saved. Please set it up from the welcome screen.');

  const url = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/workflows/${CONFIG.WORKFLOW_FILE}/dispatches`;

  const inputs = {
    nickname,
    type,
    picks: JSON.stringify(picks),
  };
  if (tiebreaker != null && tiebreaker !== '') {
    inputs.tiebreaker = String(tiebreaker);
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Workflow dispatch failed: ${resp.status}`);
  }
  // 204 No Content on success — no body to parse
}
