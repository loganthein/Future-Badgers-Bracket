// Leaderboard — load, score, and display all submitted brackets

const PICKS_REVEAL_TIME = new Date('2026-03-19T17:00:00Z'); // Thursday Mar 19 11am CT
function _picksVisible() { return new Date() >= PICKS_REVEAL_TIME; }

let _leaderboardTimer = null;
let _cachedEntries    = null;
let _cachedResults    = null;
let _cachedBdata      = null;
let _currentLbTab     = 'overall';

const TYPE_EMOJI = {
  badger:        '🦡👴',
  future_badger: '🦡👶',
};

function _typeEmoji(type) {
  return TYPE_EMOJI[type] || '🦡';
}

// ── Tab switching ──────────────────────────────────────────

function setLbTab(tab) {
  _currentLbTab = tab;
  document.querySelectorAll('.lb-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  if (_cachedEntries) _renderEntries(_cachedEntries, _cachedResults, _cachedBdata);
}

// ── Load + refresh ─────────────────────────────────────────

async function initLeaderboard() {
  clearInterval(_leaderboardTimer);
  await _refreshLeaderboard();
  _leaderboardTimer = setInterval(_refreshLeaderboard, CONFIG.LEADERBOARD_REFRESH_MS);
}

async function _refreshLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="loading">Loading scores… 🦡</div>';

  let bdata, allPicks;
  try {
    [bdata, allPicks] = await Promise.all([fetchBracketData(), fetchAllPicks()]);
  } catch (e) {
    listEl.innerHTML = `<div class="error">Couldn't load leaderboard: ${e.message}</div>`;
    return;
  }

  // Temporarily set bracketData so buildResultsArray() and scorePicksAgainstResults() work
  const prevBD = bracketData;
  bracketData  = bdata;
  const results = buildResultsArray();
  bracketData  = prevBD;

  const entries = Object.entries(allPicks).map(([nickname, data]) => {
    const picks = data.picks || [];
    return {
      nickname,
      type:       data.type       ?? null,
      tiebreaker: data.tiebreaker ?? null,
      score:      scorePicksAgainstResults(picks, results),
      champion:   picks[62] || '—',
      picks,
      submittedAt: data.submittedAt,
    };
  });

  _cachedEntries = entries;
  _cachedResults = results;
  _cachedBdata   = bdata;

  _renderEntries(entries, results, bdata);
  document.getElementById('lb-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

// ── Render entries for the active tab ──────────────────────

function _renderEntries(allEntries, results, bdata) {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;

  // Filter by tab
  let entries = _currentLbTab === 'overall'
    ? allEntries
    : allEntries.filter(e => e.type === _currentLbTab);

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No brackets here yet — be the first! 🦡</div>';
    return;
  }

  // Sort: score desc, then tiebreaker (if wisconsin_threes is set), then alpha
  const wisThrees = (bdata?.wisconsin_threes != null) ? bdata.wisconsin_threes : null;
  entries = _sortEntries(entries, wisThrees);

  const tbActive = wisThrees != null;

  // Show/hide tiebreaker note
  const tbNote = document.getElementById('lb-tb-note');
  if (tbNote) {
    tbNote.style.display = tbActive ? 'block' : 'none';
    tbNote.textContent   = tbActive
      ? `🏀 Tiebreaker answer: ${wisThrees} three-pointers`
      : '🏀 Tiebreaker: closest Wisconsin 3-point guess wins ties (answer TBD)';
    tbNote.style.display = 'block'; // always show the note
  }

  const picksVisible = _picksVisible();

  let html = '';
  entries.forEach((entry, i) => {
    const rank   = i + 1;
    const medal  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const emoji  = _typeEmoji(entry.type);
    const safeId = `lbrow-${i}`;

    // Tiebreaker display
    let tbDisplay = '—';
    if (entry.tiebreaker != null) {
      tbDisplay = String(entry.tiebreaker);
      if (tbActive) {
        const diff = Math.abs(entry.tiebreaker - wisThrees);
        tbDisplay += ` <span class="tb-diff">(${diff === 0 ? 'exact! 🎯' : `off by ${diff}`})</span>`;
      }
    }

    const scoreDisplay = picksVisible ? `${entry.score} pts` : '—';
    const championDisplay = picksVisible ? `🏆 ${_escLb(entry.champion)}` : '🔒';
    const detailContent = picksVisible
      ? _buildPicksDetail(entry.picks, results, bdata)
      : '<div class="picks-locked">🔒 Picks are revealed when the tournament begins — check back Thursday at 11am!</div>';
    const clickHandler = picksVisible ? `onclick="toggleLbDetail('${safeId}')"` : '';
    const expandArrow  = picksVisible ? '<span class="lb-expand">▼</span>' : '';

    html += `
      <div class="lb-row" id="${safeId}">
        <div class="lb-main" ${clickHandler}>
          <span class="lb-rank">${medal}</span>
          <span class="lb-name"><span class="lb-type-emoji">${emoji}</span>${_escLb(entry.nickname)}</span>
          <span class="lb-champion lb-hide-sm">${championDisplay}</span>
          <span class="lb-tiebreaker lb-hide-sm">${tbDisplay}</span>
          <span class="lb-score">${scoreDisplay}</span>
          ${expandArrow}
        </div>
        <div class="lb-detail" id="detail-${safeId}" style="display:none">
          ${detailContent}
        </div>
      </div>`;
  });

  listEl.innerHTML = html;
}

function _sortEntries(entries, wisThrees) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    // Tiebreaker only applies when wisconsin_threes is known
    if (wisThrees != null) {
      const aHas = a.tiebreaker != null;
      const bHas = b.tiebreaker != null;
      if (aHas && bHas) {
        const aDiff = Math.abs(a.tiebreaker - wisThrees);
        const bDiff = Math.abs(b.tiebreaker - wisThrees);
        if (aDiff !== bDiff) return aDiff - bDiff;
      } else if (bHas) return 1;
      else if (aHas)   return -1;
    }

    return a.nickname.localeCompare(b.nickname);
  });
}

