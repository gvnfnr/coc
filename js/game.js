/* game.js — orchestration: modes, loop, camera, builders, construction, battle, spells. */
(function (COC) {
  'use strict';

  const B = COC.Buildings, State = COC.State, Eco = COC.Economy, UI = COC.UI, Render = COC.Render;

  const Game = {
    canvas: null, ctx: null, mode: 'home', state: null, battle: null,
    camera: { x: 0, y: 0, zoom: 0.9 }, selected: null, placing: null, movingBuilding: null,
    hover: null, showGrid: false, _dirty: false, _lastSave: 0, _lastFrame: 0,
  };

  Game.start = function () {
    Game.canvas = document.getElementById('game-canvas');
    Game.ctx = Game.canvas.getContext('2d');
    Game.resize(); window.addEventListener('resize', Game.resize);
    Game.state = State.init();
    UI.init(Game); COC.Input.init(Game);
    Game.centerCamera(); UI.updateTopbar();
    Game._lastFrame = performance.now();
    requestAnimationFrame(Game.loop);
  };

  Game.resize = function () { Game.canvas.width = window.innerWidth; Game.canvas.height = window.innerHeight; };

  Game.centerCamera = function () {
    const mid = COC.Iso.toScreen(COC.GRID.cols / 2, COC.GRID.rows / 2);
    Game.camera.x = -mid.x * Game.camera.zoom; Game.camera.y = -mid.y * Game.camera.zoom; Game.clampCamera();
  };
  Game.clampCamera = function () {
    const z = Game.camera.zoom;
    const halfW = ((COC.GRID.cols + COC.GRID.rows) / 2) * (COC.GRID.tileW / 2) * z + 250;
    const halfH = ((COC.GRID.cols + COC.GRID.rows) / 2) * (COC.GRID.tileH / 2) * z + 250;
    Game.camera.x = Math.max(-halfW, Math.min(halfW, Game.camera.x));
    Game.camera.y = Math.max(-halfH, Math.min(halfH, Game.camera.y));
  };

  Game.loop = function (now) {
    const dt = Math.min(0.05, (now - Game._lastFrame) / 1000); Game._lastFrame = now;
    if (Game.mode === 'home') {
      Eco.tick(Game.state);
      if (Eco.tickTraining(Game.state)) { UI.refreshArmyIfOpen(); Game.requestSave(); }
      if (Eco.tickBrewing(Game.state)) { UI.refreshArmyIfOpen(); Game.requestSave(); }
      let up = false; for (const b of Game.state.buildings) if (B.tickUpgrade(b)) up = true;
      if (up) Game.requestSave();
      UI.updateTopbar();
      if (Game.selected) UI.updateUpgrade(Game.selected);
      UI.refreshArmyIfOpen();
    } else if (Game.mode === 'battle' && Game.battle) {
      if (!Game.battle.ended) { COC.Battle.update(Game.battle, dt); UI.updateBattleHUD(); if (Game.battle.ended) Game.onBattleEnd(); }
      else if (Game.battle.shake > 0 || Game.battle.explosions.length) COC.Battle.update(Game.battle, dt);
    }
    Render.scene(Game.ctx, Game);
    if (Game._dirty && now - Game._lastSave > 2500) { COC.Save.save(Game.state); Game._dirty = false; Game._lastSave = now; }
    requestAnimationFrame(Game.loop);
  };
  Game.requestSave = function () { Game._dirty = true; };

  // ---------- selection ----------
  Game.buildingAt = function (gx, gy) {
    const fx = Math.floor(gx), fy = Math.floor(gy), list = Game.state.buildings;
    for (let i = list.length - 1; i >= 0; i--) if (B.occupies(list[i], fx, fy)) return list[i];
    return null;
  };
  Game.clickAt = function (gx, gy) {
    const b = Game.buildingAt(gx, gy);
    if (b) { if (Eco.pending(b) > 0) Game.collectBuilding(b); Game.selected = b; UI.showUpgrade(b); }
    else Game.deselect();
  };
  Game.deselect = function () { Game.selected = null; UI.hideUpgrade(); };

  // ---------- placement / construction ----------
  Game.beginPlacement = function (type) {
    Game.deselect();
    const size = COC.BUILDINGS[type].size;
    const gx = Math.floor(COC.GRID.cols / 2 - size / 2), gy = Math.floor(COC.GRID.rows / 2 - size / 2);
    Game.movingBuilding = null;
    Game.placing = { type: type, gx: gx, gy: gy, valid: B.canPlace(Game.state, size, gx, gy, null) };
    UI.toast('Drag to position, click to place. Esc cancels.');
  };
  Game.cancelPlacement = function () { Game.placing = null; Game.movingBuilding = null; };
  Game.tryPlace = function () {
    const pl = Game.placing; if (!pl) return;
    const def = COC.BUILDINGS[pl.type], size = def.size;
    if (!B.canPlace(Game.state, size, pl.gx, pl.gy, Game.movingBuilding || null)) { UI.toast('Cannot place there.'); return; }
    if (Game.movingBuilding) { Game.movingBuilding.gx = pl.gx; Game.movingBuilding.gy = pl.gy; Game.movingBuilding = null; Game.placing = null; Game.requestSave(); COC.Audio.play('place'); return; }

    const block = B.buildBlockReason(Game.state, pl.type);
    if (block) { UI.toast(block === 'Max' ? 'Maximum reached.' : 'Requires Town Hall ' + B.thRequirement(pl.type)); Game.placing = null; return; }
    const cost = def.levels[0].cost;
    if (!State.canAfford(Game.state, cost)) { UI.toast('Not enough resources.'); Game.placing = null; COC.Audio.play('error'); return; }
    const needsBuilder = (def.levels[0].time || 0) > 0;
    if (needsBuilder && State.buildersFree(Game.state) <= 0) { UI.toast('No free builder — wait or buy a Builder\'s Hut.'); Game.placing = null; COC.Audio.play('error'); return; }

    State.pay(Game.state, cost);
    const b = B.create(Game.state, pl.type, pl.gx, pl.gy);
    Game.state.buildings.push(b);
    if (pl.type === 'buildershut') Game.state.builders += 1;
    if (needsBuilder) { B.startBuild(b); UI.toast('Construction started.'); COC.Audio.play('build'); }
    else { UI.toast(def.name + ' built!'); COC.Audio.play('place'); }
    Game.placing = null; UI.updateTopbar(); Game.requestSave();
  };
  Game.moveSelected = function () {
    if (!Game.selected) return; const b = Game.selected;
    Game.movingBuilding = b; Game.placing = { type: b.type, gx: b.gx, gy: b.gy, valid: true };
    UI.hideUpgrade(); UI.toast('Move ' + COC.BUILDINGS[b.type].name + ' — click to drop.');
  };

  // ---------- upgrades ----------
  Game.upgradeSelected = function () {
    const b = Game.selected; if (!b || b.upgrading || B.isMaxLevel(b)) return;
    if (State.buildersFree(Game.state) <= 0) { UI.toast('No free builder available.'); COC.Audio.play('error'); return; }
    const next = B.nextStats(b);
    if (!State.canAfford(Game.state, next.cost)) { UI.toast('Not enough resources.'); COC.Audio.play('error'); return; }
    State.pay(Game.state, next.cost); B.startUpgrade(b);
    UI.updateTopbar(); UI.updateUpgrade(b); UI.toast('Upgrade started.'); COC.Audio.play('build'); Game.requestSave();
  };
  Game.finishSelected = function () {
    const b = Game.selected; if (!b || !b.upgrading) return;
    const cost = B.gemFinishCost(b);
    if (Game.state.resources.gems < cost) { UI.toast('Not enough gems.'); COC.Audio.play('error'); return; }
    Game.state.resources.gems -= cost; B.finishUpgrade(b);
    UI.updateTopbar(); UI.updateUpgrade(b); UI.toast('Upgrade complete!'); COC.Audio.play('build'); Game.requestSave();
  };

  // ---------- collection ----------
  Game.collectBuilding = function (b) {
    const r = Eco.collect(Game.state, b);
    if (r && r.amount > 0) { UI.updateTopbar(); UI.toast('+' + COC.fmt(r.amount) + ' ' + r.kind); COC.Audio.play('collect'); Game.requestSave(); }
    return r;
  };
  Game.collectSelected = function () { if (Game.selected) { Game.collectBuilding(Game.selected); UI.updateUpgrade(Game.selected); } };
  Game.collectAll = function () {
    const got = { gold: 0, elixir: 0, dark: 0 };
    for (const b of Game.state.buildings) {
      const def = COC.BUILDINGS[b.type];
      if (def.category === 'resource' && def.resource && Eco.pending(b) > 0) { const r = Eco.collect(Game.state, b); if (r) got[r.kind] += r.amount; }
    }
    UI.updateTopbar();
    if (got.gold || got.elixir || got.dark) {
      let m = 'Collected 🪙' + COC.fmt(got.gold) + ' 💧' + COC.fmt(got.elixir); if (got.dark) m += ' 🌑' + COC.fmt(got.dark);
      UI.toast(m); COC.Audio.play('collect'); Game.requestSave();
    } else UI.toast('Nothing to collect yet.');
  };

  // ---------- battle ----------
  Game.matchDifficulty = function () {
    const th = B.thLevel(Game.state);
    const byTrophy = 1 + Math.floor(Game.state.trophies / 150);
    return Math.max(1, Math.min(6, Math.round((th + byTrophy) / 2)));
  };
  Game.startBattle = function () {
    if (Eco.totalArmyCount(Game.state) <= 0) { UI.toast('Train troops first! (Army menu)'); UI.toggleArmyMenu(); return; }
    COC.Save.save(Game.state); Game.deselect(); Game.placing = null;
    Game.battle = COC.Battle.create(Game.state, Game.matchDifficulty());
    Game.battle.sfx = function (n) { COC.Audio.play(n); };
    Game.mode = 'battle'; Game.centerCamera(); UI.enterBattleUI(); UI.updateBattleHUD();
    UI.toast('Select a troop or spell, then tap the map.');
  };
  Game.tryDeploy = function (type, gx, gy) {
    if (COC.Battle.deploy(Game.battle, type, gx, gy)) {
      UI.renderTrays(); UI.updateBattleHUD();
      if ((Game.battle.available[type] || 0) <= 0) Game.battle.selectedTroop = null;
    } else UI.toast('Cannot deploy there.');
  };
  Game.tryCastSpell = function (type, gx, gy) {
    if (COC.Battle.castSpell(Game.battle, type, gx, gy)) {
      UI.renderTrays();
      if ((Game.battle.availableSpells[type] || 0) <= 0) Game.battle.selectedSpell = null;
    } else UI.toast('No spells left.');
  };
  Game.endBattle = function (force) {
    if (!Game.battle) return;
    if (force) {
      Game.battle.timeLeft = 0; COC.Battle.checkEnd(Game.battle);
      if (!Game.battle.ended) { Game.battle.ended = true; Game.battle.stars = COC.Battle.computeStars(Game.battle); Game.battle.result = Game.battle.stars >= 1 ? 'victory' : 'defeat'; }
      Game.onBattleEnd();
    }
  };
  Game.onBattleEnd = function () {
    if (Game.battle._shown) return; Game.battle._shown = true;
    UI.showResult(COC.Battle.finalize(Game.battle));
  };
  Game.applyBattleRewards = function () {
    const res = COC.Battle.finalize(Game.battle);
    State.addResource(Game.state, 'gold', res.gold);
    State.addResource(Game.state, 'elixir', res.elixir);
    State.addResource(Game.state, 'dark', res.dark);
    Game.state.trophies = Math.max(0, Game.state.trophies + res.trophies);
    if (res.result === 'victory') Game.state.wins++; else Game.state.losses++;
    Game.state.army = {}; for (const k in Game.battle.available) if (Game.battle.available[k] > 0) Game.state.army[k] = Game.battle.available[k];
    Game.state.spells = {}; for (const k in Game.battle.availableSpells) if (Game.battle.availableSpells[k] > 0) Game.state.spells[k] = Game.battle.availableSpells[k];
  };
  Game.returnHome = function (again) {
    Game.applyBattleRewards();
    if (again && Eco.totalArmyCount(Game.state) > 0) {
      Game.battle = COC.Battle.create(Game.state, Game.matchDifficulty());
      Game.battle.sfx = function (n) { COC.Audio.play(n); };
      Game.centerCamera(); UI.enterBattleUI(); UI.updateBattleHUD();
      COC.Save.save(Game.state); return;
    }
    Game.battle = null; Game.mode = 'home'; UI.exitBattleUI(); Game.centerCamera(); UI.updateTopbar(); COC.Save.save(Game.state);
  };

  Game.resetGame = function () {
    COC.Save.clear(); Game.state = State.fresh(); Game.mode = 'home'; Game.battle = null;
    Game.deselect(); Game.centerCamera(); UI.updateTopbar(); COC.Save.save(Game.state); UI.toast('New village created.');
  };

  COC.Game = Game;
})(window.COC);
