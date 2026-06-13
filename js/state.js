/* state.js — central game state, derived getters, init & restore. */
(function (COC) {
  'use strict';

  const State = {};
  const B = COC.Buildings;

  function freshState() {
    return {
      resources: {
        gold: COC.START.gold,
        elixir: COC.START.elixir,
        gems: COC.START.gems,
      },
      nextId: 1,
      buildings: [],
      army: {},        // { troopType: count }   -> ready troops
      training: [],    // [{ type, endsAt }]
    };
  }

  // Storage capacity = sum of storage contributions across town hall + storages.
  State.caps = function (state) {
    const caps = { gold: 0, elixir: 0 };
    for (const b of state.buildings) {
      const s = B.stats(b);
      if (s.storage) {
        if (s.storage.gold) caps.gold += s.storage.gold;
        if (s.storage.elixir) caps.elixir += s.storage.elixir;
      }
    }
    if (caps.gold === 0) caps.gold = 1000;
    if (caps.elixir === 0) caps.elixir = 1000;
    return caps;
  };

  State.armyCapacity = function (state) {
    let cap = 0;
    for (const b of state.buildings) {
      const s = B.stats(b);
      if (s.housing) cap += s.housing;
    }
    return cap;
  };

  State.armyUsed = function (state) {
    let used = 0;
    for (const type in state.army) {
      used += (state.army[type] || 0) * COC.TROOPS[type].housing;
    }
    // include in-training
    for (const t of state.training) {
      used += COC.TROOPS[t.type].housing;
    }
    return used;
  };

  State.unlockedTroops = function (state) {
    const set = {};
    for (const b of state.buildings) {
      if (b.type === 'barracks') {
        const s = B.stats(b);
        if (s.unlock) s.unlock.forEach(function (t) { set[t] = true; });
      }
    }
    return set;
  };

  State.townHall = function (state) {
    return state.buildings.find(function (b) { return b.type === 'townhall'; });
  };

  State.canAfford = function (state, cost) {
    if (!cost) return true;
    if (cost.gold && state.resources.gold < cost.gold) return false;
    if (cost.elixir && state.resources.elixir < cost.elixir) return false;
    if (cost.gems && state.resources.gems < cost.gems) return false;
    return true;
  };

  State.pay = function (state, cost) {
    if (!cost) return;
    if (cost.gold) state.resources.gold -= cost.gold;
    if (cost.elixir) state.resources.elixir -= cost.elixir;
    if (cost.gems) state.resources.gems -= cost.gems;
  };

  // Add resources but clamp to caps (gems uncapped).
  State.addResource = function (state, kind, amount) {
    if (kind === 'gems') { state.resources.gems += amount; return amount; }
    const caps = State.caps(state);
    const before = state.resources[kind];
    const after = Math.min(caps[kind], before + amount);
    state.resources[kind] = after;
    return after - before;
  };

  // ---- Starting village ----
  State.buildStarterVillage = function (state) {
    const c = Math.floor(COC.GRID.cols / 2);
    function place(type, gx, gy) {
      const b = B.create(state, type, gx, gy);
      state.buildings.push(b);
      return b;
    }
    place('townhall', c - 1, c - 1);
    place('goldmine', c - 5, c - 1);
    place('goldmine', c - 5, c + 2);
    place('elixircollector', c + 3, c - 1);
    place('elixircollector', c + 3, c + 2);
    place('goldstorage', c - 1, c + 3);
    place('elixirstorage', c + 2, c + 3);
    place('cannon', c - 4, c - 4);
    place('archertower', c + 3, c - 4);
    place('barracks', c - 1, c - 5);
    place('armycamp', c + 4, c + 4);
    state.army = { barbarian: 5 };
  };

  // ---- Init: load save or create fresh ----
  State.init = function () {
    const saved = COC.Save.load();
    let state;
    if (saved && saved.buildings) {
      state = freshState();
      state.resources = saved.resources || state.resources;
      state.nextId = saved.nextId || 1;
      state.army = saved.army || {};
      state.training = saved.training || [];
      state.buildings = saved.buildings.map(function (d) {
        return {
          id: d.id, type: d.type, gx: d.gx, gy: d.gy, level: d.level,
          hp: d.hp, stored: d.stored || 0,
          lastCollect: d.lastCollect || Date.now(),
          upgrading: !!d.upgrading, upgradeEndsAt: d.upgradeEndsAt || 0,
        };
      });
      // Ensure nextId is safe
      for (const b of state.buildings) if (b.id >= state.nextId) state.nextId = b.id + 1;
    } else {
      state = freshState();
      State.buildStarterVillage(state);
    }
    return state;
  };

  State.fresh = function () {
    const state = freshState();
    State.buildStarterVillage(state);
    return state;
  };

  COC.State = State;
})(window.COC);
