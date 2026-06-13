/* buildings.js — building creation, stats, placement, gating, construction & upgrades. */
(function (COC) {
  'use strict';

  const B = {};

  B.def = function (b) { return COC.BUILDINGS[b.type]; };
  B.stats = function (b) { return COC.BUILDINGS[b.type].levels[b.level - 1]; };
  B.maxHp = function (b) { return B.stats(b).hp || 1; };
  B.isMaxLevel = function (b) { return b.level >= COC.BUILDINGS[b.type].levels.length; };
  B.nextStats = function (b) { return B.isMaxLevel(b) ? null : COC.BUILDINGS[b.type].levels[b.level]; };
  B.size = function (b) { return COC.BUILDINGS[b.type].size; };

  // Busy = a builder is occupied (construction or upgrade). Functional = usable now.
  B.isBusy = function (b) { return !!b.upgrading; };
  B.isFunctional = function (b) { return !b.upgrading && !b.constructing; };

  B.create = function (state, type, gx, gy) {
    const lvl1 = COC.BUILDINGS[type].levels[0];
    return {
      id: state.nextId++, type: type, gx: gx, gy: gy, level: 1,
      hp: lvl1.hp || 1, stored: 0, lastCollect: Date.now(),
      upgrading: false, constructing: false, upgradeEndsAt: 0,
    };
  };

  B.occupies = function (b, gx, gy) {
    const s = B.size(b);
    return gx >= b.gx && gx < b.gx + s && gy >= b.gy && gy < b.gy + s;
  };

  B.canPlace = function (state, size, gx, gy, ignore) {
    if (gx < 0 || gy < 0 || gx + size > COC.GRID.cols || gy + size > COC.GRID.rows) return false;
    for (let i = 0; i < state.buildings.length; i++) {
      const o = state.buildings[i];
      if (o === ignore) continue;
      const os = B.size(o);
      if (gx < o.gx + os && gx + size > o.gx && gy < o.gy + os && gy + size > o.gy) return false;
    }
    return true;
  };

  B.count = function (state, type) {
    let n = 0;
    for (const b of state.buildings) if (b.type === type) n++;
    return n;
  };

  // ---- Town Hall gating ----
  B.thLevel = function (state) {
    const th = state.buildings.find(function (b) { return b.type === 'townhall'; });
    return th ? th.level : 1;
  };
  B.maxAllowed = function (state, type) {
    const def = COC.BUILDINGS[type];
    const th = B.thLevel(state);
    if (def.maxByTH) return def.maxByTH[Math.min(th, def.maxByTH.length) - 1] || 0;
    if (def.max) return def.max;
    return Infinity;
  };
  B.thRequirement = function (type) { return COC.BUILDINGS[type].minTH || 1; };
  // Why can't I build another of this type? Returns null if buildable.
  B.buildBlockReason = function (state, type) {
    const def = COC.BUILDINGS[type];
    const th = B.thLevel(state);
    if (def.minTH && th < def.minTH) return 'TH ' + def.minTH;
    if (B.count(state, type) >= B.maxAllowed(state, type)) return 'Max';
    return null;
  };

  // ---- Construction (new building) ----
  B.startBuild = function (b) {
    const t = B.stats(b).time || 0;
    if (t <= 0) { b.upgrading = false; b.constructing = false; return false; }
    b.constructing = true; b.upgrading = true;
    b.upgradeEndsAt = Date.now() + t * 1000;
    return true; // occupies a builder
  };

  // ---- Upgrade ----
  B.startUpgrade = function (b) {
    const next = B.nextStats(b);
    if (!next) return false;
    b.upgrading = true; b.constructing = false;
    b.upgradeEndsAt = Date.now() + (next.time || 0) * 1000;
    return true;
  };
  B.finishUpgrade = function (b) {
    if (b.constructing) { b.constructing = false; b.upgrading = false; b.hp = B.stats(b).hp || 1; return; }
    b.level += 1; b.upgrading = false; b.hp = B.stats(b).hp || 1;
    b.upgradeEndsAt = 0;
  };
  B.tickUpgrade = function (b) {
    if (b.upgrading && Date.now() >= b.upgradeEndsAt) { B.finishUpgrade(b); return true; }
    return false;
  };
  B.upgradeRemaining = function (b) { return b.upgrading ? Math.max(0, (b.upgradeEndsAt - Date.now()) / 1000) : 0; };
  B.gemFinishCost = function (b) { return Math.max(1, Math.ceil(B.upgradeRemaining(b) / 20)); };

  COC.Buildings = B;
})(window.COC);
