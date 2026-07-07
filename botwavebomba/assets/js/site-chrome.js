// BOTWAVEBOMBA — Shared Header + Footer Chrome
// Replaces per-page inlined header/nav/footer with single-source-of-truth
// markup. Activated by <header data-bwb-chrome="full|compact"> and
// <footer data-bwb-chrome="default"> placeholders. Vanilla JS, no deps.
// Live counts on the full-header stats bar read /pipeline_state.json at runtime.

(function () {
  'use strict';

  // The 9 nav links, preserved verbatim from index.html lines 47-55.
  var NAV_LINKS = [
    ['/',              'Feed'],
    ['/blindspots.html', 'Blindspots'],
    ['/sources.html',  'Sources'],
    ['/trades.html',   'Trades'],
    ['/books.html',    'Books'],
    ['/corkboard/',    'Corkboard'],
    ['/corruption.html', 'Corruption'],
    ['/about.html',    'Method'],
    ['/funnies.html',  'Funnies']
  ];

  function navHtml() {
    return NAV_LINKS.map(function (l) {
      return '<a href="' + l[0] + '">' + l[1] + '</a>';
    }).join('');
  }

  function markActiveLink(root) {
    var path = window.location.pathname || '/';
    var isIndex = path === '/' || /\/index\.html?$/.test(path);
    root.querySelectorAll('.bwb-topnav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (isIndex && (href === '/' || href === '/index.html')) {
        a.classList.add('active');
      } else if (!isIndex && (href === path ||
          (href !== '/' && path.indexOf(href) === 0))) {
        a.classList.add('active');
      }
    });
  }

  // Stats-bar cells. ID-bearing cells hydrate from /pipeline_state.json.
  var STAT_CELLS = [
    { id: 'source-count',     label: 'sources' },
    { id: 'fp-count',         label: 'deep-fp' },
    { id: 'story-count',      label: 'stories', hero: true },
    { id: 'blindspot-count',  label: 'blindspots' },
    { n:   '5',               label: 'bias axes' },
    { id: 'western-count',    label: 'western' },
    { id: 'adversarial-count', label: 'adversarial' },
    { id: 'nonaligned-count', label: 'non-aligned' },
    { id: 'fp-gap',           label: 'fp gap', gap: true }
  ];

  // The 3rd stat ("stories") is the editorial anchor of the bar.
  // Give it a hero treatment: bigger type, brand color.
  // The 9th stat ("fp gap") is the work-to-do anchor: awaiting fingerprinting.
  function fullHeader() {
    var stats = STAT_CELLS.map(function (c) {
      var num = c.id
        ? '<span class="bwb-stat-number" id="' + c.id + '">&mdash;</span>'
        : '<span class="bwb-stat-number">' + c.n + '</span>';
      var cls = 'bwb-stat';
      if (c.hero) cls += ' bwb-stat--hero';
      if (c.gap)  cls += ' bwb-stat--gap';
      return '<div class="' + cls + '">' + num +
             '<span class="bwb-stat-label">' + c.label + '</span></div>' +
             '<div class="bwb-stat-divider"></div>';
    }).join('');
    return ''
      + '<div class="bwb-header-inner">'
      +   '<div class="bwb-logo-lockup">'
      +     '<div class="bwb-logo">BOTWAVEBOMBA</div>'
      +     '<div class="bwb-tagline">Not left/center/right. 5-axis bias fingerprints. The gap between blocs IS the story.</div>'
      +   '</div>'
      +   '<div class="bwb-header-right">'
      +     '<div class="bwb-pipeline-badge"><span class="bwb-pipe-dot"></span>TELOS+PAI LIVE</div>'
      +     '<div class="bwb-axis-badge" title="Five-axis bias fingerprint schema: interventionist · zionist · atlanticist · statist · financialized">'
      +       '<span class="bwb-axis-badge-label">5-AXIS</span>'
      +       '<span class="bwb-axis-badge-value">FINGERPRINTS</span>'
      +     '</div>'
      +     '<div class="bwb-status-badge" id="status-decomposition-badge" title="Pipeline decomposition status">'
      +       '<span class="bwb-status-badge-label">DECOMP</span>'
      +       '<span class="bwb-status-badge-value"><span id="status-modules-extracted">&mdash;</span>/<span id="status-modules-total">&mdash;</span></span>'
      +     '</div>'
      +     '<div class="bwb-fp-gap-badge" id="status-fp-badge" title="Bias fingerprinting coverage">'
      +       '<span class="bwb-fp-gap-label">BIAS-FP</span>'
      +       '<span class="bwb-fp-gap-value"><span id="status-fp-rated">&mdash;</span> rated &middot; <span id="status-fp-awaiting">&mdash;</span> awaiting</span>'
      +     '</div>'
      +     '<nav class="bwb-topnav">' + navHtml() + '</nav>'
      +   '</div>'
      + '</div>'
      + '<div class="bwb-stats-bar">' + stats + '</div>'
      + '<div class="bwb-differentiator">Not left/center/right. <span class="bwb-diff-highlight">5-axis bias fingerprints</span> across Western, Adversarial, and Non-Aligned blocs. <span class="bwb-diff-highlight">The gap IS the story.</span></div>';
  }

  function compactHeader() {
    return ''
      + '<div class="bwb-header-inner">'
      +   '<a href="/" class="bwb-logo bwb-logo--small">BOTWAVEBOMBA</a>'
      +   '<nav class="bwb-topnav">' + navHtml() + '</nav>'
      + '</div>';
  }

  function footer() {
    return ''
      + '<div class="bwb-footer-inner">'
      +   '<div class="bwb-footer-left">'
      +     '<span class="bwb-footer-logo">BOTWAVEBOMBA</span>'
      +     '<span class="bwb-footer-sub">A BOTWAVE journalism arm project. Powered by TELOS+PAI substrate.</span>'
      +   '</div>'
      +   '<div class="bwb-footer-cols">'
      +     '<div class="bwb-footer-col"><div class="bwb-footer-col-title">Product</div>'
      +       '<a href="/">Feed</a><a href="/blindspots.html">Blindspots</a>'
      +       '<a href="/sources.html">Sources</a><a href="/corruption.html">Corruption</a></div>'
      +     '<div class="bwb-footer-col"><div class="bwb-footer-col-title">Method</div>'
      +       '<a href="/about.html">5-axis schema</a>'
      +       '<a href="/about.html#all-sides-mbfc">AllSides + MBFC</a>'
      +       '<a href="/about.html#pipeline">Pipeline</a></div>'
      +     '<div class="bwb-footer-col"><div class="bwb-footer-col-title">Operator</div>'
      +       '<a href="mailto:kyle@example.com">kyle@example.com</a>'
      +       '<a href="https://t.me/botwave_news" target="_blank" rel="noopener">Telegram</a>'
      +       '<a href="https://github.com/Zombie760" target="_blank" rel="noopener">GitHub</a></div>'
      +   '</div>'
      +   '<div class="bwb-footer-right">'
      +     '<a href="https://t.me/botwave_news" target="_blank" rel="noopener">Telegram</a>'
      +     '<a href="/about.html">About</a>'
      +     '<a href="https://github.com/Zombie760" target="_blank" rel="noopener">GitHub</a>'
      +   '</div>'
      + '</div>'
      + '<div class="bwb-footer-disclaimer">'
      +   'BOTWAVEBOMBA does not editorialize. It surfaces the framing delta between global sources. '
      +   'Bias classification: AllSides + MBFC + hand-curated TELOS+PAI fingerprints. '
      +   'Every source link is an original primary URL. Nothing invented.'
      + '</div>';
  }

  function hydrateStats() {
    var url = (window.BWB_BASE || '') + '/pipeline_state.json';
    fetch(url, { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (s) {
      if (!s) return;
      var set = function (id, v) {
        if (typeof v !== 'number') return;
        var el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      if (s.decomposition) {
        set('status-modules-extracted', s.decomposition.modules_extracted);
        set('status-modules-total',     s.decomposition.total_modules);
      }
      if (s.source_counts) {
        set('status-fp-rated',   s.source_counts.fingerprinted);
        set('status-fp-awaiting', s.source_counts.awaiting_fingerprinting);
        set('source-count',      s.source_counts.total_ingested);
        set('fp-count',          s.source_counts.fingerprinted);
        set('fp-gap',            s.source_counts.awaiting_fingerprinting);
      }
    }).catch(function () { /* keep em-dash fallbacks */ });
  }

  // Typewriter reveal for the differentiator line. Fires once on chrome inject.
  // Respects prefers-reduced-motion (full content shown immediately).
  function typewriterDifferentiator(root) {
    var el = root.querySelector('.bwb-differentiator');
    if (!el) return;
    var fullHtml = el.innerHTML;
    // Skip animation entirely if the user prefers reduced motion.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Skip if not the full-header chrome (compact pages already have nothing to reveal).
    if (!root.classList.contains('bwb-header--full')) return;
    // Strip tags, type text content char-by-char, restore highlights after each phrase.
    var text = el.textContent;
    el.textContent = '';
    el.classList.add('bwb-differentiator--typing');
    var i = 0;
    var tick = function () {
      if (i >= text.length) {
        el.classList.remove('bwb-differentiator--typing');
        el.innerHTML = fullHtml; // restore the highlight spans
        return;
      }
      el.textContent = text.slice(0, ++i);
      setTimeout(tick, 18);
    };
    setTimeout(tick, 200);
  }

  // ── KEYBOARD SHORTCUTS ──
  // Power-user navigation: j/k step the feed, ? shows the help modal,
  // g+s/b/c jump to the major sections. Plain DOM scroll, no jQuery.
  // The ? modal is injected once on first use and persisted in the DOM.
  var SHORTCUTS = [
    { keys: ['j'],        label: 'Next story in feed' },
    { keys: ['k'],        label: 'Previous story in feed' },
    { keys: ['g', 'then', 's'], label: 'Jump to Sources page' },
    { keys: ['g', 'then', 'b'], label: 'Jump to Blindspots page' },
    { keys: ['g', 'then', 'c'], label: 'Jump to Corruption page' },
    { keys: ['g', 'then', 'f'], label: 'Jump to Feed' },
    { keys: ['g', 'then', 'l'], label: 'Jump to the LOUDEST story in this view' },
    { keys: ['/'],        label: 'Focus the first filter button' },
    { keys: ['?'],        label: 'Show this help' },
    { keys: ['Esc'],      label: 'Close modal / blur focused element' }
  ];

  function jumpToLoudest() {
    var a = document.querySelector('.bwb-loudest-callout');
    if (!a) return false;
    // If the callout is a link to a story page, navigate to it.
    // Otherwise, scroll the callout into view (it's already on the page).
    if (a.getAttribute('href')) {
      window.location.href = a.getAttribute('href');
    } else {
      a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return true;
  }

  function buildShortcutsModal() {
    if (document.getElementById('bwb-shortcuts')) return;
    var back = document.createElement('div');
    back.className = 'bwb-shortcuts';
    back.id = 'bwb-shortcuts';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-label', 'Keyboard shortcuts');
    var rows = SHORTCUTS.map(function(s) {
      var keys = s.keys.map(function(k) { return '<kbd>' + k + '</kbd>'; }).join(' ');
      return '<div class="bwb-shortcuts-row">'
           +   '<span class="bwb-shortcuts-label">' + s.label + '</span>'
           +   '<span class="bwb-shortcuts-keys">' + keys + '</span>'
           + '</div>';
    }).join('');
    back.innerHTML = ''
      + '<div class="bwb-shortcuts-card">'
      +   '<div class="bwb-shortcuts-title">Keyboard shortcuts</div>'
      +   '<div class="bwb-shortcuts-sub">Power-user navigation. Press <kbd>?</kbd> anytime to reopen.</div>'
      +   rows
      +   '<div class="bwb-shortcuts-foot">ESC or click outside to close</div>'
      + '</div>';
    document.body.appendChild(back);
    back.addEventListener('click', function(e) { if (e.target === back) closeShortcuts(); });
  }

  function openShortcuts()  { var m = document.getElementById('bwb-shortcuts'); if (m) m.classList.add('is-open'); }
  function closeShortcuts() { var m = document.getElementById('bwb-shortcuts'); if (m) m.classList.remove('is-open'); }

  function jumpToCard(delta) {
    var cards = document.querySelectorAll('#story-feed .bwb-card');
    if (!cards.length) return;
    var focused = document.activeElement;
    var idx = -1;
    cards.forEach(function(c, i) { if (c === focused || c.contains(focused)) idx = i; });
    var next = Math.max(0, Math.min(cards.length - 1, idx + delta));
    var target = cards[next];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }

  function wireShortcuts() {
    buildShortcutsModal();
    var pendingG = false;
    var gTimer = null;
    document.addEventListener('keydown', function(e) {
      // Don't hijack typing in form fields
      var t = e.target;
      var tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;

      if (e.key === '?' && e.shiftKey) { openShortcuts(); e.preventDefault(); return; }
      if (e.key === 'Escape')           { closeShortcuts(); if (t && t.blur) t.blur(); return; }

      // g-then-X 2-key sequences
      if (pendingG) {
        pendingG = false;
        clearTimeout(gTimer);
        var goto = { s: '/sources.html', b: '/blindspots.html', c: '/corruption.html', f: '/' };
        if (goto[e.key]) { window.location.href = goto[e.key]; e.preventDefault(); return; }
        if (e.key === 'l') { jumpToLoudest(); e.preventDefault(); return; }
        return;
      }
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        pendingG = true;
        gTimer = setTimeout(function() { pendingG = false; }, 900);
        return;
      }

      if (e.key === 'j') { jumpToCard(+1); e.preventDefault(); return; }
      if (e.key === 'k') { jumpToCard(-1); e.preventDefault(); return; }
      if (e.key === '/') {
        var first = document.querySelector('.bwb-filters button, .bwb-section-pills button');
        if (first) { first.focus(); e.preventDefault(); }
        return;
      }
    });
  }

  var BWB = {
    NAV_LINKS: NAV_LINKS,
    headerCompact: compactHeader,
    headerFull:    fullHeader,
    footer:        footer,

    injectChrome: function () {
      document.querySelectorAll('header[data-bwb-chrome]').forEach(function (h) {
        var mode = h.getAttribute('data-bwb-chrome');
        if (mode === 'full') {
          h.className = 'bwb-header';
          h.innerHTML = fullHeader();
          hydrateStats();
          typewriterDifferentiator(h);
        } else {
          h.className = 'bwb-header bwb-header--compact';
          h.innerHTML = compactHeader();
        }
        markActiveLink(h);
      });
      document.querySelectorAll('footer[data-bwb-chrome]').forEach(function (f) {
        f.className = 'bwb-footer';
        f.innerHTML = footer();
      });
      wireShortcuts();
    }
  };

  window.BWB = BWB;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { BWB.injectChrome(); });
  } else {
    BWB.injectChrome();
  }
})();
