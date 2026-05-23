// BOTWAVEBOMBA — API Layer
// Fast initial load via slim endpoint, then lazy full payload.
// On fetch failure: visible error banner, empty payload — no fictional content.

// Use document-relative paths so the same code works whether the site is
// served at `/` (custom domain root) or `/botwavebomba/` (GitHub Pages subpath).
// Resolves at runtime against window.location.pathname, anchored to the
// directory of the current document.
const _BWB_DOC_BASE = (() => {
  // strip filename from current path, leaving trailing slash
  const p = window.location.pathname;
  const last = p.lastIndexOf('/');
  return last >= 0 ? p.substring(0, last + 1) : '/';
})();
const BWB_API = {
  base: _BWB_DOC_BASE + 'api',
  dataBase: _BWB_DOC_BASE + 'data',
  _fullData: null,
  _slimLoaded: false,
  _fullLoaded: false,

  async getLatest() {
    // If we already have full data, return it
    if (this._fullLoaded && this._fullData) return this._fullData;

    // First load: fetch slim (36KB) for instant render
    if (!this._slimLoaded) {
      try {
        var slimR = await fetch(this.base + '/latest_slim.json', { cache: 'no-store' });
        if (slimR.ok) {
          var slimData = await slimR.json();
          this._slimLoaded = true;
          // Background-load full data while user reads slim
          this._loadFull();
          return slimData;
        }
      } catch (e) {
        // Slim failed, fall through to full
      }
    }

    // Full load (or slim failed)
    try {
      var r = await fetch(this.base + '/latest.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      this._fullData = data;
      this._fullLoaded = true;
      return data;
    } catch (e) {
      console.error('BWB: live API fetch failed', e.message);
      if (!this._slimLoaded) {
        this._showErrorBanner('Live pipeline data unavailable: ' + e.message + '. No fallback shown — empty state is the honest answer.');
      }
      return this._emptyPayload(e.message);
    }
  },

  async _loadFull() {
    // Background: load full payload and merge into state
    try {
      var r = await fetch(this.base + '/latest.json', { cache: 'no-store' });
      if (!r.ok) return;
      var data = await r.json();
      this._fullData = data;
      this._fullLoaded = true;
      // Dispatch event so feed.js can refresh with full data
      window.dispatchEvent(new CustomEvent('bwb-full-data', { detail: data }));
    } catch (e) {
      // Full data load failed silently — slim data still works
      console.warn('BWB: full data background load failed', e.message);
    }
  },

  async getBlindspotsData() {
    try {
      var r = await fetch(this.base + '/blindspots.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      return { stories: [] };
    }
  },

  async getSources() {
    try {
      var r = await fetch(this.dataBase + '/source_registry.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.error('BWB: source registry fetch failed', e.message);
      this._showErrorBanner('Source registry unavailable: ' + e.message);
      return { sources: [], total: 0 };
    }
  },

  async getStoryDetail(storyId) {
    // For story.html — load full data and find the story
    var data = await this.getLatest();
    var story = (data.stories || []).find(function(s) { return s.id === storyId; });
    if (story) return story;

    // If slim data doesn't have articles, try full
    if (!this._fullLoaded) {
      var fullData = await this._loadFullSync();
      if (fullData) {
        story = (fullData.stories || []).find(function(s) { return s.id === storyId; });
        if (story) return story;
      }
    }
    return null;
  },

  async _loadFullSync() {
    try {
      var r = await fetch(this.base + '/latest.json', { cache: 'no-store' });
      if (!r.ok) return null;
      var data = await r.json();
      this._fullData = data;
      this._fullLoaded = true;
      return data;
    } catch (e) {
      return null;
    }
  },

  getStoryParam() {
    return new URLSearchParams(window.location.search).get('id');
  },

  _showErrorBanner(message) {
    if (typeof document === 'undefined') return;
    if (document.getElementById('bwb-error-banner')) return;
    var banner = document.createElement('div');
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