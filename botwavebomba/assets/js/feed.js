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

  // Thumbnail zone (16:9, image-first like Ground News)
  const thumb = document.createElement('div');
  thumb.className = 'bwb-card-thumb';

  const img = document.createElement('img');
  img.src = story.image_url || ('https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450');
  img.alt = story.headline || '';
  img.loading = 'lazy';
  img.onerror = function() {
    this.src = 'https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450';
    this.onerror = null;
  };
  thumb.appendChild(img);

  // Badges overlaid on image
  const thumbBadges = document.createElement('div');
  thumbBadges.className = 'bwb-card-thumb-badges';
  if (story.is_blindspot) {
    const b = document.createElement('span');
    b.className = 'bwb-badge blindspot';
    b.textContent = 'BLINDSPOT';
    thumbBadges.appendChild(b);
  }
  if ((story.bias_variance || 0) > 7) {
    const b = document.createElement('span');
    b.className = 'bwb-badge high-variance';
    b.textContent = 'HIGH VARIANCE';
    thumbBadges.appendChild(b);
  }
  if (thumbBadges.children.length) thumb.appendChild(thumbBadges);
  card.appendChild(thumb);

  // Card body
  const body = document.createElement('div');
  body.className = 'bwb-card-body';

  // Headline
  const h = document.createElement('h2');
  h.className = 'bwb-card-headline';
  h.textContent = story.headline || '';
  body.appendChild(h);

  // Summary
  const summary = story.summary || '';
  const p = document.createElement('p');
  p.className = 'bwb-card-summary';
  p.textContent = summary.length > 180 ? summary.slice(0, 180) + '…' : summary;
  body.appendChild(p);

  // Coverage bar (W / N / A)
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
    { cls: 'western', txt: 'W ' + wPct + '%' },
    { cls: 'neutral', txt: 'N ' + nPct + '%' },
    { cls: 'adversarial', txt: 'A ' + aPct + '%' }
  ].forEach(function(item) {
    const span = document.createElement('span');
    span.className = item.cls;
    span.textContent = item.txt;
    labels.appendChild(span);
  });
  hmWrap.appendChild(labels);
  body.appendChild(hmWrap);

  // Source pills
  const pills = document.createElement('div');
  pills.className = 'bwb-source-pills';
  sources.slice(0, 4).forEach(function(src) {
    const pill = document.createElement('span');
    pill.className = 'bwb-source-pill ' + (src.bloc || '');
    pill.title = src.country || '';
    pill.textContent = src.name || src.id || '';
    pills.appendChild(pill);
  });
  if (total > 4) {
    const more = document.createElement('span');
    more.className = 'bwb-source-pill more';
    more.textContent = '+' + (total - 4) + ' more';
    pills.appendChild(more);
  }
  body.appendChild(pills);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'bwb-card-footer';

  const published = story.published
    ? new Date(story.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  [
    published,
    total + ' sources',
    story.bias_variance ? 'Var ' + story.bias_variance.toFixed(1) : ''
  ].filter(Boolean).forEach(function(txt) {
    const span = document.createElement('span');
    span.className = 'bwb-card-stat';
    span.textContent = txt;
    footer.appendChild(span);
  });
  body.appendChild(footer);

  card.appendChild(body);
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
