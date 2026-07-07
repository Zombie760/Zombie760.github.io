// BOTWAVEBOMBA — Story Page Renderer

document.addEventListener('DOMContentLoaded', async function() {
  const storyId = BWB_API.getStoryParam();
  if (!storyId) {
    window.location = '/';
    return;
  }

  // W6: pre-warm funding graph for the story-page money trail.
  if (typeof _loadFundingGraph === 'function') _loadFundingGraph();

  // Story detail needs full articles — use getStoryDetail which loads full data
  const story = await BWB_API.getStoryDetail(storyId);

  if (!story) {
    document.getElementById('story-headline').textContent = 'Story not found.';
    return;
  }

  // Page title
  document.getElementById('page-title').textContent = story.headline + ' — BOTWAVEBOMBA';

  // Badges
  const badges = document.getElementById('story-badges');
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

  // Headline
  document.getElementById('story-headline').textContent = story.headline || '';

  // View-Transition name — match the source card so the morph lands
  var vtName = 'bwb-card-' + story.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  var headlineEl = document.getElementById('story-headline');
  if (headlineEl) headlineEl.style.setProperty('view-transition-name', vtName);

  // Hero image — article photo with card PNG fallback
  var heroEl = document.getElementById('story-hero');
  if (heroEl) {
    var heroImg = document.createElement('img');
    heroImg.alt     = story.headline || '';
    heroImg.loading = 'lazy';
    var cardSrc = (window.BWB_URL ? window.BWB_URL('api/cards/' + story.id + '.png') : '/api/cards/' + story.id + '.png');
    if (story.image_url) {
      heroImg.src = story.image_url;
      heroImg.onerror = function() {
        this.src = cardSrc;
        this.onerror = function() { heroEl.style.display = 'none'; };
      };
    } else {
      heroImg.src = cardSrc;
      heroImg.onerror = function() { heroEl.style.display = 'none'; };
    }
    heroEl.appendChild(heroImg);
  }

  // Build article lookup keyed by source id, then enrich each source object with
  // its primary article's headline and url so heatmap, framing table, and source
  // links all render correctly. Source metadata objects carry no headline/url of
  // their own — that data lives in story.articles[].
  var articlesBySource = {};
  (story.articles || []).forEach(function(article) {
    var sid = article.source;
    if (!sid) return;
    if (!articlesBySource[sid]) articlesBySource[sid] = [];
    articlesBySource[sid].push(article);
  });

  // Enrich source objects in-place (shallow, non-destructive — only adds fields
  // that weren't there before).
  var sources = (story.sources || []).map(function(src) {
    var arts = articlesBySource[src.id] || [];
    var primary = arts[0] || {};
    return Object.assign({}, src, {
      headline: src.headline || primary.headline || null,
      url: src.url || primary.url || null,
      _articles: arts
    });
  });

  const total = sources.length;
  const western = sources.filter(function(s) { return s.bloc === 'western'; }).length;
  const adversarial = sources.filter(function(s) { return s.bloc === 'adversarial'; }).length;
  const neutral = sources.filter(function(s) { return s.bloc === 'neutral'; }).length;

  [
    { id: 'story-date', text: story.published ? new Date(story.published).toLocaleString() : '' },
    { id: 'story-source-count', text: total + ' sources — ' + western + ' western / ' + neutral + ' non-aligned / ' + adversarial + ' adversarial' },
    { id: 'story-entity-count', text: (story.entity_count || 0) + ' named entities' },
    { id: 'story-bias-variance', text: story.bias_variance ? 'Framing variance: ' + story.bias_variance.toFixed(1) + '/10' : '' }
  ].forEach(function(item) {
    const el = document.getElementById(item.id);
    if (el && item.text) el.textContent = item.text;
  });

  // Heatmap — receives enriched sources so src.headline and src.url are populated
  if (window.renderHeatmap) renderHeatmap(sources, 'bias-heatmap');

  // 5-axis breakdown
  if (window.renderAxisBreakdown) renderAxisBreakdown(sources, 'axis-breakdown');

  // 5-axis narrative fingerprint (story-level aggregate)
  build5AxisFingerprint(story);

  // Side-by-side 3-pane framing (Western / Non-Aligned / Adversarial) — W1 deliverable
  if (window.renderSideBySideFraming) renderSideBySideFraming(story);

  // Entity cloud
  buildEntityCloud(story);

  // Source links
  buildSourceLinks(sources);

  // W6: money trail + W7: corruption cross-reference
  buildFundingTrail(story, sources);
  buildCorruptionXref(story, sources);
});

