// ============================================================
// Bracket state and rendering
// ============================================================

const REGIONS = ['East', 'West', 'South', 'Midwest'];

const SEED_PAIRS = [
  [1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15],
];

const ROUND_POINTS = [1, 2, 4, 8, 16, 32];
const ROUND_NAMES  = ['Round of 64','Round of 32','Sweet 16','Elite 8','Final Four','Championship'];

// Game index layout (63 total):
//   Rounds 0-3: 4 regions × [8,4,2,1] games → indices 0-59
//   Round 4 (FF):    2 games → indices 60-61  (0=East/West, 1=South/Midwest)
//   Round 5 (Champ): 1 game  → index  62
const ROUND_OFFSETS    = [0, 32, 48, 56, 60, 62];
const GAMES_PER_REGION = [8,  4,  2,  1];

// ---- Mobile state ----
let _mobileRegion        = 0;   // 0-3 = region, 4 = Final Four
let _mobileSlideDir      = null; // 'right' | 'left' | null

function _isMobile() {
  const tabs = document.getElementById('mobile-region-tabs');
  return tabs ? getComputedStyle(tabs).display !== 'none' : window.innerWidth < 768;
}

function _isRegionDone(regionIdx) {
  return userPicks[getGameIndex(3, regionIdx, 0)] !== null;
}

function _isFFUnlocked() {
  return [0,1,2,3].every(_isRegionDone);
}

function setMobileRegion(idx) {
  if (idx === 4 && !_isFFUnlocked()) return;
  _mobileSlideDir = idx > _mobileRegion ? 'right' : 'left';
  _mobileRegion   = idx;
  renderBracket();
  document.querySelector('.bracket-scroll-wrapper')?.scrollTo(0, 0);
  // Sync tab UI (active class)
  document.querySelectorAll('.mrt-tab').forEach((t, i) =>
    t.classList.toggle('active', i === idx)
  );
}

function goNextMobileRegion() {
  const next = _mobileRegion + 1;
  if (next <= 3) setMobileRegion(next);
  else if (_isFFUnlocked()) setMobileRegion(4);
}

// ---- State ----
let bracketData     = null;
let userPicks       = new Array(63).fill(null);
let currentNickname = '';
let currentUserType = ''; // 'badger' | 'future_badger'

// ============================================================
// Index helpers
// ============================================================

function getGameIndex(round, regionIdx, gameInRegion) {
  if (round === 4) return 60 + gameInRegion;
  if (round === 5) return 62;
  return ROUND_OFFSETS[round] + regionIdx * GAMES_PER_REGION[round] + gameInRegion;
}

function getRoundFromIndex(i) {
  if (i < 32) return 0;
  if (i < 48) return 1;
  if (i < 56) return 2;
  if (i < 60) return 3;
  if (i < 62) return 4;
  return 5;
}

// ============================================================
// Team logo URLs (ESPN CDN)
// ============================================================

const TEAM_ESPN_IDS = {
  'Duke':150,'UConn':41,'Michigan State':127,'Kansas':2305,
  "St. John's":2599,'Louisville':97,'UCLA':26,'Ohio State':194,
  'TCU':2628,'UCF':2116,'South Florida':58,'Northern Iowa':2513,
  'Cal Baptist':2856,'North Dakota State':2439,'Furman':231,'Siena':2561,
  'Arizona':12,'Purdue':2509,'Gonzaga':2250,'Arkansas':8,'Wisconsin':275,
  'BYU':252,'Miami (FL)':2390,'Villanova':222,'Utah State':328,
  'Missouri':142,'High Point':2884,'Hawaii':62,'Kennesaw State':2318,
  'Queens':2910,'LIU':2799,'Texas':251,'NC State':152,
  'Florida':57,'Houston':248,'Illinois':356,'Nebraska':158,
  'Vanderbilt':238,'North Carolina':153,"Saint Mary's":2608,
  'Clemson':228,'Iowa':2294,'Texas A&M':245,'VCU':2670,'McNeese':2382,
  'Troy':2737,'Penn':219,'Idaho':70,'Prairie View A&M':2330,'Lehigh':2350,
  'Michigan':130,'Iowa State':66,'Virginia':258,'Alabama':333,
  'Texas Tech':2641,'Tennessee':2633,'Kentucky':96,'Georgia':61,
  'Saint Louis':139,'Santa Clara':2610,'Akron':2006,'Hofstra':2272,
  'Wright State':2750,'Tennessee State':2640,'UMBC':2378,'Howard':47,
  'SMU':2567,'Miami (OH)':193,
};

