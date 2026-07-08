// BOTWAVEBOMBA — Story Feed Renderer
// Newspaper sections + bias coverage + geo-frame detection

let _allStories   = [];
let _sectionsData = [];

// ── W6: Funding-graph lazy cache (loads once, survives across card renders) ──
// Every visible source-pill can resolve its owner from this map. W6 wired
// the schema (entity, edge, outlet_to_owner) — the chrome surfaces it.
let _fundingGraph      = null;   // { entities, edges, outlet_to_owner, ... } or null while loading
let _fundingGraphTried = false;  // one-shot loader; failure is sticky-silent
function _loadFundingGraph() {
  if (_fundingGraph || _fundingGraphTried) return;
  _fundingGraphTried = true;
  fetch('api/funding_graph.json', { cache: 'force-cache' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(j) { _fundingGraph = j; })
    .catch(function() { /* silent fail — funding chip hides itself */ });
}
function _resolveOwner(name) {
  if (!_fundingGraph || !_fundingGraph.outlet_to_owner) return null;
  if (!name) return null;
  return _fundingGraph.outlet_to_owner[name.toLowerCase()] || null;
}

// ── W13: Source-registry cache — factuality, political_lean, parent_company ──
// The pipeline-side factuality defaults to "unknown" for sources not in
// `scored_by_cid` (because bias_scorer.py is dead code per DIAGNOSTIC.md).
// The chrome-side can recover it from source_registry_deploy.json which
// has 374/603 sources with non-unknown factuality. Loaded once, indexed
// by source id AND by lowercased name. Story-side sources often carry
// display names (e.g. "Al Jazeera English") while the registry carries
// slugs ("al-jazeera-english") — the name fallback is what makes the
// enrichment actually fire. Cross-ref: W13 ISC.
let _registryById     = null;   // { source_id: registry_record } or null while loading
let _registryByName   = null;   // { lowercase_name: registry_record } for display-name fallback
let _registryTried    = false;
function _loadRegistry() {
  if (_registryById || _registryTried) return;
  _registryTried = true;
  if (typeof BWB_API === 'undefined' || !BWB_API.getSources) {
    return;  // BWB_API not loaded yet — caller will retry on next render
  }
  BWB_API.getSources()
    .then(function(registry) {
      var byId = {};
      var byName = {};
      (registry.sources || []).forEach(function(s) {
        if (s && s.id) byId[s.id] = s;
        if (s && s.name) byName[String(s.name).toLowerCase()] = s;
      });
      _registryById   = byId;
      _registryByName = byName;
      // Re-render any cards already on the page so they pick up the new data
      _reenrichRenderedCards();
    })
    .catch(function() { /* silent fail — bias bar shows without enrichment */ });
}
function _resolveRegistry(idOrName) {
  if (!_registryById) return null;
  if (!idOrName) return null;
  return _registryById[idOrName] || _registryByName[String(idOrName).toLowerCase()] || null;
}
// Apply registry enrichment to a source object in place, returning it.
// Pipeline values win when present and non-default; registry fills the gaps.
function _enrichSource(src) {
  if (!src) return src;
  if (!src.id && !src.name) return src;
  // Try id first, then name
  var reg = _resolveRegistry(src.id) || _resolveRegistry(src.name);
  if (!reg) return src;
  // Factuality — registry has it, pipeline clobbers to "unknown"
  if ((!src.factuality || src.factuality === 'unknown') && reg.factuality) {
    src.factuality = reg.factuality;
  }
  // political_lean → bias_bucket mapping
  // Pipeline clobbers bias_bucket to "center"; registry has political_lean
  if ((!src.bias_bucket || src.bias_bucket === 'center') && reg.political_lean) {
    src.bias_bucket = _leanToBucket(reg.political_lean);
  }
  // bias_tier — registry has it as `political_lean` directly
  if ((!src.bias_tier || src.bias_tier === 'unknown') && reg.political_lean) {
    src.bias_tier = reg.political_lean;
  }
  // parent_company
  if (!src.parent_company && reg.parent_company) {
    src.parent_company = reg.parent_company;
  }
  return src;
}
function _leanToBucket(lean) {
  if (!lean) return 'center';
  var l = String(lean).toLowerCase();
  if (l === 'left' || l === 'lean_left')              return 'left';
  if (l === 'right' || l === 'lean_right')            return 'right';
  if (l === 'center' || l === 'mostly_factual')       return 'center';
  // non-aligned / state_aligned / independent / anti-western / western-non-us
  // — Ground News only knows L/C/R; we treat non-aligned regional press as
  // "center" (independent regional coverage) and adversarial as its own
  // bucket that the bias bar can render with a fourth color.
  if (l === 'non-aligned' || l === 'independent')     return 'center';
  if (l === 'state_aligned' || l === 'anti-western')  return 'right';  // state press skews right in L/C/R frame
  return 'center';
}
// Per-story factuality aggregation: high/mixed/low per Ground News pattern.
function _aggregateFactuality(sources) {
  var counts = { high: 0, mostly_factual: 0, medium: 0, mixed: 0, low: 0, unknown: 0 };
  sources.forEach(function(s) {
    var f = (s && s.factuality) || 'unknown';
    if (counts[f] !== undefined) counts[f]++;
    else counts.unknown++;
  });
  var rated = counts.high + counts.mostly_factual + counts.medium + counts.mixed + counts.low;
  if (rated === 0) return { label: '—', tone: 'unknown', counts: counts };
  if (counts.high + counts.mostly_factual >= 0.7 * rated) return { label: 'High', tone: 'high', counts: counts };
  if (counts.low >= 0.3 * rated)                            return { label: 'Low', tone: 'low', counts: counts };
  return { label: 'Mixed', tone: 'mixed', counts: counts };
}

// W14: Source Diversity Score (0-100) — Ground News's "Story Rating".
// Two factors: (1) L/C/R spread — penalize stories that are 100% one bucket;
// (2) bloc spread — penalize stories missing Non-Aligned or Adversarial.
// Both factors are 0-50; total 0-100. A 100 means perfectly balanced
// (all 3 L/C/R and all 3 blocs represented). A 0 means single-source.
function _computeDiversityScore(sources) {
  if (!sources || sources.length === 0) return { score: 0, tier: 'unknown', factors: {} };
  var total = sources.length;

  // Factor 1: L/C/R spread — Herfindahl-Hirschman inverse.
  // 3 equal buckets = 1.0, 1 bucket only = 0.0.
  var lN = 0, cN = 0, rN = 0;
  sources.forEach(function(s) {
    var b = s.bias_bucket || 'center';
    if (b === 'left') lN++;
    else if (b === 'right') rN++;
    else cN++;
  });
  var pL = lN / total, pC = cN / total, pR = rN / total;
  var hhi = pL*pL + pC*pC + pR*pR;             // 1/3=0.33 (perfect), 1=1.0 (single)
  var lcrFactor = Math.max(0, Math.min(1, (1 - hhi) / 0.67)) * 50;  // 0..50

  // Factor 2: bloc spread — 1.0 if all 3 blocs present, 0.33 if 1.
  var blocs = { western: 0, 'non-aligned': 0, adversarial: 0 };
  sources.forEach(function(s) {
    var b = (s.bloc || '').toLowerCase();
    if (b === 'western') blocs.western++;
    else if (b === 'non-aligned' || b === 'neutral' || b === 'non_aligned') blocs['non-aligned']++;
    else if (b === 'adversarial') blocs.adversarial++;
  });
  var present = (blocs.western > 0 ? 1 : 0) + (blocs['non-aligned'] > 0 ? 1 : 0) + (blocs.adversarial > 0 ? 1 : 0);
  var blocFactor = (present / 3) * 50;          // 0..50

  var score = Math.round(lcrFactor + blocFactor);
  var tier = score >= 70 ? 'high' : score >= 40 ? 'mixed' : 'low';
  return { score: score, tier: tier, factors: { lcr: Math.round(lcrFactor), bloc: Math.round(blocFactor), present: present } };
}

// W14: Coverage gaps — what blocs are MISSING from this story.
// Returns array like ['non-aligned', 'adversarial'] or [] if all present.
function _detectCoverageGaps(sources) {
  if (!sources || sources.length === 0) return ['western', 'non-aligned', 'adversarial'];
  var seen = { western: false, 'non-aligned': false, adversarial: false };
  sources.forEach(function(s) {
    var b = (s.bloc || '').toLowerCase();
    if (b === 'western') seen.western = true;
    else if (b === 'non-aligned' || b === 'neutral' || b === 'non_aligned') seen['non-aligned'] = true;
    else if (b === 'adversarial') seen.adversarial = true;
  });
  var missing = [];
  if (!seen.western) missing.push('western');
  if (!seen['non-aligned']) missing.push('non-aligned');
  if (!seen.adversarial) missing.push('adversarial');
  return missing;
}

// Re-fire buildCard for any card already in the DOM. Idempotent — guards
// against double-render by checking the enrichment marker.
function _reenrichRenderedCards() {
  if (!document || !document.querySelectorAll) return;
  var cards = document.querySelectorAll('.bwb-card[data-story-id]');
  // For each card, find the matching story in _allStories, re-render
  cards.forEach(function(cardEl) {
    var sid = cardEl.getAttribute('data-story-id');
    if (!sid) return;
    var story = _allStories.find(function(s) { return s.id === sid; });
    if (!story) return;
    // Strip the old card and re-render in its place
    var parent = cardEl.parentNode;
    if (!parent) return;
    var fresh = buildCard(story);
    parent.replaceChild(fresh, cardEl);
  });
}

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

// W6: pre-warm the funding-graph cache on page load so the first card
// render can resolve the owner chain without a visible flicker.
// W13: pre-warm the source-registry cache for the same reason — factuality
// + political_lean data is critical to the bias bar's accuracy.
function _warmCaches() {
  _loadFundingGraph();
  _loadRegistry();
}
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _warmCaches);
} else {
  _warmCaches();
}

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

    // G3.2: lazy-load orphan card pool (deterministic fallback for stories
    // without a live card PNG or source image). Fire-and-forget — feed
    // renders first; orphans are used for cards that still need an image.
    if (!window._orphanCards) {
      window._orphanCards = [];
      fetch((window.BWB_BASE || '') + '/api/orphan_cards.json', { cache: 'no-store' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(d) { if (d && d.cards) window._orphanCards = d.cards; })
        .catch(function() { /* keep empty array */ });
    }

    var bsCount = _allStories.filter(function(s) { return s.is_blindspot; }).length;
    var storyEl = document.getElementById('story-count');
    var bsEl    = document.getElementById('blindspot-count');
    if (storyEl) storyEl.textContent = _allStories.length;
    if (bsEl)    bsEl.textContent    = bsCount;

    buildSectionTabs(_sectionsData);
  }

  var signalFilters = ['blindspot','mono-frame','blackout','has-video','left-heavy','right-heavy','adversarial','fact-high','fact-mixed','fact-low'];
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
  // W13: factuality filters. Each story is matched against the aggregate
  // factuality label of its source set. Requires registry enrichment to
  // have populated; if not, the filter returns the empty set quietly.
  if (filter === 'fact-high' || filter === 'fact-mixed' || filter === 'fact-low') {
    var targetTone = filter === 'fact-high' ? 'high'
                   : filter === 'fact-mixed' ? 'mixed'
                   : 'low';
    filtered = _allStories.filter(function(s) {
      (s.sources || []).forEach(function(src) { _enrichSource(src); });
      return _aggregateFactuality(s.sources || []).tone === targetTone;
    });
  }
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
  // W13: enrich each source with registry data (factuality, political_lean,
  // parent_company) before computing the bias bar. The pipeline-side data
  // has these clobbered to defaults because bias_scorer.py is dead code.
  // Registry-side recovery is what makes the bias bar + factuality display
  // actually mean something on every card.
  sources.forEach(function(s) { _enrichSource(s); });
  var cov      = story.coverage || {};
  var lPct     = cov.left_pct   || 0;
  var cPct     = cov.center_pct || 0;
  var rPct     = cov.right_pct  || 0;
  var stCount  = cov.state_count || 0;
  var total    = sources.length;

  var card = document.createElement('article');
  card.className = 'bwb-card';
  card.setAttribute('data-story-id', story.id || '');
  // Left-edge bloc indicator
  if (story.is_blindspot) card.classList.add('blindspot');
  else if (story.geo_frame === 'mono-frame') card.classList.add('mono-frame');
  else if (story.geo_frame === 'blackout') card.classList.add('blackout');
  card.addEventListener('click', function(e) {
    if (!e.target.closest('.bwb-article-link') && !e.target.closest('.bwb-source-pill')) {
      var url = '/story.html?id=' + encodeURIComponent(story.id);
      if (document.startViewTransition && typeof document.startViewTransition === 'function') {
        // Give the card a unique view-transition-name so the morph targets it
        var vtName = 'bwb-card-' + story.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        card.style.setProperty('view-transition-name', vtName);
        document.startViewTransition(function() {
          window.location.href = url;
        });
      } else {
        window.location = url;
      }
    }
  });

  // ── THUMBNAIL ─────────────────────────────────────────────────────────────
  // G3: prefer locally-generated card PNG (/api/cards/{story.id}.png — 160/160
  // match rate, 1200x630 social-aspect, generated nightly by the on-bridge cron).
  // Falls back to story image, then picsum. picsum is the dead-weight safety
  // net; the chrome surfaces our own pipeline's output first.
  // G3.2: when both the live card and the source image are missing, pick a
  // stable orphan from /api/orphan_cards.json (deterministic by story.id hash).
  // Orphans are card PNGs from prior pipeline runs — better than picsum, honest
  // about provenance (we label them "ARCHIVE" in the card).
  var thumb = document.createElement('div');
  thumb.className = 'bwb-card-thumb';

  var img = document.createElement('img');
  var liveCardSrc = '/api/cards/' + encodeURIComponent(story.id) + '.png';
  var sourceImg   = (articles.find(function(a) { return a.image_url; }) || {}).image_url
                    || story.image_url;
  // Try live card first; onerror chain handles the rest.
  var heroSrc = liveCardSrc;
  img.src     = heroSrc;
  img.alt     = story.headline || '';
  img.loading = 'lazy';
  img.dataset.kind = 'live';
  img.onerror = function() {
    // 1) Source image
    if (this.dataset.kind === 'live' && sourceImg) {
      this.dataset.kind = 'source';
      this.src = sourceImg;
      return;
    }
    // 2) Orphan pool (deterministic by story.id)
    if (this.dataset.kind !== 'orphan' && window._orphanCards && window._orphanCards.length) {
      var idx = 0;
      var s = story.id || '';
      for (var i = 0; i < s.length; i++) idx = (idx * 31 + s.charCodeAt(i)) >>> 0;
      var orphanId = window._orphanCards[idx % window._orphanCards.length];
      this.dataset.kind = 'orphan';
      this.src = '/api/cards/' + orphanId + '.png';
      thumb.classList.add('bwb-card-thumb--archive');
      return;
    }
    // 3) picsum last resort
    this.dataset.kind = 'picsum';
    this.src = 'https://picsum.photos/seed/' + encodeURIComponent(story.id) + '/800/450';
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

  // ── G2: SOURCE COUNT + BLOC BREAKDOWN (above the bar) ─────────────────────
  // Surfaces the substrate receipt before the visual. "12 sources · 9W 2N 1A"
  // is the gap the bias bar then renders. The bar becomes a *visualization* of
  // a number the reader just read — not a cipher. Operator-visible differentiator
  // vs Ground News: the per-card bloc split is named, not implied.
  var srcCountEl = document.createElement('div');
  srcCountEl.className = 'bwb-card-source-count';
  if (sources.length > 0) {
    var bCounts = { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 };
    sources.forEach(function(src) {
      var b = (src.bloc || 'other').toLowerCase();
      if (b === 'western')      bCounts.western++;
      else if (b === 'non-aligned' || b === 'neutral' || b === 'non_aligned') bCounts['non-aligned']++;
      else if (b === 'adversarial') bCounts.adversarial++;
      else bCounts.other++;
    });
    var parts = [total + ' source' + (total === 1 ? '' : 's')];
    if (bCounts.western)      parts.push('<span class="bwb-bloc-bullet western"></span>' + bCounts.western + 'W');
    if (bCounts['non-aligned']) parts.push('<span class="bwb-bloc-bullet non-aligned"></span>' + bCounts['non-aligned'] + 'N');
    if (bCounts.adversarial)  parts.push('<span class="bwb-bloc-bullet adversarial"></span>' + bCounts.adversarial + 'A');
    if (bCounts.other)        parts.push('<span class="bwb-bloc-bullet other"></span>' + bCounts.other + '·');
    srcCountEl.innerHTML = parts.join(' <span class="bwb-card-count-sep">·</span> ');
  } else {
    srcCountEl.innerHTML = '<span class="bwb-card-count-empty">no sources mapped</span>';
  }
  body.appendChild(srcCountEl);

  // ── BIAS COVERAGE BAR (Left / Center / Right) ─────────────────────────────
  // Wave-9 card-render polish: bias bar moves to TOP of body, between
  // badges and headline. 10px tall (was 5px). Segments are inline-labeled
  // "L 6 · C 5 · R 12" so the reader gets distribution + count in one read.
  // Cross-ref: _index/redteam/2026-07-06-card-render-vs-groundnews.md §4
  var biasWrap = document.createElement('div');
  biasWrap.className = 'bwb-bias-bar-wrap bwb-bias-bar-wrap--top';

  var biasBar = document.createElement('div');
  biasBar.className = 'bwb-bias-bar';
  // Compute per-bucket source count (more useful than % for L/C/R display)
  var lN = 0, cN = 0, rN = 0;
  sources.forEach(function(src) {
    var b = src.bias_bucket || '';
    if (b === 'left')        lN++;
    else if (b === 'center') cN++;
    else if (b === 'right')  rN++;
  });
  var bucketData = [
    ['left',   lN, lPct, 'L'],
    ['center', cN, cPct, 'C'],
    ['right',  rN, rPct, 'R'],
  ];
  bucketData.forEach(function(item) {
    var bucket = item[0], n = item[1], pct = item[2];
    if (n > 0) {
      var seg = document.createElement('div');
      seg.className  = 'bwb-bias-seg bwb-bias-' + bucket;
      seg.style.width = pct + '%';
      seg.title      = bucket + ' · ' + n + ' sources (' + pct + '%)';
      biasBar.appendChild(seg);
    }
  });
  biasWrap.appendChild(biasBar);

  // Inline-labeled meta: "L 6 · C 5 · R 12" — the Ground-News-style read
  var biasMeta = document.createElement('div');
  biasMeta.className = 'bwb-bias-meta bwb-bias-meta--labeled';

  if (story.blindspot_label) {
    var flag = document.createElement('span');
    flag.className   = 'bwb-blindspot-flag';
    flag.textContent = '⚑ ' + story.blindspot_label;
    biasMeta.appendChild(flag);
  }

  // W13: Factuality badge — Ground News signature feature. Per-story
  // aggregation of source factuality ratings into High / Mixed / Low.
  // Shows how trustworthy the source set is for this story.
  var factuality = _aggregateFactuality(sources);
  if (factuality.tone !== 'unknown') {
    var fbadge = document.createElement('span');
    fbadge.className   = 'bwb-factuality-badge bwb-factuality-' + factuality.tone;
    fbadge.textContent = 'FACT ' + factuality.label;
    fbadge.title = 'Source factuality — High: ' + factuality.counts.high
                 + ' · Medium: ' + factuality.counts.medium
                 + ' · Mixed: ' + factuality.counts.mixed
                 + ' · Low: ' + factuality.counts.low
                 + ' (unrated: ' + factuality.counts.unknown + ')';
    biasMeta.appendChild(fbadge);
  }

  // W14: Source Diversity Score — Ground News's "Story Rating" equivalent.
  // 0-100, composite of L/C/R spread + bloc spread. Visible score badge.
  var diversity = _computeDiversityScore(sources);
  if (diversity.score > 0 && total > 1) {
    var dbadge = document.createElement('span');
    dbadge.className   = 'bwb-diversity-badge bwb-diversity-' + diversity.tier;
    dbadge.textContent = 'DIVERSITY ' + diversity.score;
    dbadge.title = 'Source Diversity — L/C/R spread: ' + diversity.factors.lcr
                 + '/50 · Bloc spread: ' + diversity.factors.bloc + '/50'
                 + ' (blocs present: ' + diversity.factors.present + '/3)';
    biasMeta.appendChild(dbadge);
  }

  // W14: Coverage gap warning — fires when a story is missing a bloc.
  // Single-source or all-Western stories get tagged. Operator-visible
  // differentiator vs Ground News: name the gap.
  var gaps = _detectCoverageGaps(sources);
  if (gaps.length > 0 && total > 0) {
    var gapBadge = document.createElement('span');
    gapBadge.className = 'bwb-gap-badge';
    gapBadge.textContent = 'NO ' + gaps.map(function(g) { return g === 'non-aligned' ? 'NON-ALIGNED' : g.toUpperCase(); }).join(' + NO ');
    gapBadge.title = 'Coverage gap: this story has no ' + gaps.join(' / ') + ' sources. Click to see the framing delta in the side-by-side view.';
    biasMeta.appendChild(gapBadge);
  }
  bucketData.forEach(function(item) {
    var bucket = item[0], n = item[1], short = item[3];
    var span = document.createElement('span');
    span.className   = 'bwb-bias-pct bwb-bias-' + bucket;
    if (n > 0) {
      span.textContent = short + ' ' + n;
    } else {
      span.classList.add('zero');
      span.textContent = short + ' 0';
    }
    biasMeta.appendChild(span);
  });
  if (stCount > 0) {
    var st = document.createElement('span');
    st.className   = 'bwb-bias-pct state';
    st.textContent = '+' + stCount + ' state';
    biasMeta.appendChild(st);
  }
  // total sources
  var tot = document.createElement('span');
  tot.className   = 'bwb-bias-pct total';
  tot.textContent = total + ' source' + (total === 1 ? '' : 's');
  biasMeta.appendChild(tot);
  biasWrap.appendChild(biasMeta);
  body.appendChild(biasWrap);

  // ── W6: FUNDING CHIP ──────────────────────────────────────────────────────
  // For every source in the story, attempt to resolve the owner from the
  // funding graph. If at least one resolves, render a single summary chip
  // that surfaces the dominant owner + instrument. Operator-visible
  // differentiator vs Ground News: "see who paid for this framing" right
  // on the card. Cross-ref: ISA.md ISC-58.
  (function() {
    var owners = [];
    sources.forEach(function(src) {
      var fb = src.funding_breakdown;
      if (fb && fb.dominant_instrument) {
        owners.push({ src: src, fb: fb, owner: null, key: src.id || src.name });
        return;
      }
      var key = (src.name || src.id || '').toLowerCase();
      var rec = _resolveOwner(src.name || src.id);
      if (rec) owners.push({ src: src, fb: null, owner: rec, key: key });
    });
    if (owners.length === 0) return;

    var chip = document.createElement('div');
    chip.className = 'bwb-funding-chip';

    // Color by ownership form: red=state, blue=public_corp, gold=private/family
    var form = owners[0].owner ? owners[0].owner.ownership_form : null;
    if (!form && owners[0].fb) form = owners[0].fb.dominant_instrument;
    if (form === 'state' || form === 'state_entity')        chip.classList.add('bwb-fund-state');
    else if (form === 'public_corp' || form === 'public')    chip.classList.add('bwb-fund-corp');
    else if (form === 'family_owned' || form === 'llc' || form === 'private') chip.classList.add('bwb-fund-family');
    else if (form === 'nonprofit' || form === 'foundation') chip.classList.add('bwb-fund-foundation');
    else                                                    chip.classList.add('bwb-fund-unknown');

    var label = 'FUNDED BY';
    var chainTxt;
    if (owners[0].owner) {
      var o = owners[0].owner;
      chainTxt = o.owner_entity_id ? o.owner_entity_id.replace(/_/g, ' ') : 'corporate owner';
    } else if (owners[0].fb) {
      chainTxt = (owners[0].fb.dominant_instrument || 'mix').replace(/_/g, ' ');
    } else {
      chainTxt = 'chain loading…';
    }
    if (owners.length > 1) chainTxt += ' +' + (owners.length - 1);

    // Subscription gate: bias is free, the owner name is paid.
    // Free users see the chip form (color = ownership type) but the chain
    // text becomes a striped redacted shape. Click routes to /pro.html.
    var isPro = window.BWB_Entitlements && window.BWB_Entitlements.has('funding-name');
    if (isPro) {
      chip.innerHTML = '<span class="bwb-funding-label">' + label + '</span>'
                     + '<span class="bwb-funding-chain">' + chainTxt + '</span>';
      chip.title = 'Click to see the full money trail — owners, family offices, '
                 + 'donors, all primary-source anchored. Surfaces the manufacturing layer, not the framing.';
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.BWB_IdentityModal && typeof window.BWB_IdentityModal.open === 'function') {
          window.BWB_IdentityModal.open(owners[0].src);
        }
      });
    } else {
      chip.classList.add('is-locked');
      chip.innerHTML = '<span class="bwb-funding-label">' + label + '</span>'
                     + '<span class="bwb-funding-chain bwb-funding-tease" aria-label="Owner name locked — Pro feature"></span>'
                     + '<span class="bwb-pro-lock-inline" title="Pro feature — see the money trail">🔒 PRO</span>';
      chip.title = 'Owner name is a Pro feature. Sign up to see the full money trail.';
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = '/pro.html?from=feed&feature=funding-name';
      });
    }
    body.appendChild(chip);
  })();

  var h = document.createElement('h2');
  h.className   = 'bwb-card-headline';
  h.textContent = story.headline || '';
  body.appendChild(h);

  var summary = story.summary || '';
  var p = document.createElement('p');
  p.className   = 'bwb-card-summary';
  p.textContent = summary.length > 180 ? summary.slice(0, 180) + '...' : summary;
  body.appendChild(p);

  // ── WHY THIS GAP — substrate-honesty micro-attribution ──────────────────
  // One line. Names the bloc spread and the geo spread using the same
  // data that produced the bar above. Forces the corpus to defend itself
  // per story. If a card shows "1 source: 1 Western" in climate, that's
  // a fact the reader can act on.
  if (sources.length > 0) {
    var blocCounts = { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 };
    sources.forEach(function(src) {
      var b = src.bloc || 'other';
      if (blocCounts[b] === undefined) blocCounts.other++;
      else blocCounts[b]++;
    });
    var gap = story.geo_gap || {};
    var nCells = gap.geo_diversity_n || 0;
    var ent = gap.entropy;
    var nw  = gap.non_west_pct;

    var whyParts = [];
    whyParts.push(total + (total === 1 ? ' source' : ' sources'));
    var blocBits = [];
    if (blocCounts.western)     blocBits.push(blocCounts.western + 'W');
    if (blocCounts['non-aligned']) blocBits.push(blocCounts['non-aligned'] + 'N');
    if (blocCounts.adversarial) blocBits.push(blocCounts.adversarial + 'A');
    if (blocCounts.other)       blocBits.push(blocCounts.other + '?');
    if (blocBits.length) whyParts.push(blocBits.join('·'));

    var geoBits = [];
    if (nCells > 0) geoBits.push(nCells + ' geo cell' + (nCells === 1 ? '' : 's'));
    if (typeof ent === 'number' && ent > 0) geoBits.push('ent ' + ent.toFixed(2));
    if (typeof nw  === 'number' && nw  > 0) geoBits.push(Math.round(nw * 100) + '% non-West');
    if (geoBits.length) whyParts.push(geoBits.join(' · '));

    // ── LOW-CONFIDENCE BADGE — substrate-honesty receipt (RedTeam 2026-07-06 §3)
    // A 100% axis-populated registry can still have rows that are 0.4-confidence
    // auto-heuristics. Surface that to the user, not just the operator. The
    // count is computed at slim-build time by joining story sources against
    // data/source_registry.json's provenance[].confidence on the axis row.
    var lowN = story.low_confidence_count || 0;
    if (lowN > 0) {
      var lowBadge = document.createElement('span');
      lowBadge.className = 'bwb-low-confidence-badge';
      lowBadge.textContent = lowN + (lowN === 1 ? ' LOW' : ' LOW');
      lowBadge.title = lowN + ' of ' + total + ' source' + (total === 1 ? '' : 's')
        + ' has axis provenance below 0.5 confidence. Auto-heuristic or hand-curated guess — not operator-verified. '
        + 'See methodology.html for what this means.';
      lowBadge.setAttribute('aria-label', lowN + ' low-confidence sources');
      whyParts.push(lowBadge);
    }

    var why = document.createElement('div');
    why.className = 'bwb-why-this-gap';
    why.textContent = whyParts.join(' · ');
    why.title = 'Working-set receipt: how many sources, what bloc spread, what geographic spread. Honest about the corpus, not about the world.';
    body.appendChild(why);
  }

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
  // Wave-9 card-render polish: 2-letter monogram chip at the start of each
  // pill. Cheap visual recognition before the reader has to parse the name.
  // 0-byte cost; no CDN; degrades gracefully. Cross-ref:
  // _index/redteam/2026-07-06-card-render-vs-groundnews.md §5 item 2
  function monogram(name) {
    if (!name) return '?';
    var s = name.replace(/^(The|A)\s+/i, '').trim();
    var parts = s.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
  }
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

    // 2-letter monogram chip (left of name)
    var chip = document.createElement('span');
    chip.className = 'bwb-source-chip ' + (src.bloc || '');
    chip.textContent = monogram(src.name || src.id);
    pill.appendChild(chip);

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

    // W7: PRIMARY chip — surfaces the primary source URL (FEC filing, court
    // record, official transcript, etc.) so the reader can verify the framing
    // is anchored, not laundered. Surfaces on the card, not buried. Cross-ref:
    // ISA.md ISC-63.
    if (src.primary_source_url) {
      var prim = document.createElement('a');
      prim.className   = 'bwb-source-primary-chip';
      prim.href        = src.primary_source_url;
      prim.target      = '_blank';
      prim.rel         = 'noopener noreferrer';
      prim.textContent = 'PRIMARY';
      prim.title       = 'Primary source (FEC / OpenSecrets / court / official): ' + src.primary_source_url;
      prim.addEventListener('click', function(e) { e.stopPropagation(); });
      pill.appendChild(prim);
    }

    // W9: pill opens per-source identity modal (per-source visibility of the
    // funding-chain thesis). Click never propagates to the card's story-link
    // navigation. Cross-ref: _index/redteam/2026-07-06-card-render-vs-groundnews.md
    if (window.BWB_IdentityModal && typeof window.BWB_IdentityModal.open === 'function') {
      pill.style.cursor = 'pointer';
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.addEventListener('click', function(e) {
        e.stopPropagation();
        window.BWB_IdentityModal.open(src);
      });
      pill.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          window.BWB_IdentityModal.open(src);
        }
      });
    }

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

  // Tier change → re-paint the feed so locked funding chips flip back
  // to the real owner names. Fires from the "Try Pro" button or any
  // other BWB_Entitlements.setTier call. Free → Pro: chips unlock.
  window.addEventListener('bwb:entitlements-changed', function() {
    var active = document.querySelector('.bwb-filters .active[data-filter]');
    renderFeed(active ? active.dataset.filter : 'all');
  });
});
