// BOTWAVEBOMBA — Live Status Badge
// Reads pipeline_state.json at runtime and updates the 6/6 decomposition
// status badge + fingerprinting-gap badge on the front page.
// Acceptance: ISC-27, ISC-30, ISC-44 (status badge reads from
// pipeline_state.json at runtime — not hardcoded).

(function() {
  'use strict';

  var BWB_STATUS = {
    _state: null,

    async load() {
      try {
        var url = (window.BWB_BASE || '') + '/pipeline_state.json';
        var r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this._state = await r.json();
        this._render();
      } catch (e) {
        console.warn('BWB_STATUS: pipeline_state.json fetch failed', e.message);
        this._renderError(e.message);
      }
    },

    _setText(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    },

    _renderError(msg) {
      // Don't surface a banner — the existing pipeline-badge is fine
      // for "live status" of the data fetch. The status badge just shows
      // a soft "—" placeholder.
      this._setText('status-modules-extracted', '—');
      this._setText('status-modules-total', '—');
      this._setText('status-fp-rated', '—');
      this._setText('status-fp-awaiting', '—');
      this._setText('status-fp-last', '—');
    },

    _render() {
      var s = this._state;
      if (!s) return;

      // 6/6 decomposition badge
      var decomp = s.decomposition || {};
      var extracted = decomp.modules_extracted;
      var total = decomp.total_modules;
      var complete = (decomp.next_extraction_scheduled === 'COMPLETE');

      if (typeof extracted === 'number' && typeof total === 'number') {
        this._setText('status-modules-extracted', String(extracted));
        this._setText('status-modules-total',      String(total));
      }

      var badge = document.getElementById('status-decomposition-badge');
      if (badge) {
        if (complete && extracted === total) {
          badge.classList.add('bwb-status-badge--ok');
          badge.title = 'All ' + total + ' modules extracted with fixture-equivalence verified. See /status.html for live per-stage health.';
        } else {
          badge.classList.add('bwb-status-badge--partial');
          badge.title = extracted + ' of ' + total + ' modules extracted. ' + (decomp.next_extraction_target || 'in progress.');
        }
      }

      // Source-count + fingerprinting-gap badge
      var sc = s.source_counts || {};
      if (typeof sc.fingerprinted === 'number') {
        this._setText('status-fp-rated',    String(sc.fingerprinted));
      }
      if (typeof sc.awaiting_fingerprinting === 'number') {
        this._setText('status-fp-awaiting', String(sc.awaiting_fingerprinting));
      }
      if (sc.as_of) {
        this._setText('status-fp-last', sc.as_of);
      }
    }
  };

  window.BWB_STATUS = BWB_STATUS;
  document.addEventListener('DOMContentLoaded', function() { BWB_STATUS.load(); });
})();
