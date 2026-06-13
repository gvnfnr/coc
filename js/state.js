/* state.js — central game state, derived getters, init/restore with migration. */
(function (COC) {
  'use strict';

  const State = {};
  const B = COC.Buildings;

  function freshState() {
    return {
      resources: { gold: COC.START.gold, elixir: COC.START.elixir, dark: COC.START.dark, gems: COC.START.gems },
      builders: COC.START.builders,
      nextId: 1,
      buildings: [],
      army: {},        // ready troops { type: count }
      training: [],    // [{ type, endsAt }]
      spells: {},      // ready spells { type: count }
      brewing: [],     // [{ type, endsAt }]
      trophies: 0,
      wins: 0, losses: 0,
    };
  }

  State.caps = function (state) {
    const caps = { gold: 0, elixir: 0, dark: 0 };
    for (const b of state.buildings) {
      if (b.constructing) continue;
      const s = B.stats(b);
      if (s.storage) for (const k in s.storage) caps[k] += s.storage[k];
    }
    if (caps.gold === 0) caps.gold = 1500;
    if (caps.elixir === 0) caps.elixir = 1500;
    return caps;
  };

  State.armyCapacity = function (state) {
    let cap = 0;
    for (const b of state.buildings) {
      if (b.constructing) continue;
      const s = B.stats(b);
      if (s.housing) cap += s.housing;
    }
    return cap;
  };
  State.armyUsed = function (state) {
    let used = 0;
    for (const t in state.army) used += (state.army[t] || 0) * COC.TROOPS[t].housing;
    for (const t of state.training) used += COC.TROOPS[t.type].housing;
    return used;
  };

  State.spellCapacity = function (state) {
    let cap = 0;
    for (const b of state.buildings) {
      if (b.constructing) continue;
      const s = B.stats(b);
      if (s.spellCap) cap = Math.max(cap, s.spellCap);
    }
    return cap;
  };
  State.spellUsed = function (state) {
    let used = 0;
    for (const t in state.spells) used += (state.spells[t] || 0) * COC.SPELLS[t].housing;
    for (const t of state.brewing) used += COC.SPELLS[t.type].housing;
    return used;
  };

  State.unlockedTroops = function (state) {
    const set = {};
    for (const b of state.buildings) {
      if (b.type === 'barracks' && !b.constructing) {
        const u = B.stats(b).unlock; if (u) u.forEach(function (t) { set[t] = true; });
      }
    }
    return set;
  };
  State.unlockedSpells = function (state) {
    const set = {};
    for (const b of state.buildings) {
      if (b.type === 'spellfactory' && !b.constructing) {
        const u = B.stats(b).unlock; if (u) u.forEach(function (t) { set[t] = true; });
      }
    }
    return set;
  };

  State.buildersBusy = function (state) {
    let n = 0;
    for (const b of state.buildings) if (b.upgrading) n++;
    return n;
  };
  State.buildersFree = function (state) { return state.builders - State.buildersBusy(state); };

  State.townHall = function (state) { return state.buildings.find(function (b) { return b.type === 'townhall'; }); };

  State.canAfford = function (state, cost) {
    if (!cost) return true;
    for (const k of COC.RESOURCES) if (cost[k] && state.resources[k] < cost[k]) return false;
    return true;
  };
  State.pay = function (state, cost) {
    if (!cost) return;
    for (const k of COC.RESOURCES) if (cost[k]) state.resources[k] -= cost[k];
  };
  State.addResource = function (state, kind, amount) {
    if (amount <= 0) return 0;
    if (kind === 'gems') { state.resources.gems += amount; return amount; }
    const caps = State.caps(state);
    const before = state.resources[kind];
    const after = Math.min(caps[kind], before + amount);
    if (after < before) return 0; // never reduce below current
    state.resources[kind] = after;
    return after - before;
  };

  // ---- Starting village ----
  State.buildStarterVillage = function (state) {
    const c = Math.floor(COC.GRID.cols / 2);
    function place(type, gx, gy) { const b = B.create(state, type, gx, gy); state.buildings.push(b); return b; }
    place('townhall', c - 2, c - 2);
    place('goldmine', c - 6, c - 2);
    place('goldmine', c - 6, c + 2);
    place('elixircollector', c + 3, c - 2);
    place('elixircollector', c + 3, c + 2);
    place('goldstorage', c - 2, c + 3);
    place('elixirstorage', c + 1, c + 3);
    place('cannon', c - 5, c - 5);
    place('cannon', c + 3, c - 5);
    place('barracks', c - 2, c - 6);
    place('armycamp', c + 3, c + 4);
    state.army = { barbarian: 8, archer: 4 };
  };

  State.init = function () {
    const saved = COC.Save.load();
    if (saved && saved.buildings) {
      const state = freshState();
      if (saved.resources) for (const k of COC.RESOURCES) if (typeof saved.resources[k] === 'number') state.resources[k] = saved.resources[k];
      state.builders = saved.builders || COC.START.builders;
      state.nextId = saved.nextId || 1;
      state.army = saved.army || {};
      state.training = saved.training || [];
      state.spells = saved.spells || {};
      state.brewing = saved.brewing || [];
      state.trophies = saved.trophies || 0;
      state.wins = saved.wins || 0; state.losses = saved.losses || 0;
      state.buildings = saved.buildings
        .filter(function (d) { return COC.BUILDINGS[d.type]; }) // drop unknown types from old saves
        .map(function (d) {
          return {
            id: d.id, type: d.type, gx: d.gx, gy: d.gy, level: d.level || 1,
            hp: d.hp, stored: d.stored || 0, lastCollect: d.lastCollect || Date.now(),
            upgrading: !!d.upgrading, constructing: !!d.constructing, upgradeEndsAt: d.upgradeEndsAt || 0,
          };
        });
      for (const b of state.buildings) if (b.id >= state.nextId) state.nextId = b.id + 1;
      return state;
    }
    return State.fresh();
  };

  State.fresh = function () { const s = freshState(); State.buildStarterVillage(s); return s; };

  COC.State = State;
})(window.COC);
