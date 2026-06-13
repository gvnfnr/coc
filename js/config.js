/* config.js — all balance data: grid, buildings, troops, level tables.
   Everything lives on the global COC namespace so files load as plain scripts. */
window.COC = window.COC || {};

(function (COC) {
  'use strict';

  COC.GRID = {
    cols: 38,
    rows: 38,
    tileW: 40,   // full isometric tile width in px
    tileH: 20,   // full isometric tile height in px (2:1)
  };

  // Generic helper: a level table is an array indexed by (level-1).
  // Each building type defines size (tiles), category, and per-level stats.
  COC.BUILDINGS = {
    townhall: {
      name: 'Town Hall', size: 3, category: 'core', color: '#c99a3b', max: 1,
      desc: 'Heart of your village. Destroying it is worth a star.',
      levels: [
        { cost: { gold: 0 },    elixir: 0,  hp: 1500, time: 0,    storage: { gold: 1000, elixir: 1000 } },
        { cost: { gold: 1000 }, hp: 1850, time: 10,   storage: { gold: 2000, elixir: 2000 } },
        { cost: { gold: 4000 }, hp: 2300, time: 60,   storage: { gold: 4000, elixir: 4000 } },
        { cost: { gold: 25000 },hp: 2900, time: 240,  storage: { gold: 8000, elixir: 8000 } },
      ],
    },
    goldmine: {
      name: 'Gold Mine', size: 2, category: 'resource', resource: 'gold', color: '#f5c518',
      desc: 'Produces Gold over time. Tap to collect.',
      levels: [
        { cost: { elixir: 150 },  hp: 400, time: 5,   rate: 200,  cap: 500 },
        { cost: { elixir: 300 },  hp: 440, time: 30,  rate: 400,  cap: 1000 },
        { cost: { elixir: 700 },  hp: 480, time: 120, rate: 600,  cap: 1500 },
        { cost: { elixir: 1400 }, hp: 520, time: 360, rate: 900,  cap: 2500 },
      ],
    },
    elixircollector: {
      name: 'Elixir Collector', size: 2, category: 'resource', resource: 'elixir', color: '#c45cff',
      desc: 'Produces Elixir over time. Tap to collect.',
      levels: [
        { cost: { gold: 150 },  hp: 400, time: 5,   rate: 200,  cap: 500 },
        { cost: { gold: 300 },  hp: 440, time: 30,  rate: 400,  cap: 1000 },
        { cost: { gold: 700 },  hp: 480, time: 120, rate: 600,  cap: 1500 },
        { cost: { gold: 1400 }, hp: 520, time: 360, rate: 900,  cap: 2500 },
      ],
    },
    goldstorage: {
      name: 'Gold Storage', size: 2, category: 'resource', store: 'gold', color: '#d9a900',
      desc: 'Increases your maximum Gold capacity.',
      levels: [
        { cost: { elixir: 300 },  hp: 600, time: 10,  storage: { gold: 3000 } },
        { cost: { elixir: 800 },  hp: 700, time: 60,  storage: { gold: 8000 } },
        { cost: { elixir: 2000 }, hp: 800, time: 240, storage: { gold: 20000 } },
      ],
    },
    elixirstorage: {
      name: 'Elixir Storage', size: 2, category: 'resource', store: 'elixir', color: '#8a2be2',
      desc: 'Increases your maximum Elixir capacity.',
      levels: [
        { cost: { gold: 300 },  hp: 600, time: 10,  storage: { elixir: 3000 } },
        { cost: { gold: 800 },  hp: 700, time: 60,  storage: { elixir: 8000 } },
        { cost: { gold: 2000 }, hp: 800, time: 240, storage: { elixir: 20000 } },
      ],
    },
    cannon: {
      name: 'Cannon', size: 2, category: 'defense', color: '#7d8a99', targets: 'ground',
      desc: 'Fast single-target ground defense.',
      levels: [
        { cost: { gold: 250 },  hp: 420, time: 10,  dps: 9,  range: 5.5, atkSpeed: 0.8 },
        { cost: { gold: 600 },  hp: 470, time: 60,  dps: 12, range: 5.5, atkSpeed: 0.8 },
        { cost: { gold: 1500 }, hp: 520, time: 240, dps: 16, range: 6.0, atkSpeed: 0.8 },
        { cost: { gold: 3500 }, hp: 600, time: 600, dps: 22, range: 6.0, atkSpeed: 0.8 },
      ],
    },
    archertower: {
      name: 'Archer Tower', size: 2, category: 'defense', color: '#5a8f4e', targets: 'any',
      desc: 'Targets both ground and air. Longer range than a Cannon.',
      levels: [
        { cost: { gold: 350 },  hp: 380, time: 15,  dps: 11, range: 7.0, atkSpeed: 0.6 },
        { cost: { gold: 900 },  hp: 420, time: 90,  dps: 15, range: 7.0, atkSpeed: 0.6 },
        { cost: { gold: 2200 }, hp: 470, time: 300, dps: 20, range: 7.5, atkSpeed: 0.6 },
      ],
    },
    barracks: {
      name: 'Barracks', size: 2, category: 'army', color: '#b5552e',
      desc: 'Unlocks and trains troops.',
      levels: [
        { cost: { elixir: 200 },  hp: 350, time: 10,  unlock: ['barbarian'] },
        { cost: { elixir: 600 },  hp: 420, time: 120, unlock: ['barbarian', 'archer'] },
        { cost: { elixir: 1500 }, hp: 500, time: 420, unlock: ['barbarian', 'archer', 'giant'] },
      ],
    },
    armycamp: {
      name: 'Army Camp', size: 3, category: 'army', color: '#3d6b4f',
      desc: 'Houses your trained troops. Increases army capacity.',
      levels: [
        { cost: { elixir: 250 },  hp: 300, time: 15,  housing: 20 },
        { cost: { elixir: 750 },  hp: 360, time: 180, housing: 35 },
        { cost: { elixir: 1800 }, hp: 420, time: 480, housing: 50 },
      ],
    },
    wall: {
      name: 'Wall', size: 1, category: 'defense', color: '#9a8366', wall: true,
      desc: 'Slows down enemy troops. Cheap to build in bulk.',
      levels: [
        { cost: { gold: 50 },  hp: 600,  time: 0 },
        { cost: { gold: 200 }, hp: 1000, time: 5 },
        { cost: { gold: 600 }, hp: 1600, time: 30 },
      ],
    },
  };

  // Build menu order
  COC.BUILD_ORDER = ['goldmine', 'elixircollector', 'goldstorage', 'elixirstorage',
    'cannon', 'archertower', 'barracks', 'armycamp', 'wall', 'townhall'];

  COC.TROOPS = {
    barbarian: {
      name: 'Barbarian', color: '#e8b06a', cost: { elixir: 25 }, housing: 1, trainTime: 5,
      hp: 90, dps: 16, range: 0.7, speed: 2.2, prefers: 'any',
      desc: 'Cheap melee fighter. Attacks anything nearby.',
    },
    archer: {
      name: 'Archer', color: '#e85c8a', cost: { elixir: 50 }, housing: 1, trainTime: 8,
      hp: 50, dps: 14, range: 3.5, speed: 2.4, prefers: 'any',
      desc: 'Ranged attacker that shoots over walls.',
    },
    giant: {
      name: 'Giant', color: '#8ad0e8', cost: { elixir: 250 }, housing: 5, trainTime: 25,
      hp: 600, dps: 24, range: 0.9, speed: 1.3, prefers: 'defense',
      desc: 'Tanky unit that targets defensive buildings first.',
    },
  };

  COC.TROOP_ORDER = ['barbarian', 'archer', 'giant'];

  COC.BATTLE = {
    duration: 180,       // seconds
    deployMargin: 1.4,   // tiles from edge where deploy is allowed
  };

  COC.START = {
    gold: 800, elixir: 800, gems: 50,
  };

  // Cost of a building's NEXT level (the level it will become). lvl is current 1-based.
  COC.nextLevelData = function (typeKey, currentLevel) {
    const def = COC.BUILDINGS[typeKey];
    return def.levels[currentLevel]; // levels[currentLevel] is the (currentLevel+1)th entry
  };

  COC.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };

  COC.fmtTime = function (s) {
    s = Math.max(0, Math.ceil(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  };

})(window.COC);
