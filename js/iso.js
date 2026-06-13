/* iso.js — isometric coordinate math. Grid space <-> screen space. */
(function (COC) {
  'use strict';

  const Iso = {};

  // Convert grid (gx, gy) tile coordinates to screen point (before camera/zoom).
  // We use a diamond projection. Origin tile (0,0) maps to top apex.
  Iso.toScreen = function (gx, gy) {
    const tw = COC.GRID.tileW / 2;
    const th = COC.GRID.tileH / 2;
    return {
      x: (gx - gy) * tw,
      y: (gx + gy) * th,
    };
  };

  // Convert a screen point (already in world space, camera removed) to grid coords (float).
  Iso.toGrid = function (sx, sy) {
    const tw = COC.GRID.tileW / 2;
    const th = COC.GRID.tileH / 2;
    const gx = (sx / tw + sy / th) / 2;
    const gy = (sy / th - sx / tw) / 2;
    return { gx, gy };
  };

  // Center screen point of a building footprint of given size at top-left tile (gx,gy).
  Iso.footprintCenter = function (gx, gy, size) {
    return Iso.toScreen(gx + size / 2, gy + size / 2);
  };

  Iso.clampGrid = function (gx, gy, size) {
    gx = Math.max(0, Math.min(COC.GRID.cols - size, gx));
    gy = Math.max(0, Math.min(COC.GRID.rows - size, gy));
    return { gx, gy };
  };

  COC.Iso = Iso;
})(window.COC);