function getTeamLogoUrl(teamName) {
  const id = TEAM_ESPN_IDS[teamName];
  return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null;
}

// ============================================================
// Team helpers
// ============================================================

function getTeamsByRegion(region) {
  if (!bracketData?.teams) return [];
  return (bracketData.teams[region] || []).slice().sort((a, b) => a.seed - b.seed);
}

function getTeamBySeed(region, seed) {
  if (!bracketData?.teams) return null;
  return (bracketData.teams[region] || []).find(t => t.seed === seed) || null;
}

// Returns {seed, name, region} or null — searches all regions
function getTeamInfo(name) {
  if (!name || !bracketData?.teams) return null;
  for (const region of REGIONS) {
    const team = (bracketData.teams[region] || []).find(t => t.name === name);
    if (team) return { ...team, region };
  }
  return null;
}

// ============================================================
// Get the two teams for any game slot
// ============================================================

function getGameTeams(round, regionIdx, gameInRegion) {
  const region = REGIONS[regionIdx];

  if (round === 0) {
    const [s1, s2] = SEED_PAIRS[gameInRegion];
    const t1 = getTeamBySeed(region, s1);
    const t2 = getTeamBySeed(region, s2);
    return [t1 ? t1.name : null, t2 ? t2.name : null];
  }

  if (round <= 3) {
    const f1 = getGameIndex(round - 1, regionIdx, gameInRegion * 2);
    const f2 = getGameIndex(round - 1, regionIdx, gameInRegion * 2 + 1);
    return [userPicks[f1] || null, userPicks[f2] || null];
  }

  if (round === 4) {
    // FF game 0 (left side): East(0) vs South(2)
    // FF game 1 (right side): West(1) vs Midwest(3)
    const ffFeeds = [[0, 2], [1, 3]];
    const [r1, r2] = ffFeeds[gameInRegion];
    return [
      userPicks[getGameIndex(3, r1, 0)] || null,
      userPicks[getGameIndex(3, r2, 0)] || null,
    ];
  }

  return [userPicks[60] || null, userPicks[61] || null];
}

// ============================================================
// Convert results object from bracket-data.json → flat array[63]
//
// bracket-data.json results format (admin updates this):
// {
//   "round1":  [{"winner":"TeamName","gameId":"E1"}, ...],
//   "round2":  [...],  "round3":  [...],  "round4":  [...],
//   "round5":  [...],
//   "round6":  [{"winner":"TeamName","gameId":"CHAMP"}]
// }
//
// gameId key:
//   Rounds 1-4 → RegionLetter (E/W/S/M) + 1-based game number
//                e.g. "E1"=East game 1, "W3"=West game 3
//   Round 5    → "FF1" (East/South, left side), "FF2" (West/Midwest, right side)
//   Round 6    → "CHAMP"
//
// Also supports a flat array: "results": ["TeamA", null, ...]
// ============================================================

function buildResultsArray() {
  const flat = new Array(63).fill(null);
  if (!bracketData?.results) return flat;

  const results = bracketData.results;
  if (Array.isArray(results)) {
    return results.slice(0, 63).concat(new Array(Math.max(0, 63 - results.length)).fill(null));
  }

  const regionCode = { E: 0, W: 1, S: 2, M: 3 };
  const roundKeys  = ['round1','round2','round3','round4','round5','round6'];

  roundKeys.forEach((key, round) => {
    if (!results[key]) return;
    results[key].forEach(entry => {
      if (!entry?.winner) return;
      const gid = (entry.gameId || '').toUpperCase();

      if (gid === 'CHAMP') { flat[62] = entry.winner; return; }
      if (gid.startsWith('FF')) {
        const n = parseInt(gid.slice(2)) - 1;
        if (!isNaN(n)) flat[60 + n] = entry.winner;
        return;
      }
      const regionLetter = gid[0];
      const gameNum      = parseInt(gid.slice(1)) - 1;
      const regionIdx    = regionCode[regionLetter];
      if (regionIdx !== undefined && gameNum >= 0) {
        flat[getGameIndex(round, regionIdx, gameNum)] = entry.winner;
      }
    });
  });

  return flat;
}

