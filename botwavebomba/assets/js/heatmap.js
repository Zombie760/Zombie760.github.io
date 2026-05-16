// BOTWAVEBOMBA — Full Heatmap Renderer (story page)
// Three-column layout: Western | Non-Aligned | Adversarial
// Plus a full-width percentage bar

function renderHeatmap(sources, containerId) {
  containerId = containerId || 'bias-heatmap';
  const container = document.getElementById(containerId);
  if (!container || !sources || !sources.length) return;

  const blocs = {
    western:     sources.filter(function(s) { return s.bloc === 'western'; }),
    neutral:     sources.filter(function(s) { return s.bloc === 'neutral' || !s.bloc; }),
    adversarial: sources.filter(function(s) { return s.bloc === 'adversarial'; })
  };
  const total = sources.length;

  while (container.firstChild) container.removeChild(container.firstChild);

  // Column grid
  const grid = document.createElement('div');
  grid.className = 'heatmap-columns';

  const configs = [
    { key: 'western',     label: 'WESTERN',      color: '#4a9eff' },
    { key: 'neutral',     label: 'NON-ALIGNED',  color: '#888' },
    { key: 'adversarial', label: 'ADVERSARIAL',  color: '#ff6b6b' }
  ];

  configs.forEach(function(cfg) {
    grid.appendChild(buildColumn(cfg.label, blocs[cfg.key], cfg.color, total));
  });
  container.appendChild(grid);

  // Full-width bar
  const barRow = document.createElement('div');
  barRow.className = 'heatmap-bar-full';

  configs.forEach(function(cfg) {
    const count = blocs[cfg.key].length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const seg = document.createElement('div');
    seg.className = 'hm-seg ' + cfg.key;
    seg.style.width = pct + '%';
    seg.title = cfg.label + ': ' + count;
    if (pct > 8) seg.textContent = pct + '%';
    barRow.appendChild(seg);
  });
  container.appendChild(barRow);

  // Summary legend
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  configs.forEach(function(cfg) {
    const count = blocs[cfg.key].length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'hm-legend-item';

    const dot = document.createElement('div');
    dot.className = 'hm-legend-dot ' + cfg.key;
    item.appendChild(dot);

    const text = document.createElement('span');
    text.textContent = cfg.label + ': ' + count + ' (' + pct + '%)';
    item.appendChild(text);

    legend.appendChild(item);
  });
  container.appendChild(legend);
}

function buildColumn(label, sources, color, total) {
  const col = document.createElement('div');
  col.className = 'hm-column';

  const header = document.createElement('div');
  header.className = 'hm-col-header';
  header.style.color = color;
  header.textContent = label;
  col.appendChild(header);

  const count = document.createElement('div');
  count.className = 'hm-col-count';
  const pct = total ? Math.round((sources.length / total) * 100) : 0;
  count.textContent = sources.length + ' of ' + total + ' sources (' + pct + '%)';
  col.appendChild(count);

  const sourceList = document.createElement('div');
  sourceList.className = 'hm-col-sources';

  if (!sources.length) {
    const empty = document.createElement('div');
    empty.className = 'hm-empty';
    empty.textContent = 'No coverage from this bloc';
    sourceList.appendChild(empty);
  } else {
    sources.forEach(function(src) {
      const row = document.createElement('div');
      row.className = 'hm-source';
      row.style.borderLeftColor = color;

      const name = document.createElement('span');
      name.className = 'hm-source-name';
      name.textContent = src.name || src.id || '';
      row.appendChild(name);

      if (src.country) {
        const country = document.createElement('span');
        country.className = 'hm-source-country';
        country.textContent = src.country;
        row.appendChild(country);
      }

      if (src.headline) {
        const hl = document.createElement('span');
        hl.className = 'hm-source-headline';
        hl.textContent = src.headline.length > 90 ? src.headline.slice(0, 90) + '...' : src.headline;
        row.appendChild(hl);
      }

      if (src.url) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function(e) {
          e.stopPropagation();
          window.open(src.url, '_blank', 'noopener,noreferrer');
        });
      }

      sourceList.appendChild(row);
    });
  }

  col.appendChild(sourceList);
  return col;
}

// 5-axis radar breakdown for story page
function renderAxisBreakdown(sources, containerId) {
  containerId = containerId || 'axis-breakdown';
  const container = document.getElementById(containerId);
  if (!container) return;

  while (container.firstChild) container.removeChild(container.firstChild);

  // Compute average axis scores by bloc
  const axes = ['interventionist', 'zionist', 'atlanticist', 'statist', 'financialized'];
  const axisLabels = {
    interventionist: 'Interventionist',
    zionist: 'Zionist',
    atlanticist: 'Atlanticist',
    statist: 'Statist',
    financialized: 'Financialized'
  };

  axes.forEach(function(axis) {
    const row = document.createElement('div');
    row.className = 'bwb-axis-row-full';

    const label = document.createElement('div');
    label.className = 'bwb-axis-label';
    label.textContent = axisLabels[axis];
    row.appendChild(label);

    // Group sources by bloc, average their axis score
    const blocs = ['western', 'neutral', 'adversarial'];
    const barGroup = document.createElement('div');
    barGroup.className = 'bwb-axis-bars';

    blocs.forEach(function(bloc) {
      const bSources = sources.filter(function(s) { return (s.bloc || 'neutral') === bloc; });
      // If no axis data on the source objects, skip
      const scores = bSources.map(function(s) {
        return (s.axis && s.axis[axis] !== undefined) ? s.axis[axis] : null;
      }).filter(function(x) { return x !== null; });

      const avg = scores.length ? scores.reduce(function(a,b) { return a+b; }, 0) / scores.length : 0;
      // avg is -1 to +1, normalize to 0-100% width, center at 50
      const pct = Math.round(((avg + 1) / 2) * 100);

      const barWrap = document.createElement('div');
      barWrap.className = 'bwb-axis-bar-wrap';

      const blocLabel = document.createElement('span');
      blocLabel.className = 'bwb-axis-bloc-label ' + bloc;
      blocLabel.textContent = bloc.charAt(0).toUpperCase() + bloc.slice(1);
      barWrap.appendChild(blocLabel);

      const track = document.createElement('div');
      track.className = 'bwb-axis-track';

      const fill = document.createElement('div');
      fill.className = 'bwb-axis-fill ' + bloc;
      fill.style.width = pct + '%';
      fill.title = (avg >= 0 ? '+' : '') + avg.toFixed(2);
      track.appendChild(fill);

      const marker = document.createElement('div');
      marker.className = 'bwb-axis-midmark';
      track.appendChild(marker);

      barWrap.appendChild(track);

      const val = document.createElement('span');
      val.className = 'bwb-axis-val';
      val.textContent = scores.length ? (avg >= 0 ? '+' : '') + avg.toFixed(2) : '—';
      barWrap.appendChild(val);

      barGroup.appendChild(barWrap);
    });

    row.appendChild(barGroup);
    container.appendChild(row);
  });
}

window.renderHeatmap = renderHeatmap;
window.renderAxisBreakdown = renderAxisBreakdown;
