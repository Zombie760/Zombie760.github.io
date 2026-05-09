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

  // Meta
  const sources = story.sources || [];
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

  // Heatmap
  if (window.renderHeatmap) renderHeatmap(sources, 'bias-heatmap');

  // 5-axis breakdown
  if (window.renderAxisBreakdown) renderAxisBreakdown(sources, 'axis-breakdown');

  // Framing comparison
  buildFramingTable(story);

  // Entity cloud
  buildEntityCloud(story);

  // Source links
  buildSourceLinks(sources);
});

function buildFramingTable(story) {
  const container = document.getElementById('framing-table');
  if (!container) return;

  const sources = story.sources || [];
  if (!sources.length) {
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

      if (src.headline) {
        const hl = document.createElement('div');
        hl.className = 'bwb-framing-headline';
        hl.textContent = src.headline;
        row.appendChild(hl);
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