function build5AxisFingerprint(story) {
  var axisAvg = story.axis_avg;
  if (!axisAvg) return;
  // Skip if no sources were fingerprinted (all values null)
  if (!story.fp_source_count) return;

  // Find the existing 5-AXIS BIAS BREAKDOWN section and append after it
  var sections = document.querySelectorAll('.bwb-section');
  var insertAfter = null;
  for (var i = 0; i < sections.length; i++) {
    var title = sections[i].querySelector('.bwb-section-title');
    if (title && title.textContent.indexOf('5-AXIS') !== -1) {
      insertAfter = sections[i];
      break;
    }
  }

  var axes = [
    { key: 'interventionist', label: 'INTERVENTIONIST', color: '#dc2626' },
    { key: 'zionist',         label: 'ZIONIST',         color: '#2563eb' },
    { key: 'atlanticist',     label: 'ATLANTICIST',     color: '#0891b2' },
    { key: 'statist',         label: 'STATIST',         color: '#7c3aed' },
    { key: 'financialized',   label: 'FINANCIALIZED',   color: '#d97706' },
  ];

  var fpCount = story.fp_source_count || 0;

  var section = document.createElement('section');
  section.className = 'bwb-section';

  var header = document.createElement('div');
  header.className = 'bwb-section-header';

  var title = document.createElement('h2');
  title.className = 'bwb-section-title';
  title.textContent = '5-AXIS NARRATIVE FINGERPRINT';
  header.appendChild(title);

  var sub = document.createElement('span');
  sub.className = 'bwb-section-sub';
  sub.textContent = 'Avg score across ' + fpCount + ' fingerprinted source' + (fpCount !== 1 ? 's' : '') + ' (0 = min, 1 = max)';
  header.appendChild(sub);

  section.appendChild(header);

  var grid = document.createElement('div');
  grid.className = 'bwb-5axis-grid';

  axes.forEach(function(ax) {
    var score = axisAvg[ax.key];

    var row = document.createElement('div');
    row.className = 'bwb-5axis-row';

    var labelEl = document.createElement('div');
    labelEl.className = 'bwb-5axis-label';
    labelEl.textContent = ax.label;
    row.appendChild(labelEl);

    var track = document.createElement('div');
    track.className = 'bwb-5axis-track';

    if (score !== null && score !== undefined) {
      var fill = document.createElement('div');
      fill.className = 'bwb-5axis-fill';
      fill.style.width = Math.round(score * 100) + '%';
      fill.style.background = ax.color;
      track.appendChild(fill);
    }

    row.appendChild(track);

    var val = document.createElement('div');
    val.className = 'bwb-5axis-val';
    val.textContent = (score !== null && score !== undefined) ? score.toFixed(2) : '—';
    row.appendChild(val);

    grid.appendChild(row);
  });

  section.appendChild(grid);

  if (insertAfter && insertAfter.parentNode) {
    insertAfter.parentNode.insertBefore(section, insertAfter.nextSibling);
  } else {
    // Fallback: append to story container
    var container = document.getElementById('story-container');
    if (container) container.appendChild(section);
  }
}

