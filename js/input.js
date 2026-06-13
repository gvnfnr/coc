/* input.js — mouse + keyboard handling for home and battle modes. */
(function (COC) {
  'use strict';
  const Input = {};
  const Iso = COC.Iso;

  Input.init = function (game) {
    const canvas = game.canvas;
    let dragging = false, moved = false, last = { x: 0, y: 0 }, downPt = { x: 0, y: 0 };

    function rel(ev) {
      const r = canvas.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      return { x: cx, y: cy };
    }
    function toGrid(p) {
      const cam = game.camera;
      const wx = (p.x - canvas.width / 2 - cam.x) / cam.zoom;
      const wy = (p.y - canvas.height / 2 - cam.y) / cam.zoom;
      return Iso.toGrid(wx, wy);
    }
    game.screenToGrid = function (ev) { return toGrid(rel(ev)); };

    function onDown(ev) { COC.Audio.resume(); const p = rel(ev); dragging = true; moved = false; last = p; downPt = p; }

    function onMove(ev) {
      const p = rel(ev), g = toGrid(p);
      game.hover = { gx: Math.floor(g.gx), gy: Math.floor(g.gy) };
      if (game.mode === 'home' && game.placing) {
        const size = COC.BUILDINGS[game.placing.type].size;
        const c = Iso.clampGrid(Math.round(g.gx - size / 2), Math.round(g.gy - size / 2), size);
        game.placing.gx = c.gx; game.placing.gy = c.gy;
        game.placing.valid = COC.Buildings.canPlace(game.state, size, c.gx, c.gy, game.movingBuilding || null);
      }
      if (dragging) {
        const dx = p.x - last.x, dy = p.y - last.y;
        if (Math.abs(p.x - downPt.x) + Math.abs(p.y - downPt.y) > 6) moved = true;
        if (!game.placing) { game.camera.x += dx; game.camera.y += dy; game.clampCamera(); }
        last = p;
      }
    }

    function onUp(ev) {
      const wasDrag = moved; dragging = false;
      const g = toGrid(rel(ev));
      if (wasDrag) return;
      if (game.mode === 'home') {
        if (game.placing) game.tryPlace(); else game.clickAt(g.gx, g.gy);
      } else {
        if (game.battle.selectedSpell) game.tryCastSpell(game.battle.selectedSpell, g.gx, g.gy);
        else if (game.battle.selectedTroop) game.tryDeploy(game.battle.selectedTroop, g.gx, g.gy);
      }
    }

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onDown(e); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); onMove(e); }, { passive: false });
    canvas.addEventListener('touchend', function () {
      const r = canvas.getBoundingClientRect();
      onUp({ clientX: last.x + r.left, clientY: last.y + r.top });
    });
    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      game.camera.zoom = Math.max(0.35, Math.min(2.5, game.camera.zoom * (ev.deltaY < 0 ? 1.1 : 0.9)));
      game.clampCamera();
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); if (game.placing) game.cancelPlacement(); });

    window.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (game.placing) game.cancelPlacement(); else game.deselect();
        if (game.battle) { game.battle.selectedTroop = null; game.battle.selectedSpell = null; COC.UI.renderTrays && COC.UI.renderTrays(); }
        $('build-menu') && $('build-menu').classList.add('hidden'); $('army-menu') && $('army-menu').classList.add('hidden');
      } else if ((ev.key === 'b' || ev.key === 'B') && game.mode === 'home') COC.UI.toggleBuildMenu();
      else if ((ev.key === 'a' || ev.key === 'A') && game.mode === 'home') COC.UI.toggleArmyMenu();
    });
    function $(id) { return document.getElementById(id); }
  };

  COC.Input = Input;
})(window.COC);
