/* ── BWB_IdentityModal ─────────────────────────────────────────────────────
 * Per-source visibility modal for the operator's money-trace thesis.
 * Click a source pill on a card → modal opens with:
 *   - source name + 2-letter monogram
 *   - bloc chip (color-coded)
 *   - 5 bias axes as horizontal bars
 *   - country / language / source type
 *   - factuality (when present)
 *   - funding chain (read from funding_graph.json if loaded, else placeholder)
 *   - primary source URL (when present)
 *   - MBFC credibility (when not "unknown")
 *
 * W9 BotWaveBomba Phase-2 ISA. Vanilla DOM, no dependencies.
 * Reuses existing CSS variables from main.css where present; falls back
 * to inline styles with the same tokens.
 *
 * Public API:
 *   window.BWB_IdentityModal.open(source)  — open modal for a source object
 *   window.BWB_IdentityModal.close()       — close the modal
 * ──────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var BIAS_AXES = [
    { key: 'bias_western',        label: 'Western' },
    { key: 'bias_adversarial',    label: 'Adversarial' },
    { key: 'bias_atlanticist',    label: 'Atlanticist' },
    { key: 'bias_interventionist',label: 'Interventionist' },
    { key: 'bias_statist',        label: 'Statist' },
    { key: 'bias_financialized',  label: 'Financialized' }
  ];

  var BLOC_COLORS = {
    western:     '#2255CC',
    adversarial: '#CC2222',
    'non-aligned':'#0F8B7E',
    neutral:     '#5E7070'
  };

  // funding_graph is loaded lazily on first open; the W6 agent writes it.
  var _fundingGraph = null;
  var _fundingGraphLoadAttempted = false;

  function loadFundingGraph(cb) {
    if (_fundingGraph) return cb(_fundingGraph);
    if (_fundingGraphLoadAttempted) return cb(null);
    _fundingGraphLoadAttempted = true;
    var url = (window.BWB_BASE || '') + '/api/funding_graph.json';
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { _fundingGraph = d; cb(d); })
      .catch(function () { cb(null); });
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'style') n.setAttribute('style', attrs[k]);
        else if (k === 'html') n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function monogram(name) {
    if (!name) return '?';
    var s = String(name).replace(/^(The|A)\s+/i, '').trim();
    var parts = s.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
  }

  function pct(v) {
    if (typeof v !== 'number' || isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function pctLabel(v) {
    return Math.round(pct(v) * 100) + '%';
  }

  function buildBiasRow(axis, value) {
    var row = el('div', { class: 'bwb-im-bias-row', style: 'display:flex;align-items:center;gap:10px;margin:6px 0;' });
    var label = el('div', {
      class: 'bwb-im-bias-label',
      style: 'flex:0 0 130px;font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:0.5px;color:var(--theme-text-muted,rgba(255,255,255,0.5));text-transform:uppercase;'
    }, axis.label);
    var barWrap = el('div', { class: 'bwb-im-bias-barwrap', style: 'flex:1;height:8px;background:var(--theme-border,rgba(255,255,255,0.12));border-radius:2px;overflow:hidden;' });
    var bar = el('div', {
      class: 'bwb-im-bias-bar bwb-bias-bar',
      style: 'width:' + (pct(value) * 100) + '%;height:100%;background:var(--signal-' + (axis.key.replace('bias_','')) + ',#2255CC);transition:width .2s ease;'
    });
    barWrap.appendChild(bar);
    var val = el('div', {
      class: 'bwb-im-bias-val',
      style: 'flex:0 0 42px;text-align:right;font-family:var(--font-mono,monospace);font-size:10px;color:var(--theme-text,#F0EDE8);'
    }, pctLabel(value));
    row.appendChild(label);
    row.appendChild(barWrap);
    row.appendChild(val);
    return row;
  }

  function buildFundingChain(source, fundingGraph) {
    var wrap = el('div', { class: 'bwb-im-funding', style: 'margin-top:14px;' });
    wrap.appendChild(el('div', {
      class: 'bwb-im-section-title',
      style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:1px;color:var(--theme-text-muted,rgba(255,255,255,0.4));text-transform:uppercase;margin-bottom:6px;'
    }, 'FUNDING CHAIN'));

    // Priority 1: funding_breakdown on the source object (W6's authoritative form)
    if (source.funding_breakdown) {
      renderFundingBreakdown(wrap, source.funding_breakdown);
      return wrap;
    }

    // Priority 2: funding_graph.outlet_to_owner[lowercase name]
    var nameKey = (source.name || '').toLowerCase().trim();
    var ownerChain = null;
    if (fundingGraph && fundingGraph.outlet_to_owner && nameKey) {
      ownerChain = fundingGraph.outlet_to_owner[nameKey];
    }
    if (ownerChain) {
      renderFundingBreakdown(wrap, ownerChain);
      return wrap;
    }

    // Priority 3: parent_company hint (cheapest possible signal)
    if (source.parent_company && source.parent_company !== 'unknown') {
      var row = el('div', { style: 'font-size:12px;color:var(--theme-text,#F0EDE8);margin:2px 0;' });
      row.appendChild(el('span', { style: 'color:var(--theme-text-muted,rgba(255,255,255,0.5));font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.5px;margin-right:8px;' }, 'PARENT'));
      row.appendChild(document.createTextNode(source.parent_company));
      wrap.appendChild(row);
    }

    // Placeholder line — never crash the modal
    var placeholder = el('div', {
      style: 'font-size:11px;color:var(--theme-text-muted,rgba(255,255,255,0.4));font-style:italic;margin-top:4px;'
    }, fundingGraph === null && _fundingGraphLoadAttempted
      ? 'funding chain loading...'
      : 'funding chain loading...');
    wrap.appendChild(placeholder);
    return wrap;
  }

  function renderFundingBreakdown(wrap, breakdown) {
    // breakdown can be: { parent, parent_of, lp_of } (W6) OR an array
    // of {role, name, url} chain links.
    var list;
    if (Array.isArray(breakdown)) {
      list = breakdown;
    } else if (breakdown && typeof breakdown === 'object') {
      list = [];
      if (breakdown.parent)     list.push({ role: 'OWNED BY',     name: breakdown.parent });
      if (breakdown.parent_of)  list.push({ role: 'PARENT OF',    name: breakdown.parent_of });
      if (breakdown.lp_of)      list.push({ role: 'LP OF',        name: breakdown.lp_of });
    } else {
      return;
    }
    list.forEach(function (link) {
      var row = el('div', { style: 'font-size:12px;color:var(--theme-text,#F0EDE8);margin:3px 0;display:flex;gap:8px;align-items:baseline;' });
      var role = el('span', {
        style: 'flex:0 0 90px;color:var(--theme-text-muted,rgba(255,255,255,0.5));font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.5px;'
      }, link.role || 'CHAIN');
      if (link.url) {
        var a = el('a', {
          href: link.url,
          target: '_blank',
          rel: 'noopener',
          style: 'color:var(--theme-accent,#BF3B2D);text-decoration:underline;'
        }, link.name);
        row.appendChild(role);
        row.appendChild(a);
      } else {
        row.appendChild(role);
        row.appendChild(document.createTextNode(link.name || ''));
      }
      wrap.appendChild(row);
    });
  }

  function buildPrimarySource(source) {
    if (!source.primary_source_url) return null;
    var wrap = el('div', { class: 'bwb-im-primary', style: 'margin-top:14px;' });
    wrap.appendChild(el('div', {
      style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:1px;color:var(--theme-text-muted,rgba(255,255,255,0.4));text-transform:uppercase;margin-bottom:4px;'
    }, 'PRIMARY'));
    var a = el('a', {
      href: source.primary_source_url,
      target: '_blank',
      rel: 'noopener',
      style: 'color:var(--theme-accent,#BF3B2D);text-decoration:underline;font-size:12px;word-break:break-all;'
    }, source.primary_source_url);
    wrap.appendChild(a);
    return wrap;
  }

  function buildMetaRow(items) {
    var row = el('div', {
      style: 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;'
    });
    items.forEach(function (it) {
      if (!it.value || it.value === 'unknown') return;
      var chip = el('div', {
        class: 'bwb-im-meta bwb-chip',
        style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.5px;padding:3px 8px;border:1px solid var(--theme-border,rgba(255,255,255,0.12));color:var(--theme-text-muted,rgba(255,255,255,0.6));text-transform:uppercase;'
      }, it.label + ': ' + it.value);
      row.appendChild(chip);
    });
    return row;
  }

  function buildModalContent(source) {
    var root = el('div', {
      class: 'bwb-modal bwb-im-modal',
      style: 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);'
    });

    var card = el('div', {
      class: 'bwb-im-card',
      role: 'dialog',
      'aria-modal': 'true',
      style: 'background:var(--theme-bg-card,#161616);border:1px solid var(--theme-border,rgba(255,255,255,0.12));max-width:520px;width:100%;max-height:88vh;overflow-y:auto;padding:24px;color:var(--theme-text,#F0EDE8);font-family:var(--font-sans,\'DM Sans\',sans-serif);box-shadow:0 20px 60px rgba(0,0,0,0.5);'
    });

    // ── Header: monogram + name + close
    var header = el('div', { style: 'display:flex;align-items:flex-start;gap:14px;margin-bottom:6px;' });
    var mon = el('div', {
      class: 'bwb-im-monogram ' + (source.bloc || ''),
      style: 'flex:0 0 56px;height:56px;display:flex;align-items:center;justify-content:center;background:var(--bg-hover,#222);color:var(--theme-text-muted,rgba(255,255,255,0.5));font-family:var(--font-mono,monospace);font-size:18px;font-weight:700;letter-spacing:1px;border-radius:4px;'
    }, monogram(source.name));
    var nameWrap = el('div', { style: 'flex:1;min-width:0;' });
    nameWrap.appendChild(el('h2', {
      style: 'margin:0 0 4px;font-family:var(--font-display,\'Playfair Display\',serif);font-size:20px;line-height:1.2;'
    }, source.name || source.id || 'Unknown source'));

    // Bloc chip + source type chip
    var chipRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;' });
    if (source.bloc) {
      var blocColor = BLOC_COLORS[source.bloc] || '#5E7070';
      chipRow.appendChild(el('span', {
        class: 'bwb-chip bwb-im-bloc ' + source.bloc,
        style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.5px;padding:2px 8px;border:1px solid ' + blocColor + ';color:' + blocColor + ';text-transform:uppercase;'
      }, source.bloc));
    }
    if (source.source_type) {
      chipRow.appendChild(el('span', {
        class: 'bwb-chip',
        style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.5px;padding:2px 8px;border:1px solid var(--theme-border,rgba(255,255,255,0.12));color:var(--theme-text-muted,rgba(255,255,255,0.6));text-transform:uppercase;'
      }, source.source_type));
    }
    if (source.mbfc_credibility && source.mbfc_credibility !== 'unknown') {
      chipRow.appendChild(el('span', {
        class: 'bwb-chip',
        style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.5px;padding:2px 8px;border:1px solid var(--signal-verified,#059669);color:var(--signal-verified,#059669);text-transform:uppercase;'
      }, 'MBFC: ' + source.mbfc_credibility));
    }
    nameWrap.appendChild(chipRow);
    header.appendChild(mon);
    header.appendChild(nameWrap);
    card.appendChild(header);

    // ── Meta row (country / language / factuality)
    card.appendChild(buildMetaRow([
      { label: 'Country',    value: source.country },
      { label: 'Language',   value: source.language },
      { label: 'Type',       value: source.source_type },
      { label: 'Factuality', value: source.factuality },
      { label: 'Parent',     value: source.parent_company }
    ]));

    // ── 5 bias axes
    var biasSection = el('div', { class: 'bwb-im-bias-section', style: 'margin-top:18px;' });
    biasSection.appendChild(el('div', {
      style: 'font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:1px;color:var(--theme-text-muted,rgba(255,255,255,0.4));text-transform:uppercase;margin-bottom:8px;'
    }, 'BIAS AXES'));
    BIAS_AXES.forEach(function (axis) {
      biasSection.appendChild(buildBiasRow(axis, source[axis.key]));
    });
    card.appendChild(biasSection);

    // ── Funding chain
    card.appendChild(buildFundingChain(source, _fundingGraph));

    // ── Primary source URL
    var primary = buildPrimarySource(source);
    if (primary) card.appendChild(primary);

    // ── See the chain further link
    var chainLink = el('div', { style: 'margin-top:16px;padding-top:14px;border-top:1px solid var(--theme-border,rgba(255,255,255,0.08));' });
    var chainA = el('a', {
      href: '/corruption.html?source=' + encodeURIComponent(source.name || source.id || ''),
      style: 'font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:0.8px;color:var(--theme-accent,#BF3B2D);text-transform:uppercase;text-decoration:none;border-bottom:1px dotted var(--theme-accent,#BF3B2D);padding-bottom:1px;'
    }, 'SEE THE CHAIN FURTHER →');
    chainLink.appendChild(chainA);
    card.appendChild(chainLink);

    // ── Close button
    var closeBtn = el('button', {
      type: 'button',
      'aria-label': 'Close',
      class: 'bwb-im-close',
      style: 'position:absolute;top:14px;right:18px;background:none;border:none;color:var(--theme-text-muted,rgba(255,255,255,0.5));font-size:22px;cursor:pointer;line-height:1;padding:0;font-family:var(--font-mono,monospace);'
    }, '×');
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });
    card.style.position = 'relative';
    card.appendChild(closeBtn);

    // ── Click-outside to close
    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });

    root.appendChild(card);
    return root;
  }

  var _openRoot = null;

  function open(source) {
    if (!source || typeof source !== 'object') {
      console.warn('[BWB_IdentityModal] open() called with non-source:', source);
      return;
    }
    close(); // close any existing
    loadFundingGraph(function () {
      // re-render in case the funding graph arrived after first paint
      if (_openRoot && document.body.contains(_openRoot)) {
        document.body.removeChild(_openRoot);
      }
      _openRoot = buildModalContent(source);
      document.body.appendChild(_openRoot);
    });
  }

  function close() {
    if (_openRoot && _openRoot.parentNode) {
      _openRoot.parentNode.removeChild(_openRoot);
    }
    _openRoot = null;
  }

  // ── ESC key to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && _openRoot) close();
  });

  // Expose public API
  window.BWB_IdentityModal = { open: open, close: close };
})();
