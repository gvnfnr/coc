/* troops.js — battle troop entities: spawning, targeting, movement, melee/ranged attack. */
(function (COC) {
  'use strict';

  const T = {};
  const B = COC.Buildings;

  // Center point (grid coords) of a building.
  T.buildingCenter = function (bld) {
    const s = COC.BUILDINGS[bld.type].size;
    return { x: bld.gx + s / 2, y: bld.gy + s / 2 };
  };

  // Shortest distance (in tiles) from point (px,py) to a building's footprint rectangle.
  T.distToBuilding = function (px, py, bld) {
    const s = COC.BUILDINGS[bld.type].size;
    const x0 = bld.gx, y0 = bld.gy, x1 = bld.gx + s, y1 = bld.gy + s;
    const dx = Math.max(x0 - px, 0, px - x1);
    const dy = Math.max(y0 - py, 0, py - y1);
    return Math.hypot(dx, dy);
  };

  T.spawn = function (battle, type, x, y) {
    const def = COC.TROOPS[type];
    return {
      type: type,
      x: x, y: y,
      hp: def.hp, maxHp: def.hp,
      target: null,
      atkTimer: 0,
      dead: false,
      anim: Math.random() * Math.PI * 2,
    };
  };

  // Choose a target building for a troop. Giants prefer defenses.
  T.pickTarget = function (battle, troop) {
    const def = COC.TROOPS[troop.type];
    let best = null, bestD = Infinity;
    const live = battle.buildings.filter(function (b) { return !b.destroyed; });

    let pool = live;
    if (def.prefers === 'defense') {
      const defenses = live.filter(function (b) { return COC.BUILDINGS[b.type].category === 'defense' && !COC.BUILDINGS[b.type].wall; });
      if (defenses.length) pool = defenses;
    }
    // Avoid targeting walls directly unless they're all that's left.
    let nonWall = pool.filter(function (b) { return !COC.BUILDINGS[b.type].wall; });
    if (nonWall.length) pool = nonWall;

    for (const b of pool) {
      const d = T.distToBuilding(troop.x, troop.y, b);
      if (d < bestD) { bestD = d; best = b; }
    }
    troop.target = best;
    return best;
  };

  // Find a wall that blocks the straight path toward the troop's target (so troops smash walls).
  T.blockingWall = function (battle, troop) {
    if (!troop.target) return null;
    const tc = T.buildingCenter(troop.target);
    const dx = tc.x - troop.x, dy = tc.y - troop.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return null;
    // sample a short step ahead
    const step = 0.8;
    const sx = troop.x + (dx / dist) * step;
    const sy = troop.y + (dy / dist) * step;
    for (const b of battle.buildings) {
      if (b.destroyed || !COC.BUILDINGS[b.type].wall) continue;
      const s = COC.BUILDINGS[b.type].size;
      if (sx >= b.gx && sx < b.gx + s && sy >= b.gy && sy < b.gy + s) return b;
    }
    return null;
  };

  // Per-frame update for one troop. Returns floaters/damage events via callbacks.
  T.update = function (battle, troop, dt, onDamage) {
    if (troop.dead) return;
    const def = COC.TROOPS[troop.type];
    troop.anim += dt * 8;

    // (re)acquire target if missing or destroyed
    if (!troop.target || troop.target.destroyed) {
      // a blocking wall takes priority once we have a primary target
      T.pickTarget(battle, troop);
    }
    if (!troop.target) return; // nothing left

    // Check for a wall in the way; if so, attack it instead.
    let attackTarget = troop.target;
    const wall = T.blockingWall(battle, troop);
    if (wall && wall !== troop.target) attackTarget = wall;

    const d = T.distToBuilding(troop.x, troop.y, attackTarget);

    if (d <= def.range) {
      // in range — attack
      troop.atkTimer -= dt;
      const dmg = def.dps * dt;
      attackTarget.hp -= dmg;
      onDamage(attackTarget, dmg, troop);
    } else {
      // move toward attackTarget's nearest edge / center
      const c = T.buildingCenter(attackTarget);
      let dx = c.x - troop.x, dy = c.y - troop.y;
      const m = Math.hypot(dx, dy) || 1;
      troop.x += (dx / m) * def.speed * dt;
      troop.y += (dy / m) * def.speed * dt;
    }
  };

  COC.Troops = T;
})(window.COC);