// ============================================================
// Pick a winner and propagate
// ============================================================

function pickWinner(gameIdx, teamName) {
  if (userPicks[gameIdx] === teamName) return;
  if (userPicks[gameIdx] !== null) clearDownstream(gameIdx);
  userPicks[gameIdx] = teamName;
  renderBracket();
  updateLockButton();
}

function clearDownstream(gameIdx) {
  userPicks[gameIdx] = null;
  const next = getNextGame(gameIdx);
  if (next !== null) clearDownstream(next);
}

function getNextGame(gameIdx) {
  const round = getRoundFromIndex(gameIdx);
  if (round >= 5) return null;
  if (round === 4) return 62;

  const offset    = gameIdx - ROUND_OFFSETS[round];
  const regionIdx = Math.floor(offset / GAMES_PER_REGION[round]);
  const gameInReg = offset % GAMES_PER_REGION[round];

  // East(0)→FF0, West(1)→FF1, South(2)→FF0, Midwest(3)→FF1
  if (round === 3) return 60 + (regionIdx % 2);
  return getGameIndex(round + 1, regionIdx, Math.floor(gameInReg / 2));
}

function allPicksMade() {
  return userPicks.every(p => p !== null);
}

// ============================================================
// Rendering
// ============================================================

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function _matchupHTML(round, regionIdx, gameInRegion, results) {
  const idx = round === 5 ? 62
            : round === 4 ? 60 + gameInRegion
            : getGameIndex(round, regionIdx, gameInRegion);

  const [t1raw, t2raw] = getGameTeams(round, regionIdx, gameInRegion);
  const picked = userPicks[idx];
  const actual = results[idx];
  const locked = actual !== null;

  function btnHTML(rawName) {
    if (!rawName) return `<div class="team-slot empty">TBD</div>`;
    let cls = 'team-slot';
    if (picked === rawName) cls += ' picked';
    if (locked) {
      if (rawName === actual)       cls += ' correct';
      else if (picked === rawName)  cls += ' wrong';
    }
    const info = getTeamInfo(rawName);
    const seedSpan = info ? `<span class="team-seed">${info.seed}</span>` : '';
    const nameSpan = `<span class="team-name">${_esc(rawName)}</span>`;
    const logoUrl  = round === 0 ? getTeamLogoUrl(rawName) : null;
    const logoImg  = logoUrl
      ? `<img src="${logoUrl}" class="team-logo" alt="" onerror="this.style.display='none'">`
      : '';
    return `<button class="${cls}"
      data-game="${idx}"
      data-team="${rawName.replace(/"/g,'&quot;')}"
      ${locked ? 'disabled' : ''}
    >${seedSpan}${logoImg}${nameSpan}</button>`;
  }

  return `<div class="matchup" data-game="${idx}">${btnHTML(t1raw)}${btnHTML(t2raw)}</div>`;
}

function _roundColHTML(round, regionIdx, numGames, results) {
  // Group every two consecutive matchups into a .game-pair so connector
  // lines (drawn via CSS ::before/::after) can span between them.
  const ROUND_SHORT = ['R64', 'R32', 'S16', 'E8'];
  let pairs = '';
  for (let g = 0; g < numGames; g += 2) {
    pairs += '<div class="game-pair">';
    pairs += _matchupHTML(round, regionIdx, g, results);
    if (g + 1 < numGames) pairs += _matchupHTML(round, regionIdx, g + 1, results);
    pairs += '</div>';
  }
  return `<div class="round-col" data-round="${round}">` +
    `<div class="rcol-label">${ROUND_SHORT[round] || ''}</div>` +
    `<div class="rcol-games">${pairs}</div>` +
    `</div>`;
}

function _regionHTML(regionIdx, isRight, results) {
  const region     = REGIONS[regionIdx];
  const roundOrder = isRight ? [3, 2, 1, 0] : [0, 1, 2, 3];
  let cols = '';
  for (const r of roundOrder) cols += _roundColHTML(r, regionIdx, GAMES_PER_REGION[r], results);
  return `<div class="region-block region-${region.toLowerCase()}">
    <div class="region-label pos-${isRight ? 'right' : 'left'}">${region}</div>
    <div class="region-rounds">${cols}</div>
  </div>`;
}

