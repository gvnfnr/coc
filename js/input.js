/* input.js — mouse + keyboard handling for home and battle modes. */
(function (COC) {
  'use strict';

  const Input = {};
  const Iso = COC.Iso;

  Input.init = function (game) {
    const canvas = game.canvas;
    let dragging = false;
    let moved = false;
    let last = { x: 0, y: 0 };
    let downPt = { x: 0, y: 0 };

    function rel(ev) {
      const r = canvas.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      return { x: cx, y: cy };
    }

    // screen -> grid (float), accounting for camera + zoom
    function toGrid(p) {
      const cam = game.camera;
      const wx = (p.x - canvas.width / 2 - cam.x) / cam.zoom;
      const wy = (p.y - canvas.height / 2 - cam.y) / cam.zoom;
      return Iso.toGrid(wx, wy);
    }
    game.screenToGrid = function (ev) { return toGrid(rel(ev)); };

    function onDown(ev) {
      const p = rel(ev);
      dragging = true; moved = false;
      last = p; downPt = p;
    }

    function onMove(ev) {
      const p = rel(ev);
      const g = toGrid(p);
      game.hover = { gx: Math.floor(g.gx), gy: Math.floor(g.gy) };

      // update placement ghost to follow cursor
      if (game.mode === 'home' && game.placing) {
        const size = COC.BUILDINGS[game.placing.type].size;
        let gx = Math.round(g.gx - size / 2);
        let gy = Math.round(g.gy - size / 2);
        const c = Iso.clampGrid(gx, gy, size);
        game.placing.gx = c.gx; game.placing.gy = c.gy;
        game.placing.valid = COC.Buildings.canPlace(game.state, size, c.gx, c.gy, game.movingBuilding || null);
      }

      if (dragging) {
        const dx = p.x - last.x, dy = p.y - last.y;
        if (Math.abs(p.x - downPt.x) + Math.abs(p.y - downPt.y) > 6) moved = true;
        // pan camera (unless actively placing a building with cursor)
        if (!game.placing) {
          game.camera.x += dx; game.camera.y += dy;
          game.clampCamera();
        }
        last = p;
      }
    }

    function onUp(ev) {
      const wasDrag = moved;
      dragging = false;
      const p = rel(ev);
      const g = toGrid(p);
      if (wasDrag) return; // it was a pan, not a click

      if (game.mode === 'home') {
        if (game.placing) {
          game.tryPlace();
        } else {
          game.clickAt(g.gx, g.gy);
        }
      } else { // battle
        if (game.battle.selectedTroop) {
          game.tryDeploy(game.battle.selectedTroop, g.gx, g.gy);
        }
      }
    }

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // touch
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onDown(e); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); onMove(e); }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      // touchend has no coordinates; use last known
      const fake = { clientX: last.x + canvas.getBoundingClientRect().left, clientY: last.y + canvas.getBoundingClientRect().top };
      onUp(fake);
    });

    // zoom
    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.1 : 0.9;
      game.camera.zoom = Math.max(0.4, Math.min(2.5, game.camera.zoom * factor));
      game.clampCamera();
    }, { passive: false });

    // right click cancels placement
    canvas.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (game.placing) game.cancelPlacement();
    });

    // keyboard
    window.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (game.placing) game.cancelPlacement();
        else game.deselect();
        document.getElementById('build-menu').classList.add('hidden');
        document.getElementById('army-menu').classList.add('hidden');
      } else if (ev.key === 'b' || ev.key === 'B') {
        if (game.mode === 'home') COC.UI.toggleBuildMenu();
      } else if (ev.key === 'a' || ev.key === 'A') {
        if (game.mode === 'home') COC.UI.toggleArmyMenu();
      }
    });
  };

  COC.Input = Input;
})(window.COC);
