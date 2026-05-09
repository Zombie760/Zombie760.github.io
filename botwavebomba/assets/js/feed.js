// BOTWAVEBOMBA — Story Feed Renderer
// Ground News-style cards: Western / Non-Aligned / Adversarial heatmap

let _allStories = [];

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

async function renderFeed(filter) {
  filter = filter || 'all';
  const feed = document.getElementById('story-feed');

  if (!_allStories.length) {
    const data = await BWB_API.getLatest();
    _allStories = data.stories || [];

    const bsCount = _allStories.filter(function(s) { return s.is_blindspot; }).length;
    const storyEl = document.getElementById('story-count');
    const bsEl = document.getElementById('blindspot-count');
    if (storyEl) storyEl.textContent = _allStories.length;
    if (bsEl) bsEl.textContent = bsCount;
  }

  let filtered = _allStories;
  if (filter === 'blindspot')     filtered = _allStories.filter(function(s) { return s.is_blindspot; });
  if (filter === 'high-variance') filtered = _allStories.filter(function(s) { return (s.bias_variance || 0) > 6; });
  if (filter === 'western')       filtered = _allStories.filter(function(s) {
    return (s.sources || []).every(function(src) { return src.bloc === 'western'; });
  });
  if (filter === 'adversarial')   filtered = _allStories.filter(function(s) {
    return (s.sources || []).some(function(src) { return src.bloc === 'adversarial'; });
  });
  if (filter === 'non-aligned')   filtered = _allStories.filter(function(s) {
    return (s.sources || []).some(function(src) { return src.bloc === 'neutral'; });
  });

  while (feed.firstChild) feed.removeChild(feed.firstChild);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'bwb-empty';
    empty.textContent = 'No stories match this filter.';
    feed.appendChild(empty);
    return;
  }

  filtered.forEach(function(story) {
    feed.appendChild(buildCard(story));
  });
}

function buildCard(story) {
  const sources = story.sources || [];
  const western     = sources.filter(function(s) { return s.bloc === 'western'; }).length;
  const adversarial = sources.filter(function(s) { return s.bloc === 'adversarial'; }).length;
  const neutral     = sources.filter(function(s) { return s.bloc === 'neutral'; }).length;
  const total       = sources.length;

  const wPct = total ? Math.round((western / total) * 100) : 0;
  const aPct = total ? Math.round((adversarial / total) * 100) : 0;
  const nPct = total ? Math.round((neutral / total) * 100) : 0;

  const card = document.createElement('article');
  card.className = 'bwb-card';
  card.addEventListener('click', function() {
    window.location = '/botwavebomba/story.html?id=' + encodeURIComponent(story.id);
  });

  // Badges
  const badges = document.createElement('div');
  badges.className = 'bwb-card-badges';
  if (story.is_blindspot) {
    const b = document.createElement('span');
    b.className = 'bwb-badge blindspot';
    b.textContent = 'BLINDSPOT';
    badges.appendChild(b);
  }
  if ((story.bias_variance || 0) > 7) {
    const b = document.createElement('span');
    b.className = 'bwb-badge high-variance';
    b.textContent = 'HIGH VARIANCE';
    badges.appendChild(b);
  }
  card.appendChild(badges);

  // Headline
  const h = document.createElement('h2');
  h.className = 'bwb-card-headline';
  h.textContent = story.headline || '';
  card.appendChild(h);

  // Summary
  const summary = story.summary || '';
  const p = document.createElement('p');
  p.className = 'bwb-card-summary';
  p.textContent = summary.length > 200 ? summary.slice(0, 200) + '...' : summary;
  card.appendChild(p);

  // Mini heatmap
  const hmWrap = document.createElement('div');
  hmWrap.className = 'bwb-mini-heatmap';

  const bar = document.createElement('div');
  bar.className = 'bwb-heatmap-bar';
  ['western', 'neutral', 'adversarial'].forEach(function(bloc, i) {
    const pct = [wPct, nPct, aPct][i];
    const seg = document.createElement('div');
    seg.className = 'bwb-bar-' + bloc;
    seg.style.width = pct + '%';
    seg.title = [western + ' Western', neutral + ' Non-Aligned', adversarial + ' Adversarial'][i];
    bar.appendChild(seg);
  });
  hmWrap.appendChild(bar);

  const labels = document.createElement('div');
  labels.className = 'bwb-heatmap-labels';
  [
    { cls: 'western', txt: western + ' Western' },
    { cls: 'neutral', txt: neutral + ' Non-Aligned' },
    { cls: 'adversarial', txt: adversarial + ' Adversarial' }
  ].forEach(function(item) {
    const span = document.createElement('span');
    span.className = item.cls;
    span.textContent = item.txt;
    labels.appendChild(span);
  });
  hmWrap.appendChild(labels);
  card.appendChild(hmWrap);

  // Source pills
  const pills = document.createElement('div');
  pills.className = 'bwb-source-pills';
  sources.slice(0, 5).forEach(function(src) {
    const pill = document.createElement('span');
    pill.className = 'bwb-source-pill ' + (src.bloc || '');
    pill.title = src.country || '';
    pill.textContent = src.name || src.id || '';
    pills.appendChild(pill);
  });
  if (total > 5) {
    const more = document.createElement('span');
    more.className = 'bwb-source-pill more';
    more.textContent = '+' + (total - 5);
    pills.appendChild(more);
  }
  card.appendChild(pills);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'bwb-card-footer';

  const published = story.published
    ? new Date(story.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  [
    published,
    total + ' sources',
    (story.entity_count || 0) + ' entities',
    story.bias_variance ? 'Variance ' + story.bias_variance.toFixed(1) : '',
    story.blindspot_score ? 'BS ' + story.blindspot_score.toFixed(1) : ''
  ].filter(Boolean).forEach(function(txt) {
    const span = document.createElement('span');
    span.className = 'bwb-card-stat';
    span.textContent = txt;
    footer.appendChild(span);
  });
  card.appendChild(footer);

  return card;
}

// Wire filter buttons
document.addEventListener('DOMContentLoaded', function() {
  renderFeed('all');

  const nav = document.getElementById('filter-nav');
  if (nav) {
    nav.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      nav.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderFeed(btn.dataset.filter);
    });
  }
});
