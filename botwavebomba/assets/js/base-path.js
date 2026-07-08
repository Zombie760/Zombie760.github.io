// BOTWAVEBOMBA — Base Path Detection
// Makes the site work both at root (Cloudflare Pages / custom domain)
// and under GitHub Pages project subpath (zombie760.github.io/botwavebomba/)

(function () {
  'use strict';

  function detectBasePath() {
    var host = location.hostname;
    var path = location.pathname;

    // GitHub Pages project site under /botwavebomba/ (no hyphen — current deployment)
    if (host === 'zombie760.github.io' || host === 'www.zombie760.github.io') {
      if (path.indexOf('/botwavebomba') === 0) {
        return '/botwavebomba';
      }
      // Legacy: /botwave-bomba/ (with hyphen) — kept for backwards compat
      // with any external links still using the old project-name spelling.
      if (path.indexOf('/botwave-bomba') === 0) {
        return '/botwave-bomba';
      }
    }

    // Any other known subpath deployments can be added here
    // e.g. if (host === 'example.com' && path.indexOf('/bomba') === 0) return '/bomba';

    // Default: root deployment (Cloudflare Pages, custom domain, local dev server at /)
    return '';
  }

  var base = detectBasePath();

  // Expose globally for other scripts
  window.BWB_BASE = base;

  // Also set a <base> tag early so that all hard-coded href="/..." and src="/..." in HTML work
  // when deployed under a subpath on GitHub Pages.
  if (base && base !== '') {
    try {
      var existingBase = document.querySelector('base');
      if (!existingBase) {
        var b = document.createElement('base');
        b.href = base + '/';
        // Insert as early as possible in <head>
        var head = document.head || document.getElementsByTagName('head')[0];
        if (head.firstChild) {
          head.insertBefore(b, head.firstChild);
        } else {
          head.appendChild(b);
        }
      }
    } catch (e) {
      // Non-fatal
      console.warn('[BWB] base tag injection failed', e);
    }
  }

  // Helper for building asset URLs in JS
  window.BWB_URL = function (p) {
    if (!p) return base || '/';
    if (p[0] === '/') p = p.slice(1);
    return (base ? base + '/' : '/') + p;
  };
})();
