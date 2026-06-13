/* save.js — localStorage persistence. */
(function (COC) {
  'use strict';

  const KEY = 'coc_save_v1';
  const Save = {};

  Save.save = function (state) {
    try {
      const data = {
        v: 1,
        savedAt: Date.now(),
        resources: state.resources,
        nextId: state.nextId,
        buildings: state.buildings.map(function (b) {
          return {
            id: b.id, type: b.type, gx: b.gx, gy: b.gy, level: b.level,
            hp: b.hp, stored: b.stored,
            upgrading: b.upgrading, upgradeEndsAt: b.upgradeEndsAt,
            lastCollect: b.lastCollect,
          };
        }),
        army: state.army,
        training: state.training,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  };

  Save.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Load failed', e);
      return null;
    }
  };

  Save.clear = function () {
    localStorage.removeItem(KEY);
  };

  COC.Save = Save;
})(window.COC);
