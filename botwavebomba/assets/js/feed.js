// BOTWAVEBOMBA — Story Feed Renderer
// Ground News-style bias coverage: Left / Center / Right + per-article media strip

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
    const bsEl    = document.getElementById('blindspot-count');
    if (storyEl) storyEl.textContent = _allStories.length;
    if (bsEl)    bsEl.textContent    = bsCount;
  }

  let filtered = _allStories;
  if (filter === 'blindspot')    filtered = _allStories.filter(function(s) { return s.is_blindspot; });
  if (filter === 'has-video')    filtered = _allStories.filter(function(s) { return s.has_video; });
  if (filter === 'left-heavy')   filtered = _allStories.filter(function(s) { return ((s.coverage || {}).left_pct  || 0) >= 60; });
  if (filter === 'right-heavy')  filtered = _allStories.filter(function(s) { return ((s.coverage || {}).right_pct || 0) >= 60; });
  if (filter === 'adversarial')  filtered = _allStories.filter(function(s) {
    return (s.sources || []).some(function(src) { return src.bloc === 'adversarial'; });
  });
  if (filter === 'western')      filtered = _allStories.filter(function(s) {
    return (s.sources || []).every(function(src) { return src.bloc === 'western'; });
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
  const sources  = story.sources  || [];
  const articles = story.articles || [];
  const cov      = story.coverage || {};
  const lPct     = cov.left_pct   || 0;
  const cPct     = cov.center_pct || 0;
  const rPct     = cov.right_pct  || 0;
  const stCount  = cov.state_count || 0;
  const total    = sources.length;

  const card = document.createElement('article');
  card.className = 'bwb-card';
  card.addEventListener('click', function(e) {
    if (!e.target.closest('.bwb-article-link')) {
      window.location = '/botwavebomba/story.html?id=' + encodeURIComponent(story.id);
    }
  });

  // ── THUMBNAIL ─────────────────────────────────────────────────────────────
  const thumb = document.createElement('div');
  thumb.className = 'bwb-card-thumb';

  const img = document.createElement('img');
  // Hero image: first article with a real photo, then story-level, then seed fallback
  const heroSrc = (articles.find(function(a) { return a.image_url; }) || {}).image_url
    || story.image_url
    || ('https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450');
  img.src      = heroSrc;
  img.alt      = story.headline || '';
  img.loading  = 'lazy';
  img.onerror  = function() {
    this.src     = 'https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450';
    this.onerror = null;
  };
  thumb.appendChild(img);

  const thumbBadges = document.createElement('div');
  thumbBadges.className = 'bwb-card-thumb-badges';
  if (story.is_blindspot) {
    const b = document.createElement('span');
    b.className  = 'bwb-badge blindspot';
    b.textContent = 'BLINDSPOT';
    thumbBadges.appendChild(b);
  }
  if (story.has_video) {
    const v = document.createElement('span');
    v.className  = 'bwb-badge video';
    v.textContent = '▶ VIDEO';
    thumbBadges.appendChild(v);
  }
  if (thumbBadges.children.length) thumb.appendChild(thumbBadges);
  card.appendChild(thumb);

  // ── CARD BODY ─────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'bwb-card-body';

  const h = document.createElement('h2');
  h.className   = 'bwb-card-headline';
  h.textContent = story.headline || '';
  body.appendChild(h);

  const summary = story.summary || '';
  const p = document.createElement('p');
  p.className   = 'bwb-card-summary';
  p.textContent = summary.length > 180 ? summary.slice(0, 180) + '…' : summary;
  body.appendChild(p);

  // ── BIAS COVERAGE BAR (Left / Center / Right) ─────────────────────────────
  const biasWrap = document.createElement('div');
  biasWrap.className = 'bwb-bias-bar-wrap';

  const biasBar = document.createElement('div');
  biasBar.className = 'bwb-bias-bar';
  [['left', lPct, 'Left'], ['center', cPct, 'Center'], ['right', rPct, 'Right']].forEach(function(item) {
    var bucket = item[0], pct = item[1], label = item[2];
    if (pct > 0) {
      const seg = document.createElement('div');
      seg.className  = 'bwb-bias-seg bwb-bias-' + bucket;
      seg.style.width = pct + '%';
      seg.title      = label + ' ' + pct + '%';
      biasBar.appendChild(seg);
    }
  });
  biasWrap.appendChild(biasBar);

  const biasMeta = document.createElement('div');
  biasMeta.className = 'bwb-bias-meta';

  if (story.blindspot_label) {
    const flag = document.createElement('span');
    flag.className  = 'bwb-blindspot-flag';
    flag.textContent = '⚑ ' + story.blindspot_label;
    biasMeta.appendChild(flag);
    // Still show pcts after flag
    [['left', lPct, 'L'], ['center', cPct, 'C'], ['right', rPct, 'R']].forEach(function(item) {
      var bucket = item[0], pct = item[1], short = item[2];
      const span = document.createElement('span');
      span.className  = 'bwb-bias-pct bwb-bias-' + bucket;
      span.textContent = short + ' ' + pct + '%';
      biasMeta.appendChild(span);
    });
  } else {
    [['left', lPct, 'L'], ['center', cPct, 'C'], ['right', rPct, 'R']].forEach(function(item) {
      var bucket = item[0], pct = item[1], short = item[2];
      const span = document.createElement('span');
      span.className  = 'bwb-bias-pct bwb-bias-' + bucket;
      span.textContent = short + ' ' + pct + '%';
      biasMeta.appendChild(span);
    });
  }
  if (stCount > 0) {
    const st = document.createElement('span');
    st.className  = 'bwb-bias-pct state';
    st.textContent = stCount + ' state';
    biasMeta.appendChild(st);
  }
  biasWrap.appendChild(biasMeta);
  body.appendChild(biasWrap);

  // ── ARTICLE STRIP ─────────────────────────────────────────────────────────
  const realArticles = articles.filter(function(a) { return a.url; });
  if (realArticles.length > 0) {
    const strip = document.createElement('div');
    strip.className = 'bwb-article-strip';

    realArticles.slice(0, 6).forEach(function(art) {
      const item = document.createElement('a');
      item.className = 'bwb-article-link';
      item.href      = art.url;
      item.target    = '_blank';
      item.rel       = 'noopener noreferrer';
      item.addEventListener('click', function(e) { e.stopPropagation(); });

      const artThumb = document.createElement('div');
      artThumb.className = 'bwb-article-thumb';
      if (art.image_url) {
        const artImg  = document.createElement('img');
        artImg.src    = art.image_url;
        artImg.alt    = '';
        artImg.loading = 'lazy';
        artImg.onerror = function() { this.remove(); };
        artThumb.appendChild(artImg);
      }
      if (art.video_url) {
        const play = document.createElement('span');
        play.className  = 'bwb-mini-play';
        play.textContent = '▶';
        artThumb.appendChild(play);
      }
      item.appendChild(artThumb);

      const srcLabel = document.createElement('span');
      srcLabel.className  = 'bwb-article-src';
      srcLabel.textContent = art.source_name || art.source || '';
      item.appendChild(srcLabel);

      strip.appendChild(item);
    });
    body.appendChild(strip);
  }

  // ── SOURCE PILLS ──────────────────────────────────────────────────────────
  const pills = document.createElement('div');
  pills.className = 'bwb-source-pills';
  sources.slice(0, 4).forEach(function(src) {
    const pill = document.createElement('span');
    // bias_bucket (left/center/right) takes priority over legacy bloc
    const colorClass = src.bias_bucket || src.bloc || '';
    pill.className  = 'bwb-source-pill ' + colorClass;
    pill.title      = (src.country || '') + (src.bias_tier ? ' · ' + src.bias_tier : '');
    pill.textContent = src.name || src.id || '';
    pills.appendChild(pill);
  });
  if (total > 4) {
    const more = document.createElement('span');
    more.className  = 'bwb-source-pill more';
    more.textContent = '+' + (total - 4) + ' more';
    pills.appendChild(more);
  }
  body.appendChild(pills);

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'bwb-card-footer';

  const published = story.published
    ? new Date(story.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  [published, total + ' sources'].filter(Boolean).forEach(function(txt) {
    const span = document.createElement('span');
    span.className  = 'bwb-card-stat';
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
