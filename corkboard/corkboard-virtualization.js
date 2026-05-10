(function () {
  'use strict';

  // Lightweight virtualization: hide offscreen .card elements to reduce DOM pressure.
  // Non-destructive: cards are kept in DOM but given a .virtual-hidden class (display:none)

  function init() {
    try {
      const world = document.getElementById('world');
      const stage = document.getElementById('stage');
      const perf = createPerfPanel();

      let enabled = true; // enable by default when many cards
      let threshold = 200; // only enable virtualization when total cards > threshold
      let buffer = 400; // pixels in world coords

      function createPerfPanel() {
        const panel = document.createElement('div');
        panel.id = 'corkboard-perf-panel';
        panel.style.position = 'fixed';
        panel.style.right = '12px';
        panel.style.top = '80px';
        panel.style.zIndex = '100000';
        panel.style.background = 'rgba(10,10,10,0.7)';
        panel.style.color = '#fff';
        panel.style.padding = '8px 10px';
        panel.style.fontFamily = 'Courier Prime, monospace';
        panel.style.fontSize = '12px';
        panel.style.border = '1px solid rgba(255,0,0,0.2)';
        panel.style.maxWidth = '220px';
        panel.innerHTML = '<div><strong>Corkboard</strong></div><div id="cb-perf-count">Cards: 0</div><div id="cb-perf-visible">Visible: 0</div>';
        document.body.appendChild(panel);
        return panel;
      }

      function updatePerfPanel(total, visible) {
        try {
          const c = document.getElementById('cb-perf-count');
          const v = document.getElementById('cb-perf-visible');
          if (c) c.textContent = 'Cards: ' + total;
          if (v) v.textContent = 'Visible: ' + visible;
        } catch (e) {}
      }

      function getViewportWorldRect() {
        // world coords: convert viewport rectangle to world-space using corkboardState
        const state = window.corkboardState || { scale: 1, tx: 0, ty: 0 };
        const left = -state.tx / state.scale;
        const top = -state.ty / state.scale;
        const width = window.innerWidth / state.scale;
        const height = window.innerHeight / state.scale;
        return { left: left - buffer, top: top - buffer, right: left + width + buffer, bottom: top + height + buffer };
      }

      function update() {
        const cards = Array.from(document.querySelectorAll('.card'));
        const total = cards.length;
        if (total === 0) { updatePerfPanel(0,0); return; }
        if (total < threshold) { updatePerfPanel(total, total); return; }
        if (!enabled) { updatePerfPanel(total, total); return; }

        const rect = getViewportWorldRect();
        let visible = 0;
        cards.forEach(card => {
          try {
            const cx = card.offsetLeft;
            const cy = card.offsetTop;
            const cw = card.offsetWidth;
            const ch = card.offsetHeight;
            const cardRight = cx + cw;
            const cardBottom = cy + ch;
            const intersects = !(cardRight < rect.left || cx > rect.right || cardBottom < rect.top || cy > rect.bottom);
            if (intersects) {
              card.classList.remove('virtual-hidden');
              visible += 1;
            } else {
              card.classList.add('virtual-hidden');
            }
          } catch (e) {}
        });
        updatePerfPanel(total, visible);
      }

      // update loop tied to animation frame
      function loop() { try { update(); } catch (e) {} requestAnimationFrame(loop); }
      requestAnimationFrame(loop);

      // UI toggle
      (function addToggle() {
        const ui = document.getElementById('ui'); if (!ui) return;
        const btn = document.createElement('button'); btn.id = 'vb-toggle'; btn.textContent = 'Virtualize: ON'; btn.style.marginLeft = '8px'; btn.style.fontFamily = 'Oswald, sans-serif'; btn.style.padding = '8px 10px';
        btn.addEventListener('click', () => { enabled = !enabled; btn.textContent = 'Virtualize: ' + (enabled ? 'ON' : 'OFF'); });
        const controls = ui.querySelector('.controls') || ui; controls.appendChild(btn);
      })();

      // expose API
      window.corkboardVirtualization = {
        enable: (on) => { enabled = Boolean(on); },
        setThreshold: (n) => { threshold = Number(n) || threshold; }
      };

    } catch (err) {
      console.error('corkboard-virtualization init failed', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