// ── Helpers ────────────────────────────────────────────────

function _escLb(str) {
  return (str || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

function toggleLbDetail(rowId) {
  const el  = document.getElementById(`detail-${rowId}`);
  const row = document.getElementById(rowId);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  row?.querySelector('.lb-expand')?.setAttribute('style', open ? '' : 'transform:rotate(180deg)');
}

function _buildPicksDetail(picks, results, bdata) {
  const prevBD = bracketData;
  bracketData  = bdata;

  let html = '<div class="picks-detail">';

  for (let r = 5; r >= 0; r--) {
    const start = ROUND_OFFSETS[r];
    const end   = r === 5 ? 63 : r === 4 ? 62 : ROUND_OFFSETS[r] + 4 * GAMES_PER_REGION[r];

    const roundPicks = [];
    for (let i = start; i < end; i++) {
      const pick   = picks[i];
      const actual = results[i];
      if (!pick) continue;
      const status = actual ? (pick === actual ? 'correct' : 'wrong') : '';
      roundPicks.push({ pick, status });
    }

    if (roundPicks.length === 0) continue;

    html += `<div class="picks-round">
      <div class="picks-round-label">${ROUND_NAMES[r]} (${ROUND_POINTS[r]} pt${ROUND_POINTS[r] > 1 ? 's' : ''})</div>
      <div class="picks-list">`;
    roundPicks.forEach(({ pick, status }) => {
      const icon = status === 'correct' ? '✅' : status === 'wrong' ? '❌' : '⏳';
      html += `<span class="pick-chip pick-${status || 'pending'}">${icon} ${_escLb(pick)}</span>`;
    });
    html += '</div></div>';
  }

  html += '</div>';
  bracketData = prevBD;
  return html;
}
