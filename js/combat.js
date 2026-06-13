/* combat.js — defensive buildings, projectiles (homing + lobbed splash), traps. */
(function (COC) {
  'use strict';

  const C = {};
  const T = COC.Troops;

  function domainMatch(targets, domain) {
    if (targets === 'any') return true;
    return targets === domain;
  }

  C.updateDefenses = function (battle, dt) {
    for (const b of battle.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (b.destroyed || def.category !== 'defense' || def.wall || b.upgrading || b.constructing) continue;
      const s = COC.BUILDINGS[b.type].levels[b.level - 1];
      const c = T.buildingCenter(b);
      b.atkTimer = (b.atkTimer || 0) - dt;

      // pick nearest valid troop
      let target = null, bd = Infinity;
      for (const tr of battle.troops) {
        if (tr.dead || !domainMatch(def.targets, tr.domain)) continue;
        const d = Math.hypot(tr.x - c.x, tr.y - c.y);
        if (d > s.range) continue;
        if (def.minRange && d < def.minRange) continue; // mortar blind spot
        if (d < bd) { bd = d; target = tr; }
      }

      // hidden tesla cloak
      if (def.hidden) b.revealed = b.revealed || !!target;

      if (target) {
        b.aimAngle = Math.atan2(target.y - c.y, target.x - c.x);
        if (b.atkTimer <= 0) {
          b.atkTimer = s.atkSpeed;
          const dmg = s.dps * s.atkSpeed;
          if (def.arc) {
            // mortar: lob at the troop's CURRENT position (non-homing), splash on impact
            battle.projectiles.push({ x: c.x, y: c.y, sx: c.x, sy: c.y, lx: target.x, ly: target.y,
              t: 0, dur: Math.max(0.4, bd / 9), dmg: dmg, splash: def.splash, domain: def.targets,
              color: '#3a3a3a', arc: true });
          } else {
            battle.projectiles.push({ x: c.x, y: c.y, target: target, speed: 16, dmg: dmg,
              splash: def.splash || 0, domain: def.targets, color: C.boltColor(b.type), arc: false });
          }
          if (battle.sfx) battle.sfx(def.arc ? 'thunk' : 'shoot');
        }
      }
    }
  };

  C.boltColor = function (type) {
    switch (type) {
      case 'cannon': return '#ffcf6b';
      case 'archertower': return '#9be37a';
      case 'airdefense': return '#7fd0ff';
      case 'wizardtower': return '#c49bff';
      case 'tesla': return '#7ff0ff';
      default: return '#ffd';
    }
  };

  function hitTroops(battle, x, y, radius, dmg, domain, onHit) {
    for (const tr of battle.troops) {
      if (tr.dead || !domainMatch(domain, tr.domain)) continue;
      if (Math.hypot(tr.x - x, tr.y - y) <= radius) { tr.hp -= dmg; if (onHit) onHit(tr); }
    }
  }

  C.updateProjectiles = function (battle, dt) {
    const live = [];
    for (const p of battle.projectiles) {
      if (p.arc) {
        p.t += dt / p.dur;
        if (p.t >= 1) {
          battle.explosions.push({ x: p.lx, y: p.ly, r: (p.splash || 1) , life: 0.35, max: 0.35 });
          hitTroops(battle, p.lx, p.ly, p.splash || 1, p.dmg, p.domain);
          if (battle.sfx) battle.sfx('boom');
          continue;
        }
        p.x = p.sx + (p.lx - p.sx) * p.t;
        p.y = p.sy + (p.ly - p.sy) * p.t;
        live.push(p);
      } else {
        if (!p.target || p.target.dead) continue;
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0.4) {
          if (p.splash) hitTroops(battle, p.target.x, p.target.y, p.splash, p.dmg, p.domain);
          else p.target.hp -= p.dmg;
          continue;
        }
        p.x += (dx / d) * p.speed * dt; p.y += (dy / d) * p.speed * dt;
        live.push(p);
      }
    }
    battle.projectiles = live;
  };

  // Traps trigger on proximity of ground troops.
  C.updateTraps = function (battle, dt) {
    for (const b of battle.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (!def.trap || b.triggered || b.destroyed) continue;
      const c = T.buildingCenter(b);
      let near = null;
      for (const tr of battle.troops) {
        if (tr.dead || tr.domain !== 'ground') continue;
        if (Math.hypot(tr.x - c.x, tr.y - c.y) <= 1.4) { near = tr; break; }
      }
      if (!near) continue;
      const s = COC.BUILDINGS[b.type].levels[b.level - 1];
      b.triggered = true; b.destroyed = true;
      if (def.type !== 'spring' && b.type === 'bomb') {
        battle.explosions.push({ x: c.x, y: c.y, r: def.splash, life: 0.4, max: 0.4 });
        hitTroops(battle, c.x, c.y, def.splash, s.dmg, 'ground');
        if (battle.sfx) battle.sfx('boom');
      } else if (b.type === 'springtrap') {
        let ejected = 0;
        for (const tr of battle.troops) {
          if (tr.dead || tr.domain !== 'ground') continue;
          if (Math.hypot(tr.x - c.x, tr.y - c.y) <= 1.6 && ejected < s.capacity) { tr.dead = true; ejected++; }
        }
        battle.explosions.push({ x: c.x, y: c.y, r: 1.2, life: 0.3, max: 0.3 });
        if (battle.sfx) battle.sfx('spring');
      }
    }
  };

  COC.Combat = C;
})(window.COC);
