/* battle.js — battle mode: enemy base generation, deploy, spells, scoring, loot, trophies. */
(function (COC) {
  'use strict';

  const Battle = {};
  const T = COC.Troops;
  const C = COC.Combat;

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function lv(def, d) { return Math.min(def.levels.length, Math.max(1, d)); }

  Battle.generateBase = function (d) {
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    const buildings = []; let id = 1;

    function rectFree(gx, gy, size) {
      if (gx < 2 || gy < 2 || gx + size > cols - 2 || gy + size > rows - 2) return false;
      for (const o of buildings) {
        const os = COC.BUILDINGS[o.type].size;
        if (gx < o.gx + os && gx + size > o.gx && gy < o.gy + os && gy + size > o.gy) return false;
      }
      return true;
    }
    function add(type, gx, gy, level, loot) {
      const def = COC.BUILDINGS[type];
      level = lv(def, level);
      const st = def.levels[level - 1];
      buildings.push({ id: id++, type: type, gx: gx, gy: gy, level: level,
        hp: st.hp || 60, maxHp: st.hp || 60, destroyed: false, triggered: false,
        loot: loot || null, atkTimer: 0, revealed: false });
    }
    function near(type, level, loot, spread) {
      const size = COC.BUILDINGS[type].size;
      // try increasingly wide random rings
      for (let s = spread; s <= spread + 8; s += 2) {
        for (let i = 0; i < 60; i++) {
          const gx = cx + rint(-s, s), gy = cy + rint(-s, s);
          if (rectFree(gx, gy, size)) { add(type, gx, gy, level, loot); return true; }
        }
      }
      // guaranteed fallback: scan the whole inner area outward from center
      for (let ring = 1; ring < Math.max(cols, rows); ring++) {
        for (let gx = cx - ring; gx <= cx + ring; gx++) for (let gy = cy - ring; gy <= cy + ring; gy++) {
          if (Math.abs(gx - cx) !== ring && Math.abs(gy - cy) !== ring) continue;
          if (rectFree(gx, gy, size)) { add(type, gx, gy, level, loot); return true; }
        }
      }
      return false;
    }

    add('townhall', cx - 2, cy - 2, Math.min(d + 1, 6), { gold: 400 * d, elixir: 400 * d, dark: d >= 4 ? 40 * d : 0 });

    for (let i = 0; i < 2 + d; i++) near('goldmine', d, { gold: rint(250, 600) * d }, 9);
    for (let i = 0; i < 2 + d; i++) near('elixircollector', d, { elixir: rint(250, 600) * d }, 9);
    near('goldstorage', d, { gold: rint(800, 1600) * d }, 7);
    near('elixirstorage', d, { elixir: rint(800, 1600) * d }, 7);
    if (d >= 4) { near('darkdrill', d - 3, { dark: rint(40, 100) * d }, 7); near('darkstorage', 1, { dark: rint(60, 150) * d }, 6); }

    for (let i = 0; i < 1 + d; i++) near('cannon', d, null, 8);
    for (let i = 0; i < d; i++) near('archertower', Math.max(1, d - 1), null, 8);
    if (d >= 3) near('mortar', d - 2, null, 6);
    if (d >= 4) near('airdefense', d - 3, null, 6);
    if (d >= 5) { near('wizardtower', d - 4, null, 6); near('tesla', d - 4, null, 5); }
    near('barracks', d, null, 10);
    near('armycamp', d, null, 10);

    // traps
    for (let i = 0; i < d; i++) near('bomb', Math.max(1, d - 2), null, 7);
    if (d >= 4) for (let i = 0; i < d - 3; i++) near('springtrap', 1, null, 7);

    // wall ring(s)
    const r = 5 + d;
    const wlvl = Math.min(4, Math.max(1, d - 1));
    for (let gx = cx - r; gx <= cx + r; gx++) { wall(gx, cy - r); wall(gx, cy + r); }
    for (let gy = cy - r; gy <= cy + r; gy++) { wall(cx - r, gy); wall(cx + r, gy); }
    function wall(gx, gy) { if (rectFree(gx, gy, 1)) add('wall', gx, gy, wlvl, null); }

    return buildings;
  };

  Battle.create = function (state, difficulty) {
    const d = Math.max(1, Math.min(6, difficulty || 1));
    const buildings = Battle.generateBase(d);
    let totalCount = 0, totalLoot = { gold: 0, elixir: 0, dark: 0 };
    for (const b of buildings) {
      const def = COC.BUILDINGS[b.type];
      if (!def.wall && !def.trap) totalCount++;
      if (b.loot) for (const k in b.loot) totalLoot[k] = (totalLoot[k] || 0) + b.loot[k];
    }
    const available = {}; for (const k in state.army) available[k] = state.army[k];
    const availableSpells = {}; for (const k in state.spells) availableSpells[k] = state.spells[k];

    const battle = {
      difficulty: d, buildings: buildings, troops: [], projectiles: [], explosions: [], tracers: [],
      floaters: [], zones: [], available: available, availableSpells: availableSpells,
      deployed: 0, totalCount: totalCount, destroyedCount: 0,
      totalLoot: totalLoot, lootGained: { gold: 0, elixir: 0, dark: 0 },
      timeLeft: COC.BATTLE.duration, stars: 0, ended: false, result: null,
      selectedTroop: null, selectedSpell: null, shake: 0, sfx: null,
      trophyWin: 8 + d * 5, trophyLoss: -(4 + d * 3),
      wallGrid: null,
    };
    battle.isWall = function (gx, gy) { return Battle.isWall(battle, gx, gy); };
    Battle.buildWallGrid(battle);
    return battle;
  };

  Battle.buildWallGrid = function (battle) {
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    const g = new Uint8Array(cols * rows);
    for (const b of battle.buildings) {
      if (b.destroyed || !COC.BUILDINGS[b.type].wall) continue;
      g[b.gy * cols + b.gx] = 1;
    }
    battle.wallGrid = g;
  };

  Battle.destructionPct = function (battle) { return battle.totalCount ? battle.destroyedCount / battle.totalCount : 0; };

  Battle.troopsRemaining = function (battle) {
    let n = 0; for (const k in battle.available) n += battle.available[k];
    for (const t of battle.troops) if (!t.dead) n++;
    return n;
  };
  Battle.spellsRemaining = function (battle) {
    let n = 0; for (const k in battle.availableSpells) n += battle.availableSpells[k];
    return n;
  };

  function onBuildingFloater(battle, b) {
    if (!b.loot) return;
    const c = T.buildingCenter(b);
    let i = 0;
    for (const k of ['gold', 'elixir', 'dark']) {
      if (b.loot[k]) { battle.lootGained[k] += b.loot[k];
        battle.floaters.push({ x: c.x, y: c.y - i * 0.4, text: '+' + COC.fmt(b.loot[k]) + COC.RES_ICON[k], color: '#fff', life: 1.1, vy: -0.8 }); i++; }
    }
  }

  Battle.dealDamage = function (battle, bld, amount) {
    if (bld.destroyed) { return; }
    bld.hp -= amount;
    if (bld.hp <= 0) {
      bld.destroyed = true;
      const def = COC.BUILDINGS[bld.type];
      if (def.wall) { Battle.buildWallGrid(battle); return; }
      if (def.trap) return;
      battle.destroyedCount++;
      onBuildingFloater(battle, bld);
      const c = T.buildingCenter(bld);
      battle.explosions.push({ x: c.x, y: c.y, r: 1.4, life: 0.45, max: 0.45 });
      battle.shake = Math.min(10, battle.shake + 4);
      if (battle.sfx) battle.sfx('boom');
    }
  };

  Battle.isWall = function (battle, gx, gy) {
    if (gx < 0 || gy < 0 || gx >= COC.GRID.cols || gy >= COC.GRID.rows) return true;
    return battle.wallGrid[gy * COC.GRID.cols + gx] === 1;
  };

  Battle.deploy = function (battle, type, gx, gy) {
    if (battle.ended || !battle.available[type] || battle.available[type] <= 0) return false;
    for (const b of battle.buildings) {
      if (b.destroyed) continue;
      const s = COC.BUILDINGS[b.type].size;
      if (gx >= b.gx - 0.4 && gx < b.gx + s + 0.4 && gy >= b.gy - 0.4 && gy < b.gy + s + 0.4) return false;
    }
    battle.available[type]--; battle.deployed++;
    battle.troops.push(T.spawn(type, gx, gy));
    battle.explosions.push({ x: gx, y: gy, r: 0.8, life: 0.25, max: 0.25, deploy: true });
    if (battle.sfx) battle.sfx('deploy');
    return true;
  };

  Battle.castSpell = function (battle, type, gx, gy) {
    if (battle.ended || !battle.availableSpells[type] || battle.availableSpells[type] <= 0) return false;
    const sp = COC.SPELLS[type];
    battle.availableSpells[type]--;
    if (sp.type === 'instant') {
      battle.explosions.push({ x: gx, y: gy, r: sp.radius, life: 0.5, max: 0.5, spell: type });
      for (const b of battle.buildings) {
        if (b.destroyed) continue;
        if (T.distToBuilding(gx, gy, b) <= sp.radius) Battle.dealDamage(battle, b, sp.damage);
      }
      for (const tr of battle.troops) if (!tr.dead && Math.hypot(tr.x - gx, tr.y - gy) <= sp.radius) tr.hp -= sp.damage * 0.4;
      battle.shake = Math.min(12, battle.shake + 6);
      if (battle.sfx) battle.sfx('zap');
    } else {
      battle.zones.push({ type: type, x: gx, y: gy, radius: sp.radius, until: Date.now() + sp.duration * 1000 });
      if (battle.sfx) battle.sfx('spell');
    }
    return true;
  };

  Battle.update = function (battle, dt) {
    if (battle.ended) return;
    battle.timeLeft -= dt;
    if (battle.shake > 0) battle.shake = Math.max(0, battle.shake - dt * 30);

    // spell zones (heal / rage)
    const now = Date.now();
    battle.zones = battle.zones.filter(function (z) { return z.until > now; });
    for (const z of battle.zones) {
      const sp = COC.SPELLS[z.type];
      for (const tr of battle.troops) {
        if (tr.dead) continue;
        if (Math.hypot(tr.x - z.x, tr.y - z.y) <= z.radius) {
          if (z.type === 'heal') tr.hp = Math.min(tr.maxHp, tr.hp + sp.heal * dt);
          if (z.type === 'rage') tr.rageUntil = now + 250;
        }
      }
    }

    // troops
    for (const tr of battle.troops) {
      T.update(battle, tr, dt, function (b, dmg) { Battle.dealDamage(battle, b, dmg); });
    }

    C.updateTraps(battle, dt);
    C.updateDefenses(battle, dt);
    C.updateProjectiles(battle, dt);

    battle.troops = battle.troops.filter(function (t) { return !t.dead; });

    for (const f of battle.floaters) { f.y += f.vy * dt; f.life -= dt; }
    battle.floaters = battle.floaters.filter(function (f) { return f.life > 0; });
    for (const e of battle.explosions) e.life -= dt;
    battle.explosions = battle.explosions.filter(function (e) { return e.life > 0; });
    for (const t of battle.tracers) t.life -= dt;
    battle.tracers = battle.tracers.filter(function (t) { return t.life > 0; });

    Battle.checkEnd(battle);
  };

  Battle.computeStars = function (battle) {
    let s = 0; const pct = Battle.destructionPct(battle);
    if (pct >= 0.5) s++;
    const th = battle.buildings.find(function (b) { return b.type === 'townhall'; });
    if (th && th.destroyed) s++;
    if (pct >= 0.999) s++;
    return s;
  };

  Battle.checkEnd = function (battle) {
    if (battle.ended) return;
    const allDown = battle.destroyedCount >= battle.totalCount;
    const noTroops = Battle.troopsRemaining(battle) === 0 && battle.deployed > 0;
    const timeUp = battle.timeLeft <= 0;
    if (allDown || noTroops || timeUp) {
      battle.ended = true;
      battle.stars = Battle.computeStars(battle);
      battle.result = battle.stars >= 1 ? 'victory' : 'defeat';
      if (battle.sfx) battle.sfx(battle.result === 'victory' ? 'win' : 'lose');
    }
  };

  Battle.finalize = function (battle) {
    return {
      stars: battle.stars, result: battle.result,
      gold: Math.floor(battle.lootGained.gold), elixir: Math.floor(battle.lootGained.elixir),
      dark: Math.floor(battle.lootGained.dark),
      destruction: Math.round(Battle.destructionPct(battle) * 100),
      trophies: battle.result === 'victory' ? battle.trophyWin : battle.trophyLoss,
    };
  };

  COC.Battle = Battle;
})(window.COC);
