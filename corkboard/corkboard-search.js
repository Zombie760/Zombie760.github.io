// corkboard-search.js
// Phase 3: client-side search, filtering chips, permalinks, and "view source" buttons on cards.
// Works progressively: if the page's card DOM or data is not yet available, waits and retries a few times.

(function () {
  'use strict';

  const RETRY_LIMIT = 8;
  const RETRY_DELAY = 400; // ms

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function queryCards() {
    return Array.from(document.querySelectorAll('.card'));
  }

  function getCardId(card) {
    return card.getAttribute('data-id') || card.id || card.getAttribute('id') || card.dataset.id || '';
  }

  function getCardText(card) {
    // prefer data-name then visible text
    return (card.getAttribute('data-name') || card.dataset.name || card.textContent || '').toLowerCase();
  }

  function highlightCard(card) {
    try {
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      // attempt to center card in viewport
      const rect = card.getBoundingClientRect();
      const world = document.getElementById('world');
      if (!world || !window.corkboardState) return;
      const state = window.corkboardState;
      // compute card center in world coordinates
      const cardWorldX = (card.offsetLeft + (card.offsetWidth / 2));
      const cardWorldY = (card.offsetTop + (card.offsetHeight / 2));
      // target tx,ty so card center is viewport center
      const targetTx = (window.innerWidth / 2) - (cardWorldX * state.scale);
      const targetTy = (window.innerHeight / 2) - (cardWorldY * state.scale);
      state.tx = targetTx; state.ty = targetTy;
      // smooth-ish animation
      if (window.corkboardHelpers && window.corkboardHelpers.applyTransform) {
        window.corkboardHelpers.applyTransform();
      }
    } catch (e) { console.warn('highlightCard failed', e); }
  }

  function updatePermalinkForCard(card) {
    const id = getCardId(card);
    if (!id) return;
    const url = new URL(window.location.href);
    url.hash = `node=${encodeURIComponent(id)}`;
    history.replaceState(null, '', url.toString());
  }

  function handleCardClick(e) {
    const card = e.currentTarget;
    highlightCard(card);
    updatePermalinkForCard(card);
  }

  function addViewSourceToCard(card, sources) {
    try {
      const body = card.querySelector('.body') || card;
      if (!body) return;
      // avoid duplicates
      if (body.querySelector('.view-sources')) return;
      const btn = document.createElement('button');
      btn.className = 'view-sources';
      btn.textContent = 'View sources';
      btn.style.position = 'absolute';
      btn.style.right = '8px';
      btn.style.bottom = '8px';
      btn.style.padding = '6px 8px';
      btn.style.fontFamily = 'Courier Prime, monospace';
      btn.style.fontSize = '11px';
      btn.style.background = 'rgba(0,0,0,0.6)';
      btn.style.color = '#fff';
      btn.style.border = '1px solid rgba(255,255,255,0.08)';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showSourcesModal(sources);
      });
      body.appendChild(btn);
    } catch (e) { console.warn('addViewSourceToCard failed', e); }
  }

  function showSourcesModal(sources) {
    try {
      if (!sources || sources.length === 0) {
        window.corkboardSafe && corkboardSafe.showToast && corkboardSafe.showToast('No sources available', 'info');
        return;
      }
      // simple modal
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.background = 'rgba(0,0,0,0.8)'; overlay.style.zIndex = 200000; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
      const box = document.createElement('div');
      box.style.background = '#111'; box.style.color = '#fff'; box.style.padding = '18px'; box.style.maxWidth = '720px'; box.style.maxHeight = '70vh'; box.style.overflow = 'auto'; box.style.border = '2px solid #d71920';
      const title = document.createElement('h3'); title.textContent = 'Sources'; title.style.fontFamily = 'Anton, sans-serif'; title.style.marginTop = '0'; box.appendChild(title);
      const ul = document.createElement('ul');
      ul.style.fontFamily = 'Courier Prime, monospace'; ul.style.fontSize = '13px'; ul.style.lineHeight = '1.5';
      sources.forEach(s => {
        const li = document.createElement('li');
        if (s.url) {
          const a = document.createElement('a'); a.href = s.url; a.textContent = s.title || s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = '#f4e9d5';
          li.appendChild(a);
        } else {
          li.textContent = s.title || s;
        }
        ul.appendChild(li);
      });
      box.appendChild(ul);
      const close = document.createElement('button'); close.textContent = 'Close'; close.style.marginTop = '12px'; close.style.padding='8px 10px'; close.style.cursor='pointer'; close.addEventListener('click', () => overlay.remove());
      box.appendChild(close);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    } catch (e) { console.warn('showSourcesModal failed', e); }
  }

  function applyFilters({ search = '', chapter = null, type = null }) {
    const cards = queryCards();
    const q = (search || '').toLowerCase().trim();
    cards.forEach(card => {
      const text = getCardText(card);
      const cardChapter = (card.getAttribute('data-chapter') || card.dataset.chapter || '').toLowerCase();
      const cardType = (card.getAttribute('data-type') || card.dataset.type || '').toLowerCase();
      let visible = true;
      if (q) {
        visible = text.indexOf(q) !== -1;
      }
      if (chapter && chapter !== 'all') {
        visible = visible && (cardChapter === chapter.toLowerCase());
      }
      if (type && type !== 'all') {
        visible = visible && (cardType === type.toLowerCase());
      }
      if (visible) card.classList.remove('dim'); else card.classList.add('dim');
    });
  }

  function buildUI(data) {
    try {
      const ui = document.getElementById('ui');
      if (!ui) return;
      // Search container
      const container = document.createElement('div');
      container.style.display = 'flex'; container.style.alignItems = 'center'; container.style.gap = '10px';
      container.style.marginLeft = '12px';

      const input = document.createElement('input');
      input.type = 'search'; input.placeholder = 'Search names, roles, docs...';
      input.style.padding = '8px 10px'; input.style.fontFamily = 'Courier Prime, monospace'; input.style.fontSize = '13px';

      // Chapter filter select
      const chapterSelect = document.createElement('select');
      chapterSelect.style.padding='8px'; chapterSelect.style.fontFamily='Courier Prime, monospace'; chapterSelect.style.fontSize='12px';
      const chapters = new Set();
      (data.victims || []).forEach(v => { if (v.chapter) chapters.add(v.chapter); });
      chapterSelect.appendChild(new Option('All chapters','all'));
      Array.from(chapters).sort().forEach(ch => chapterSelect.appendChild(new Option(ch, ch)));

      // Type filter
      const typeSelect = document.createElement('select');
      typeSelect.style.padding='8px'; typeSelect.style.fontFamily='Courier Prime, monospace'; typeSelect.style.fontSize='12px';
      const types = new Set();
      (data.victims || []).forEach(v => { if (v.type) types.add(v.type); });
      typeSelect.appendChild(new Option('All types','all'));
      Array.from(types).sort().forEach(t => typeSelect.appendChild(new Option(t, t)));

      container.appendChild(input);
      container.appendChild(chapterSelect);
      container.appendChild(typeSelect);

      ui.appendChild(container);

      const debounced = debounce(() => {
        applyFilters({ search: input.value, chapter: chapterSelect.value, type: typeSelect.value });
      }, 180);

      input.addEventListener('input', debounced);
      chapterSelect.addEventListener('change', debounced);
      typeSelect.addEventListener('change', debounced);

      // wire up card clicks for permalink & highlight
      const cards = queryCards();
      cards.forEach(card => {
        card.addEventListener('click', handleCardClick);
      });

      // add view source buttons for victims that have document_anchors
      try {
        const idToVictim = {};
        (data.victims || []).forEach(v => { if (v.id) idToVictim[v.id] = v; });
        cards.forEach(card => {
          const cid = getCardId(card);
          if (cid && idToVictim[cid]) {
            const victim = idToVictim[cid];
            const anchors = victim.document_anchors || []; // these are ids; we don't have full doc metadata here
            // map anchor ids to friendly links if documents file exists
            const sources = (anchors || []).map(a => ({ title: a, url: `#${a}` }));
            if (sources.length) addViewSourceToCard(card, sources);
          }
        });
      } catch (e) { console.warn('adding view source buttons failed', e); }

      // initial filter from URL (hash or query)
      const hash = window.location.hash || '';
      const params = new URLSearchParams(window.location.search);
      let nodeId = null;
      if (hash.startsWith('#node=')) nodeId = decodeURIComponent(hash.replace('#node=',''));
      if (!nodeId && params.has('node')) nodeId = params.get('node');
      if (nodeId) {
        const target = document.querySelector(`.card[data-id="${CSS.escape(nodeId)}"], #${CSS.escape(nodeId)}`);
        if (target) highlightCard(target);
      }

    } catch (e) { console.warn('buildUI failed', e); }
  }

  function waitForDataAndBuild(retries = 0) {
    const cards = queryCards();
    // Attempt to fetch victims_data.json to build filters. If not found, still build UI but with empty data.
    fetch('./victims_data.json').then(resp => {
      if (!resp.ok) return {};
      return resp.json();
    }).then(data => {
      buildUI(data || {});
    }).catch(err => {
      // fallback: try to get data embedded on window if available
      const wdata = window.boardData || window.victimsData || null;
      if (wdata) {
        buildUI(wdata);
      } else if (retries < RETRY_LIMIT) {
        setTimeout(() => waitForDataAndBuild(retries + 1), RETRY_DELAY);
      } else {
        buildUI({ victims: [] });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForDataAndBuild(0)); else waitForDataAndBuild(0);

})();
