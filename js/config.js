/* config.js — balance data: grid, buildings, troops, spells, level tables, TH gating. */
window.COC = window.COC || {};

(function (COC) {
  'use strict';

  COC.VERSION = 2;

  COC.GRID = { cols: 42, rows: 42, tileW: 40, tileH: 20 };

  COC.RESOURCES = ['gold', 'elixir', 'dark', 'gems'];
  COC.RES_ICON = { gold: '🪙', elixir: '💧', dark: '🌑', gems: '💎' };

  /* ----------------------------------------------------------------------
     BUILDINGS
     Each: name, size, category, color, optional flags, and a `levels[]`
     table (index = level-1). A level entry may define:
       cost {gold|elixir|dark|gems}, time (sec), hp,
       rate/cap (collectors), storage {gold|elixir|dark},
       dps/range/atkSpeed/targets/splash/minRange (defenses),
       housing (army camp), unlock[] (barracks/spell factory), troopSpace
     `minTH` gates availability; `maxByTH` caps how many you may own per TH level.
  ---------------------------------------------------------------------- */
  function caps(arr) { return arr; }

  COC.BUILDINGS = {
    townhall: {
      name: 'Town Hall', size: 4, category: 'core', color: '#c99a3b', max: 1, minTH: 1,
      desc: 'Heart of your village. Higher levels unlock new buildings.',
      levels: [
        { cost: {},              hp: 1600, time: 0,    storage: { gold: 1500, elixir: 1500, dark: 200 } },
        { cost: { gold: 1000 },  hp: 2000, time: 15,   storage: { gold: 3000, elixir: 3000, dark: 400 } },
        { cost: { gold: 4000 },  hp: 2500, time: 120,  storage: { gold: 6000, elixir: 6000, dark: 800 } },
        { cost: { gold: 16000 }, hp: 3100, time: 600,  storage: { gold: 12000, elixir: 12000, dark: 1500 } },
        { cost: { gold: 60000 }, hp: 3900, time: 1800, storage: { gold: 25000, elixir: 25000, dark: 3000 } },
        { cost: { gold: 200000 },hp: 4800, time: 3600, storage: { gold: 50000, elixir: 50000, dark: 6000 } },
      ],
    },

    goldmine: {
      name: 'Gold Mine', size: 3, category: 'resource', resource: 'gold', color: '#f5c518',
      minTH: 1, maxByTH: caps([3, 4, 5, 6, 7, 8]), desc: 'Produces Gold over time. Tap to collect.',
      levels: [
        { cost: { elixir: 150 },  hp: 400, time: 5,   rate: 300,  cap: 800 },
        { cost: { elixir: 300 },  hp: 440, time: 60,  rate: 500,  cap: 1500 },
        { cost: { elixir: 700 },  hp: 480, time: 300, rate: 800,  cap: 2500 },
        { cost: { elixir: 1800 }, hp: 520, time: 1200,rate: 1200, cap: 4000 },
      ],
    },
    elixircollector: {
      name: 'Elixir Collector', size: 3, category: 'resource', resource: 'elixir', color: '#c45cff',
      minTH: 1, maxByTH: caps([3, 4, 5, 6, 7, 8]), desc: 'Produces Elixir over time. Tap to collect.',
      levels: [
        { cost: { gold: 150 },  hp: 400, time: 5,   rate: 300,  cap: 800 },
        { cost: { gold: 300 },  hp: 440, time: 60,  rate: 500,  cap: 1500 },
        { cost: { gold: 700 },  hp: 480, time: 300, rate: 800,  cap: 2500 },
        { cost: { gold: 1800 }, hp: 520, time: 1200,rate: 1200, cap: 4000 },
      ],
    },
    darkdrill: {
      name: 'Dark Elixir Drill', size: 3, category: 'resource', resource: 'dark', color: '#5b4a6b',
      minTH: 4, maxByTH: caps([0, 0, 0, 1, 2, 3]), desc: 'Slowly extracts precious Dark Elixir.',
      levels: [
        { cost: { gold: 8000 },  hp: 700, time: 600,  rate: 30, cap: 200 },
        { cost: { gold: 20000 }, hp: 800, time: 1800, rate: 50, cap: 350 },
        { cost: { gold: 50000 }, hp: 900, time: 3600, rate: 80, cap: 500 },
      ],
    },

    goldstorage: {
      name: 'Gold Storage', size: 3, category: 'resource', store: 'gold', color: '#d9a900',
      minTH: 1, maxByTH: caps([1, 2, 2, 3, 4, 4]), desc: 'Increases your maximum Gold capacity.',
      levels: [
        { cost: { elixir: 300 },  hp: 700, time: 30,   storage: { gold: 4000 } },
        { cost: { elixir: 1000 }, hp: 850, time: 300,  storage: { gold: 12000 } },
        { cost: { elixir: 3000 }, hp: 1000,time: 1200, storage: { gold: 30000 } },
      ],
    },
    elixirstorage: {
      name: 'Elixir Storage', size: 3, category: 'resource', store: 'elixir', color: '#8a2be2',
      minTH: 1, maxByTH: caps([1, 2, 2, 3, 4, 4]), desc: 'Increases your maximum Elixir capacity.',
      levels: [
        { cost: { gold: 300 },  hp: 700, time: 30,   storage: { elixir: 4000 } },
        { cost: { gold: 1000 }, hp: 850, time: 300,  storage: { elixir: 12000 } },
        { cost: { gold: 3000 }, hp: 1000,time: 1200, storage: { elixir: 30000 } },
      ],
    },
    darkstorage: {
      name: 'Dark Elixir Storage', size: 3, category: 'resource', store: 'dark', color: '#3a3145',
      minTH: 4, maxByTH: caps([0, 0, 0, 1, 1, 1]), desc: 'Stores Dark Elixir for elite troops and spells.',
      levels: [
        { cost: { gold: 10000 }, hp: 900,  time: 600,  storage: { dark: 1000 } },
        { cost: { gold: 30000 }, hp: 1100, time: 1800, storage: { dark: 3000 } },
      ],
    },

    cannon: {
      name: 'Cannon', size: 3, category: 'defense', color: '#7d8a99', targets: 'ground',
      minTH: 1, maxByTH: caps([3, 4, 5, 6, 7, 7]), desc: 'Fast single-target ground defense.',
      levels: [
        { cost: { gold: 250 },  hp: 450, time: 30,   dps: 11, range: 6.0, atkSpeed: 0.8 },
        { cost: { gold: 800 },  hp: 520, time: 300,  dps: 15, range: 6.0, atkSpeed: 0.8 },
        { cost: { gold: 2400 }, hp: 600, time: 1200, dps: 21, range: 6.5, atkSpeed: 0.8 },
        { cost: { gold: 6000 }, hp: 700, time: 3600, dps: 28, range: 6.5, atkSpeed: 0.8 },
      ],
    },
    archertower: {
      name: 'Archer Tower', size: 3, category: 'defense', color: '#5a8f4e', targets: 'any',
      minTH: 2, maxByTH: caps([0, 2, 3, 4, 5, 6]), desc: 'Targets ground and air. Long range.',
      levels: [
        { cost: { gold: 350 },  hp: 400, time: 60,   dps: 13, range: 8.0, atkSpeed: 0.5 },
        { cost: { gold: 1100 }, hp: 460, time: 600,  dps: 18, range: 8.0, atkSpeed: 0.5 },
        { cost: { gold: 3200 }, hp: 530, time: 1800, dps: 25, range: 8.5, atkSpeed: 0.5 },
      ],
    },
    mortar: {
      name: 'Mortar', size: 3, category: 'defense', color: '#6b6f76', targets: 'ground',
      splash: 1.6, minRange: 2.5, arc: true,
      minTH: 3, maxByTH: caps([0, 0, 1, 2, 3, 4]), desc: 'Lobs shells dealing heavy splash damage. Blind up close.',
      levels: [
        { cost: { gold: 3000 },  hp: 500, time: 600,  dps: 16, range: 9.0, atkSpeed: 4.0 },
        { cost: { gold: 8000 },  hp: 580, time: 1800, dps: 22, range: 9.0, atkSpeed: 4.0 },
        { cost: { gold: 18000 }, hp: 660, time: 3600, dps: 30, range: 9.5, atkSpeed: 4.0 },
      ],
    },
    wizardtower: {
      name: 'Wizard Tower', size: 3, category: 'defense', color: '#7a5cc4', targets: 'any',
      splash: 1.2,
      minTH: 5, maxByTH: caps([0, 0, 0, 0, 2, 3]), desc: 'Splash damage to ground and air.',
      levels: [
        { cost: { gold: 12000 }, hp: 620, time: 1800, dps: 24, range: 7.0, atkSpeed: 1.3 },
        { cost: { gold: 28000 }, hp: 720, time: 3600, dps: 32, range: 7.0, atkSpeed: 1.3 },
      ],
    },
    airdefense: {
      name: 'Air Defense', size: 3, category: 'defense', color: '#3f7fae', targets: 'air',
      minTH: 4, maxByTH: caps([0, 0, 0, 1, 2, 3]), desc: 'Devastating against air units. Cannot hit ground.',
      levels: [
        { cost: { gold: 6000 },  hp: 550, time: 1200, dps: 60, range: 7.5, atkSpeed: 1.0 },
        { cost: { gold: 16000 }, hp: 640, time: 3000, dps: 80, range: 7.5, atkSpeed: 1.0 },
      ],
    },
    tesla: {
      name: 'Hidden Tesla', size: 2, category: 'defense', color: '#46c7e0', targets: 'any', hidden: true,
      minTH: 5, maxByTH: caps([0, 0, 0, 0, 2, 3]), desc: 'Stays cloaked until enemies get close, then zaps them.',
      levels: [
        { cost: { gold: 14000 }, hp: 480, time: 1800, dps: 30, range: 6.0, atkSpeed: 0.6 },
        { cost: { gold: 32000 }, hp: 560, time: 3600, dps: 40, range: 6.0, atkSpeed: 0.6 },
      ],
    },

    barracks: {
      name: 'Barracks', size: 3, category: 'army', color: '#b5552e',
      minTH: 1, maxByTH: caps([1, 2, 2, 3, 4, 4]), desc: 'Unlocks and trains Elixir troops.',
      levels: [
        { cost: { elixir: 200 },  hp: 400, time: 15,   unlock: ['barbarian'] },
        { cost: { elixir: 600 },  hp: 470, time: 300,  unlock: ['barbarian', 'archer', 'goblin'] },
        { cost: { elixir: 1500 }, hp: 540, time: 1200, unlock: ['barbarian', 'archer', 'goblin', 'giant', 'wallbreaker'] },
        { cost: { elixir: 4000 }, hp: 620, time: 3600, unlock: ['barbarian', 'archer', 'goblin', 'giant', 'wallbreaker', 'wizard', 'balloon'] },
        { cost: { elixir: 9000 }, hp: 700, time: 7200, unlock: ['barbarian', 'archer', 'goblin', 'giant', 'wallbreaker', 'wizard', 'balloon', 'healer', 'dragon'] },
      ],
    },
    armycamp: {
      name: 'Army Camp', size: 4, category: 'army', color: '#3d6b4f',
      minTH: 1, maxByTH: caps([1, 2, 3, 3, 4, 4]), desc: 'Houses your trained troops. Adds army capacity.',
      levels: [
        { cost: { elixir: 250 },  hp: 350, time: 30,   housing: 20 },
        { cost: { elixir: 1000 }, hp: 420, time: 600,  housing: 35 },
        { cost: { elixir: 3000 }, hp: 490, time: 1800, housing: 50 },
        { cost: { elixir: 7000 }, hp: 560, time: 5400, housing: 70 },
      ],
    },
    spellfactory: {
      name: 'Spell Factory', size: 3, category: 'army', color: '#d24a86',
      minTH: 5, maxByTH: caps([0, 0, 0, 0, 1, 1]), desc: 'Brews battle spells. Higher levels unlock more.',
      levels: [
        { cost: { elixir: 8000 },  hp: 500, time: 1800, unlock: ['lightning'], spellCap: 4 },
        { cost: { elixir: 20000 }, hp: 600, time: 3600, unlock: ['lightning', 'heal', 'rage'], spellCap: 6 },
      ],
    },
    buildershut: {
      name: "Builder's Hut", size: 2, category: 'army', color: '#caa46b', max: 5, minTH: 1, gemBuild: true,
      desc: 'Adds an extra Builder so you can construct two things at once.',
      levels: [{ cost: { gems: 25 }, hp: 250, time: 0 }],
    },

    wall: {
      name: 'Wall', size: 1, category: 'defense', color: '#9a8366', wall: true,
      minTH: 2, maxByTH: caps([0, 25, 50, 75, 125, 175]), desc: 'Blocks enemy ground troops. Build in bulk.',
      levels: [
        { cost: { gold: 100 },  hp: 700,  time: 0 },
        { cost: { gold: 500 },  hp: 1400, time: 0 },
        { cost: { gold: 2000 }, hp: 2500, time: 0 },
        { cost: { gold: 7000 }, hp: 4000, time: 0 },
      ],
    },

    /* Traps — placed like buildings, invisible to attackers until triggered. */
    bomb: {
      name: 'Bomb', size: 1, category: 'trap', color: '#2b2b2b', trap: true, trigger: 'ground',
      splash: 2.0, minTH: 3, maxByTH: caps([0, 0, 2, 4, 6, 8]), desc: 'Hidden explosive. Splash damage to ground troops.',
      levels: [
        { cost: { gold: 400 },  time: 0, dmg: 90 },
        { cost: { gold: 1200 }, time: 0, dmg: 150 },
        { cost: { gold: 4000 }, time: 0, dmg: 240 },
      ],
    },
    springtrap: {
      name: 'Spring Trap', size: 1, category: 'trap', color: '#3a5a3a', trap: true, trigger: 'ground',
      minTH: 4, maxByTH: caps([0, 0, 0, 2, 3, 4]), desc: 'Springs and ejects several ground troops from the battle.',
      levels: [{ cost: { gold: 2000 }, time: 0, capacity: 6 }],
    },
  };

  COC.BUILD_ORDER = ['goldmine', 'elixircollector', 'darkdrill', 'goldstorage', 'elixirstorage', 'darkstorage',
    'cannon', 'archertower', 'mortar', 'wizardtower', 'airdefense', 'tesla', 'wall',
    'bomb', 'springtrap', 'barracks', 'armycamp', 'spellfactory', 'buildershut'];

  /* ----------------------------------------------------------------------
     TROOPS — domain ground/air; prefers picks a priority target class.
  ---------------------------------------------------------------------- */
  COC.TROOPS = {
    barbarian: { name: 'Barbarian', color: '#e8b06a', cost: { elixir: 25 }, housing: 1, trainTime: 4,
      hp: 95, dps: 18, range: 0.7, speed: 2.2, domain: 'ground', prefers: 'any',
      desc: 'Cheap melee fighter. Attacks anything nearby.' },
    archer: { name: 'Archer', color: '#e85c8a', cost: { elixir: 50 }, housing: 1, trainTime: 6,
      hp: 50, dps: 16, range: 3.5, speed: 2.4, domain: 'ground', prefers: 'any',
      desc: 'Ranged. Shoots over walls.' },
    goblin: { name: 'Goblin', color: '#7ec850', cost: { elixir: 40 }, housing: 1, trainTime: 5,
      hp: 56, dps: 20, range: 0.7, speed: 3.2, domain: 'ground', prefers: 'resource', resourceBonus: 2,
      desc: 'Fast and greedy. Targets resource buildings, double damage to them.' },
    giant: { name: 'Giant', color: '#8ad0e8', cost: { elixir: 250 }, housing: 5, trainTime: 24,
      hp: 700, dps: 26, range: 0.9, speed: 1.3, domain: 'ground', prefers: 'defense',
      desc: 'Tanky. Targets defensive buildings first.' },
    wallbreaker: { name: 'Wall Breaker', color: '#caa', cost: { elixir: 100 }, housing: 2, trainTime: 8,
      hp: 40, dps: 12, range: 0.6, speed: 3.0, domain: 'ground', prefers: 'wall', wallDmgMult: 12,
      desc: 'Suicidal bomber. Charges walls and detonates with splash.' },
    wizard: { name: 'Wizard', color: '#6a8cff', cost: { elixir: 200 }, housing: 4, trainTime: 18,
      hp: 90, dps: 36, range: 3.0, speed: 2.0, domain: 'ground', prefers: 'any', splash: 1.0,
      desc: 'Glass cannon. Ranged splash damage.' },
    healer: { name: 'Healer', color: '#ffd2e0', cost: { elixir: 500 }, housing: 8, trainTime: 30,
      hp: 350, dps: 0, range: 4.0, speed: 1.6, domain: 'air', prefers: 'none', heal: 28,
      desc: 'Flies and heals nearby ground troops. Cannot attack.' },
    balloon: { name: 'Balloon', color: '#e0564a', cost: { elixir: 300, dark: 0 }, housing: 5, trainTime: 24,
      hp: 320, dps: 60, range: 0.8, speed: 1.2, domain: 'air', prefers: 'defense', splash: 1.4,
      desc: 'Airborne bomber. Targets defenses with heavy splash.' },
    dragon: { name: 'Dragon', color: '#c64ad0', cost: { elixir: 900, dark: 0 }, housing: 12, trainTime: 45,
      hp: 1500, dps: 70, range: 2.8, speed: 1.5, domain: 'air', prefers: 'any', splash: 0.9,
      desc: 'Flying powerhouse with splash breath. Targets anything.' },
  };
  COC.TROOP_ORDER = ['barbarian', 'archer', 'goblin', 'giant', 'wallbreaker', 'wizard', 'healer', 'balloon', 'dragon'];

  /* ----------------------------------------------------------------------
     SPELLS — deployed by clicking a target location in battle.
  ---------------------------------------------------------------------- */
  COC.SPELLS = {
    lightning: { name: 'Lightning', color: '#ffe34d', cost: { elixir: 1500 }, housing: 2, brewTime: 20,
      radius: 2.4, damage: 320, type: 'instant', desc: 'Strikes a small area for instant damage to buildings & troops.' },
    heal: { name: 'Heal', color: '#7fe07f', cost: { elixir: 2000 }, housing: 2, brewTime: 25,
      radius: 3.0, heal: 60, duration: 6, type: 'zone', desc: 'Creates a zone that heals your troops over time.' },
    rage: { name: 'Rage', color: '#d36bff', cost: { elixir: 2500 }, housing: 2, brewTime: 25,
      radius: 3.0, dmgMult: 1.6, speedMult: 1.6, duration: 7, type: 'zone', desc: 'Boosts damage and speed of troops inside.' },
  };
  COC.SPELL_ORDER = ['lightning', 'heal', 'rage'];

  COC.BATTLE = { duration: 180 };
  COC.START = { gold: 1000, elixir: 1000, dark: 0, gems: 75, builders: 2 };

  /* ---- helpers ---- */
  COC.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };
  COC.fmtTime = function (s) {
    s = Math.max(0, Math.ceil(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + (sec ? sec + 's' : '');
    return sec + 's';
  };
  COC.costStr = function (cost) {
    if (!cost) return 'Free';
    const p = [];
    for (const k of COC.RESOURCES) if (cost[k]) p.push(COC.RES_ICON[k] + COC.fmt(cost[k]));
    return p.length ? p.join(' ') : 'Free';
  };

})(window.COC);