// ============================================================
// Mobile rendering
// ============================================================

function _mobileTeamBtn(rawName, idx, picked, actual, round) {
  if (!rawName) return `<div class="mbr-team empty">TBD</div>`;
  const locked = actual !== null;
  let cls = 'mbr-team';
  if (picked === rawName) cls += ' picked';
  if (locked) {
    if (rawName === actual)      cls += ' correct';
    else if (picked === rawName) cls += ' wrong';
  }
  const info    = getTeamInfo(rawName);
  const seed    = info ? `<span class="mbr-seed">${info.seed}</span>` : '';
  const logoUrl = round === 0 ? getTeamLogoUrl(rawName) : null;
  const logo    = logoUrl
    ? `<img src="${logoUrl}" class="mbr-logo" width="20" height="20" alt="" onerror="this.style.display='none'">`
    : '';
  return `<button class="${cls}"
    data-game="${idx}"
    data-team="${rawName.replace(/"/g,'&quot;')}"
    ${locked ? 'disabled' : ''}
  >${seed}${logo}<span class="mbr-name">${_esc(rawName)}</span></button>`;
}

function _mobileMatchupHTML(round, regionIdx, gameInRegion, results) {
  const idx    = round === 5 ? 62
               : round === 4 ? 60 + gameInRegion
               : getGameIndex(round, regionIdx, gameInRegion);
  const [t1, t2] = getGameTeams(round, regionIdx, gameInRegion);
  const picked   = userPicks[idx];
  const actual   = results[idx];
  return `<div class="mbr-matchup">
    ${_mobileTeamBtn(t1, idx, picked, actual, round)}
    ${_mobileTeamBtn(t2, idx, picked, actual, round)}
  </div>`;
}

function _renderMobileRegion(regionIdx, results) {
  const dir = _mobileSlideDir;
  _mobileSlideDir = null;
  const animCls = dir === 'right' ? 'slide-right' : dir === 'left' ? 'slide-left' : '';

  let html = `<div class="mobile-bracket-region ${animCls}">`;
  html += `<div class="mbr-region-label">${REGIONS[regionIdx]} Region</div>`;

  for (let r = 0; r <= 3; r++) {
    const numGames = GAMES_PER_REGION[r];
    const pts      = ROUND_POINTS[r];
    html += `<div class="mbr-round">
      <div class="mbr-round-label">${ROUND_NAMES[r]} <span class="mbr-round-pts">${pts} pt${pts > 1 ? 's' : ''} each</span></div>
      <div class="mbr-games">`;
    for (let g = 0; g < numGames; g++) {
      html += _mobileMatchupHTML(r, regionIdx, g, results);
    }
    html += '</div></div>';
  }

  const nextLabel = regionIdx < 3
    ? `Next: ${REGIONS[regionIdx + 1]} →`
    : _isFFUnlocked() ? 'Go to Final Four →' : 'Final Four (complete region first)';
  html += `<div class="mbr-next-bar">
    <button class="btn btn-${regionIdx < 3 || _isFFUnlocked() ? 'primary' : 'secondary'}"
      onclick="goNextMobileRegion()">
      ${nextLabel}
    </button>
  </div>`;
  html += '</div>';
  return html;
}

function _renderMobileFinalFour(results) {
  const dir = _mobileSlideDir;
  _mobileSlideDir = null;
  const animCls = dir === 'right' ? 'slide-right' : dir === 'left' ? 'slide-left' : '';

  if (!_isFFUnlocked()) {
    return `<div class="mobile-bracket-region ${animCls}">
      <div class="mbr-locked">Complete all 4 regions to unlock the Final Four!</div>
    </div>`;
  }

  let html = `<div class="mobile-bracket-region ${animCls}">`;
  html += `<div class="mbr-region-label">Final Four &amp; Championship</div>`;

  html += `<div class="mbr-round">
    <div class="mbr-round-label">Final Four <span class="mbr-round-pts">16 pts each</span></div>
    <div class="mbr-games">
      ${_mobileMatchupHTML(4, 0, 0, results)}
      ${_mobileMatchupHTML(4, 0, 1, results)}
    </div>
  </div>`;

  html += `<div class="mbr-round">
    <div class="mbr-round-label">Championship <span class="mbr-round-pts">32 pts</span></div>
    <div class="mbr-games">
      ${_mobileMatchupHTML(5, 0, 0, results)}
    </div>
  </div>`;

  html += '</div>';
  return html;
}

