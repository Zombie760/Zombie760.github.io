// BOTWAVEBOMBA — Story Feed Renderer
// Newspaper sections + bias coverage + geo-frame detection

let _allStories   = [];
let _sectionsData = [];

// Section display labels — newspaper feel, no emojis in labels
var SECTION_LABELS = {
  'front-page':    'Front Page',
  'world':         'World',
  'politics':      'Politics',
  'conflict':      'Conflict',
  'business':      'Business',
  'tech':          'Technology',
  'health':        'Health',
  'climate':       'Climate',
  'sports':        'Sports',
  'entertainment': 'Entertainment',
  'chisme':        'Chisme',
  'funnies':       'Funnies',
};

function buildSectionDivider(sectionId) {
  var label = SECTION_LABELS[sectionId] || sectionId;
  var div = document.createElement('div');
  div.className = 'bwb-section-divider';
  div.id = 'section-' + sectionId;

  var lbl = document.createElement('span');
  lbl.className   = 'bwb-section-divider-label';
  lbl.textContent = label.toUpperCase();
  div.appendChild(lbl);

  var line = document.createElement('div');
  line.className = 'bwb-section-divider-line';
  div.appendChild(line);

  return div;
}

async function renderFeed(filter) {
  filter = filter || 'all';
  var feed = document.getElementById('story-feed');

  if (!_allStories.length) {
    var data      = await BWB_API.getLatest();
    _allStories   = data.stories  || [];
    _sectionsData = data.sections || [];

    var bsCount = _allStories.filter(function(s) { return s.is_blindspot; }).length;
    var storyEl = document.getElementById('story-count');
    var bsEl    = document.getElementById('blindspot-count');
    if (storyEl) storyEl.textContent = _allStories.length;
    if (bsEl)    bsEl.textContent    = bsCount;

    buildSectionTabs(_sectionsData);
  }

  var signalFilters = ['blindspot','mono-frame','blackout','has-video','left-heavy','right-heavy','adversarial'];
  var isSignal = signalFilters.indexOf(filter) !== -1;

  var filtered = _allStories;
  if (filter === 'blindspot')   filtered = _allStories.filter(function(s) { return s.is_blindspot; });
  if (filter === 'mono-frame')  filtered = _allStories.filter(function(s) { return s.geo_frame === 'mono-frame'; });
  if (filter === 'blackout')    filtered = _allStories.filter(function(s) { return s.geo_frame === 'blackout'; });
  if (filter === 'has-video')   filtered = _allStories.filter(function(s) { return s.has_video; });
  if (filter === 'left-heavy')  filtered = _allStories.filter(function(s) { return ((s.coverage || {}).left_pct  || 0) >= 60; });
  if (filter === 'right-heavy') filtered = _allStories.filter(function(s) { return ((s.coverage || {}).right_pct || 0) >= 60; });
  if (filter === 'adversarial') filtered = _allStories.filter(function(s) {
    return (s.sources || []).some(function(src) { return src.bloc === 'adversarial'; });
  });
  if (!isSignal && filter !== 'all') {
    filtered = _allStories.filter(function(s) { return s.section === filter; });
  }

  while (feed.firstChild) feed.removeChild(feed.firstChild);

  if (!filtered.length) {
    var empty = document.createElement('div');
    empty.className   = 'bwb-empty';
    empty.textContent = 'No stories in this section yet — check back after the next pipeline run.';
    feed.appendChild(empty);
    return;
  }

  // All-view: inject section dividers between groups (newspaper layout)
  if (filter === 'all') {
    var currentSection = null;
    filtered.forEach(function(story) {
      var sec = story.section || 'world';
      if (sec !== currentSection) {
        feed.appendChild(buildSectionDivider(sec));
        currentSection = sec;
      }
      feed.appendChild(buildCard(story));
    });
  } else {
    filtered.forEach(function(story) {
      feed.appendChild(buildCard(story));
    });
  }
}

