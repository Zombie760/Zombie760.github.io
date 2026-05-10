// corkboard-helpers.js
// Small runtime guards and helpers to make the corkboard pages more robust.

function _corkboard_init() {
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

    // Toast UI for non-blocking messages
    if (!document.getElementById('corkboard-toast')) {
      const toast = document.createElement('div');
      toast.id = 'corkboard-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.zIndex = '99999';
      toast.style.maxWidth = '320px';
      toast.style.fontFamily = 'Courier Prime, monospace';
      document.body.appendChild(toast);
    }

    // Add a safe global fetch wrapper for victims_data.json to prevent page-break if file missing
    if (window.fetch && !window._corkboard_fetch_wrapped) {
      const _originalFetch = window.fetch.bind(window);
      window.fetch = function(resource, init) {
        try {
          if (typeof resource === 'string' && resource.includes('victims_data.json')) {
            return _originalFetch(resource, init).catch(() => {
              console.warn('corkboard: victims_data.json fetch failed — using empty fallback.');
              window.corkboardSafe && corkboardSafe.showToast && corkboardSafe.showToast('Data not available — using fallback', 'warn');
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
      tryRun: (fn) => { try { fn(); } catch (e) { console.warn('corkboard helper error', e); } },
      showToast: (msg, type = 'info', timeout = 5000) => {
        try {
          const toast = document.getElementById('corkboard-toast');
          if (!toast) return;
          const item = document.createElement('div');
          item.textContent = msg;
          item.style.background = type === 'warn' ? 'rgba(200,100,40,0.95)' : 'rgba(20,20,20,0.95)';
          item.style.color = '#fff';
          item.style.padding = '8px 12px';
          item.style.marginTop = '8px';
          item.style.borderRadius = '4px';
          item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
          toast.appendChild(item);
          setTimeout(() => { try { item.style.transition = 'opacity 300ms'; item.style.opacity = '0'; setTimeout(() => item.remove(), 350); } catch(e){} }, timeout);
        } catch (e) { /* noop */ }
      }
    };
  } catch (err) {
    // never throw — helper must be safe
    console.error('corkboard-helpers init failed', err);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _corkboard_init); else _corkboard_init();