function _updateMobileTabs(results) {
  const ffUnlocked = _isFFUnlocked();
  document.querySelectorAll('.mrt-tab').forEach((tab, i) => {
    if (i < 4) {
      tab.classList.toggle('done',   _isRegionDone(i));
      tab.classList.toggle('active', i === _mobileRegion);
    } else {
      tab.disabled = !ffUnlocked;
      tab.classList.toggle('active', _mobileRegion === 4);
    }
  });
  _updateProgressBar();
}

function renderBracket() {
  const container = document.getElementById('bracket-scroll');
  if (!container || !bracketData) return;

  const results = buildResultsArray();

  if (_isMobile()) {
    container.innerHTML = _mobileRegion < 4
      ? _renderMobileRegion(_mobileRegion, results)
      : _renderMobileFinalFour(results);
    container.querySelectorAll('.mbr-team:not(.empty):not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => pickWinner(parseInt(btn.dataset.game), btn.dataset.team));
    });
    _updateMobileTabs(results);
    return;
  }

  // NCAA layout: East(0)+South(2) on left, West(1)+Midwest(3) on right.
  // FF game 0 = East vs South (left FF), FF game 1 = West vs Midwest (right FF).
  const champ     = userPicks[62];
  const champLogo = champ ? getTeamLogoUrl(champ) : null;
  const champHeroHTML = champ
    ? `<div class="champ-hero">
        ${champLogo ? `<img src="${champLogo}" class="champ-hero-logo" alt="" onerror="this.style.display='none'">` : ''}
        <div class="champ-hero-name">${_esc(champ)}</div>
       </div>`
    : `<div class="champ-hero empty">🏆</div>`;

  container.innerHTML = `<div class="bracket-inner">
    <div class="bracket-half">
      ${_regionHTML(0, false, results)}
      ${_regionHTML(2, false, results)}
    </div>
    <div class="bracket-center">
      <div class="center-label">Final Four</div>
      <div class="ff-spine">
        <div class="ff-row"><div class="ff-slot">${_matchupHTML(4, 0, 0, results)}</div></div>
        <div class="champ-row">
          ${champHeroHTML}
          <div class="champ-label">Championship</div>
          <div class="champ-slot">${_matchupHTML(5, 0, 0, results)}</div>
        </div>
        <div class="ff-row"><div class="ff-slot">${_matchupHTML(4, 0, 1, results)}</div></div>
      </div>
    </div>
    <div class="bracket-half">
      ${_regionHTML(1, true, results)}
      ${_regionHTML(3, true, results)}
    </div>
  </div>`;

  container.querySelectorAll('.team-slot:not(.empty):not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => pickWinner(parseInt(btn.dataset.game), btn.dataset.team));
  });
}

function _updateProgressBar() {
  const made = userPicks.filter(p => p !== null).length;
  const fill = document.getElementById('pick-progress-fill');
  const text = document.getElementById('pick-progress-text');
  if (fill) fill.style.width = ((made / 63) * 100) + '%';
  if (text) {
    if (made === 63) {
      text.textContent = 'All picks made! Enter your tiebreaker to lock in.';
      text.classList.add('complete');
    } else {
      text.textContent = made + ' of 63 picks made';
      text.classList.remove('complete');
    }
  }
}

function updateLockButton() {
  const btn       = document.getElementById('lock-btn');
  const tbSection = document.getElementById('tiebreaker-section');
  if (!btn) return;

  _updateProgressBar();

  const allDone = allPicksMade();
  if (tbSection) tbSection.style.display = allDone ? 'block' : 'none';

  if (allDone) {
    const tbVal = parseInt(document.getElementById('tiebreaker-input')?.value ?? '');
    btn.style.display = 'block';
    btn.disabled = isNaN(tbVal) || tbVal < 0 || tbVal > 200;
  } else {
    btn.style.display = 'none';
  }
}

// ============================================================
// Init bracket page
// ============================================================