function buildSectionTabs(sections) {
  var nav = document.getElementById('section-nav');
  if (!nav) return;

  // Remove any previously injected buttons (keep static children if any)
  while (nav.firstChild) nav.removeChild(nav.firstChild);

  var allBtn       = document.createElement('button');
  allBtn.className = 'active';
  allBtn.dataset.filter = 'all';
  allBtn.textContent    = 'All';
  nav.appendChild(allBtn);

  sections.forEach(function(sec) {
    if (sec.id === 'front-page') return;
    var btn = document.createElement('button');
    btn.dataset.filter = sec.id;
    btn.textContent    = SECTION_LABELS[sec.id] || sec.label;
    nav.appendChild(btn);
  });

  nav.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    nav.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderFeed(btn.dataset.filter);
    // Scroll feed into view
    var feed = document.getElementById('story-feed');
    if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function buildCard(story) {
  var sources  = story.sources  || [];
  var articles = story.articles || [];
  var cov      = story.coverage || {};
  var lPct     = cov.left_pct   || 0;
  var cPct     = cov.center_pct || 0;
  var rPct     = cov.right_pct  || 0;
  var stCount  = cov.state_count || 0;
  var total    = sources.length;

  var card = document.createElement('article');
  card.className = 'bwb-card';
  // Left-edge bloc indicator
  if (story.is_blindspot) card.classList.add('blindspot');
  else if (story.geo_frame === 'mono-frame') card.classList.add('mono-frame');
  else if (story.geo_frame === 'blackout') card.classList.add('blackout');
  card.addEventListener('click', function(e) {
    if (!e.target.closest('.bwb-article-link')) {
      window.location = '/story.html?id=' + encodeURIComponent(story.id);
    }
  });

  // ── THUMBNAIL ─────────────────────────────────────────────────────────────
  var thumb = document.createElement('div');
  thumb.className = 'bwb-card-thumb';

  var img = document.createElement('img');
  var heroSrc = (articles.find(function(a) { return a.image_url; }) || {}).image_url
    || story.image_url
    || ('https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450');
  img.src     = heroSrc;
  img.alt     = story.headline || '';
  img.loading = 'lazy';
  img.onerror = function() {
    this.src     = 'https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450';
    this.onerror = null;
  };
  thumb.appendChild(img);

  var thumbBadges = document.createElement('div');
  thumbBadges.className = 'bwb-card-thumb-badges';
  if (story.is_blindspot) {
    var b = document.createElement('span');
    b.className   = 'bwb-badge blindspot';
    b.textContent = 'BLINDSPOT';
    thumbBadges.appendChild(b);
  }
  if (story.has_video) {
    var v = document.createElement('span');
    v.className   = 'bwb-badge video';
    v.textContent = 'VIDEO';
    thumbBadges.appendChild(v);
  }
  if (story.geo_frame === 'mono-frame') {
    var gfm = document.createElement('span');
    gfm.className   = 'bwb-badge mono-frame';
    gfm.textContent = 'MONO-FRAME';
    thumbBadges.appendChild(gfm);
  }
  if (story.geo_frame === 'blackout') {
    var gfb = document.createElement('span');
    gfb.className   = 'bwb-badge blackout';
    gfb.textContent = 'W. BLACKOUT';
    thumbBadges.appendChild(gfb);
  }
  if (thumbBadges.children.length) thumb.appendChild(thumbBadges);
  card.appendChild(thumb);

  // ── CARD BODY ─────────────────────────────────────────────────────────────
  var body = document.createElement('div');
  body.className = 'bwb-card-body';

  var h = document.createElement('h2');
  h.className   = 'bwb-card-headline';
  h.textContent = story.headline || '';
  body.appendChild(h);

  var summary = story.summary || '';
  var p = document.createElement('p');
  p.className   = 'bwb-card-summary';
  p.textContent = summary.length > 180 ? summary.slice(0, 180) + '...' : summary;
  body.appendChild(p);

  // ── BIAS COVERAGE BAR (Left / Center / Right) ─────────────────────────────
  var biasWrap = document.createElement('div');
  biasWrap.className = 'bwb-bias-bar-wrap';

  var biasBar = document.createElement('div');
  biasBar.className = 'bwb-bias-bar';
  [['left', lPct, 'Left'], ['center', cPct, 'Center'], ['right', rPct, 'Right']].forEach(function(item) {
    var bucket = item[0], pct = item[1], label = item[2];
    if (pct > 0) {
      var seg = document.createElement('div');
      seg.className  = 'bwb-bias-seg bwb-bias-' + bucket;
      seg.style.width = pct + '%';
      seg.title      = label + ' ' + pct + '%';
      biasBar.appendChild(seg);
    }
  });
  biasWrap.appendChild(biasBar);

  var biasMeta = document.createElement('div');
  biasMeta.className = 'bwb-bias-meta';

  if (story.blindspot_label) {
    var flag = document.createElement('span');
    flag.className   = 'bwb-blindspot-flag';
    flag.textContent = 'FLAG: ' + story.blindspot_label;
    biasMeta.appendChild(flag);
  }
  [['left', lPct, 'L'], ['center', cPct, 'C'], ['right', rPct, 'R']].forEach(function(item) {
    var bucket = item[0], pct = item[1], short = item[2];
    var span = document.createElement('span');
    span.className   = 'bwb-bias-pct bwb-bias-' + bucket;
    span.textContent = short + ' ' + pct + '%';
    biasMeta.appendChild(span);
  });
  if (stCount > 0) {
    var st = document.createElement('span');
    st.className   = 'bwb-bias-pct state';
    st.textContent = stCount + ' state';
    biasMeta.appendChild(st);
  }
  biasWrap.appendChild(biasMeta);
  body.appendChild(biasWrap);

  // ── GEO FRAME BREAKDOWN ───────────────────────────────────────────────────
  if (story.geo_frame && story.geo_frame_label) {
    var gfWrap = document.createElement('div');
    gfWrap.className = 'bwb-geo-frame-wrap bwb-geo-' + story.geo_frame;

    var gfLabel = document.createElement('span');
    gfLabel.className   = 'bwb-geo-frame-label';
    gfLabel.textContent = (story.geo_frame === 'mono-frame' ? 'MONO-FRAME: ' : 'W.BLACKOUT: ')
                        + story.geo_frame_label.replace(/^Western (Mono-Frame|Blackout): /, '');
    gfWrap.appendChild(gfLabel);

    var bd = story.geo_breakdown || {};
    var geoOrder = [['west','West'], ['middle-east','Mid-East'], ['latin-america','Lat-Am'],
                    ['africa','Africa'], ['pacific-asia','Asia'], ['adversarial','Adv'],
                    ['eastern-europe','E.Eur'], ['global-south','G-South']];
    var nonZero = geoOrder.filter(function(g) { return bd[g[0]]; });
    if (nonZero.length) {
      var gfCounts = document.createElement('span');
      gfCounts.className   = 'bwb-geo-counts';
      gfCounts.textContent = nonZero.map(function(g) { return g[1] + ': ' + bd[g[0]]; }).join('  ·  ');
      gfWrap.appendChild(gfCounts);
    }
    body.appendChild(gfWrap);
  }

  // ── ARTICLE STRIP ─────────────────────────────────────────────────────────
  var realArticles = articles.filter(function(a) { return a.url; });
  if (realArticles.length > 0) {
    var strip = document.createElement('div');
    strip.className = 'bwb-article-strip';

    realArticles.slice(0, 6).forEach(function(art) {
      var item = document.createElement('a');
      item.className = 'bwb-article-link';
      item.href      = art.url;
      item.target    = '_blank';
      item.rel       = 'noopener noreferrer';
      item.addEventListener('click', function(e) { e.stopPropagation(); });

      var artThumb = document.createElement('div');
      artThumb.className = 'bwb-article-thumb';
      if (art.image_url) {
        var artImg   = document.createElement('img');
        artImg.src   = art.image_url;
        artImg.alt   = '';
        artImg.loading = 'lazy';
        artImg.onerror = function() { this.remove(); };
        artThumb.appendChild(artImg);
      }
      if (art.video_url) {
        var play = document.createElement('span');
        play.className   = 'bwb-mini-play';
        play.textContent = 'V';
        artThumb.appendChild(play);
      }
      item.appendChild(artThumb);

      var srcLabel = document.createElement('span');
      srcLabel.className   = 'bwb-article-src';
      srcLabel.textContent = art.source_name || art.source || '';
      item.appendChild(srcLabel);

      strip.appendChild(item);
    });
    body.appendChild(strip);
  }

  // ── SOURCE PILLS ──────────────────────────────────────────────────────────
  var pills = document.createElement('div');
  pills.className = 'bwb-source-pills';
  sources.slice(0, 4).forEach(function(src) {
    var pill = document.createElement('span');
    var colorClass = src.bias_bucket || src.bloc || '';
    pill.className   = 'bwb-source-pill ' + colorClass;
    // Build title from enriched data
    var titleParts = [];
    if (src.country) titleParts.push(src.country);
    if (src.bloc) titleParts.push(src.bloc);
    if (src.factuality && src.factuality !== 'unknown') titleParts.push(src.factuality);
    if (src.primary_vs_launder && src.primary_vs_launder !== 'unknown') titleParts.push(src.primary_vs_launder);
    if (src.political_lean && src.political_lean !== 'unknown') titleParts.push(src.political_lean);
    pill.title = titleParts.join(' · ') || '';

    // Factuality dot inside pill
    var fDot = src.factuality || 'unknown';
    if (fDot !== 'unknown') {
      var dot = document.createElement('span');
      dot.className = 'bwb-fact-dot ' + fDot;
      pill.appendChild(dot);
    }
    var nameSpan = document.createElement('span');
    nameSpan.className = 'bwb-source-pill-name';
    nameSpan.textContent = src.name || src.id || '';
    pill.appendChild(nameSpan);

    // Launderer tag
    var pvl = src.primary_vs_launder || 'unknown';
    if (pvl === 'launderer' || pvl === 'aggregator') {
      var tag = document.createElement('span');
      tag.className = 'bwb-source-tag ' + pvl;
      tag.textContent = pvl === 'launderer' ? 'LAUNDER' : 'AGG';
      pill.appendChild(tag);
    }

    pills.appendChild(pill);
  });
  if (total > 4) {
    var more = document.createElement('span');
    more.className   = 'bwb-source-pill more';
    more.textContent = '+' + (total - 4) + ' more';
    pills.appendChild(more);
  }
  body.appendChild(pills);

  // ── OWNERSHIP CONCENTRATION ──────────────────────────────────────────────
  // Detect when 2+ sources share the same parent company
  var parentCounts = {};
  sources.forEach(function(src) {
    var pc = src.parent_company || '';
    if (pc && pc.indexOf('unknown') === -1) {
      parentCounts[pc] = (parentCounts[pc] || 0) + 1;
    }
  });
  var concentrated = Object.keys(parentCounts).filter(function(k) { return parentCounts[k] >= 2; });
  if (concentrated.length > 0) {
    var ownDiv = document.createElement('div');
    ownDiv.className = 'bwb-ownership-conc';
    concentrated.forEach(function(company) {
      var tag = document.createElement('span');
      tag.className = 'bwb-own-tag';
      tag.textContent = company + ' (' + parentCounts[company] + ')';
      ownDiv.appendChild(tag);
    });
    body.appendChild(ownDiv);
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  var footer = document.createElement('div');
  footer.className = 'bwb-card-footer';

  var published = story.published
    ? new Date(story.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  [published, total + ' sources'].filter(Boolean).forEach(function(txt) {
    var span = document.createElement('span');
    span.className   = 'bwb-card-stat';
    span.textContent = txt;
    footer.appendChild(span);
  });
  body.appendChild(footer);

  card.appendChild(body);
  return card;
}


// ── FULL DATA REFRESH ──
// When the full 2MB payload loads in the background, refresh the feed
// with complete articles and ownership data
window.addEventListener('bwb-full-data', function(e) {
  var fullData = e.detail;
  if (!fullData || !fullData.stories) return;
  _allStories = fullData.stories;
  _sectionsData = fullData.sections || [];
  
  // Update counts
  var bsCount = _allStories.filter(function(s) { return s.is_blindspot; }).length;
  var storyEl = document.getElementById('story-count');
  var bsEl = document.getElementById('blindspot-count');
  if (storyEl) storyEl.textContent = _allStories.length;
  if (bsEl) bsEl.textContent = bsCount;

  // Re-render current filter with full data (includes articles)
  var activeFilter = document.querySelector('.bwb-filters .active[data-filter]');
  if (activeFilter) {
    renderFeed(activeFilter.dataset.filter);
  } else {
    renderFeed('all');
  }
});

// Boot
document.addEventListener('DOMContentLoaded', function() {
  // Load registry stats into header
  BWB_API.getSources().then(function(registry) {
    var sources = registry.sources || [];
    if (!sources.length) return;

    var blocCounts = { western: 0, adversarial: 0, 'non-aligned': 0 };
    var fpCount = 0;
    var factHigh = 0, factMixed = 0;

    sources.forEach(function(s) {
      var bloc = s.bloc || 'unknown';
      if (blocCounts[bloc] !== undefined) blocCounts[bloc]++;
      if (s.axis && Object.keys(s.axis).length) fpCount++;
      var f = s.factuality || 'unknown';
      if (f === 'high' || f === 'mostly_factual') factHigh++;
      else if (f === 'mixed') factMixed++;
    });

    var el = function(id) { return document.getElementById(id); };
    if (el('source-count')) el('source-count').textContent = sources.length;
    if (el('fp-count')) el('fp-count').textContent = fpCount;
    if (el('western-count')) el('western-count').textContent = blocCounts.western;
    if (el('adversarial-count')) el('adversarial-count').textContent = blocCounts.adversarial;
    if (el('nonaligned-count')) el('nonaligned-count').textContent = blocCounts['non-aligned'];
  });

  renderFeed('all');

  // Signal filter row — wired statically
  var sigNav = document.getElementById('filter-nav');
  if (sigNav) {
    sigNav.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      sigNav.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      // Clear section nav active state
      var secNav = document.getElementById('section-nav');
      if (secNav) secNav.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
      renderFeed(btn.dataset.filter);
    });
  }
});
