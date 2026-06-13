/* pathfinding.js — A* on the tile grid for ground troops navigating around walls. */
(function (COC) {
  'use strict';

  const Path = {};
  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  // blocked(gx,gy) -> true if a wall occupies that tile. Diagonal moves are
  // disallowed through wall corners. Returns array of {x,y} tile-centers or null.
  Path.find = function (blocked, sx, sy, tx, ty) {
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    sx = Math.max(0, Math.min(cols - 1, sx | 0));
    sy = Math.max(0, Math.min(rows - 1, sy | 0));
    tx = Math.max(0, Math.min(cols - 1, tx | 0));
    ty = Math.max(0, Math.min(rows - 1, ty | 0));
    if (sx === tx && sy === ty) return [{ x: tx + 0.5, y: ty + 0.5 }];

    const idx = (x, y) => y * cols + x;
    const open = []; // simple binary-less heap via sorted insertion (grids are small)
    const came = new Map();
    const g = new Map();
    const startK = idx(sx, sy);
    g.set(startK, 0);
    open.push({ k: startK, x: sx, y: sy, f: heur(sx, sy, tx, ty) });

    function heur(x, y, gx, gy) { return Math.hypot(x - gx, y - gy); }

    let guard = 0;
    while (open.length && guard++ < 6000) {
      // pop lowest f
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.x === tx && cur.y === ty) return reconstruct(came, cur.k, cols);

      for (const d of DIRS) {
        const nx = cur.x + d[0], ny = cur.y + d[1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (blocked(nx, ny) && !(nx === tx && ny === ty)) continue;
        // prevent cutting wall corners diagonally
        if (d[0] !== 0 && d[1] !== 0) {
          if (blocked(cur.x + d[0], cur.y) && blocked(cur.x, cur.y + d[1])) continue;
        }
        const step = (d[0] !== 0 && d[1] !== 0) ? 1.4142 : 1;
        const nk = idx(nx, ny);
        const tentative = g.get(cur.k) + step;
        if (!g.has(nk) || tentative < g.get(nk)) {
          g.set(nk, tentative);
          came.set(nk, cur.k);
          const f = tentative + heur(nx, ny, tx, ty);
          // update or insert
          let found = false;
          for (const node of open) if (node.k === nk) { node.f = f; found = true; break; }
          if (!found) open.push({ k: nk, x: nx, y: ny, f: f });
        }
      }
    }
    return null;
  };

  function reconstruct(came, endK, cols) {
    const out = [];
    let k = endK;
    while (k !== undefined) {
      const x = k % cols, y = Math.floor(k / cols);
      out.push({ x: x + 0.5, y: y + 0.5 });
      k = came.get(k);
    }
    out.reverse();
    return out;
  }

  COC.Path = Path;
})(window.COC);