async function initBracket(nickname, type) {
  currentNickname  = nickname;
  currentUserType  = type;
  userPicks        = new Array(63).fill(null);
  _mobileRegion    = 0;
  _mobileSlideDir  = null;

  // Reset tiebreaker input
  const tbInput = document.getElementById('tiebreaker-input');
  if (tbInput) tbInput.value = '';

  const typeLabel = type === 'badger' ? 'Badger Alum' : 'Future Badger';
  document.getElementById('bracket-player-name').textContent = nickname;
  showPage('page-bracket');

  const container = document.getElementById('bracket-scroll');
  container.innerHTML = '<div class="loading">Loading bracket...</div>';

  let bdata, existingPicks;
  try {
    [bdata, existingPicks] = await Promise.all([fetchBracketData(), fetchAllPicks()]);
  } catch (e) {
    container.innerHTML = `<div class="error">Couldn't load the bracket. Check your internet and try again!<br><small>${e.message}</small></div>`;
    return;
  }

  // Nickname uniqueness check — no overwriting allowed
  if (existingPicks[nickname]) {
    container.innerHTML = '';
    showPage('page-welcome');
    const input = document.getElementById('nickname-input');
    if (input) input.value = nickname;
    setTimeout(() => {
      document.getElementById('nickname-error').textContent =
        `"${nickname}" is already taken! Try a different nickname.`;
      document.getElementById('nickname-error').style.display = 'block';
      document.getElementById('nickname-input')?.focus();
    }, 50);
    return;
  }

  if (!bdata.teams || REGIONS.some(r => (bdata.teams[r] || []).length < 16)) {
    container.innerHTML = `<div class="error">Bracket isn't set up yet — ask your organizer to add the teams!</div>`;
    return;
  }

  bracketData = bdata;
  if (typeof _pushBracketHistoryState === 'function') _pushBracketHistoryState();
  renderBracket();
  updateLockButton();

  // Wire tiebreaker input to re-check lock button
  document.getElementById('tiebreaker-input')?.addEventListener('input', updateLockButton);
}

// ============================================================
// Submit picks
// ============================================================

async function lockBracket() {
  if (!allPicksMade()) return;

  const tbVal = parseInt(document.getElementById('tiebreaker-input')?.value ?? '');
  if (isNaN(tbVal) || tbVal < 0 || tbVal > 200) {
    document.getElementById('tiebreaker-input')?.focus();
    return;
  }

  const btn     = document.getElementById('lock-btn');
  const spinner = document.getElementById('bracket-saving');
  btn.style.display     = 'none';
  if (spinner) spinner.style.display = 'block';

  function _resetBtn() {
    btn.disabled          = false;
    btn.style.display     = '';
    if (spinner) spinner.style.display = 'none';
  }

  try {
    // Final duplicate check right before write (race condition safety)
    const existing = await fetchAllPicks();
    if (existing[currentNickname]) {
      _resetBtn();
      showPage('page-welcome');
      const input = document.getElementById('nickname-input');
      if (input) input.value = currentNickname;
      document.getElementById('nickname-error').textContent =
        `"${currentNickname}" was just taken by someone else! Try a different name.`;
      document.getElementById('nickname-error').style.display = 'block';
      return;
    }

    await submitPicks(currentNickname, userPicks, currentUserType, tbVal);
    if (typeof _bracketSubmitted !== 'undefined') _bracketSubmitted = true;
    showPage('page-success');
    initSuccessPage(tbVal);
  } catch (e) {
    _resetBtn();
    if (e.code === 'NICKNAME_TAKEN') {
      showPage('page-welcome');
      const input = document.getElementById('nickname-input');
      if (input) input.value = currentNickname;
      document.getElementById('nickname-error').textContent =
        `"${currentNickname}" is already taken! Try a different name.`;
      document.getElementById('nickname-error').style.display = 'block';
    } else {
      alert('Oops! Could not save your bracket: ' + e.message);
    }
  }
}

// Re-render on resize so mobile/desktop switch is seamless
let _resizeTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function () {
    if (bracketData) renderBracket();
  }, 200);
});

// ============================================================
// Scoring helper (used by leaderboard)
// ============================================================

function scorePicksAgainstResults(picks, results) {
  let score = 0;
  for (let i = 0; i < 63; i++) {
    if (picks[i] && results[i] && picks[i] === results[i]) {
      score += ROUND_POINTS[getRoundFromIndex(i)];
    }
  }
  return score;
}
