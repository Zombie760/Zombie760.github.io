// corkboard-helpers.js
// Small runtime guards and helpers to make the corkboard pages more robust.

document.addEventListener('DOMContentLoaded', () => {
  try {
    const world = document.getElementById('world');
    const edges = document.getElementById('edges');

    if (world && edges) {
      // Ensure edges SVG has explicit width/height and a viewBox so drawing scales correctly.
      const w = parseInt(getComputedStyle(world).width, 10) || world.offsetWidth || 7000;
      const h = parseInt(getComputedStyle(world).height, 10) || world.offsetHeight || 5000;
      edges.setAttribute('width', String(w));
      edges.setAttribute('height', String(h));
      if (!edges.getAttribute('viewBox')) edges.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    // Add a safe global fetch wrapper for victims_data.json to prevent page-break if file missing
    if (window.fetch && !window._corkboard_fetch_wrapped) {
      const _originalFetch = window.fetch.bind(window);
      window.fetch = function(resource, init) {
        try {
          if (typeof resource === 'string' && resource.includes('victims_data.json')) {
            return _originalFetch(resource, init).catch(() => {
              console.warn('corkboard: victims_data.json fetch failed — using empty fallback.');
              const fallback = { victims: [], pipelines: [], victim_connections: [] };
              return Promise.resolve(new Response(JSON.stringify(fallback), { headers: { 'Content-Type': 'application/json' } }));
            });
          }
        } catch (e) {
          // fall through to original fetch
        }
        return _originalFetch(resource, init);
      };
      window._corkboard_fetch_wrapped = true;
    }

    // Defensive DOM helpers used by boards' inline scripts
    window.corkboardSafe = {
      elOrNull: (selector) => document.querySelector(selector) || null,
      tryRun: (fn) => { try { fn(); } catch (e) { console.warn('corkboard helper error', e); } }
    };
  } catch (err) {
    // never throw — helper must be safe
    console.error('corkboard-helpers init failed', err);
  }
});
