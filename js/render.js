/* render.js — all canvas drawing for home & battle (stylized 2.5D isometric). */
(function (COC) {
  'use strict';

  const Render = {};
  const Iso = COC.Iso;
  const B = COC.Buildings;
  const T = COC.Troops;

  function bodyHeight(type) {
    const def = COC.BUILDINGS[type];
    if (def.wall) return 16;
    if (def.trap) return 4;
    if (def.category === 'defense') return 26 + def.size * 4;
    if (def.category === 'core') return 46;
    return 22 + def.size * 4;
  }
  function shade(hex, amt) {
    const c = parseInt(hex.slice(1), 16);
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (amt < 0) { const f = 1 + amt; r *= f; g *= f; b *= f; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  Render.applyCamera = function (ctx, cam, canvas, shake) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // sky
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#9fd6ea'); grd.addColorStop(1, '#cde6c0');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(canvas.width / 2 + cam.x + sx, canvas.height / 2 + cam.y + sy);
    ctx.scale(cam.zoom, cam.zoom);
  };

  function decor() {
    if (COC._decor) return COC._decor;
    const list = []; const cols = COC.GRID.cols, rows = COC.GRID.rows;
    let seed = 1337;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (let i = 0; i < 70; i++) {
      const gx = Math.floor(rnd() * (cols + 12)) - 6;
      const gy = Math.floor(rnd() * (rows + 12)) - 6;
      const inside = gx > 4 && gy > 4 && gx < cols - 4 && gy < rows - 4;
      if (inside) continue; // keep play area clear
      list.push({ gx: gx, gy: gy, type: rnd() < 0.7 ? 'tree' : 'rock' });
    }
    COC._decor = list; return list;
  }

  Render.drawGround = function (ctx, mode) {
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    const a = Iso.toScreen(0, 0), b = Iso.toScreen(cols, 0), c = Iso.toScreen(cols, rows), d = Iso.toScreen(0, rows);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.fillStyle = mode === 'battle' ? '#6f9e54' : '#7cb35e'; ctx.fill();
    const tw = COC.GRID.tileW / 2, th = COC.GRID.tileH / 2;
    for (let gx = 0; gx < cols; gx++) for (let gy = 0; gy < rows; gy++) {
      const t = Iso.toScreen(gx, gy);
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + tw, t.y + th); ctx.lineTo(t.x, t.y + th * 2); ctx.lineTo(t.x - tw, t.y + th); ctx.closePath();
      ctx.fillStyle = ((gx + gy) % 2 === 0) ? (mode === 'battle' ? '#79a85e' : '#86bd66') : (mode === 'battle' ? '#6f9e54' : '#7cb35e');
      ctx.fill();
    }
    // border + decorations
    ctx.strokeStyle = 'rgba(80,110,60,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.stroke();
    for (const o of decor()) Render.drawDecor(ctx, o);
  };

  Render.drawDecor = function (ctx, o) {
    const p = Iso.toScreen(o.gx + 0.5, o.gy + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 7, 3.5, 0, 0, 6.28); ctx.fill();
    if (o.type === 'tree') {
      ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x - 1.5, p.y - 10, 3, 10);
      ctx.fillStyle = '#3f8f43'; ctx.beginPath(); ctx.arc(p.x, p.y - 14, 8, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#4fa854'; ctx.beginPath(); ctx.arc(p.x - 3, p.y - 16, 5, 0, 6.28); ctx.fill();
    } else {
      ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(p.x, p.y - 4, 6, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#bdbdbd'; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 6, 3, 0, 6.28); ctx.fill();
    }
  };

  Render.drawGridLines = function (ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    for (let gx = 0; gx <= cols; gx++) { const s = Iso.toScreen(gx, 0), e = Iso.toScreen(gx, rows); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke(); }
    for (let gy = 0; gy <= rows; gy++) { const s = Iso.toScreen(0, gy), e = Iso.toScreen(cols, gy); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke(); }
  };

  Render.highlightFootprint = function (ctx, gx, gy, size, fill) {
    const top = Iso.toScreen(gx, gy), right = Iso.toScreen(gx + size, gy), bottom = Iso.toScreen(gx + size, gy + size), left = Iso.toScreen(gx, gy + size);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  };

  Render.drawBuilding = function (ctx, bld, opts) {
    opts = opts || {};
    const def = COC.BUILDINGS[bld.type];
    const size = def.size;

    // traps: hidden during battle unless triggered; small marker at home
    if (def.trap) {
      if (opts.battle) { if (!bld.triggered) return; }
      const cc = Iso.footprintCenter(bld.gx, bld.gy, size);
      ctx.fillStyle = opts.battle ? 'rgba(0,0,0,0.2)' : 'rgba(40,40,40,0.85)';
      ctx.beginPath(); ctx.arc(cc.x, cc.y - 3, 6, 0, 6.28); ctx.fill();
      ctx.fillStyle = bld.type === 'bomb' ? '#e0563d' : '#7fe07f'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(bld.type === 'bomb' ? '💣' : '⏏', cc.x, cc.y);
      return;
    }
    if (def.hidden && opts.battle && !bld.revealed) {
      // tesla cloaked — faint shimmer only
      const cc = Iso.footprintCenter(bld.gx, bld.gy, size);
      ctx.fillStyle = 'rgba(70,199,224,0.10)'; ctx.beginPath(); ctx.arc(cc.x, cc.y - 6, 8, 0, 6.28); ctx.fill();
      return;
    }

    const h = bodyHeight(bld.type);
    const color = def.color;
    const top = Iso.toScreen(bld.gx, bld.gy), right = Iso.toScreen(bld.gx + size, bld.gy),
      bottom = Iso.toScreen(bld.gx + size, bld.gy + size), left = Iso.toScreen(bld.gx, bld.gy + size);

    // shadow
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();

    const alpha = (bld.constructing || opts.ghost) ? 0.6 : 1;
    ctx.globalAlpha = alpha;
    // left & right faces
    ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(left.x, left.y - h); ctx.closePath();
    ctx.fillStyle = shade(color, -0.35); ctx.fill();
    ctx.beginPath(); ctx.moveTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(right.x, right.y - h); ctx.closePath();
    ctx.fillStyle = shade(color, -0.18); ctx.fill();
    // top face
    ctx.beginPath(); ctx.moveTo(top.x, top.y - h); ctx.lineTo(right.x, right.y - h); ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(left.x, left.y - h); ctx.closePath();
    ctx.fillStyle = shade(color, 0.12); ctx.fill();
    ctx.strokeStyle = opts.selected ? '#fff' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = opts.selected ? 2.5 : 1; ctx.stroke();
    ctx.globalAlpha = 1;

    const cx = (top.x + bottom.x) / 2, cyTop = (top.y + bottom.y) / 2 - h;
    if (bld.constructing) { Render.drawScaffold(ctx, cx, cyTop, h); }
    else { try { Render.drawAccent(ctx, bld, cx, cyTop, h, size, opts); } catch (e) { Render.drawEmblem(ctx, bld, cx, cyTop); } }

    // upgrade/build timer
    if (bld.upgrading) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - 20, cyTop - h - 16, 40, 13);
      ctx.fillStyle = '#7fd0ff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText((bld.constructing ? '🔨 ' : '⏳ ') + COC.fmtTime(B.upgradeRemaining(bld)), cx, cyTop - h - 6);
    }

    // level badge
    if (!opts.ghost && !def.wall) {
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(right.x - 5, right.y - h - 5, 8, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ffd84d'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(bld.level, right.x - 5, right.y - h - 4); ctx.textBaseline = 'alphabetic';
    }

    const maxHp = bld.maxHp != null ? bld.maxHp : B.maxHp(bld);
    if (opts.showHp && bld.hp < maxHp && !bld.destroyed) Render.healthBar(ctx, cx, cyTop - h - (def.wall ? 8 : 26), Math.max(0, bld.hp / maxHp), def.wall ? 18 : 30);

    if (opts.pending && opts.pending > 0) {
      const icon = COC.RES_ICON[def.resource]; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(icon, cx, cyTop - h - 18 + Math.sin(Date.now() / 300) * 2);
    }
  };

  Render.drawScaffold = function (ctx, cx, cy, h) {
    ctx.strokeStyle = '#caa46b'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - 12, cy - h - 8, 24, h + 12);
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - 2); ctx.lineTo(cx + 12, cy - h - 8); ctx.stroke();
  };

  // Per-type stylized top accents (turrets rotate to aimAngle).
  Render.drawAccent = function (ctx, bld, cx, cy, h, size, opts) {
    const def = COC.BUILDINGS[bld.type];
    const aim = bld.aimAngle || 0;
    ctx.save();
    if (def.category === 'defense' && !def.wall) {
      // turret platform
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 6.28); ctx.fill();
      ctx.fillStyle = shade(def.color, 0.25); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 6.28); ctx.fill();
      const bx = cx + Math.cos(aim) * 12, by = cy + Math.sin(aim) * 6;
      if (bld.type === 'cannon') { ctx.strokeStyle = '#333'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke(); }
      else if (bld.type === 'mortar') { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(cx, cy - 2, 5, 0, 6.28); ctx.fill(); }
      else if (bld.type === 'airdefense') { ctx.fillStyle = '#234'; ctx.fillRect(cx - 4, cy - 8, 8, 8); ctx.fillStyle = '#7fd0ff'; ctx.fillRect(cx - 2, cy - 12, 4, 5); }
      else if (bld.type === 'tesla') { ctx.strokeStyle = '#7ff0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 4); ctx.stroke(); ctx.fillStyle = '#7ff0ff'; ctx.beginPath(); ctx.arc(cx, cy - 9, 2.5, 0, 6.28); ctx.fill(); }
      else if (bld.type === 'wizardtower') { ctx.fillStyle = '#7a5cc4'; ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy - 12); ctx.closePath(); ctx.fill(); }
      else { ctx.strokeStyle = '#444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke(); } // archer tower
    } else if (def.category === 'resource') {
      Render.drawEmblem(ctx, bld, cx, cy);
    } else if (def.category === 'core') {
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 8, cy - 4); ctx.lineTo(cx + 8, cy - 20); ctx.stroke();
      ctx.fillStyle = '#e0563d'; ctx.beginPath(); ctx.moveTo(cx + 8, cy - 20); ctx.lineTo(cx + 20, cy - 16); ctx.lineTo(cx + 8, cy - 12); ctx.closePath(); ctx.fill();
      Render.drawEmblem(ctx, bld, cx, cy);
    } else {
      Render.drawEmblem(ctx, bld, cx, cy);
    }
    ctx.restore();
  };

  Render.drawEmblem = function (ctx, bld, cx, cy) {
    const map = { townhall: '🏛', goldmine: '⛏', elixircollector: '🧪', darkdrill: '🌑',
      goldstorage: '🪙', elixirstorage: '💧', darkstorage: '🌑', barracks: '⚔', armycamp: '⛺',
      spellfactory: '✨', buildershut: '🔨', cannon: '', archertower: '🏹', mortar: '', airdefense: '', tesla: '', wizardtower: '' };
    const ch = map[bld.type]; if (!ch) return;
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy - 2); ctx.textBaseline = 'alphabetic';
  };

  Render.healthBar = function (ctx, cx, y, frac, w) {
    w = w || 28; const h = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#333'; ctx.fillRect(cx - w / 2, y, w, h);
    ctx.fillStyle = frac > 0.5 ? '#5ad65a' : frac > 0.25 ? '#f5c518' : '#e74c3c'; ctx.fillRect(cx - w / 2, y, w * frac, h);
  };

  Render.drawTroop = function (ctx, tr) {
    const def = COC.TROOPS[tr.type];
    const p = Iso.toScreen(tr.x, tr.y);
    const air = tr.domain === 'air';
    const lift = air ? 22 : 0;
    const bob = (air ? Math.sin(tr.anim * 0.5) * 2 : Math.abs(Math.sin(tr.anim)) * 2);
    const r = tr.type === 'giant' || tr.type === 'dragon' ? 10 : (tr.type === 'wallbreaker' || tr.type === 'goblin' ? 5 : 6);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, 6.28); ctx.fill();
    const yy = p.y - r - bob - lift;
    if (air) { ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, yy + r); ctx.stroke(); }
    // body
    ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(p.x, yy, r, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    if (Date.now() < tr.rageUntil) { ctx.strokeStyle = '#d36bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, yy, r + 2, 0, 6.28); ctx.stroke(); }
    // eyes (facing)
    const fx = Math.cos(tr.facing) * r * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x + fx - 2, yy - 1, 1.6, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + fx + 2, yy - 1, 1.6, 0, 6.28); ctx.fill();
    if (tr.hp < tr.maxHp) Render.healthBar(ctx, p.x, yy - r - 8, tr.hp / tr.maxHp, 18);
  };

  Render.drawProjectile = function (ctx, p) {
    const s = Iso.toScreen(p.x, p.y);
    if (p.arc) {
      const lift = Math.sin(p.t * Math.PI) * 26;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 3, 1.5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(s.x, s.y - 10 - lift, 4, 0, 6.28); ctx.fill();
    } else {
      ctx.fillStyle = p.color || '#ffcf6b'; ctx.beginPath(); ctx.arc(s.x, s.y - 12, 3, 0, 6.28); ctx.fill();
    }
  };

  Render.drawTracer = function (ctx, t) {
    const a = Iso.toScreen(t.x, t.y), b = Iso.toScreen(t.tx, t.ty);
    ctx.strokeStyle = t.color; ctx.globalAlpha = Math.max(0, t.life / 0.12) * 0.7; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 12); ctx.lineTo(b.x, b.y - 12); ctx.stroke(); ctx.globalAlpha = 1;
  };

  Render.drawExplosion = function (ctx, e) {
    const s = Iso.toScreen(e.x, e.y); const k = 1 - e.life / e.max;
    const rad = (e.deploy ? 14 : 26) * e.r * (0.4 + k);
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.fillStyle = e.spell === 'lightning' ? '#ffe34d' : e.deploy ? '#fff' : '#ffae42';
    ctx.beginPath(); ctx.arc(s.x, s.y - 8, rad, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  };

  Render.drawZone = function (ctx, z) {
    const s = Iso.toScreen(z.x, z.y);
    const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.1;
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = z.type === 'heal' ? '#7fe07f' : '#d36bff';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, z.radius * COC.GRID.tileW / 2, z.radius * COC.GRID.tileH / 2, 0, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  };

  Render.drawFloater = function (ctx, f) {
    const s = Iso.toScreen(f.x, f.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life)); ctx.fillStyle = f.color;
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, s.x, s.y - 30); ctx.fillText(f.text, s.x, s.y - 30); ctx.globalAlpha = 1;
  };

  Render.scene = function (ctx, game) {
    Render.applyCamera(ctx, game.camera, game.canvas, game.mode === 'battle' && game.battle ? game.battle.shake : 0);
    Render.drawGround(ctx, game.mode);
    if (game.mode === 'home' && (game.placing || game.showGrid)) Render.drawGridLines(ctx);
    if (game.mode === 'home') Render.homeScene(ctx, game); else Render.battleScene(ctx, game);
  };

  Render.homeScene = function (ctx, game) {
    const sorted = game.state.buildings.slice().sort(function (a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });
    for (const b of sorted) Render.drawBuilding(ctx, b, { selected: game.selected === b, showHp: true, pending: COC.Economy.pending(b) });
    if (game.placing) {
      const size = COC.BUILDINGS[game.placing.type].size;
      Render.highlightFootprint(ctx, game.placing.gx, game.placing.gy, size, game.placing.valid ? 'rgba(80,220,120,0.35)' : 'rgba(230,70,70,0.35)');
      Render.drawBuilding(ctx, { type: game.placing.type, gx: game.placing.gx, gy: game.placing.gy, level: 1, hp: 1 }, { ghost: true });
    } else if (game.hover && game.selected == null) {
      Render.highlightFootprint(ctx, game.hover.gx, game.hover.gy, 1, 'rgba(255,255,255,0.1)');
    }
  };

  Render.battleScene = function (ctx, game) {
    const battle = game.battle;
    if ((battle.selectedTroop || battle.selectedSpell) && game.hover) {
      const col = battle.selectedSpell ? 'rgba(255,220,80,0.3)' : 'rgba(80,180,255,0.3)';
      Render.highlightFootprint(ctx, game.hover.gx, game.hover.gy, 1, col);
    }
    for (const z of battle.zones) Render.drawZone(ctx, z);
    const sorted = battle.buildings.slice().sort(function (a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });
    for (const b of sorted) { if (b.destroyed && !COC.BUILDINGS[b.type].trap) { Render.drawRubble(ctx, b); continue; } Render.drawBuilding(ctx, b, { showHp: true, battle: true }); }
    const ts = battle.troops.slice().sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    for (const tr of ts) Render.drawTroop(ctx, tr);
    for (const t of battle.tracers) Render.drawTracer(ctx, t);
    for (const p of battle.projectiles) Render.drawProjectile(ctx, p);
    for (const e of battle.explosions) Render.drawExplosion(ctx, e);
    for (const f of battle.floaters) Render.drawFloater(ctx, f);
  };

  Render.drawRubble = function (ctx, bld) {
    const c = Iso.footprintCenter(bld.gx, bld.gy, COC.BUILDINGS[bld.type].size);
    ctx.fillStyle = 'rgba(60,40,30,0.5)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(c.x + (i - 1.5) * 5, c.y + ((i % 2) ? 2 : -2), 3, 0, 6.28); ctx.fill(); }
  };

  COC.Render = Render;
})(window.COC);
