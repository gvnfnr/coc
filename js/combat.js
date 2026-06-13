/* combat.js — defensive buildings targeting troops + projectile simulation. */
(function (COC) {
  'use strict';

  const C = {};
  const T = COC.Troops;

  C.buildingCenter = T.buildingCenter;

  // Defenses scan for the nearest living troop in range and fire on cooldown.
  C.updateDefenses = function (battle, dt) {
    for (const b of battle.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (b.destroyed || def.category !== 'defense' || def.wall) continue;
      const s = COC.BUILDINGS[b.type].levels[b.level - 1];
      b.atkTimer = (b.atkTimer || 0) - dt;

      const c = T.buildingCenter(b);
      let target = null, bestD = Infinity;
      for (const tr of battle.troops) {
        if (tr.dead) continue;
        const d = Math.hypot(tr.x - c.x, tr.y - c.y);
        if (d <= s.range && d < bestD) { bestD = d; target = tr; }
      }
      if (target && b.atkTimer <= 0) {
        b.atkTimer = s.atkSpeed;
        const dmg = s.dps * s.atkSpeed;
        battle.projectiles.push({
          x: c.x, y: c.y,
          target: target,
          speed: 14,
          dmg: dmg,
          color: b.type === 'cannon' ? '#ffcf6b' : '#9be37a',
        });
      }
    }
  };

  // Move projectiles toward their target troop; on hit, apply damage.
  C.updateProjectiles = function (battle, dt, onTroopHit) {
    const live = [];
    for (const p of battle.projectiles) {
      if (!p.target || p.target.dead) continue; // fizzle
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.4) {
        p.target.hp -= p.dmg;
        onTroopHit(p.target, p.dmg);
        continue;
      }
      const m = d || 1;
      p.x += (dx / m) * p.speed * dt;
      p.y += (dy / m) * p.speed * dt;
      live.push(p);
    }
    battle.projectiles = live;
  };

  COC.Combat = C;
})(window.COC);
