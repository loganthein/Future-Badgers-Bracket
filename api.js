// API layer — reads from GitHub Gists, writes via Actions workflow dispatch

const _GH_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
};
const _GH_AUTH_HEADERS = () => ({
  ..._GH_HEADERS,
  'Authorization': `token ${WORKFLOW_TOKEN}`,
});

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

// ── Submit via workflow dispatch ───────────────────────────────────────────

// picks: array of 63 team name strings
// type: 'badger' | 'future_badger'
// tiebreaker: integer (Wisconsin 3-point guess)
async function submitPicks(nickname, picks, type, tiebreaker) {
  const dispatchUrl = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/workflows/submit-bracket.yml/dispatches`;

  // Record time just before dispatch so we can find this specific run
  const dispatchTime = new Date();

  const resp = await fetch(dispatchUrl, {
    method: 'POST',
    headers: { ..._GH_AUTH_HEADERS(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        nickname,
        type,
        picks:      JSON.stringify(picks),
        tiebreaker: String(tiebreaker),
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Failed to trigger workflow: ${resp.status}`);
  }

  // Workflow dispatched (204 No Content) — now find and poll the run
  const runId = await _waitForRun(dispatchTime);
  const run   = await _waitForCompletion(runId);

  if (run.conclusion !== 'success') {
    const taken = await _checkNicknameTaken(runId);
    if (taken) {
      const err = new Error('This name is already taken. Please go back and choose a different name.');
      err.code = 'NICKNAME_TAKEN';
      throw err;
    }
    throw new Error('Your bracket could not be saved. Please try again.');
  }
}

// Waits up to 30s for a new submit-bracket.yml run triggered after dispatchTime.
async function _waitForRun(dispatchTime, timeoutMs = 30000) {
  await _sleep(4000); // give GitHub a moment to create the run

  const url      = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/workflows/submit-bracket.yml/runs?event=workflow_dispatch&per_page=5`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const resp = await fetch(url, { headers: _GH_AUTH_HEADERS() });
    if (resp.ok) {
      const data = await resp.json();
      const run = (data.workflow_runs || []).find(r =>
        new Date(r.created_at) >= new Date(dispatchTime.getTime() - 15000)
      );
      if (run) return run.id;
    }
    await _sleep(3000);
  }
  throw new Error('Could not find the workflow run. Your bracket may still be saving — check the leaderboard in a minute.');
}

// Polls a run every 3s until it reaches "completed", up to 90s.
async function _waitForCompletion(runId, timeoutMs = 90000) {
  const url      = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/runs/${runId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const resp = await fetch(url, { headers: _GH_AUTH_HEADERS() });
    if (resp.ok) {
      const run = await resp.json();
      if (run.status === 'completed') return run;
    }
    await _sleep(3000);
  }
  throw new Error('Submission timed out. Your bracket may still be saving — check the leaderboard in a minute.');
}

// Reads job logs to detect "NICKNAME_TAKEN" output from the script.
async function _checkNicknameTaken(runId) {
  try {
    const jobsResp = await fetch(
      `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/runs/${runId}/jobs`,
      { headers: _GH_AUTH_HEADERS() }
    );
    if (!jobsResp.ok) return false;
    const jobs  = await jobsResp.json();
    const jobId = jobs.jobs?.[0]?.id;
    if (!jobId) return false;

    const logsResp = await fetch(
      `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/jobs/${jobId}/logs`,
      { headers: _GH_AUTH_HEADERS() }
    );
    if (!logsResp.ok) return false;
    const text = await logsResp.text();
    return text.includes('NICKNAME_TAKEN');
  } catch {
    return false;
  }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
