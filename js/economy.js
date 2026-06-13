/* economy.js — resource generation/collection, troop training, spell brewing. */
(function (COC) {
  'use strict';

  const Eco = {};
  const B = COC.Buildings;
  const State = COC.State;

  Eco.tick = function (state) {
    const now = Date.now();
    for (const b of state.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (def.category !== 'resource' || !def.resource) continue;
      if (b.upgrading) { b.lastCollect = now; continue; }
      const s = B.stats(b);
      const dt = (now - b.lastCollect) / 1000;
      if (dt <= 0) continue;
      b.stored = Math.min(s.cap, (b.stored || 0) + (s.rate / 3600) * dt);
      b.lastCollect = now;
    }
  };

  Eco.pending = function (b) {
    const def = COC.BUILDINGS[b.type];
    if (def.category !== 'resource' || !def.resource) return 0;
    return Math.floor(b.stored || 0);
  };

  Eco.collect = function (state, b) {
    const def = COC.BUILDINGS[b.type];
    if (def.category !== 'resource' || !def.resource) return null;
    const amount = Math.floor(b.stored || 0);
    if (amount <= 0) return null;
    const added = State.addResource(state, def.resource, amount);
    b.stored = (b.stored || 0) - amount;
    return { kind: def.resource, amount: added };
  };

  // ---- Troops ----
  Eco.canTrain = function (state, type) {
    const t = COC.TROOPS[type];
    if (!State.unlockedTroops(state)[type]) return { ok: false, reason: 'Locked' };
    if (!State.canAfford(state, t.cost)) return { ok: false, reason: 'Cost' };
    if (State.armyUsed(state) + t.housing > State.armyCapacity(state)) return { ok: false, reason: 'Camp full' };
    return { ok: true };
  };
  Eco.queueTrain = function (state, type) {
    const c = Eco.canTrain(state, type); if (!c.ok) return c;
    const t = COC.TROOPS[type];
    State.pay(state, t.cost);
    const last = state.training.length ? state.training[state.training.length - 1].endsAt : Date.now();
    state.training.push({ type: type, endsAt: Math.max(Date.now(), last) + t.trainTime * 1000 });
    return { ok: true };
  };
  Eco.tickTraining = function (state) {
    const now = Date.now(); let changed = false;
    while (state.training.length && state.training[0].endsAt <= now) {
      const d = state.training.shift(); state.army[d.type] = (state.army[d.type] || 0) + 1; changed = true;
    }
    return changed;
  };

  // ---- Spells ----
  Eco.canBrew = function (state, type) {
    const sp = COC.SPELLS[type];
    if (!State.unlockedSpells(state)[type]) return { ok: false, reason: 'Locked' };
    if (!State.canAfford(state, sp.cost)) return { ok: false, reason: 'Cost' };
    if (State.spellUsed(state) + sp.housing > State.spellCapacity(state)) return { ok: false, reason: 'Full' };
    return { ok: true };
  };
  Eco.queueBrew = function (state, type) {
    const c = Eco.canBrew(state, type); if (!c.ok) return c;
    const sp = COC.SPELLS[type];
    State.pay(state, sp.cost);
    const last = state.brewing.length ? state.brewing[state.brewing.length - 1].endsAt : Date.now();
    state.brewing.push({ type: type, endsAt: Math.max(Date.now(), last) + sp.brewTime * 1000 });
    return { ok: true };
  };
  Eco.tickBrewing = function (state) {
    const now = Date.now(); let changed = false;
    while (state.brewing.length && state.brewing[0].endsAt <= now) {
      const d = state.brewing.shift(); state.spells[d.type] = (state.spells[d.type] || 0) + 1; changed = true;
    }
    return changed;
  };

  Eco.totalArmyCount = function (state) {
    let n = 0; for (const k in state.army) n += state.army[k] || 0; return n;
  };

  COC.Economy = Eco;
})(window.COC);
