// Leaderboard — load, score, and display all submitted brackets

const PICKS_REVEAL_TIME = new Date('2026-03-19T17:00:00Z'); // Thursday Mar 19 11am CT
function _picksVisible() { return new Date() >= PICKS_REVEAL_TIME; }

let _leaderboardTimer = null;
let _cachedEntries    = null;
let _cachedResults    = null;
let _cachedBdata      = null;
let _currentLbTab     = 'overall';

const TYPE_LABEL = {
  badger:        'Badger Alum',
  future_badger: 'Future Badger',
};

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

  listEl.innerHTML = '<div class="loading">Loading scores...</div>';

  let bdata, allPicks;
  try {
    [bdata, allPicks] = await Promise.all([fetchBracketData(), fetchAllPicks()]);
  } catch (e) {
    listEl.innerHTML = `<div class="error">Couldn't load leaderboard: ${e.message}</div>`;
    return;
  }

  // Temporarily set bracketData so buildResultsArray() works
  const prevBD = bracketData;
  bracketData  = bdata;
  const results = buildResultsArray();
  bracketData  = prevBD;

  const eliminated = _buildEliminatedSet(results, bdata);

  const entries = Object.entries(allPicks).map(([nickname, data]) => {
    const picks = data.picks || [];
    return {
      nickname,
      type:         data.type       ?? null,
      tiebreaker:   data.tiebreaker ?? null,
      score:        scorePicksAgainstResults(picks, results),
      maxAvailable: _calcMaxAvailable(picks, results, eliminated),
      champion:     picks[62] || '—',
      picks,
      submittedAt: data.submittedAt,
    };
  });

  _cachedEntries = entries;
  _cachedResults = results;
  _cachedBdata   = bdata;

  _renderAwards(entries, results, bdata);
  _renderEntries(entries, results, bdata);
  document.getElementById('lb-updated').textContent = `Last updated: ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
}

// ── Max Available calculation ──────────────────────────────

// Returns the two actual teams that play/played in a given game slot.
function _getGameParticipants(gameIdx, results, bdata) {
  const round = getRoundFromIndex(gameIdx);

  if (round === 0) {
    const offset      = gameIdx;                         // ROUND_OFFSETS[0] = 0
    const regionIdx   = Math.floor(offset / GAMES_PER_REGION[0]);
    const gameInReg   = offset % GAMES_PER_REGION[0];
    const region      = REGIONS[regionIdx];
    const [s1, s2]    = SEED_PAIRS[gameInReg];
    const teams       = (bdata?.teams?.[region]) || [];
    return [
      teams.find(t => t.seed === s1)?.name || null,
      teams.find(t => t.seed === s2)?.name || null,
    ];
  }

  if (round <= 3) {
    const offset    = gameIdx - ROUND_OFFSETS[round];
    const regionIdx = Math.floor(offset / GAMES_PER_REGION[round]);
    const gameInReg = offset % GAMES_PER_REGION[round];
    const f1 = getGameIndex(round - 1, regionIdx, gameInReg * 2);
    const f2 = getGameIndex(round - 1, regionIdx, gameInReg * 2 + 1);
    return [results[f1] || null, results[f2] || null];
  }

  if (round === 4) {
    // FF: game 0 = East(0) vs South(2), game 1 = West(1) vs Midwest(3)
    const game    = gameIdx - 60;
    const regions = [[0, 2], [1, 3]][game];
    return [
      results[getGameIndex(3, regions[0], 0)] || null,
      results[getGameIndex(3, regions[1], 0)] || null,
    ];
  }

  // Championship (62)
  return [results[60] || null, results[61] || null];
}

// Builds a Set of team names that have already been eliminated.
function _buildEliminatedSet(results, bdata) {
  const eliminated = new Set();
  for (let i = 0; i < 63; i++) {
    if (!results[i]) continue;
    const [t1, t2] = _getGameParticipants(i, results, bdata);
    if (t1 && t1 !== results[i]) eliminated.add(t1);
    if (t2 && t2 !== results[i]) eliminated.add(t2);
  }
  return eliminated;
}

// Returns current score + maximum points still available for this bracket.
function _calcMaxAvailable(picks, results, eliminated) {
  let max = 0;
  for (let i = 0; i < 63; i++) {
    if (!picks[i]) continue;
    const pts = ROUND_POINTS[getRoundFromIndex(i)];
    if (results[i] !== null && results[i] !== undefined) {
      // Game already decided — only score if correct
      if (picks[i] === results[i]) max += pts;
    } else {
      // Game not yet played — score if team is still alive
      if (!eliminated.has(picks[i])) max += pts;
    }
  }
  return max;
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
    listEl.innerHTML = '<div class="empty-state">No brackets here yet — be the first!</div>';
    return;
  }

  // Sort: score desc → maxAvailable desc → tiebreaker → alpha
  const wisThrees = (bdata?.wisconsin_threes != null) ? bdata.wisconsin_threes : null;
  entries = _sortEntries(entries, wisThrees);

  const tbActive = wisThrees != null;

  // Tiebreaker note
  const tbNote = document.getElementById('lb-tb-note');
  if (tbNote) {
    tbNote.textContent   = tbActive
      ? `Tiebreaker answer: ${wisThrees} three-pointers`
      : 'Tiebreaker: closest Wisconsin 3-point guess wins ties (answer TBD)';
    tbNote.style.display = 'block';
  }

  const picksVisible = _picksVisible();

  // Column header row
  let html = `
    <div class="lb-col-labels">
      <span class="lb-col-rank"></span>
      <span class="lb-col-name">Name</span>
      <span class="lb-col-pts">Pts</span>
      <span class="lb-col-max lb-hide-sm">Max</span>
      <span class="lb-col-tb lb-hide-sm">Tiebreaker</span>
      <span class="lb-col-champ lb-hide-sm">Champion</span>
      <span class="lb-col-exp"></span>
    </div>`;

  entries.forEach((entry, i) => {
    const rank   = i + 1;
    const safeId = `lbrow-${i}`;

    // Points
    const ptsDisplay = picksVisible ? String(entry.score) : '—';

    // Max Available
    const maxDisplay = picksVisible ? String(entry.maxAvailable) : '—';

    // Tiebreaker
    let tbDisplay = '—';
    if (picksVisible && entry.tiebreaker != null) {
      tbDisplay = String(entry.tiebreaker);
      if (tbActive) {
        const diff = Math.abs(entry.tiebreaker - wisThrees);
        tbDisplay += ` <span class="tb-diff">(${diff === 0 ? 'exact!' : `off by ${diff}`})</span>`;
      }
    }

    // Champion
    const champLogoHtml = picksVisible && entry.champion && entry.champion !== '—'
      ? _champLogoImg(entry.champion, 16) : '';
    const championDisplay = picksVisible ? `${champLogoHtml}${_escLb(entry.champion)}` : '—';

    const detailContent = picksVisible
      ? _buildPicksDetail(entry.picks, results, bdata)
      : '<div class="picks-locked">Picks are revealed when the tournament begins — check back Thursday at 11am!</div>';
    const clickHandler = picksVisible ? `onclick="toggleLbDetail('${safeId}')"` : '';
    const expandArrow  = picksVisible ? '<span class="lb-expand">&#9660;</span>' : '';

    html += `
      <div class="lb-row" id="${safeId}">
        <div class="lb-main" ${clickHandler}>
          <span class="lb-rank">#${rank}</span>
          <span class="lb-name">${_escLb(entry.nickname)}</span>
          <span class="lb-pts">${ptsDisplay}</span>
          <span class="lb-max lb-hide-sm">${maxDisplay}</span>
          <span class="lb-tiebreaker lb-hide-sm">${tbDisplay}</span>
          <span class="lb-champion lb-hide-sm">${championDisplay}</span>
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

    // Max available (desc) as second sort key
    if (b.maxAvailable !== a.maxAvailable) return b.maxAvailable - a.maxAvailable;

    // Tiebreaker — only when wisconsin_threes is known
    if (wisThrees != null) {
      const aHas = a.tiebreaker != null;
      const bHas = b.tiebreaker != null;
      if (aHas && bHas) {
        const aDiff = Math.abs(a.tiebreaker - wisThrees);
        const bDiff = Math.abs(b.tiebreaker - wisThrees);
        if (aDiff !== bDiff) return aDiff - bDiff;
      } else if (bHas) return  1;
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

function _champLogoImg(teamName, size) {
  const url = getTeamLogoUrl(teamName);
  if (!url) return '';
  return `<img src="${url}" class="champ-logo" width="${size}" height="${size}" alt="" onerror="this.style.display='none'">`;
}

function toggleLbDetail(rowId) {
  const el  = document.getElementById(`detail-${rowId}`);
  const row = document.getElementById(rowId);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  row?.querySelector('.lb-expand')?.setAttribute('style', open ? '' : 'transform:rotate(180deg)');
}

// ── Awards section ──────────────────────────────────────────

function _renderAwards(allEntries, results, bdata) {
  const el = document.getElementById('awards-section');
  if (!el) return;

  if (allEntries.length === 0) { el.style.display = 'none'; return; }

  const visible   = _picksVisible();
  const wisThrees = (bdata?.wisconsin_threes != null) ? bdata.wisconsin_threes : null;
  const crowned   = visible && !!results[62];

  function topOf(entries) {
    if (!entries.length) return [];
    const sorted = _sortEntries(entries, wisThrees);
    const best   = sorted[0].score;
    if (!visible) return [];
    return sorted.filter(e => e.score === best);
  }

  const overall = topOf(allEntries);
  const alums   = topOf(allEntries.filter(e => e.type === 'badger'));
  const futureB = topOf(allEntries.filter(e => e.type === 'future_badger'));

  function winnerLine(winners) {
    if (!visible) return `<div class="award-winner tbd">Filling out brackets...</div>`;
    if (!winners.length) return `<div class="award-winner tbd">No entries yet</div>`;
    return winners.map(w =>
      `<div class="award-winner">${_typeEmojiAward(w.type)} ${_escLb(w.nickname)}</div>`
    ).join('');
  }

  function metaLine(winners) {
    if (!visible || !winners.length) return '';
    const pts = winners[0].score;
    return `<div class="award-meta">${pts} pts</div>`;
  }

  function champLine(winners) {
    if (!visible || !winners.length) return '';
    const pick = winners[0].champion;
    return pick && pick !== '—'
      ? `<div class="award-champ-pick">${_champLogoImg(pick, 16)}${_escLb(pick)}</div>`
      : '';
  }

  function card(title, winners, isOverall) {
    const highlight = crowned && isOverall && winners.length > 0;
    return `<div class="award-card${highlight ? ' crowned' : ''}">
      <div class="award-title">${title}</div>
      ${winnerLine(winners)}
      ${metaLine(winners)}
      ${champLine(winners)}
    </div>`;
  }

  el.innerHTML = `<div class="awards-grid">
    ${card('🏆 Overall Champion', overall, true)}
    ${card('Top Badger Alum',     alums,   false)}
    ${card('Top Future Badger',   futureB, false)}
  </div>`;
  el.style.display = 'block';
}

function _typeEmojiAward(type) {
  return type === 'badger' ? 'Badger Alum' : type === 'future_badger' ? 'Future Badger' : '';
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
      const icon = status === 'correct' ? '✓' : status === 'wrong' ? '✗' : '';
      html += `<span class="pick-chip pick-${status || 'pending'}">${icon} ${_escLb(pick)}</span>`;
    });
    html += '</div></div>';
  }

  html += '</div>';
  bracketData = prevBD;
  return html;
}
