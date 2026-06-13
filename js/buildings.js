/* buildings.js — building creation, stats lookup, placement & upgrade helpers. */
(function (COC) {
  'use strict';

  const B = {};

  // Stats for a building's CURRENT level (level is 1-based).
  B.stats = function (b) {
    return COC.BUILDINGS[b.type].levels[b.level - 1];
  };

  B.def = function (b) {
    return COC.BUILDINGS[b.type];
  };

  B.maxHp = function (b) {
    return B.stats(b).hp;
  };

  B.isMaxLevel = function (b) {
    return b.level >= COC.BUILDINGS[b.type].levels.length;
  };

  // Data for the NEXT level (what an upgrade buys). Returns null at max.
  B.nextStats = function (b) {
    if (B.isMaxLevel(b)) return null;
    return COC.BUILDINGS[b.type].levels[b.level];
  };

  B.create = function (state, type, gx, gy) {
    const lvl1 = COC.BUILDINGS[type].levels[0];
    const b = {
      id: state.nextId++,
      type: type,
      gx: gx, gy: gy,
      level: 1,
      hp: lvl1.hp,
      stored: 0,
      lastCollect: Date.now(),
      upgrading: false,
      upgradeEndsAt: 0,
    };
    return b;
  };

  B.size = function (b) {
    return COC.BUILDINGS[b.type].size;
  };

  // Tile-rectangle occupancy test.
  B.occupies = function (b, gx, gy) {
    const s = B.size(b);
    return gx >= b.gx && gx < b.gx + s && gy >= b.gy && gy < b.gy + s;
  };

  // Can a footprint of `size` at (gx,gy) be placed given existing buildings? ignore = building being moved.
  B.canPlace = function (state, size, gx, gy, ignore) {
    if (gx < 0 || gy < 0 || gx + size > COC.GRID.cols || gy + size > COC.GRID.rows) return false;
    for (let i = 0; i < state.buildings.length; i++) {
      const o = state.buildings[i];
      if (o === ignore) continue;
      const os = B.size(o);
      // AABB overlap on the tile grid
      if (gx < o.gx + os && gx + size > o.gx && gy < o.gy + os && gy + size > o.gy) {
        return false;
      }
    }
    return true;
  };

  // Count of a given type currently in the village.
  B.count = function (state, type) {
    let n = 0;
    for (const b of state.buildings) if (b.type === type) n++;
    return n;
  };

  // Begin an upgrade (or initial build "upgrade" handled separately). Assumes cost already paid.
  B.startUpgrade = function (b) {
    const next = B.nextStats(b);
    if (!next) return false;
    b.upgrading = true;
    b.upgradeEndsAt = Date.now() + next.time * 1000;
    return true;
  };

  B.finishUpgrade = function (b) {
    b.level += 1;
    b.upgrading = false;
    b.upgradeEndsAt = 0;
    b.hp = B.stats(b).hp; // restore to full at new level
  };

  // Called each frame to auto-complete finished upgrades.
  B.tickUpgrade = function (b) {
    if (b.upgrading && Date.now() >= b.upgradeEndsAt) {
      B.finishUpgrade(b);
      return true;
    }
    return false;
  };

  B.upgradeRemaining = function (b) {
    if (!b.upgrading) return 0;
    return Math.max(0, (b.upgradeEndsAt - Date.now()) / 1000);
  };

  // Instant-finish an upgrade with gems.
  B.gemFinishCost = function (b) {
    const remaining = B.upgradeRemaining(b);
    return Math.max(1, Math.ceil(remaining / 30));
  };

  COC.Buildings = B;
})(window.COC);
