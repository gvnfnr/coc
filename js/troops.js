/* troops.js — battle troop AI: targeting, pathfinding, melee/ranged/splash, healing, wall-breaking. */
(function (COC) {
  'use strict';

  const T = {};

  T.buildingCenter = function (b) {
    const s = COC.BUILDINGS[b.type].size;
    return { x: b.gx + s / 2, y: b.gy + s / 2 };
  };
  T.distToBuilding = function (px, py, b) {
    const s = COC.BUILDINGS[b.type].size;
    const dx = Math.max(b.gx - px, 0, px - (b.gx + s));
    const dy = Math.max(b.gy - py, 0, py - (b.gy + s));
    return Math.hypot(dx, dy);
  };

  T.spawn = function (type, x, y) {
    const def = COC.TROOPS[type];
    return {
      type: type, x: x, y: y, hp: def.hp, maxHp: def.hp,
      target: null, path: null, pi: 0, pathTimer: 0, atkTimer: 0,
      dead: false, anim: Math.random() * 6.28, facing: 0,
      rageUntil: 0, domain: def.domain,
    };
  };

  function live(battle) { return battle.buildings.filter(function (b) { return !b.destroyed && !COC.BUILDINGS[b.type].trap; }); }

  T.pickTarget = function (battle, troop) {
    const def = COC.TROOPS[troop.type];
    const all = live(battle);
    if (all.length === 0) { troop.target = null; return null; }
    let pool = all;
    if (def.prefers === 'defense') {
      const d = all.filter(function (b) { return COC.BUILDINGS[b.type].category === 'defense' && !COC.BUILDINGS[b.type].wall; });
      if (d.length) pool = d;
    } else if (def.prefers === 'resource') {
      const r = all.filter(function (b) { return COC.BUILDINGS[b.type].category === 'resource'; });
      if (r.length) pool = r;
    } else if (def.prefers === 'wall') {
      const w = all.filter(function (b) { return COC.BUILDINGS[b.type].wall; });
      pool = w.length ? w : all.filter(function (b) { return !COC.BUILDINGS[b.type].wall; });
    }
    // exclude bare walls for non-wallbreakers unless walls are all that remain
    if (def.prefers !== 'wall') {
      const nonWall = pool.filter(function (b) { return !COC.BUILDINGS[b.type].wall; });
      if (nonWall.length) pool = nonWall;
    }
    let best = null, bd = Infinity;
    for (const b of pool) { const d = T.distToBuilding(troop.x, troop.y, b); if (d < bd) { bd = d; best = b; } }
    troop.target = best; troop.path = null;
    return best;
  };

  // Nearest damaged friendly ground troop (for healer).
  function nearestWounded(battle, troop) {
    let best = null, bd = Infinity;
    for (const o of battle.troops) {
      if (o === troop || o.dead || o.domain !== 'ground') continue;
      const d = Math.hypot(o.x - troop.x, o.y - troop.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function moveToward(troop, tx, ty, speed, dt) {
    let dx = tx - troop.x, dy = ty - troop.y;
    const m = Math.hypot(dx, dy);
    if (m < 1e-4) return 0;
    troop.facing = Math.atan2(dy, dx);
    const step = speed * dt;
    troop.x += (dx / m) * Math.min(step, m);
    troop.y += (dy / m) * Math.min(step, m);
    return m;
  }

  // Follow / (re)compute an A* path for ground troops, then step along it.
  function navigateGround(battle, troop, goalB, speed, dt) {
    troop.pathTimer -= dt;
    const c = T.buildingCenter(goalB);
    if (!troop.path || troop.pathTimer <= 0 || troop.pi >= (troop.path ? troop.path.length : 0)) {
      troop.path = COC.Path.find(function (gx, gy) { return battle.isWall(gx, gy); },
        Math.floor(troop.x), Math.floor(troop.y), Math.floor(c.x), Math.floor(c.y));
      troop.pi = 0; troop.pathTimer = 0.6;
    }
    if (!troop.path) {
      // walled off — charge the nearest standing wall toward the goal
      const w = nearestWall(battle, troop);
      if (w) { troop.wallTarget = w; const wc = T.buildingCenter(w); moveToward(troop, wc.x, wc.y, speed, dt); return; }
      moveToward(troop, c.x, c.y, speed, dt); // give up, straight line
      return;
    }
    troop.wallTarget = null;
    // advance to current waypoint
    let wp = troop.path[troop.pi];
    if (wp) {
      const d = Math.hypot(wp.x - troop.x, wp.y - troop.y);
      if (d < 0.35) { troop.pi++; wp = troop.path[troop.pi]; }
      if (wp) moveToward(troop, wp.x, wp.y, speed, dt);
    } else {
      moveToward(troop, c.x, c.y, speed, dt);
    }
  }

  function nearestWall(battle, troop) {
    let best = null, bd = Infinity;
    for (const b of battle.buildings) {
      if (b.destroyed || !COC.BUILDINGS[b.type].wall) continue;
      const d = T.distToBuilding(troop.x, troop.y, b);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  T.update = function (battle, troop, dt, dealDamage) {
    if (troop.dead) return;
    const def = COC.TROOPS[troop.type];
    troop.anim += dt * 8;
    const raged = Date.now() < troop.rageUntil;
    const speed = def.speed * (raged ? 1.6 : 1);
    const dpsMul = raged ? 1.6 : 1;

    // ----- Healer: support, no attacks -----
    if (def.heal) {
      const w = nearestWounded(battle, troop);
      if (w) {
        const d = Math.hypot(w.x - troop.x, w.y - troop.y);
        if (d > def.range) moveToward(troop, w.x, w.y, speed, dt);
        else {
          for (const o of battle.troops) {
            if (o.dead || o.domain !== 'ground') continue;
            if (Math.hypot(o.x - troop.x, o.y - troop.y) <= def.range)
              o.hp = Math.min(o.maxHp, o.hp + def.heal * dt);
          }
        }
      }
      return;
    }

    // ----- Wall Breaker: charge nearest wall and detonate -----
    if (def.prefers === 'wall') {
      let w = troop.target && !troop.target.destroyed ? troop.target : T.pickTarget(battle, troop);
      if (!w) return;
      const d = T.distToBuilding(troop.x, troop.y, w);
      if (d <= def.range) {
        const ccenter = T.buildingCenter(w);
        const burst = w.maxHp * 1.2 + def.dps * def.wallDmgMult; // obliterate the segment
        for (const b of battle.buildings) {
          if (b.destroyed) continue;
          if (T.distToBuilding(ccenter.x, ccenter.y, b) <= 1.2)
            dealDamage(b, COC.BUILDINGS[b.type].wall ? burst : def.dps * def.wallDmgMult * 0.3, troop);
        }
        battle.explosions.push({ x: ccenter.x, y: ccenter.y, r: 1.4, life: 0.4, max: 0.4 });
        if (battle.sfx) battle.sfx('boom');
        troop.dead = true;
      } else {
        const c = T.buildingCenter(w); moveToward(troop, c.x, c.y, speed, dt);
      }
      return;
    }

    // ----- Acquire / refresh target -----
    if (!troop.target || troop.target.destroyed) T.pickTarget(battle, troop);
    if (!troop.target) return;
    const tgt = troop.target;
    const d = T.distToBuilding(troop.x, troop.y, tgt);

    if (d <= def.range) {
      // attack (with optional splash)
      troop.atkTimer -= dt;
      const center = T.buildingCenter(tgt);
      troop.facing = Math.atan2(center.y - troop.y, center.x - troop.x);
      const dmg = def.dps * dpsMul * dt * (def.resourceBonus && COC.BUILDINGS[tgt.type].category === 'resource' ? def.resourceBonus : 1);
      if (def.splash) {
        for (const b of battle.buildings) {
          if (b.destroyed) continue;
          if (T.distToBuilding(center.x, center.y, b) <= def.splash) dealDamage(b, dmg, troop);
        }
      } else {
        dealDamage(tgt, dmg, troop);
      }
      // ranged visual tracer
      if (def.range > 1.2 && (troop.atkTimer <= 0)) {
        troop.atkTimer = 0.4;
        battle.tracers.push({ x: troop.x, y: troop.y - 0.4, tx: center.x, ty: center.y, life: 0.12, color: def.color });
      }
    } else {
      if (troop.domain === 'air') {
        const c = T.buildingCenter(tgt); moveToward(troop, c.x, c.y, speed, dt);
      } else {
        navigateGround(battle, troop, tgt, speed, dt);
      }
    }
  };

  COC.Troops = T;
})(window.COC);