// sources: the enriched sources array produced in DOMContentLoaded.
// Each src has: .headline (from primary article), .url (from primary article),
// ._articles (all articles for this source). Source metadata objects never carry
// headline/url on their own — the enrichment step in DOMContentLoaded provides them.
function buildFramingTable(sources) {
  const container = document.getElementById('framing-table');
  if (!container) return;

  if (!sources || !sources.length) {
    container.textContent = 'No framing data available.';
    return;
  }

  // Group by bloc
  const blocs = ['western', 'neutral', 'adversarial'];
  const blocLabels = { western: 'Western', neutral: 'Non-Aligned', adversarial: 'Adversarial' };

  // Bloc toggle: 4 pills (All + the 3 blocs). Clicking a pill hides the other
  // bloc sections so the reader can see one bloc's framing in isolation. Default = All.
  const filterRow = document.createElement('div');
  filterRow.className = 'bwb-bloc-filter';
  filterRow.setAttribute('role', 'tablist');
  filterRow.setAttribute('aria-label', 'Filter framing table by bloc');
  const pills = [['all', 'All', null]].concat(
    blocs.map(function(b) { return [b, blocLabels[b], b]; })
  );
  pills.forEach(function(p, i) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bwb-bloc-filter-pill' + (i === 0 ? ' active' : '');
    btn.dataset.bloc = p[0];
    btn.textContent = p[1];
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    filterRow.appendChild(btn);
  });
  filterRow.addEventListener('click', function(e) {
    const btn = e.target.closest('.bwb-bloc-filter-pill');
    if (!btn) return;
    filterRow.querySelectorAll('.bwb-bloc-filter-pill').forEach(function(b) {
      var on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const chosen = btn.dataset.bloc;
    container.querySelectorAll('.bwb-framing-bloc').forEach(function(sec) {
      const show = chosen === 'all' || sec.classList.contains('bwb-framing-bloc-' + chosen);
      sec.style.display = show ? '' : 'none';
    });
  });
  container.parentNode.insertBefore(filterRow, container);

  blocs.forEach(function(bloc) {
    const bSources = sources.filter(function(s) { return s.bloc === bloc; });
    if (!bSources.length) return;

    const section = document.createElement('div');
    section.className = 'bwb-framing-bloc bwb-framing-bloc-' + bloc;

    const header = document.createElement('div');
    header.className = 'bwb-framing-bloc-header ' + bloc;
    header.textContent = blocLabels[bloc] + ' (' + bSources.length + ')';
    section.appendChild(header);

    bSources.forEach(function(src) {
      const row = document.createElement('div');
      row.className = 'bwb-framing-row';

      const meta = document.createElement('div');
      meta.className = 'bwb-framing-meta';

      const name = document.createElement('span');
      name.className = 'bwb-framing-source-name';
      name.textContent = src.name || src.id || '';
      meta.appendChild(name);

      if (src.country) {
        const country = document.createElement('span');
        country.className = 'bwb-framing-country';
        country.textContent = src.country;
        meta.appendChild(country);
      }

      row.appendChild(meta);

      // src.headline and src.url were injected by the enrichment step above
      if (src.headline) {
        const hl = document.createElement('div');
        hl.className = 'bwb-framing-headline';
        hl.textContent = src.headline;
        row.appendChild(hl);
      }

      // Lede snippet — the actual first paragraph, not just the headline
      var primaryArt = src._articles && src._articles[0];
      if (primaryArt && primaryArt.snippet) {
        const snip = document.createElement('div');
        snip.className = 'bwb-framing-snippet';
        snip.textContent = primaryArt.snippet;
        row.appendChild(snip);
      }

      // Show extra-article count with tooltip listing their headlines
      var extras = (src._articles || []).slice(1);
      if (extras.length) {
        const more = document.createElement('div');
        more.className = 'bwb-framing-more';
        more.title = extras.map(function(a) { return a.headline || a.url || ''; }).join('\n');
        more.textContent = '(+' + extras.length + ' more)';
        row.appendChild(more);
      }

      if (src.url) {
        const link = document.createElement('a');
        link.className = 'bwb-framing-link';
        link.textContent = 'Read original →';
        link.href = src.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        row.appendChild(link);
      }

      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

function buildEntityCloud(story) {
  const container = document.getElementById('entity-cloud');
  if (!container) return;

  const entities = story.entity_list || story.entities || [];
  if (!entities.length) {
    container.textContent = 'Entity extraction not yet available for this story.';
    return;
  }

  entities.forEach(function(entity) {
    const tag = document.createElement('span');
    tag.className = 'bwb-entity-tag';
    tag.textContent = typeof entity === 'string' ? entity : (entity.name || entity);
    container.appendChild(tag);
  });
}

function buildSourceLinks(sources) {
  const container = document.getElementById('source-links');
  if (!container) return;

  sources.forEach(function(src) {
    const row = document.createElement('div');
    row.className = 'bwb-source-link-row ' + (src.bloc || '');

    const bloc = document.createElement('span');
    bloc.className = 'bwb-source-link-bloc ' + (src.bloc || '');
    bloc.textContent = (src.bloc || '').toUpperCase();
    row.appendChild(bloc);

    const name = document.createElement('span');
    name.className = 'bwb-source-link-name';
    name.textContent = src.name || src.id || '';
    row.appendChild(name);

    if (src.country) {
      const country = document.createElement('span');
      country.className = 'bwb-source-link-country';
      country.textContent = src.country;
      row.appendChild(country);
    }

    // W7: PRIMARY chip — surfaces the primary source URL (FEC filing, court
    // record, official transcript, etc.) so the reader can verify the framing
    // is anchored, not laundered. Mirrors the feed-card chip.
    if (src.primary_source_url) {
      const prim = document.createElement('a');
      prim.className   = 'bwb-source-link-primary';
      prim.href        = src.primary_source_url;
      prim.target      = '_blank';
      prim.rel         = 'noopener noreferrer';
      prim.textContent = 'PRIMARY';
      prim.title       = 'Primary source (FEC / OpenSecrets / court / official): ' + src.primary_source_url;
      row.appendChild(prim);
    }

    // W6: funding_breakdown tag — surfaces the dominant instrument on the
    // story page so the reader sees the per-source funding chain without
    // having to click into the Money Trail section.
    var fb = src.funding_breakdown;
    if (fb && fb.dominant_instrument) {
      const fbTag = document.createElement('span');
      fbTag.className   = 'bwb-source-link-funding';
      fbTag.textContent = (fb.dominant_instrument || '').replace(/_/g, ' ');
      if (fb.summary) fbTag.title = fb.summary;
      row.appendChild(fbTag);
    }

    if (src.url) {
      const link = document.createElement('a');
      link.className = 'bwb-source-link-url';
      link.textContent = 'Primary source →';
      link.href = src.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.appendChild(link);
    }

    container.appendChild(row);
  });
}

// ── W6: FUNDING TRAIL — the manufacturing layer, surfaced on the story page ──
// For every source in the story, resolve its owner from the funding graph and
// render a row showing the owner chain. This is the operator's stated
// differentiator vs Ground News: "see who paid for this framing" right next
// to the article the reader just read. The full graph (entities + edges) is
// in api/funding_graph.json; the chrome is here.
function buildFundingTrail(story, sources) {
  // Accept a few container ids — story.html may have any of these.
  var container = document.getElementById('funding-trail')
                || document.getElementById('money-trail')
                || document.getElementById('funding-section');
  if (!container) return;

  // Lazy-load the graph if feed.js hasn't already.
  if (typeof _loadFundingGraph === 'function') _loadFundingGraph();

  if (!_fundingGraph) {
    container.innerHTML = '<p class="bwb-funding-loading">Money trail loading…</p>';
    // Retry once after a short delay in case the fetch is in flight.
    setTimeout(function() {
      if (_fundingGraph) buildFundingTrail(story, sources);
    }, 600);
    return;
  }

  var graph = _fundingGraph;
  var owners = graph.outlet_to_owner || {};
  var entities = (graph.entities || []).reduce(function(acc, e) {
    acc[e.id] = e; return acc;
  }, {});

  var matched = 0;
  var rows = sources.map(function(src) {
    var rec = owners[(src.name || src.id || '').toLowerCase()];
    if (!rec) return null;
    matched++;
    var entity = entities[rec.owner_entity_id];
    var ownerName = entity ? entity.name : rec.owner_entity_id.replace(/_/g, ' ');

    var row = document.createElement('div');
    row.className = 'bwb-funding-row bwb-fund-' + (rec.ownership_form || 'unknown');

    var src1 = document.createElement('span');
    src1.className = 'bwb-funding-source';
    src1.textContent = src.name || src.id;
    row.appendChild(src1);

    var arrow = document.createElement('span');
    arrow.className = 'bwb-funding-arrow';
    arrow.textContent = '→';
    row.appendChild(arrow);

    var owner = document.createElement('span');
    owner.className = 'bwb-funding-owner';
    owner.textContent = ownerName;
    row.appendChild(owner);

    if (entity && entity.primary_source_url) {
      var cite = document.createElement('a');
      cite.className = 'bwb-funding-cite';
      cite.href = entity.primary_source_url;
      cite.target = '_blank';
      cite.rel = 'noopener noreferrer';
      cite.textContent = 'primary source';
      cite.title = entity.primary_source_url;
      row.appendChild(cite);
    }

    return row;
  }).filter(Boolean);

  container.innerHTML = '';
  var head = document.createElement('h3');
  head.textContent = 'Money Trail — who funded the framing';
  container.appendChild(head);

  if (matched === 0) {
    var note = document.createElement('p');
    note.className = 'bwb-funding-empty';
    note.textContent = 'No mapped owner for this story\'s sources yet. Funding graph '
                     + 'covers ' + Object.keys(owners).length + ' outlets; this story\'s '
                     + 'sources aren\'t in that map. Operator-pace expansion.';
    container.appendChild(note);
    return;
  }

  var sub = document.createElement('p');
  sub.className = 'bwb-funding-sub';
  sub.textContent = matched + ' of ' + sources.length + ' source'
                  + (sources.length === 1 ? '' : 's')
                  + ' mapped. Each owner links to the primary-source anchor.';
  container.appendChild(sub);

  rows.forEach(function(r) { container.appendChild(r); });

  var more = document.createElement('p');
  more.className = 'bwb-funding-more';
  more.innerHTML = 'Full graph: <a href="api/funding_graph.json" target="_blank" rel="noopener">api/funding_graph.json</a> '
                + '(' + (graph.entities || []).length + ' entities, '
                + (graph.edges  || []).length + ' edges, '
                + Object.keys(owners).length + ' outlet-to-owner mappings)';
  container.appendChild(more);
}

// ── W7: CORRUPTION CROSS-REFERENCE — does the story touch a known super-donor PAC? ──
// Loads api/corruption_v2.json (pre-existing AIPAC + 17 PACs + 20 money-trail
// rows). If any PAC's name or its tagged entities appear in the story text
// (headline, summary, source names), surface a "Corruption cross-reference"
// section with the matching PAC + a money-trail summary. Surfaces the
// manufacturing layer without forcing the reader to a separate page.
function buildCorruptionXref(story, sources) {
  var container = document.getElementById('corruption-xref')
                || document.getElementById('corruption-section')
                || document.getElementById('corruption-modal');
  if (!container) return;

  fetch('api/corruption_v2.json', { cache: 'force-cache' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(c) {
      if (!c || !c.tier1_pacs) return;
      var haystack = ((story.headline || '') + ' ' + (story.summary || ''))
                     .toLowerCase();
      sources.forEach(function(s) {
        if (s.name) haystack += ' ' + s.name.toLowerCase();
      });

      var hits = [];
      (c.tier1_pacs || []).forEach(function(p) {
        if (haystack.indexOf((p.short_name || p.name || '').toLowerCase()) !== -1) {
          hits.push(p);
        }
      });
      // Also check the 20 money-trail rows if they exist
      var trail = c.money_trail || c.money_trail_rows || [];
      trail.forEach(function(row) {
        var txt = (row.pac || row.recipient || '').toLowerCase();
        if (txt && haystack.indexOf(txt) !== -1) {
          hits.push({ name: row.pac, short_name: row.pac, notes: row.notes || '',
                      fec_url: row.fec_url, opensecrets_url: row.opensecrets_url });
        }
      });

      container.innerHTML = '';
      var head = document.createElement('h3');
      head.textContent = 'Corruption Cross-Reference';
      container.appendChild(head);

      if (hits.length === 0) {
        var note = document.createElement('p');
        note.className = 'bwb-corruption-empty';
        note.textContent = 'No superdonor PAC match in this story\'s headline, summary, or source list. '
                         + 'Coverage of ' + (c.tier1_pacs || []).length + ' PACs + '
                         + trail.length + ' money-trail rows is in scope — this story doesn\'t trigger any.';
        container.appendChild(note);
        return;
      }

      hits.forEach(function(p) {
        var row = document.createElement('div');
        row.className = 'bwb-corruption-row';

        var name = document.createElement('div');
        name.className = 'bwb-corruption-pac';
        name.textContent = p.name || p.short_name;
        row.appendChild(name);

        if (p.notes) {
          var note = document.createElement('p');
          note.className = 'bwb-corruption-notes';
          note.textContent = p.notes;
          row.appendChild(note);
        }

        var links = document.createElement('div');
        links.className = 'bwb-corruption-links';
        if (p.fec_url) {
          var fec = document.createElement('a');
          fec.href = p.fec_url; fec.target = '_blank'; fec.rel = 'noopener noreferrer';
          fec.textContent = 'FEC filings';
          links.appendChild(fec);
        }
        if (p.opensecrets_url) {
          var os = document.createElement('a');
          os.href = p.opensecrets_url; os.target = '_blank'; os.rel = 'noopener noreferrer';
          os.textContent = 'OpenSecrets';
          links.appendChild(os);
        }
        row.appendChild(links);

        container.appendChild(row);
      });
    })
    .catch(function() { /* silent — corruption is overlay, not core */ });
}
