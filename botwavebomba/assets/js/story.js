// BOTWAVEBOMBA — Story Page Renderer

document.addEventListener('DOMContentLoaded', async function() {
  const storyId = BWB_API.getStoryParam();
  if (!storyId) {
    window.location = '/botwavebomba/';
    return;
  }

  const data = await BWB_API.getLatest();
  const story = (data.stories || []).find(function(s) { return s.id === storyId; });

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

  // Framing comparison — pass enriched sources (with headline/url/._articles)
  buildFramingTable(sources);

  // Entity cloud
  buildEntityCloud(story);

  // Source links
  buildSourceLinks(sources);
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

  blocs.forEach(function(bloc) {
    const bSources = sources.filter(function(s) { return s.bloc === bloc; });
    if (!bSources.length) return;

    const section = document.createElement('div');
    section.className = 'bwb-framing-bloc';

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

  const entities = story.entities || story.entity_list || [];
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
