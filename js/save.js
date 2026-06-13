/* save.js — localStorage persistence. */
(function (COC) {
  'use strict';
  const KEY = 'coc_save_v2';
  const OLD_KEYS = ['coc_save_v1'];
  const Save = {};

  Save.save = function (state) {
    try {
      const data = {
        v: COC.VERSION, savedAt: Date.now(),
        resources: state.resources, builders: state.builders, nextId: state.nextId,
        army: state.army, training: state.training, spells: state.spells, brewing: state.brewing,
        trophies: state.trophies, wins: state.wins, losses: state.losses,
        buildings: state.buildings.map(function (b) {
          return { id: b.id, type: b.type, gx: b.gx, gy: b.gy, level: b.level, hp: b.hp,
            stored: b.stored, upgrading: b.upgrading, constructing: b.constructing,
            upgradeEndsAt: b.upgradeEndsAt, lastCollect: b.lastCollect };
        }),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { console.warn('Save failed', e); return false; }
  };

  Save.load = function () {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw) { for (const k of OLD_KEYS) { raw = localStorage.getItem(k); if (raw) break; } }
      return raw ? JSON.parse(raw) : null;
    } catch (e) { console.warn('Load failed', e); return null; }
  };

  Save.clear = function () { localStorage.removeItem(KEY); for (const k of OLD_KEYS) localStorage.removeItem(k); };

  COC.Save = Save;
})(window.COC);
