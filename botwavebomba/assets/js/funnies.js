// BOTWAVEBOMBA — Funnies / MAD Magazine Archive

var _allIssues = [];
var _activeDecade = 'all';
var _activeLang   = 'en';

// Issues the editor has flagged for special treatment
var HALLOWEEN_ISSUES = [53, 57, 78, 114, 132, 150, 162, 183, 202, 241, 275, 311, 356, 399, 467, 521];
var SPYVSPY_ISSUES   = [29, 30, 31, 32, 33, 35, 38, 41, 44, 47, 52, 60, 70, 80, 95, 110, 130, 155];

function issueNum(issue) {
  return parseInt(issue, 10);
}

function isHalloween(issue) {
  return HALLOWEEN_ISSUES.indexOf(issueNum(issue)) !== -1;
}

function isSpyVsSpy(issue) {
  return SPYVSPY_ISSUES.indexOf(issueNum(issue)) !== -1;
}

function buildCover(item) {
  var cover = document.createElement('div');
  cover.className = 'fny-issue-cover';

  // MAD cover tile (no per-issue thumbnails available in this collection)
  var tile = document.createElement('div');
  tile.className = 'fny-cover-tile';

  var logo = document.createElement('div');
  logo.className   = 'fny-cover-tile-logo';
  logo.textContent = 'MAD';
  tile.appendChild(logo);

  var issueLabel = document.createElement('div');
  issueLabel.className   = 'fny-cover-tile-issue';
  issueLabel.textContent = '#' + item.issue;
  tile.appendChild(issueLabel);

  var yearLabel = document.createElement('div');
  yearLabel.className   = 'fny-cover-tile-year';
  yearLabel.textContent = item.year;
  tile.appendChild(yearLabel);

  cover.appendChild(tile);

  // Badge overlay
  if (isHalloween(item.issue)) {
    var b = document.createElement('span');
    b.className   = 'fny-cover-badge halloween';
    b.textContent = 'HALLOWEEN';
    cover.appendChild(b);
  } else if (isSpyVsSpy(item.issue)) {
    var s = document.createElement('span');
    s.className   = 'fny-cover-badge spyvspy';
    s.textContent = 'SPY VS SPY';
    cover.appendChild(s);
  }

  return cover;
}

function buildCard(item) {
  var a = document.createElement('a');
  a.className = 'fny-issue-card';
  a.href      = item.url;
  a.target    = '_blank';
  a.rel       = 'noopener noreferrer';
  a.title     = item.title;

  a.appendChild(buildCover(item));

  var meta = document.createElement('div');
  meta.className = 'fny-issue-meta';

  var title = document.createElement('div');
  title.className   = 'fny-issue-title';
  title.textContent = 'Issue #' + item.issue;
  meta.appendChild(title);

  var year = document.createElement('div');
  year.className   = 'fny-issue-year';
  year.textContent = item.year + ' · ' + item.decade;
  meta.appendChild(year);

  a.appendChild(meta);
  return a;
}

function renderGrid() {
  var grid = document.getElementById('mad-grid');
  while (grid.firstChild) grid.removeChild(grid.firstChild);

  // Non-English editions: show coming soon
  var comingSoon = document.getElementById('coming-soon');
  if (_activeLang !== 'en') {
    comingSoon.classList.add('visible');
    return;
  }
  comingSoon.classList.remove('visible');

  var filtered = _allIssues;
  if (_activeDecade !== 'all') {
    filtered = _allIssues.filter(function(i) { return i.decade === _activeDecade; });
  }

  if (!filtered.length) {
    var empty = document.createElement('div');
    empty.className   = 'bwb-empty';
    empty.textContent = 'No issues in this decade.';
    grid.appendChild(empty);
    return;
  }

  filtered.forEach(function(item) {
    grid.appendChild(buildCard(item));
  });
}

function initDecadeNav() {
  var nav = document.getElementById('decade-nav');
  if (!nav) return;
  nav.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-decade]');
    if (!btn) return;
    nav.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    _activeDecade = btn.dataset.decade;
    renderGrid();
  });
}

function initLangPills() {
  var pills = document.getElementById('lang-pills');
  if (!pills) return;
  pills.addEventListener('click', function(e) {
    var pill = e.target.closest('[data-lang]');
    if (!pill) return;
    if (pill.dataset.coming === 'true') return;
    pills.querySelectorAll('.fny-lang-pill').forEach(function(p) { p.classList.remove('active'); });
    pill.classList.add('active');
    _activeLang = pill.dataset.lang;
    renderGrid();
  });
}

async function init() {
  // Inject coming-soon panel into main
  var main = document.querySelector('.fny-main');
  var cs = document.createElement('div');
  cs.id = 'coming-soon';
  cs.className = 'fny-coming-soon';

  var csTitle = document.createElement('div');
  csTitle.className   = 'fny-cs-title';
  csTitle.textContent = 'Coming Soon';
  cs.appendChild(csTitle);

  var csBody = document.createElement('div');
  csBody.className   = 'fny-cs-body';
  csBody.textContent = 'International MAD Magazine editions are being sourced from archive.org. '
                     + 'German, Spanish, Portuguese, French, Italian, and Japanese collections '
                     + 'will appear here as they are catalogued and verified. '
                     + 'Same deal — no redistribution, archive.org links only.';
  cs.appendChild(csBody);

  main.appendChild(cs);

  try {
    var resp = await fetch('/botwavebomba/data/mad_archive.json');
    _allIssues = await resp.json();
  } catch (err) {
    var grid = document.getElementById('mad-grid');
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    var errEl = document.createElement('div');
    errEl.className   = 'bwb-empty';
    errEl.textContent = 'Could not load archive. Try refreshing.';
    grid.appendChild(errEl);
    return;
  }

  initDecadeNav();
  initLangPills();
  renderGrid();
}

document.addEventListener('DOMContentLoaded', init);
