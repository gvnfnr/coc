/* game.js — orchestration: modes, loop, camera, and all user actions. */
(function (COC) {
  'use strict';

  const B = COC.Buildings;
  const State = COC.State;
  const Eco = COC.Economy;
  const UI = COC.UI;
  const Render = COC.Render;

  const Game = {
    canvas: null, ctx: null,
    mode: 'home',
    state: null,
    battle: null,
    camera: { x: 0, y: 0, zoom: 1 },
    selected: null,
    placing: null,
    movingBuilding: null,
    hover: null,
    showGrid: false,
    _dirty: false,
    _lastSave: 0,
    _lastFrame: 0,
  };

  Game.start = function () {
    Game.canvas = document.getElementById('game-canvas');
    Game.ctx = Game.canvas.getContext('2d');
    Game.resize();
    window.addEventListener('resize', Game.resize);

    Game.state = State.init();
    UI.init(Game);
    COC.Input.init(Game);
    Game.centerCamera();
    UI.updateTopbar();

    Game._lastFrame = performance.now();
    requestAnimationFrame(Game.loop);
  };

  Game.resize = function () {
    Game.canvas.width = window.innerWidth;
    Game.canvas.height = window.innerHeight;
  };

  Game.centerCamera = function () {
    // center on map middle
    const mid = COC.Iso.toScreen(COC.GRID.cols / 2, COC.GRID.rows / 2);
    Game.camera.x = -mid.x * Game.camera.zoom;
    Game.camera.y = -mid.y * Game.camera.zoom;
    Game.clampCamera();
  };

  Game.clampCamera = function () {
    const z = Game.camera.zoom;
    const halfW = ((COC.GRID.cols + COC.GRID.rows) / 2) * (COC.GRID.tileW / 2) * z + 200;
    const halfH = ((COC.GRID.cols + COC.GRID.rows) / 2) * (COC.GRID.tileH / 2) * z + 200;
    Game.camera.x = Math.max(-halfW, Math.min(halfW, Game.camera.x));
    Game.camera.y = Math.max(-halfH, Math.min(halfH, Game.camera.y));
  };

  // ---------------- Loop ----------------
  Game.loop = function (now) {
    const dt = Math.min(0.05, (now - Game._lastFrame) / 1000);
    Game._lastFrame = now;

    if (Game.mode === 'home') {
      Eco.tick(Game.state);
      if (Eco.tickTraining(Game.state)) { UI.refreshArmyIfOpen(); Game.requestSave(); }
      let upgraded = false;
      for (const b of Game.state.buildings) if (B.tickUpgrade(b)) upgraded = true;
      if (upgraded) Game.requestSave();

      UI.updateTopbar();
      if (Game.selected) UI.updateUpgrade(Game.selected);
      UI.refreshArmyIfOpen();
    } else if (Game.mode === 'battle' && Game.battle) {
      if (!Game.battle.ended) {
        COC.Battle.update(Game.battle, dt);
        UI.updateBattleHUD();
        if (Game.battle.ended) Game.onBattleEnd();
      }
    }

    Render.scene(Game.ctx, Game);

    // autosave
    if (Game._dirty && now - Game._lastSave > 2500) {
      COC.Save.save(Game.state);
      Game._dirty = false; Game._lastSave = now;
    }

    requestAnimationFrame(Game.loop);
  };

  Game.requestSave = function () { Game._dirty = true; };

  // ---------------- Home: selection ----------------
  Game.buildingAt = function (gx, gy) {
    const fx = Math.floor(gx), fy = Math.floor(gy);
    // iterate from topmost (highest depth) so picking favors front buildings
    const list = Game.state.buildings;
    for (let i = list.length - 1; i >= 0; i--) {
      if (B.occupies(list[i], fx, fy)) return list[i];
    }
    return null;
  };

  Game.clickAt = function (gx, gy) {
    const b = Game.buildingAt(gx, gy);
    if (b) {
      // tap-to-collect resource buildings
      const pending = Eco.pending(b);
      if (pending > 0) Game.collectBuilding(b);
      Game.selected = b;
      UI.showUpgrade(b);
    } else {
      Game.deselect();
    }
  };

  Game.deselect = function () {
    Game.selected = null;
    UI.hideUpgrade();
  };

  // ---------------- Home: placement ----------------
  Game.beginPlacement = function (type) {
    Game.deselect();
    const size = COC.BUILDINGS[type].size;
    const gx = Math.floor(COC.GRID.cols / 2 - size / 2);
    const gy = Math.floor(COC.GRID.rows / 2 - size / 2);
    Game.movingBuilding = null;
    Game.placing = { type: type, gx: gx, gy: gy, valid: B.canPlace(Game.state, size, gx, gy, null) };
    UI.toast('Drag to position, click to place. Esc/right-click cancels.');
  };

  Game.cancelPlacement = function () {
    Game.placing = null;
    Game.movingBuilding = null;
  };

  Game.tryPlace = function () {
    const pl = Game.placing;
    if (!pl) return;
    const size = COC.BUILDINGS[pl.type].size;
    if (!B.canPlace(Game.state, size, pl.gx, pl.gy, Game.movingBuilding || null)) {
      UI.toast('Cannot place there.');
      return;
    }
    if (Game.movingBuilding) {
      Game.movingBuilding.gx = pl.gx;
      Game.movingBuilding.gy = pl.gy;
      Game.movingBuilding = null;
      Game.placing = null;
      Game.requestSave();
      return;
    }
    // new build
    const cost = COC.BUILDINGS[pl.type].levels[0].cost;
    if (!State.canAfford(Game.state, cost)) { UI.toast('Not enough resources.'); Game.placing = null; return; }
    State.pay(Game.state, cost);
    const b = B.create(Game.state, pl.type, pl.gx, pl.gy);
    Game.state.buildings.push(b);
    Game.placing = null;
    UI.updateTopbar();
    UI.toast(COC.BUILDINGS[b.type].name + ' built!');
    Game.requestSave();
  };

  Game.moveSelected = function () {
    if (!Game.selected) return;
    const b = Game.selected;
    Game.movingBuilding = b;
    Game.placing = { type: b.type, gx: b.gx, gy: b.gy, valid: true };
    UI.hideUpgrade();
    UI.toast('Move ' + COC.BUILDINGS[b.type].name + ' — click to drop.');
  };

  // ---------------- Home: upgrades ----------------
  Game.upgradeSelected = function () {
    const b = Game.selected;
    if (!b || b.upgrading || B.isMaxLevel(b)) return;
    const next = B.nextStats(b);
    if (!State.canAfford(Game.state, next.cost)) { UI.toast('Not enough resources.'); return; }
    State.pay(Game.state, next.cost);
    B.startUpgrade(b);
    UI.updateTopbar();
    UI.updateUpgrade(b);
    UI.toast('Upgrade started.');
    Game.requestSave();
  };

  Game.finishSelected = function () {
    const b = Game.selected;
    if (!b || !b.upgrading) return;
    const cost = B.gemFinishCost(b);
    if (Game.state.resources.gems < cost) { UI.toast('Not enough gems.'); return; }
    Game.state.resources.gems -= cost;
    B.finishUpgrade(b);
    UI.updateTopbar();
    UI.updateUpgrade(b);
    UI.toast('Upgrade complete!');
    Game.requestSave();
  };

  // ---------------- Collection ----------------
  Game.collectBuilding = function (b) {
    const r = Eco.collect(Game.state, b);
    if (r && r.amount > 0) {
      UI.updateTopbar();
      UI.toast('+' + COC.fmt(r.amount) + ' ' + r.kind);
      Game.requestSave();
    }
    return r;
  };

  Game.collectSelected = function () {
    if (Game.selected) { Game.collectBuilding(Game.selected); UI.updateUpgrade(Game.selected); }
  };

  Game.collectAll = function () {
    let gold = 0, elixir = 0;
    for (const b of Game.state.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (def.category === 'resource' && def.resource && Eco.pending(b) > 0) {
        const r = Eco.collect(Game.state, b);
        if (r) { if (r.kind === 'gold') gold += r.amount; else elixir += r.amount; }
      }
    }
    UI.updateTopbar();
    if (gold || elixir) {
      UI.toast('Collected 🪙' + COC.fmt(gold) + '  💧' + COC.fmt(elixir));
      Game.requestSave();
    } else UI.toast('Nothing to collect yet.');
  };

  // ---------------- Battle ----------------
  Game.startBattle = function () {
    if (Eco.totalArmyCount(Game.state) <= 0) {
      UI.toast('Train troops first! (Army menu)');
      UI.toggleArmyMenu();
      return;
    }
    COC.Save.save(Game.state);
    Game.deselect();
    Game.placing = null;
    const th = State.townHall(Game.state);
    const diff = th ? th.level : 1;
    Game.battle = COC.Battle.create(Game.state, diff);
    Game.mode = 'battle';
    Game.centerCamera();
    UI.enterBattleUI();
    UI.updateBattleHUD();
    UI.toast('Select a troop, then tap the map to deploy!');
  };

  Game.tryDeploy = function (type, gx, gy) {
    if (COC.Battle.deploy(Game.battle, type, gx, gy)) {
      UI.renderTroopTray();
      UI.updateBattleHUD();
      if ((Game.battle.available[type] || 0) <= 0) Game.battle.selectedTroop = null;
    } else {
      UI.toast('Cannot deploy there.');
    }
  };

  Game.endBattle = function (force) {
    if (!Game.battle) return;
    if (force) {
      Game.battle.timeLeft = 0;
      COC.Battle.checkEnd(Game.battle);
      if (!Game.battle.ended) { // no troops deployed yet — force surrender
        Game.battle.ended = true;
        Game.battle.stars = COC.Battle.computeStars(Game.battle);
        Game.battle.result = Game.battle.stars >= 1 ? 'victory' : 'defeat';
      }
      Game.onBattleEnd();
    }
  };

  Game.onBattleEnd = function () {
    if (Game.battle._shown) return;
    Game.battle._shown = true;
    UI.showResult(COC.Battle.finalize(Game.battle));
  };

  Game.returnHome = function () {
    const res = COC.Battle.finalize(Game.battle);
    State.addResource(Game.state, 'gold', res.gold);
    State.addResource(Game.state, 'elixir', res.elixir);
    // surviving + undeployed troops are consumed; only undeployed remain? In CoC nothing returns.
    // We keep undeployed troops (never sent into battle).
    Game.state.army = {};
    for (const k in Game.battle.available) {
      if (Game.battle.available[k] > 0) Game.state.army[k] = Game.battle.available[k];
    }
    Game.battle = null;
    Game.mode = 'home';
    UI.exitBattleUI();
    Game.centerCamera();
    UI.updateTopbar();
    COC.Save.save(Game.state);
  };

  // ---------------- Reset ----------------
  Game.resetGame = function () {
    COC.Save.clear();
    Game.state = State.fresh();
    Game.mode = 'home';
    Game.battle = null;
    Game.deselect();
    Game.centerCamera();
    UI.updateTopbar();
    COC.Save.save(Game.state);
    UI.toast('New village created.');
  };

  COC.Game = Game;
})(window.COC);
