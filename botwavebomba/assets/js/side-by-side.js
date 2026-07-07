// BOTWAVEBOMBA — Side-by-Side 3-Pane Framing Renderer
// Ground News pattern: 3 columns (Western / Non-Aligned / Adversarial) showing
// the same story's coverage from each bloc, side-by-side.
//
// Replaces/extends buildFramingTable() from story.js. Reads the enriched
// sources array (each src.headline, src.url, src._articles) and the
// article_cards (each with source → bloc lookup) to produce one column
// per bloc with the live article cards in the order they appear in latest.json.
//
// Acceptance: the front page lists 1 story; clicking it shows the 3-pane
// view with one column per bloc, ordered Western → Non-Aligned → Adversarial.

(function() {
  'use strict';

  var BLOC_ORDER = [
    { key: 'western',     label: 'WESTERN',     subtitle: 'US/NATO/Israel-aligned press',          color: 'var(--signal-western)' },
    { key: 'non-aligned', label: 'NON-ALIGNED', subtitle: 'Regional press · Global South · independent', color: 'var(--signal-neutral)' },
    { key: 'adversarial', label: 'ADVERSARIAL', subtitle: 'Multipolar / anti-intervention framing',     color: 'var(--signal-adversarial)' }
  ];

  // Per-source → bloc lookup. We accept the source objects in two shapes:
  //   (a) story.sources[] from latest.json — has .bloc and .name
  //   (b) article_cards[] — has .source (id) and .source_name, needs lookup
  function buildSourceBlocMap(story) {
    var map = {};
    (story.sources || []).forEach(function(s) {
      if (s && s.id) map[s.id] = s.bloc || s.bias_bucket || 'non-aligned';
    });
    return map;
  }

  // Articles carrying their bloc. The article_cards are the canonical
  // per-article framing — they carry headline, snippet, url, source.
  // We bucket them by the source's bloc.
  function bucketArticlesByBloc(story) {
    var blocMap = buildSourceBlocMap(story);
    var buckets = { western: [], 'non-aligned': [], adversarial: [] };
    (story.article_cards || []).forEach(function(art) {
      var bloc = blocMap[art.source] || 'non-aligned';
      // Normalize — story.sources uses 'neutral' for non-aligned; we use 'non-aligned'
      if (bloc === 'neutral') bloc = 'non-aligned';
      if (!buckets[bloc]) buckets[bloc] = [];
      buckets[bloc].push(art);
    });
    return buckets;
  }

  function renderArticleCard(art) {
    var card = document.createElement('a');
    card.className = 'bwb-3pane-article';
    card.href = art.url || '#';
    if (art.url) {
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }

    if (art.source_name) {
      var src = document.createElement('div');
      src.className = 'bwb-3pane-source';
      src.textContent = art.source_name + (art.country ? ' · ' + art.country : '');
      card.appendChild(src);
    }

    var hl = document.createElement('div');
    hl.className = 'bwb-3pane-headline';
    hl.textContent = art.headline || '(no headline)';
    card.appendChild(hl);

    if (art.snippet) {
      var snip = document.createElement('div');
      snip.className = 'bwb-3pane-snippet';
      // Truncate snippet to ~280 chars for visual balance
      var s = art.snippet.length > 280 ? art.snippet.slice(0, 280).replace(/\s+\S*$/, '') + '…' : art.snippet;
      snip.textContent = s;
      card.appendChild(snip);
    }

    var read = document.createElement('div');
    read.className = 'bwb-3pane-read';
    read.textContent = 'Read original →';
    card.appendChild(read);

    return card;
  }

  function renderColumn(blocDef, articles) {
    var col = document.createElement('div');
    col.className = 'bwb-3pane-col bwb-3pane-col--' + blocDef.key;
    col.style.setProperty('--col-color', blocDef.color);

    var head = document.createElement('div');
    head.className = 'bwb-3pane-col-header';
    var lbl = document.createElement('div');
    lbl.className = 'bwb-3pane-col-label';
    lbl.textContent = blocDef.label;
    head.appendChild(lbl);
    var sub = document.createElement('div');
    sub.className = 'bwb-3pane-col-sub';
    sub.textContent = blocDef.subtitle;
    head.appendChild(sub);
    var count = document.createElement('div');
    count.className = 'bwb-3pane-col-count';
    count.textContent = articles.length + (articles.length === 1 ? ' source' : ' sources');
    head.appendChild(count);
    col.appendChild(head);

    if (articles.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'bwb-3pane-empty';
      empty.textContent = 'No ' + blocDef.label.toLowerCase() + ' coverage of this story.';
      col.appendChild(empty);
    } else {
      articles.forEach(function(art) {
        col.appendChild(renderArticleCard(art));
      });
    }
    return col;
  }

  // Public API — called from story.js after story is loaded.
  // Replaces the old buildFramingTable side-effect; story.js now calls
  // this and the old per-bloc grouped table is preserved below the 3-pane.
  window.renderSideBySideFraming = function(story) {
    var container = document.getElementById('framing-table');
    if (!container) return;

    // Clear existing
    while (container.firstChild) container.removeChild(container.firstChild);
    container.classList.add('bwb-3pane-grid');

    // If we have no article_cards (slim data fallback), fall back gracefully
    if (!story.article_cards || !story.article_cards.length) {
      var empty = document.createElement('div');
      empty.className = 'bwb-3pane-empty';
      empty.textContent = 'Side-by-side framing requires full data — pipeline is still loading.';
      container.appendChild(empty);
      return;
    }

    var buckets = bucketArticlesByBloc(story);
    BLOC_ORDER.forEach(function(blocDef) {
      container.appendChild(renderColumn(blocDef, buckets[blocDef.key] || []));
    });
  };
})();
