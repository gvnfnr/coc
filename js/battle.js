/* battle.js — battle mode: enemy base generation, deployment, simulation, scoring. */
(function (COC) {
  'use strict';

  const Battle = {};
  const T = COC.Troops;
  const C = COC.Combat;

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  // Build a randomized enemy base. Returns an array of building objects with loot.
  Battle.generateBase = function (difficulty) {
    const buildings = [];
    const cols = COC.GRID.cols, rows = COC.GRID.rows;
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    let nextId = 1;
    const lvl = Math.max(1, Math.min(3, difficulty || 1));

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
      level = Math.min(level, def.levels.length);
      const stats = def.levels[level - 1];
      buildings.push({
        id: nextId++, type: type, gx: gx, gy: gy, level: level,
        hp: stats.hp, maxHp: stats.hp, destroyed: false,
        loot: loot || { gold: 0, elixir: 0 }, atkTimer: 0,
      });
    }
    function tryAddNear(type, level, loot, spread) {
      const size = COC.BUILDINGS[type].size;
      for (let i = 0; i < 60; i++) {
        const gx = cx + rint(-spread, spread);
        const gy = cy + rint(-spread, spread);
        if (rectFree(gx, gy, size)) { add(type, gx, gy, level, loot); return true; }
      }
      return false;
    }

    // Town hall in the middle, holds a chunk of loot.
    add('townhall', cx - 1, cy - 1, Math.min(lvl + 1, 4), { gold: 300 * lvl, elixir: 300 * lvl });

    // Resource buildings & storages with loot.
    for (let i = 0; i < 2 + lvl; i++) tryAddNear('goldmine', lvl, { gold: rint(200, 500) * lvl, elixir: 0 }, 8);
    for (let i = 0; i < 2 + lvl; i++) tryAddNear('elixircollector', lvl, { gold: 0, elixir: rint(200, 500) * lvl }, 8);
    tryAddNear('goldstorage', lvl, { gold: rint(500, 1200) * lvl, elixir: 0 }, 6);
    tryAddNear('elixirstorage', lvl, { gold: 0, elixir: rint(500, 1200) * lvl }, 6);

    // Defenses.
    for (let i = 0; i < 1 + lvl; i++) tryAddNear('cannon', lvl, null, 7);
    for (let i = 0; i < lvl; i++) tryAddNear('archertower', Math.max(1, lvl - 1), null, 7);
    tryAddNear('barracks', lvl, null, 9);
    tryAddNear('armycamp', lvl, null, 9);

    // A ring of walls around the core.
    const r = 4 + lvl;
    for (let gx = cx - r; gx <= cx + r; gx++) {
      placeWall(gx, cy - r); placeWall(gx, cy + r);
    }
    for (let gy = cy - r; gy <= cy + r; gy++) {
      placeWall(cx - r, gy); placeWall(cx + r, gy);
    }
    function placeWall(gx, gy) {
      if (rectFree(gx, gy, 1)) add('wall', gx, gy, Math.min(lvl, 3), null);
    }

    return buildings;
  };

  Battle.create = function (state, difficulty) {
    const buildings = Battle.generateBase(difficulty);
    let totalLoot = { gold: 0, elixir: 0 }, totalHp = 0;
    for (const b of buildings) {
      totalHp += b.maxHp;
      if (b.loot) { totalLoot.gold += b.loot.gold; totalLoot.elixir += b.loot.elixir; }
    }
    // available troops = snapshot of ready army
    const available = {};
    for (const k in state.army) available[k] = state.army[k];

    return {
      difficulty: difficulty || 1,
      buildings: buildings,
      troops: [],
      projectiles: [],
      floaters: [],
      available: available,
      deployed: 0,
      totalCount: buildings.length,
      destroyedCount: 0,
      totalHp: totalHp,
      totalLoot: totalLoot,
      lootGained: { gold: 0, elixir: 0 },
      timeLeft: COC.BATTLE.duration,
      stars: 0,
      ended: false,
      result: null,        // 'victory' | 'defeat'
      selectedTroop: null,
    };
  };

  Battle.destructionPct = function (battle) {
    if (!battle.totalCount) return 0;
    return battle.destroyedCount / battle.totalCount;
  };

  Battle.troopsRemaining = function (battle) {
    let n = 0;
    for (const k in battle.available) n += battle.available[k];
    for (const tr of battle.troops) if (!tr.dead) n++;
    return n;
  };

  Battle.deploy = function (battle, type, gx, gy) {
    if (battle.ended) return false;
    if (!battle.available[type] || battle.available[type] <= 0) return false;
    // can't deploy onto a building footprint
    for (const b of battle.buildings) {
      if (b.destroyed) continue;
      const s = COC.BUILDINGS[b.type].size;
      if (gx >= b.gx - 0.5 && gx < b.gx + s + 0.5 && gy >= b.gy - 0.5 && gy < b.gy + s + 0.5) return false;
    }
    battle.available[type]--;
    battle.deployed++;
    battle.troops.push(T.spawn(battle, type, gx, gy));
    return true;
  };

  function addFloater(battle, x, y, text, color) {
    battle.floaters.push({ x: x, y: y, text: text, color: color, life: 1.0, vy: -0.8 });
  }

  Battle.update = function (battle, dt) {
    if (battle.ended) return;
    battle.timeLeft -= dt;

    // troops attack buildings
    for (const tr of battle.troops) {
      T.update(battle, tr, dt, function (bld, dmg, troop) {
        if (bld.hp <= 0 && !bld.destroyed) {
          bld.destroyed = true;
          battle.destroyedCount++;
          if (bld.loot && (bld.loot.gold || bld.loot.elixir)) {
            const g = bld.loot.gold, e = bld.loot.elixir;
            battle.lootGained.gold += g;
            battle.lootGained.elixir += e;
            const c = T.buildingCenter(bld);
            if (g) addFloater(battle, c.x, c.y, '+' + COC.fmt(g) + 'g', '#ffd84d');
            if (e) addFloater(battle, c.x, c.y - 0.4, '+' + COC.fmt(e) + 'e', '#d36bff');
          }
        }
      });
    }

    // defenses fire, projectiles resolve
    C.updateDefenses(battle, dt);
    C.updateProjectiles(battle, dt, function (troop, dmg) {
      if (troop.hp <= 0 && !troop.dead) {
        troop.dead = true;
      }
    });

    // clear dead troops occasionally (keep for fade? just remove)
    battle.troops = battle.troops.filter(function (t) { return !t.dead; });

    // floaters
    for (const f of battle.floaters) { f.y += f.vy * dt; f.life -= dt; }
    battle.floaters = battle.floaters.filter(function (f) { return f.life > 0; });

    Battle.checkEnd(battle);
  };

  Battle.computeStars = function (battle) {
    let stars = 0;
    const pct = Battle.destructionPct(battle);
    if (pct >= 0.5) stars++;
    const th = battle.buildings.find(function (b) { return b.type === 'townhall'; });
    if (th && th.destroyed) stars++;
    if (pct >= 0.999) stars++;
    return stars;
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
    }
  };

  // What the player keeps. (Loot already accumulated as buildings fell.)
  Battle.finalize = function (battle) {
    return {
      stars: battle.stars,
      result: battle.result,
      gold: Math.floor(battle.lootGained.gold),
      elixir: Math.floor(battle.lootGained.elixir),
      destruction: Math.round(Battle.destructionPct(battle) * 100),
    };
  };

  COC.Battle = Battle;
})(window.COC);
