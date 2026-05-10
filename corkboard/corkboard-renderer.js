(function () {
  'use strict';

  // Canvas-backed edges renderer for corkboard
  // Creates a canvas overlay that mirrors SVG #edges paths for high-performance rendering.

  function createCanvas() {
    const world = document.getElementById('world');
    if (!world) return null;
    // Ensure we only create one
    let canvas = document.getElementById('edges-canvas');
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.id = 'edges-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = 1; // same stacking as svg#edges
    // insert after existing svg#edges if present
    const edges = document.getElementById('edges');
    if (edges && edges.parentNode) edges.parentNode.insertBefore(canvas, edges.nextSibling);
    else world.appendChild(canvas);
    return canvas;
  }

  function resizeCanvasToDisplaySize(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    return false;
  }

  function samplePathPoints(path, maxSamples = 120) {
    const points = [];
    try {
      const len = path.getTotalLength();
      const samples = Math.min(maxSamples, Math.max(2, Math.floor(len / 12)));
      for (let i = 0; i <= samples; i++) {
        const p = path.getPointAtLength((i / samples) * len);
        points.push([p.x, p.y]);
      }
    } catch (e) {
      // fallback if path methods unavailable
    }
    return points;
  }

  function drawAllEdgesOnCanvas(ctx, canvas) {
    const svg = document.getElementById('edges');
    if (!svg) return;
    const paths = svg.querySelectorAll('.edge path, path');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    paths.forEach(path => {
      const points = samplePathPoints(path);
      if (!points || points.length < 2) return;
      // compute style from computed style of svg path
      const cs = window.getComputedStyle(path);
      let stroke = cs.stroke || cs.getPropertyValue('stroke') || '#ff0000';
      let width = parseFloat(cs.strokeWidth || cs.getPropertyValue('stroke-width')) || 2.5;
      // use a glow effect for bright edges if class includes 'bright'
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (path.closest && path.closest('.edge') && path.closest('.edge').classList.contains('bright')) {
        ctx.shadowColor = 'rgba(255, 60, 60, 0.9)';
        ctx.shadowBlur = 14;
        width = Math.max(width, 3);
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;

      ctx.beginPath();
      points.forEach((pt, idx) => {
        const [x, y] = pt;
        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      // dashed/highlight strokes
      const hi = path.querySelector && path.querySelector('.string-hi');
      if (hi) {
        const hiPoints = samplePathPoints(hi);
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ff6666';
        ctx.beginPath();
        hiPoints.forEach((pt, idx) => { const [x, y] = pt; if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function init() {
    try {
      const canvas = createCanvas();
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let enabled = false; // start with SVG by default
      let dirty = true;

      function redraw() {
        if (!enabled) return;
        resizeCanvasToDisplaySize(canvas);
        drawAllEdgesOnCanvas(ctx, canvas);
        dirty = false;
      }

      // hook into corkboardState changes by monkey-patching applyTransform if available
      const origApply = window.corkboardHelpers && window.corkboardHelpers.applyTransform;
      if (origApply) {
        window.corkboardHelpers.applyTransform = function () {
          try { origApply(); } catch (e) { console.warn(e); }
          dirty = true;
          // also update minimap via helper if present
          try { window.corkboardHelpers.updateMinimap && window.corkboardHelpers.updateMinimap(); } catch (e) {}
        };
      }

      // expose control API
      const api = {
        enableCanvas: function (on) {
          enabled = Boolean(on);
          const svg = document.getElementById('edges');
          if (enabled) {
            if (svg) svg.style.display = 'none';
            canvas.style.display = 'block';
            dirty = true;
          } else {
            if (svg) svg.style.display = '';
            canvas.style.display = 'none';
          }
        },
        requestRedraw: function () { dirty = true; }
      };

      // ensure canvas hidden by default
      canvas.style.display = 'none';

      // animation loop
      function loop() {
        if (dirty && enabled) redraw();
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);

      // add a small toggle button to UI
      (function addToggleButton() {
        const ui = document.getElementById('ui');
        if (!ui) return;
        const btn = document.createElement('button');
        btn.id = 'edge-render-toggle';
        btn.textContent = 'Edges: Canvas';
        btn.style.marginLeft = '8px';
        btn.style.fontFamily = 'Oswald, sans-serif';
        btn.style.padding = '8px 10px';
        btn.addEventListener('click', () => {
          api.enableCanvas(!enabled);
          btn.classList.toggle('active', !enabled);
          btn.textContent = enabled ? 'Edges: Canvas' : 'Edges: SVG';
          // request immediate redraw when enabling
          if (!enabled) api.requestRedraw();
        });
        // append to controls group if exists
        const controls = ui.querySelector('.controls') || ui;
        controls.appendChild(btn);
      })();

      window.corkboardRenderer = api;

    } catch (err) {
      console.error('corkboard-renderer init failed', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
