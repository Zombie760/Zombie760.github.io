// BOTWAVEBOMBA — Sources Directory Renderer

let _registry = null;
let _activeFilter = 'all';
let _searchQuery = '';

async function loadRegistry() {
  if (_registry) return _registry;
  _registry = await BWB_API.getSources();
  return _registry;
}

function axisBar(value, cls) {
  // value is -1.0 to 1.0, render as a small bar centered at 0
  const pct = Math.round(((value + 1) / 2) * 100);
  const bar = document.createElement('div');
  bar.className = 'src-axis-wrap';
  const fill = document.createElement('div');
  fill.className = 'src-axis-fill ' + cls;
  fill.style.width = pct + '%';
  fill.title = (value >= 0 ? '+' : '') + value.toFixed(2);
  bar.appendChild(fill);
  const mark = document.createElement('div');
  mark.className = 'src-axis-mid';
  bar.appendChild(mark);
  return bar;
}

async function renderSources() {
  const reg = await loadRegistry();
  const sources = (reg.sources || []);

  // Update summary counts
  const el = function(id) { return document.getElementById(id); };
  if (el('count-western'))    el('count-western').textContent    = sources.filter(function(s) { return s.bloc === 'western'; }).length;
  if (el('count-neutral'))    el('count-neutral').textContent    = sources.filter(function(s) { return s.bloc === 'neutral'; }).length;
  if (el('count-adversarial')) el('count-adversarial').textContent = sources.filter(function(s) { return s.bloc === 'adversarial'; }).length;

  renderSourceTable(sources);
}

function renderSourceTable(sources) {
  const container = document.getElementById('source-rows');
  if (!container) return;

  let filtered = sources;

  if (_activeFilter !== 'all') {
    filtered = filtered.filter(function(s) { return s.bloc === _activeFilter; });
  }

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    filtered = filtered.filter(function(s) {
      return (s.name || '').toLowerCase().includes(q) ||
             (s.id || '').toLowerCase().includes(q) ||
             (s.country || '').toLowerCase().includes(q);
    });
  }

  // Sort by bloc then name
  filtered.sort(function(a, b) {
    if (a.bloc !== b.bloc) {
      const order = { western: 0, neutral: 1, adversarial: 2 };
      return (order[a.bloc] || 99) - (order[b.bloc] || 99);
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  while (container.firstChild) container.removeChild(container.firstChild);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'bwb-empty';
    empty.textContent = 'No sources match.';
    container.appendChild(empty);
    return;
  }

  filtered.forEach(function(src) {
    const row = document.createElement('div');
    row.className = 'bwb-src-row ' + (src.bloc || '');

    // Name
    const name = document.createElement('span');
    name.className = 'bwb-src-name';
    if (src.url) {
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = src.name || src.id || '';
      name.appendChild(a);
    } else {
      name.textContent = src.name || src.id || '';
    }
    row.appendChild(name);

    // Country
    const country = document.createElement('span');
    country.className = 'bwb-src-country';
    country.textContent = src.country || '—';
    row.appendChild(country);

    // Bloc
    const bloc = document.createElement('span');
    bloc.className = 'bwb-src-bloc bwb-badge ' + (src.bloc || '');
    bloc.textContent = (src.bloc || '').toUpperCase();
    row.appendChild(bloc);

    // Lean
    const lean = document.createElement('span');
    lean.className = 'bwb-src-lean';
    lean.textContent = src.political_lean || '—';
    row.appendChild(lean);

    // Atlanticist bar
    const atlCell = document.createElement('span');
    atlCell.className = 'bwb-src-axis hide-sm';
    const atl = (src.axis || {}).atlanticist || 0;
    atlCell.appendChild(axisBar(atl, 'western'));
    atlCell.appendChild(document.createTextNode(' ' + (atl >= 0 ? '+' : '') + atl.toFixed(2)));
    row.appendChild(atlCell);

    // Interventionist bar
    const intCell = document.createElement('span');
    intCell.className = 'bwb-src-axis hide-sm';
    const intv = (src.axis || {}).interventionist || 0;
    intCell.appendChild(axisBar(intv, 'adversarial'));
    intCell.appendChild(document.createTextNode(' ' + (intv >= 0 ? '+' : '') + intv.toFixed(2)));
    row.appendChild(intCell);

    // Factuality
    const fact = document.createElement('span');
    fact.className = 'bwb-src-factuality hide-sm bwb-fact-' + (src.factuality || 'unknown').replace(/\s/g,'_');
    fact.textContent = src.factuality || '—';
    row.appendChild(fact);

    // Provenance (ISC-34/42) — per-source evidence chain. We surface
    // MBFC credibility as a self-documenting label and the upstream
    // AllSides/MBFC search URL as a one-click citation. The hand-curated
    // fingerprint lives in api/sources.json; the operator's curation
    // notes live in _index/receipts/source_provenance.jsonl.
    const prov = document.createElement('span');
    prov.className = 'bwb-src-provenance hide-sm';
    prov.title = 'Primary-source anchor: MBFC factuality rating. ' +
                 'Full provenance chain (which axis value came from which input) ' +
                 'is published in _index/receipts/source_provenance.jsonl.';
    const mbfc = src.mbfc_credibility || 'unrated';
    const provText = document.createElement('span');
    provText.className = 'bwb-prov-label';
    provText.textContent = 'MBFC: ' + mbfc;
    prov.appendChild(provText);
    if (src.name) {
      const a = document.createElement('a');
      a.className = 'bwb-prov-link';
      a.href = 'https://www.allsides.com/search?query=' + encodeURIComponent(src.name);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = 'Look up "' + src.name + '" on AllSides (external primary source)';
      a.textContent = '↗';
      prov.appendChild(a);
    }
    row.appendChild(prov);

    // Link
    const linkCell = document.createElement('span');
    linkCell.className = 'bwb-src-link';
    if (src.url) {
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = '→';
      linkCell.appendChild(a);
    }
    row.appendChild(linkCell);

    container.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  renderSources();

  // Filter buttons
  const filterBtns = document.querySelectorAll('[data-src-filter]');
  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _activeFilter = btn.dataset.srcFilter;
      loadRegistry().then(function(reg) { renderSourceTable(reg.sources || []); });
    });
  });

  // Search
  const search = document.getElementById('source-search');
  if (search) {
    search.addEventListener('input', function() {
      _searchQuery = search.value;
      loadRegistry().then(function(reg) { renderSourceTable(reg.sources || []); });
    });
  }
});
