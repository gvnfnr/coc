/* economy.js — resource generation, collection, training queue. */
(function (COC) {
  'use strict';

  const Eco = {};
  const B = COC.Buildings;

  // Accumulate production into each collector's internal store (capped). Called every frame.
  Eco.tick = function (state) {
    const now = Date.now();
    for (const b of state.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (def.category !== 'resource' || !def.resource) continue;
      if (b.upgrading) { b.lastCollect = now; continue; }
      const s = B.stats(b);
      const dt = (now - b.lastCollect) / 1000;
      if (dt <= 0) continue;
      const perSec = s.rate / 3600; // rate is per hour
      b.stored = Math.min(s.cap, (b.stored || 0) + perSec * dt);
      b.lastCollect = now;
    }
  };

  // How much is sitting in a collector ready to grab.
  Eco.pending = function (b) {
    const def = COC.BUILDINGS[b.type];
    if (def.category !== 'resource' || !def.resource) return 0;
    return Math.floor(b.stored || 0);
  };

  // Collect from a single collector into storage. Returns {kind, amount} or null.
  Eco.collect = function (state, b) {
    const def = COC.BUILDINGS[b.type];
    if (def.category !== 'resource' || !def.resource) return null;
    const amount = Math.floor(b.stored || 0);
    if (amount <= 0) return null;
    const added = COC.State.addResource(state, def.resource, amount);
    b.stored = (b.stored || 0) - amount; // even if storage full, drain collector
    return { kind: def.resource, amount: added };
  };

  // ---- Training queue ----
  Eco.canTrain = function (state, troopType) {
    const t = COC.TROOPS[troopType];
    if (!COC.State.unlockedTroops(state)[troopType]) return { ok: false, reason: 'Locked' };
    if (!COC.State.canAfford(state, t.cost)) return { ok: false, reason: 'Need elixir' };
    const cap = COC.State.armyCapacity(state);
    const used = COC.State.armyUsed(state);
    if (used + t.housing > cap) return { ok: false, reason: 'Camp full' };
    return { ok: true };
  };

  Eco.queueTrain = function (state, troopType) {
    const check = Eco.canTrain(state, troopType);
    if (!check.ok) return check;
    const t = COC.TROOPS[troopType];
    COC.State.pay(state, t.cost);
    // queue end time stacks after the last item in queue
    const last = state.training.length ? state.training[state.training.length - 1].endsAt : Date.now();
    const start = Math.max(Date.now(), last);
    state.training.push({ type: troopType, endsAt: start + t.trainTime * 1000 });
    return { ok: true };
  };

  // Move finished training into the ready army.
  Eco.tickTraining = function (state) {
    const now = Date.now();
    let changed = false;
    while (state.training.length && state.training[0].endsAt <= now) {
      const done = state.training.shift();
      state.army[done.type] = (state.army[done.type] || 0) + 1;
      changed = true;
    }
    return changed;
  };

  Eco.totalArmyCount = function (state) {
    let n = 0;
    for (const k in state.army) n += state.army[k] || 0;
    return n;
  };

  COC.Economy = Eco;
})(window.COC);
