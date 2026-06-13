/* render.js — all canvas drawing for home & battle modes. */
(function (COC) {
  'use strict';

  const Render = {};
  const Iso = COC.Iso;
  const B = COC.Buildings;
  const T = COC.Troops;

  // pixel height of a building's body, by type/category
  function bodyHeight(type) {
    const def = COC.BUILDINGS[type];
    if (def.wall) return 14;
    if (def.category === 'defense') return 30 + def.size * 4;
    if (def.category === 'core') return 40;
    return 22 + def.size * 4;
  }

  function shade(hex, amt) {
    // amt -1..1 darken/lighten
    const c = parseInt(hex.slice(1), 16);
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (amt < 0) { const f = 1 + amt; r *= f; g *= f; b *= f; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  Render.applyCamera = function (ctx, cam, canvas) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2 + cam.x, canvas.height / 2 + cam.y);
    ctx.scale(cam.zoom, cam.zoom);
  };

  // ---- Grid ----
  Render.drawGround = function (ctx, mode) {
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    // big ground diamond
    const a = Iso.toScreen(0, 0);
    const b = Iso.toScreen(cols, 0);
    const c = Iso.toScreen(cols, rows);
    const d = Iso.toScreen(0, rows);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = mode === 'battle' ? '#6f9e54' : '#7cb35e';
    ctx.fill();

    // checker tiles
    for (let gx = 0; gx < cols; gx++) {
      for (let gy = 0; gy < rows; gy++) {
        const t = Iso.toScreen(gx, gy);
        const tw = COC.GRID.tileW / 2, th = COC.GRID.tileH / 2;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + tw, t.y + th);
        ctx.lineTo(t.x, t.y + th * 2);
        ctx.lineTo(t.x - tw, t.y + th);
        ctx.closePath();
        ctx.fillStyle = ((gx + gy) % 2 === 0)
          ? (mode === 'battle' ? '#79a85e' : '#86bd66')
          : (mode === 'battle' ? '#6f9e54' : '#7cb35e');
        ctx.fill();
      }
    }
  };

  Render.drawGridLines = function (ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    for (let gx = 0; gx <= cols; gx++) {
      const s = Iso.toScreen(gx, 0), e = Iso.toScreen(gx, rows);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
    for (let gy = 0; gy <= rows; gy++) {
      const s = Iso.toScreen(0, gy), e = Iso.toScreen(cols, gy);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
  };

  // Highlight a single tile footprint (for placement / hover).
  Render.highlightFootprint = function (ctx, gx, gy, size, fill) {
    const top = Iso.toScreen(gx, gy);
    const right = Iso.toScreen(gx + size, gy);
    const bottom = Iso.toScreen(gx + size, gy + size);
    const left = Iso.toScreen(gx, gy + size);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  // ---- Building ----
  // bld: {type, gx, gy, level, hp, ...}; isBattle uses maxHp; home uses Buildings.maxHp
  Render.drawBuilding = function (ctx, bld, opts) {
    opts = opts || {};
    const def = COC.BUILDINGS[bld.type];
    const size = def.size;
    const h = bodyHeight(bld.type);
    const color = def.color;

    const top = Iso.toScreen(bld.gx, bld.gy);
    const right = Iso.toScreen(bld.gx + size, bld.gy);
    const bottom = Iso.toScreen(bld.gx + size, bld.gy + size);
    const left = Iso.toScreen(bld.gx, bld.gy + size);

    // ground shadow
    ctx.beginPath();
    ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    // left face
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y - h);
    ctx.lineTo(left.x, left.y - h);
    ctx.closePath();
    ctx.fillStyle = shade(color, -0.35);
    ctx.fill();

    // right face
    ctx.beginPath();
    ctx.moveTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y - h);
    ctx.lineTo(right.x, right.y - h);
    ctx.closePath();
    ctx.fillStyle = shade(color, -0.18);
    ctx.fill();

    // top face
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - h);
    ctx.lineTo(right.x, right.y - h);
    ctx.lineTo(bottom.x, bottom.y - h);
    ctx.lineTo(left.x, left.y - h);
    ctx.closePath();
    ctx.fillStyle = opts.ghost ? color : shade(color, 0.12);
    ctx.globalAlpha = opts.ghost ? 0.55 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = opts.selected ? '#fff' : 'rgba(0,0,0,0.35)';
    ctx.lineWidth = opts.selected ? 2.5 : 1;
    ctx.stroke();

    // emblem / detail on top center
    const cx = (top.x + bottom.x) / 2;
    const cyTop = (top.y + bottom.y) / 2 - h;
    Render.drawEmblem(ctx, bld, cx, cyTop, size);

    // upgrade indicator
    if (bld.upgrading) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx - 16, cyTop - h - 14, 32, 12);
      ctx.fillStyle = '#7fd0ff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏳ ' + COC.fmtTime(B.upgradeRemaining(bld)), cx, cyTop - h - 5);
    }

    // level badge
    if (!opts.ghost && !def.wall) {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(right.x - 4, right.y - h - 4, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd84d';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(bld.level, right.x - 4, right.y - h - 3);
      ctx.textBaseline = 'alphabetic';
    }

    // health bar (battle, or damaged at home)
    const maxHp = bld.maxHp != null ? bld.maxHp : B.maxHp(bld);
    if (opts.showHp && bld.hp < maxHp && !bld.destroyed) {
      Render.healthBar(ctx, cx, cyTop - h - (def.wall ? 6 : 24), Math.max(0, bld.hp / maxHp), 28);
    }

    // ready-to-collect bubble
    if (opts.pending && opts.pending > 0) {
      const icon = def.resource === 'gold' ? '🪙' : '💧';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      const bob = Math.sin(Date.now() / 300) * 2;
      ctx.fillText(icon, cx, cyTop - h - 18 + bob);
    }
  };

  Render.drawEmblem = function (ctx, bld, cx, cy, size) {
    const def = COC.BUILDINGS[bld.type];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = (8 + size * 2) + 'px sans-serif';
    let ch = '';
    switch (bld.type) {
      case 'townhall': ch = '🏛'; break;
      case 'goldmine': ch = '⛏'; break;
      case 'elixircollector': ch = '🧪'; break;
      case 'goldstorage': ch = '🪙'; break;
      case 'elixirstorage': ch = '💧'; break;
      case 'cannon': ch = '💣'; break;
      case 'archertower': ch = '🏹'; break;
      case 'barracks': ch = '⚔'; break;
      case 'armycamp': ch = '⛺'; break;
      case 'wall': ch = ''; break;
    }
    if (ch) ctx.fillText(ch, cx, cy);
    ctx.textBaseline = 'alphabetic';
  };

  Render.healthBar = function (ctx, cx, y, frac, w) {
    w = w || 28;
    const h = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#333';
    ctx.fillRect(cx - w / 2, y, w, h);
    ctx.fillStyle = frac > 0.5 ? '#5ad65a' : frac > 0.25 ? '#f5c518' : '#e74c3c';
    ctx.fillRect(cx - w / 2, y, w * frac, h);
  };

  // ---- Troops ----
  Render.drawTroop = function (ctx, tr) {
    const def = COC.TROOPS[tr.type];
    const p = Iso.toScreen(tr.x, tr.y);
    const bob = Math.abs(Math.sin(tr.anim)) * 2;
    const r = tr.type === 'giant' ? 9 : 6;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(p.x, p.y - r - bob, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x - r * 0.35, p.y - r - bob - 1, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + r * 0.35, p.y - r - bob - 1, 1.6, 0, Math.PI * 2); ctx.fill();
    // health bar
    if (tr.hp < tr.maxHp) Render.healthBar(ctx, p.x, p.y - r * 2 - bob - 8, tr.hp / tr.maxHp, 18);
  };

  Render.drawProjectile = function (ctx, p) {
    const s = Iso.toScreen(p.x, p.y);
    ctx.fillStyle = p.color || '#ffcf6b';
    ctx.beginPath(); ctx.arc(s.x, s.y - 10, 3, 0, Math.PI * 2); ctx.fill();
  };

  Render.drawFloater = function (ctx, f) {
    const s = Iso.toScreen(f.x, f.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, s.x, s.y - 30);
    ctx.fillText(f.text, s.x, s.y - 30);
    ctx.globalAlpha = 1;
  };

  // ---- Master scene draw ----
  Render.scene = function (ctx, game) {
    const cam = game.camera;
    Render.applyCamera(ctx, cam, game.canvas);
    Render.drawGround(ctx, game.mode);
    if (game.mode === 'home' && (game.placing || game.showGrid)) Render.drawGridLines(ctx);

    if (game.mode === 'home') {
      Render.homeScene(ctx, game);
    } else {
      Render.battleScene(ctx, game);
    }
  };

  Render.homeScene = function (ctx, game) {
    const state = game.state;
    const sorted = state.buildings.slice().sort(function (a, b) {
      return (a.gx + a.gy) - (b.gx + b.gy);
    });
    // deploy / placement zone highlight already drawn via grid
    for (const b of sorted) {
      Render.drawBuilding(ctx, b, {
        selected: game.selected === b,
        showHp: true,
        pending: COC.Economy.pending(b),
      });
    }
    // placement ghost
    if (game.placing) {
      const size = COC.BUILDINGS[game.placing.type].size;
      Render.highlightFootprint(ctx, game.placing.gx, game.placing.gy, size,
        game.placing.valid ? 'rgba(80,220,120,0.35)' : 'rgba(230,70,70,0.35)');
      Render.drawBuilding(ctx, { type: game.placing.type, gx: game.placing.gx, gy: game.placing.gy, level: 1, hp: 1 }, { ghost: true });
    } else if (game.hover && game.selected == null) {
      Render.highlightFootprint(ctx, game.hover.gx, game.hover.gy, 1, 'rgba(255,255,255,0.12)');
    }
  };

  Render.battleScene = function (ctx, game) {
    const battle = game.battle;
    // deploy zone shading near edges
    if (game.battle.selectedTroop && game.hover) {
      Render.highlightFootprint(ctx, game.hover.gx, game.hover.gy, 1, 'rgba(80,180,255,0.3)');
    }
    const sorted = battle.buildings.slice().sort(function (a, b) {
      return (a.gx + a.gy) - (b.gx + b.gy);
    });
    for (const b of sorted) {
      if (b.destroyed) { Render.drawRubble(ctx, b); continue; }
      Render.drawBuilding(ctx, b, { showHp: true });
    }
    // troops sorted by depth
    const ts = battle.troops.slice().sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    for (const tr of ts) Render.drawTroop(ctx, tr);
    for (const p of battle.projectiles) Render.drawProjectile(ctx, p);
    for (const f of battle.floaters) Render.drawFloater(ctx, f);
  };

  Render.drawRubble = function (ctx, bld) {
    const size = COC.BUILDINGS[bld.type].size;
    const c = Iso.footprintCenter(bld.gx, bld.gy, size);
    ctx.fillStyle = 'rgba(60,40,30,0.5)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(c.x + (i - 1.5) * 5, c.y + ((i % 2) ? 2 : -2), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  COC.Render = Render;
})(window.COC);
