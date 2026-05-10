// corkboard-helpers.js (Phase 2 enhancements)
// Adds pan/zoom (pointer + wheel + keyboard), basic pinch support, minimap sync/click-to-jump,
// prefers-reduced-motion support, ARIA labels for UI controls, and a content-warning modal.

(function () {
  'use strict';

  function init() {
    try {
      const world = document.getElementById('world');
      const stage = document.getElementById('stage');
      const edges = document.getElementById('edges');
      const minimap = document.getElementById('minimap');
      const minimapViewport = document.getElementById('minimap-viewport');

      // Ensure edges SVG viewBox/size
      if (world && edges) {
        const w = parseInt(getComputedStyle(world).width, 10) || world.offsetWidth || 7000;
        const h = parseInt(getComputedStyle(world).height, 10) || world.offsetHeight || 5000;
        edges.setAttribute('width', String(w));
        edges.setAttribute('height', String(h));
        if (!edges.getAttribute('viewBox')) edges.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }

      // Toast UI
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

      // state
      window.corkboardState = window.corkboardState || {
        scale: 1,
        minScale: 0.3,
        maxScale: 3.0,
        tx: 0,
        ty: 0
      };

      const state = window.corkboardState;

      function applyTransform() {
        if (!world) return;
        world.style.transformOrigin = '0 0';
        world.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
        updateMinimapViewport();
      }

      // basic pan implementation using pointer events
      (function setupPan() {
        if (!stage || !world) return;

        let isPanning = false;
        let startX = 0, startY = 0;

        stage.style.touchAction = 'none'; // allow custom panning gestures

        stage.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return; // left only
          isPanning = true;
          startX = e.clientX;
          startY = e.clientY;
          stage.setPointerCapture(e.pointerId);
          stage.classList && stage.classList.add('panning');
        });

        stage.addEventListener('pointermove', (e) => {
          if (!isPanning) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          startX = e.clientX;
          startY = e.clientY;
          state.tx += dx;
          state.ty += dy;
          applyTransform();
        });

        stage.addEventListener('pointerup', (e) => {
          if (!isPanning) return;
          isPanning = false;
          stage.releasePointerCapture && stage.releasePointerCapture(e.pointerId);
          stage.classList && stage.classList.remove('panning');
        });

        stage.addEventListener('pointercancel', () => { isPanning = false; stage.classList && stage.classList.remove('panning'); });
      })();

      // wheel for zoom (use ctrl/meta to zoom; plain wheel pans vertically)
      (function setupWheel() {
        if (!stage || !world) return;
        stage.addEventListener('wheel', (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // zoom toward mouse pointer
            const rect = world.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const delta = -e.deltaY;
            const zoomFactor = delta > 0 ? 1.08 : 0.925;
            const newScale = Math.max(state.minScale, Math.min(state.maxScale, state.scale * zoomFactor));
            // adjust tx/ty so point under mouse stays stationary
            const scaleRatio = newScale / state.scale;
            state.tx = mx - scaleRatio * (mx - state.tx);
            state.ty = my - scaleRatio * (my - state.ty);
            state.scale = newScale;
            applyTransform();
          } else {
            // default: pan vertically
            state.ty -= e.deltaY;
            state.tx -= e.deltaX;
            applyTransform();
          }
        }, { passive: false });
      })();

      // keyboard controls
      (function setupKeyboard() {
        window.addEventListener('keydown', (e) => {
          if (e.key === '+' || e.key === '=' ) { // zoom in
            e.preventDefault();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const rect = world.getBoundingClientRect();
            const mx = centerX - rect.left;
            const my = centerY - rect.top;
            const newScale = Math.min(state.maxScale, state.scale * 1.12);
            const scaleRatio = newScale / state.scale;
            state.tx = mx - scaleRatio * (mx - state.tx);
            state.ty = my - scaleRatio * (my - state.ty);
            state.scale = newScale;
            applyTransform();
          } else if (e.key === '-' || e.key === '_') { // zoom out
            e.preventDefault();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const rect = world.getBoundingClientRect();
            const mx = centerX - rect.left;
            const my = centerY - rect.top;
            const newScale = Math.max(state.minScale, state.scale / 1.12);
            const scaleRatio = newScale / state.scale;
            state.tx = mx - scaleRatio * (mx - state.tx);
            state.ty = my - scaleRatio * (my - state.ty);
            state.scale = newScale;
            applyTransform();
          } else if (e.key === 'ArrowUp') { state.ty += 50; applyTransform(); }
          else if (e.key === 'ArrowDown') { state.ty -= 50; applyTransform(); }
          else if (e.key === 'ArrowLeft') { state.tx += 50; applyTransform(); }
          else if (e.key === 'ArrowRight') { state.tx -= 50; applyTransform(); }
          else if (e.key === '0') { // reset
            state.scale = 1; state.tx = 0; state.ty = 0; applyTransform(); }
        });
      })();

      // simple pinch-to-zoom support using pointer events
      (function setupPinch() {
        if (!stage || !world) return;
        const pointers = new Map();
        let lastDist = null;

        stage.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, e); });
        stage.addEventListener('pointermove', (e) => {
          if (!pointers.has(e.pointerId)) return;
          pointers.set(e.pointerId, e);
          if (pointers.size === 2) {
            const arr = Array.from(pointers.values());
            const a = arr[0]; const b = arr[1];
            const dx = b.clientX - a.clientX; const dy = b.clientY - a.clientY;
            const dist = Math.hypot(dx, dy);
            if (lastDist) {
              const zoomFactor = dist / lastDist;
              const newScale = Math.max(state.minScale, Math.min(state.maxScale, state.scale * zoomFactor));
              // center between two pointers
              const rect = world.getBoundingClientRect();
              const mx = ((a.clientX + b.clientX) / 2) - rect.left;
              const my = ((a.clientY + b.clientY) / 2) - rect.top;
              const scaleRatio = newScale / state.scale;
              state.tx = mx - scaleRatio * (mx - state.tx);
              state.ty = my - scaleRatio * (my - state.ty);
              state.scale = newScale;
              applyTransform();
            }
            lastDist = dist;
          }
        });
        function cleanupPointer(e) { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = null; }
        stage.addEventListener('pointerup', cleanupPointer);
        stage.addEventListener('pointercancel', cleanupPointer);
        stage.addEventListener('pointerout', cleanupPointer);
        stage.addEventListener('pointerleave', cleanupPointer);
      })();

      // minimap basic sync and click-to-jump
      (function setupMinimap() {
        if (!minimap || !minimapViewport || !world) return;

        // draw viewport rectangle in minimap based on world transform and window size
        function update() {
          const worldRect = world.getBoundingClientRect();
          const scale = state.scale;
          const worldWidth = world.offsetWidth * scale;
          const worldHeight = world.offsetHeight * scale;
          const viewWidth = window.innerWidth;
          const viewHeight = window.innerHeight;

          // minimap dimensions
          const mmW = minimap.clientWidth;
          const mmH = minimap.clientHeight;

          const ratioX = mmW / (world.offsetWidth || 1);
          const ratioY = mmH / (world.offsetHeight || 1);

          // viewport position in world coordinates (account for transform)
          const vx = -state.tx / state.scale;
          const vy = -state.ty / state.scale;
          const vw = viewWidth / state.scale;
          const vh = viewHeight / state.scale;

          const mmX = vx * ratioX;
          const mmY = vy * ratioY;
          const mmVW = vw * ratioX;
          const mmVH = vh * ratioY;

          minimapViewport.style.left = `${mmX}px`;
          minimapViewport.style.top = `${mmY}px`;
          minimapViewport.style.width = `${mmVW}px`;
          minimapViewport.style.height = `${mmVH}px`;
          minimapViewport.style.border = '2px solid var(--obey-red)';
          minimapViewport.style.position = 'absolute';
        }

        window.addEventListener('resize', update);
        // expose update so applyTransform can call it
        window.corkboardHelpers = window.corkboardHelpers || {};
        window.corkboardHelpers.updateMinimap = update;

        // click-to-jump
        minimap.addEventListener('click', (e) => {
          const rect = minimap.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const worldW = world.offsetWidth || 1;
          const worldH = world.offsetHeight || 1;
          const ratioX = worldW / rect.width;
          const ratioY = worldH / rect.height;
          const centerWorldX = clickX * ratioX;
          const centerWorldY = clickY * ratioY;
          // move viewport so centerWorld is centered in window
          const newTx = -centerWorldX * state.scale + (window.innerWidth / 2);
          const newTy = -centerWorldY * state.scale + (window.innerHeight / 2);
          state.tx = newTx; state.ty = newTy; applyTransform();
        });

        // update loop
        function updateMinimapLoop() { try { update(); } catch(e){}; requestAnimationFrame(updateMinimapLoop); }
        updateMinimapLoop();
      })();

      // prefers-reduced-motion
      (function enforceReducedMotion() {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.matches) {
          document.documentElement.classList.add('reduced-motion');
          // reduce animations by setting a CSS variable or removing animation-heavy classes
          document.querySelectorAll('*').forEach(el => {
            try { el.style.animationDuration = '0.001ms'; } catch(e){}
          });
        }
      })();

      // ARIA: add labels for UI buttons for better screen reader text
      (function addAria() {
        try {
          const btns = document.querySelectorAll('#ui button, .controls button, .btn');
          btns.forEach(b => {
            if (!b.getAttribute('aria-label')) {
              b.setAttribute('aria-label', b.textContent.trim() || 'control');
            }
            b.tabIndex = 0;
          });
        } catch (e) { /* noop */ }
      })();

      // content warning modal (show once unless dismissed permanently)
      (function contentWarning() {
        try {
          if (localStorage && localStorage.getItem('corkboard_warn_dismissed') === '1') return;
          const overlay = document.createElement('div');
          overlay.id = 'corkboard-content-warning';
          overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.background = 'rgba(0,0,0,0.85)'; overlay.style.zIndex = '100000'; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
          const box = document.createElement('div');
          box.style.background = '#111'; box.style.color = '#fff'; box.style.padding = '22px'; box.style.maxWidth = '720px'; box.style.border = '2px solid #8b0000'; box.style.fontFamily = 'Courier Prime, monospace';
          box.innerHTML = `<h2 style="font-family: Anton, sans-serif; color: #f4e9d5; margin-top:0;">Content Warning</h2>
            <p style="color:#dcdcdc;">This board contains references to victims, alleged abuse, and other sensitive material sourced from public records. Viewer discretion advised. All claims are sourced — consult primary documents linked in each card.</p>
            <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end;">
              <button id="cwb-continue" style="padding:8px 12px; background:#d71920; color:#fff; border:none; cursor:pointer;">Continue</button>
              <button id="cwb-dismiss" style="padding:8px 12px; background:transparent; color:#fff; border:1px solid #666; cursor:pointer;">Continue and don't show again</button>
            </div>`;
          overlay.appendChild(box);
          document.body.appendChild(overlay);
          document.getElementById('cwb-continue').addEventListener('click', () => { overlay.remove(); });
          document.getElementById('cwb-dismiss').addEventListener('click', () => { if (localStorage) localStorage.setItem('corkboard_warn_dismissed','1'); overlay.remove(); });
        } catch(e) { /* noop */ }
      })();

      // expose helpers and initial transform
      window.corkboardHelpers = window.corkboardHelpers || {};
      window.corkboardHelpers.applyTransform = applyTransform;
      window.corkboardHelpers.updateMinimap = window.corkboardHelpers.updateMinimap || function(){};
      applyTransform();

    } catch (err) {
      console.error('corkboard-helpers init failed', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
