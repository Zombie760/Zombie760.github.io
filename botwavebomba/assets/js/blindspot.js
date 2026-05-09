// BOTWAVEBOMBA — Blindspot Page Renderer

let _blindspotData = null;

async function renderBlindspotsPage(filter) {
  filter = filter || 'all';
  const feed = document.getElementById('blindspot-feed');
  if (!feed) return;

  if (!_blindspotData) {
    _blindspotData = await BWB_API.getBlindspotsData();
    // Fall back to filtering the main feed
    if (!(_blindspotData.stories || []).length) {
      const main = await BWB_API.getLatest();
      _blindspotData = {
        stories: (main.stories || []).filter(function(s) { return s.is_blindspot || (s.blindspot_score || 0) > 4; })
      };
    }

    const total = (_blindspotData.stories || []).length;
    const el = document.getElementById('bs-total-count');
    if (el) el.textContent = total;
  }

  let stories = _blindspotData.stories || [];

  if (filter === 'western-only') {
    stories = stories.filter(function(s) {
      const srcs = s.sources || [];
      const w = srcs.filter(function(x) { return x.bloc === 'western'; }).length;
      const a = srcs.filter(function(x) { return x.bloc === 'adversarial'; }).length;
      return w > 0 && a === 0;
    });
  }
  if (filter === 'adversarial-only') {
    stories = stories.filter(function(s) {
      const srcs = s.sources || [];
      const w = srcs.filter(function(x) { return x.bloc === 'western'; }).length;
      const a = srcs.filter(function(x) { return x.bloc === 'adversarial'; }).length;
      return a > 0 && w === 0;
    });
  }
  if (filter === 'non-aligned-only') {
    stories = stories.filter(function(s) {
      const srcs = s.sources || [];
      const n = srcs.filter(function(x) { return x.bloc === 'neutral'; }).length;
      const w = srcs.filter(function(x) { return x.bloc === 'western'; }).length;
      const a = srcs.filter(function(x) { return x.bloc === 'adversarial'; }).length;
      return n > 0 && w === 0 && a === 0;
    });
  }

  while (feed.firstChild) feed.removeChild(feed.firstChild);

  if (!stories.length) {
    const empty = document.createElement('div');
    empty.className = 'bwb-empty';
    empty.textContent = 'No blindspots detected matching this filter. Check back after next pipeline run.';
    feed.appendChild(empty);
    return;
  }

  stories.sort(function(a, b) { return (b.blindspot_score || 0) - (a.blindspot_score || 0); });
  stories.forEach(function(story) { feed.appendChild(buildBlindspostCard(story)); });
}

function buildBlindspostCard(story) {
  const sources = story.sources || [];
  const western     = sources.filter(function(s) { return s.bloc === 'western'; }).length;
  const adversarial = sources.filter(function(s) { return s.bloc === 'adversarial'; }).length;
  const neutral     = sources.filter(function(s) { return s.bloc === 'neutral'; }).length;
  const total       = sources.length;

  // Determine blindspot type
  let bsType = 'mixed';
  if (western > 0 && adversarial === 0) bsType = 'western-only';
  else if (adversarial > 0 && western === 0) bsType = 'adversarial-only';

  const card = document.createElement('article');
  card.className = 'bwb-card bwb-blindspot-card ' + bsType;
  card.addEventListener('click', function() {
    window.location = '/botwavebomba/story.html?id=' + encodeURIComponent(story.id);
  });

  // Blindspot type badge
  const typeHeader = document.createElement('div');
  typeHeader.className = 'bwb-bs-type-header ' + bsType;
  if (bsType === 'western-only') {
    typeHeader.textContent = 'WESTERN-ONLY — adversarial press not covering this';
  } else if (bsType === 'adversarial-only') {
    typeHeader.textContent = 'ADVERSARIAL-ONLY — Western press silent on this';
  } else {
    typeHeader.textContent = 'COVERAGE ASYMMETRY DETECTED';
  }
  card.appendChild(typeHeader);

  const h = document.createElement('h2');
  h.className = 'bwb-card-headline';
  h.textContent = story.headline || '';
  card.appendChild(h);

  const p = document.createElement('p');
  p.className = 'bwb-card-summary';
  const summary = story.summary || '';
  p.textContent = summary.length > 220 ? summary.slice(0, 220) + '...' : summary;
  card.appendChild(p);

  // Coverage breakdown
  const breakdown = document.createElement('div');
  breakdown.className = 'bwb-bs-breakdown';

  [
    { label: 'Western', count: western, cls: 'western' },
    { label: 'Non-Aligned', count: neutral, cls: 'neutral' },
    { label: 'Adversarial', count: adversarial, cls: 'adversarial' }
  ].forEach(function(item) {
    const col = document.createElement('div');
    col.className = 'bwb-bs-bloc ' + (item.count === 0 ? 'zero' : '');

    const num = document.createElement('span');
    num.className = 'bwb-bs-num ' + item.cls;
    num.textContent = item.count;
    col.appendChild(num);

    const lbl = document.createElement('span');
    lbl.className = 'bwb-bs-lbl';
    lbl.textContent = item.label;
    col.appendChild(lbl);

    if (item.count === 0) {
      const zero = document.createElement('span');
      zero.className = 'bwb-bs-zero-label';
      zero.textContent = 'NOT COVERING';
      col.appendChild(zero);
    }

    breakdown.appendChild(col);
  });
  card.appendChild(breakdown);

  // Score + sources
  const footer = document.createElement('div');
  footer.className = 'bwb-card-footer';

  [
    story.blindspot_score ? 'Blindspot score: ' + story.blindspot_score.toFixed(1) + '/10' : '',
    total + ' total sources',
    story.bias_variance ? 'Variance ' + story.bias_variance.toFixed(1) : ''
  ].filter(Boolean).forEach(function(txt) {
    const span = document.createElement('span');
    span.className = 'bwb-card-stat';
    span.textContent = txt;
    footer.appendChild(span);
  });
  card.appendChild(footer);

  return card;
}

document.addEventListener('DOMContentLoaded', function() {
  renderBlindspotsPage('all');

  const nav = document.querySelector('.bwb-filters');
  if (nav) {
    nav.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-bs-filter]');
      if (!btn) return;
      nav.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderBlindspotsPage(btn.dataset.bsFilter);
    });
  }
});
