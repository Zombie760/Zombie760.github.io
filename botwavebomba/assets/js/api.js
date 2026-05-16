// BOTWAVEBOMBA — API Layer
// Reads from /botwavebomba/api/*.json written by the systemd-fired pipeline.
// On fetch failure: surfaces a visible error banner and returns an empty payload.
// No silent fallback to fictional demo content — see DIAGNOSTIC.md for the rationale.

const BWB_API = {
  base: '/botwavebomba/api',
  dataBase: '/botwavebomba/data',

  async getLatest() {
    try {
      const r = await fetch(`${this.base}/latest.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.error('BWB: live API fetch failed', e.message);
      this._showErrorBanner('Live pipeline data unavailable: ' + e.message + '. No fallback shown — empty state is the honest answer.');
      return this._emptyPayload(e.message);
    }
  },

  async getBlindspotsData() {
    try {
      const r = await fetch(`${this.base}/blindspots.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      // Intentional: empty stories triggers blindspot.js fallback that derives
      // blindspots from latest.json. This is the documented path now that the
      // stale blindspots fossil has been removed.
      return { stories: [] };
    }
  },

  async getSources() {
    try {
      const r = await fetch(`${this.dataBase}/source_registry.json`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.error('BWB: source registry fetch failed', e.message);
      this._showErrorBanner('Source registry unavailable: ' + e.message);
      return { sources: [], total: 0 };
    }
  },

  getStoryParam() {
    return new URLSearchParams(window.location.search).get('id');
  },

  _showErrorBanner(message) {
    if (typeof document === 'undefined') return;
    if (document.getElementById('bwb-error-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'bwb-error-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0',
      'background:#5a0000', 'color:#fff',
      'padding:0.75rem 1rem',
      'font-family:DM Mono, ui-monospace, Menlo, monospace',
      'font-size:0.8rem', 'line-height:1.4',
      'z-index:99999',
      'border-bottom:2px solid #a83232',
      'text-align:center'
    ].join(';');
    banner.textContent = 'PIPELINE: ' + message;
    if (document.body) {
      document.body.appendChild(banner);
    } else {
      document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(banner); });
    }
  },

  _emptyPayload(errorMessage) {
    return {
      generated_at: null,
      article_count: 0,
      story_count: 0,
      sections: [],
      stories: [],
      _error: errorMessage || 'unknown'
    };
  }
};

window.BWB_API = BWB_API;
