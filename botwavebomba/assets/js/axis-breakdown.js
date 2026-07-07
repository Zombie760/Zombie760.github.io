// BOTWAVEBOMBA — 5-Axis Delta Visualization (story page)
// Per-bloc grouped bar chart of 5 axis scores (0.0-1.0 scale).
// Vanilla JS, no external libs. Matches existing bwb-axis-* CSS conventions
// in main.css. Receives sources with s.axis = {interventionist, zionist,
// atlanticist, statist, financialized} once Move A's registry lands.

(function() {
  var AXES = ['interventionist', 'zionist', 'atlanticist', 'statist', 'financialized'];
  var AXIS_LABELS = {
    interventionist: 'Interventionist',
    zionist:         'Zionist',
    atlanticist:     'Atlanticist',
    statist:         'Statist',
    financialized:   'Financialized'
  };

  // Matches --signal-* CSS vars (main.css:19-21). Hardcoded here so the
  // module works without a stylesheet read; CSS overrides win when present.
  var BLOC_COLORS = {
    western:     '#2255CC',
    neutral:     '#5E7070',
    adversarial: '#CC2222',
    mixed:       '#8B5CF6'
  };
  var BLOC_LABELS = {
    western:     'Western',
    neutral:     'Non-Aligned',
    adversarial: 'Adversarial',
    mixed:       'Mixed'
  };

  function renderAxisBreakdown(sources, containerId) {
    containerId = containerId || 'axis-breakdown';
    var container = document.getElementById(containerId);
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    var hasAxisData = (sources || []).some(function(s) {
      return s && s.axis && AXES.some(function(k) {
        return typeof s.axis[k] === 'number';
      });
    });

    if (!hasAxisData) {
      var empty = document.createElement('div');
      empty.className = 'bwb-axis-empty';
      empty.textContent = '5-axis data not yet available for this story. Coming soon via source_registry.json enrichment.';
      container.appendChild(empty);
      return;
    }

    // Group sources by bloc. Defaults to 'neutral' when missing.
    var grouped = { western: [], neutral: [], adversarial: [], mixed: [] };
    (sources || []).forEach(function(s) {
      if (!s) return;
      var b = s.bloc || 'neutral';
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(s);
    });

    // Only render blocs with at least one source.
    var activeBlocs = Object.keys(grouped).filter(function(b) { return grouped[b].length > 0; });

    // Header legend
    var legend = document.createElement('div');
    legend.className = 'bwb-axis-bloc-legend';
    activeBlocs.forEach(function(b) {
      var item = document.createElement('span');
      item.className = 'bwb-axis-bloc-legend-item';
      var dot = document.createElement('span');
      dot.className = 'bwb-axis-bloc-legend-dot';
      dot.style.background = BLOC_COLORS[b];
      item.appendChild(dot);
      var lbl = document.createElement('span');
      lbl.textContent = BLOC_LABELS[b] + ' (' + grouped[b].length + ')';
      item.appendChild(lbl);
      legend.appendChild(item);
    });
    var hint = document.createElement('span');
    hint.className = 'bwb-axis-bloc-legend-hint';
    hint.textContent = '1.0 = strongly aligned · 0.5 = neutral';
    legend.appendChild(hint);
    container.appendChild(legend);

    // For each axis, render a row of bars (one per bloc).
    AXES.forEach(function(axis) {
      var row = document.createElement('div');
      row.className = 'bwb-axis-row';

      var label = document.createElement('div');
      label.className = 'bwb-axis-label';
      label.textContent = AXIS_LABELS[axis];
      row.appendChild(label);

      var bars = document.createElement('div');
      bars.className = 'bwb-axis-bars';

      activeBlocs.forEach(function(bloc) {
        var scores = grouped[bloc]
          .map(function(s) { return s.axis && typeof s.axis[axis] === 'number' ? s.axis[axis] : null; })
          .filter(function(x) { return x !== null; });
        var avg = scores.length ? scores.reduce(function(a, b) { return a + b; }, 0) / scores.length : 0;
        // 0-1 scale: width = avg * 100%, centerline at 50%.
        var pct = Math.max(0, Math.min(100, avg * 100));

        var barWrap = document.createElement('div');
        barWrap.className = 'bwb-axis-bar-wrap';

        var blocLbl = document.createElement('span');
        blocLbl.className = 'bwb-axis-bloc-label';
        blocLbl.textContent = BLOC_LABELS[bloc];
        blocLbl.style.color = BLOC_COLORS[bloc];
        barWrap.appendChild(blocLbl);

        var track = document.createElement('div');
        track.className = 'bwb-axis-track';

        var fill = document.createElement('div');
        fill.className = 'bwb-axis-fill';
        fill.style.width = pct.toFixed(1) + '%';
        fill.style.background = BLOC_COLORS[bloc];
        fill.title = BLOC_LABELS[bloc] + ' · ' + AXIS_LABELS[axis] + ' · ' + (scores.length ? avg.toFixed(2) : 'n/a') + ' (n=' + scores.length + ')';
        track.appendChild(fill);

        // Centerline marker at 0.5 (neutral).
        var mid = document.createElement('div');
        mid.className = 'bwb-axis-midmark';
        track.appendChild(mid);

        barWrap.appendChild(track);

        var val = document.createElement('span');
        val.className = 'bwb-axis-val';
        val.textContent = scores.length ? avg.toFixed(2) : '—';
        barWrap.appendChild(val);

        bars.appendChild(barWrap);
      });

      row.appendChild(bars);
      container.appendChild(row);
    });
  }

  window.renderAxisBreakdown = renderAxisBreakdown;
})();
