/* ui.js — DOM UI: top bar, action bar, build & army menus, upgrade popup, battle HUD, result. */
(function (COC) {
  'use strict';

  const UI = {};
  const B = COC.Buildings;
  const State = COC.State;
  const Eco = COC.Economy;
  let game = null;

  function $(id) { return document.getElementById(id); }
  function costStr(cost) {
    if (!cost) return 'Free';
    const parts = [];
    if (cost.gold) parts.push('🪙' + COC.fmt(cost.gold));
    if (cost.elixir) parts.push('💧' + COC.fmt(cost.elixir));
    if (cost.gems) parts.push('💎' + COC.fmt(cost.gems));
    return parts.length ? parts.join(' ') : 'Free';
  }

  UI.init = function (g) {
    game = g;
    UI.bindActionBar();
    UI.toastEl = $('toast');
  };

  UI.bindActionBar = function () {
    $('btn-build').onclick = function () { UI.toggleBuildMenu(); };
    $('btn-army').onclick = function () { UI.toggleArmyMenu(); };
    $('btn-attack').onclick = function () { game.startBattle(); };
    $('btn-collect').onclick = function () { game.collectAll(); };
    $('btn-reset').onclick = function () {
      if (confirm('Reset all progress and start a new village?')) game.resetGame();
    };
    // battle HUD
    $('btn-end-battle').onclick = function () { game.endBattle(true); };
    $('btn-return-home').onclick = function () { game.returnHome(); };
    // upgrade popup
    $('up-close').onclick = function () { game.deselect(); };
    $('up-upgrade').onclick = function () { game.upgradeSelected(); };
    $('up-finish').onclick = function () { game.finishSelected(); };
    $('up-collect').onclick = function () { game.collectSelected(); };
    $('up-move').onclick = function () { game.moveSelected(); };
  };

  // ---------- Top bar ----------
  UI.updateTopbar = function () {
    const r = game.state.resources;
    const caps = State.caps(game.state);
    $('res-gold').textContent = COC.fmt(r.gold) + ' / ' + COC.fmt(caps.gold);
    $('res-elixir').textContent = COC.fmt(r.elixir) + ' / ' + COC.fmt(caps.elixir);
    $('res-gems').textContent = COC.fmt(r.gems);
  };

  // ---------- Build menu ----------
  UI.toggleBuildMenu = function () {
    const el = $('build-menu');
    if (el.classList.contains('hidden')) { UI.renderBuildMenu(); el.classList.remove('hidden'); $('army-menu').classList.add('hidden'); }
    else el.classList.add('hidden');
  };

  UI.renderBuildMenu = function () {
    const list = $('build-list');
    list.innerHTML = '';
    const state = game.state;
    COC.BUILD_ORDER.forEach(function (type) {
      const def = COC.BUILDINGS[type];
      const cost = def.levels[0].cost;
      const affordable = State.canAfford(state, cost);
      const count = B.count(state, type);
      const atMax = def.max && count >= def.max;
      const item = document.createElement('div');
      item.className = 'menu-item' + ((!affordable || atMax) ? ' disabled' : '');
      item.innerHTML =
        '<div class="mi-icon" style="background:' + def.color + '"></div>' +
        '<div class="mi-body"><div class="mi-name">' + def.name + (count ? ' <span class="mi-count">x' + count + '</span>' : '') + '</div>' +
        '<div class="mi-desc">' + def.desc + '</div>' +
        '<div class="mi-cost">' + (atMax ? 'Max built' : costStr(cost)) + '</div></div>';
      if (affordable && !atMax) {
        item.onclick = function () {
          $('build-menu').classList.add('hidden');
          game.beginPlacement(type);
        };
      }
      list.appendChild(item);
    });
  };

  // ---------- Army menu ----------
  UI.toggleArmyMenu = function () {
    const el = $('army-menu');
    if (el.classList.contains('hidden')) { UI.renderArmyMenu(); el.classList.remove('hidden'); $('build-menu').classList.add('hidden'); }
    else el.classList.add('hidden');
  };

  UI.renderArmyMenu = function () {
    const state = game.state;
    const unlocked = State.unlockedTroops(state);
    const cap = State.armyCapacity(state);
    const used = State.armyUsed(state);
    $('army-cap').textContent = used + ' / ' + cap;

    const list = $('army-list');
    list.innerHTML = '';
    COC.TROOP_ORDER.forEach(function (type) {
      const t = COC.TROOPS[type];
      const isUnlocked = !!unlocked[type];
      const check = Eco.canTrain(state, type);
      const ready = state.army[type] || 0;
      const item = document.createElement('div');
      item.className = 'menu-item' + ((!isUnlocked || !check.ok) ? ' disabled' : '');
      item.innerHTML =
        '<div class="mi-icon" style="background:' + t.color + '"></div>' +
        '<div class="mi-body"><div class="mi-name">' + t.name +
        ' <span class="mi-count">ready x' + ready + '</span></div>' +
        '<div class="mi-desc">' + (isUnlocked ? t.desc : 'Locked — upgrade a Barracks to unlock.') + '</div>' +
        '<div class="mi-cost">' + costStr(t.cost) + ' · 🏠' + t.housing + ' · ⏱' + t.trainTime + 's' +
        (check.ok ? '' : ' · <span class="warn">' + (isUnlocked ? check.reason : '') + '</span>') + '</div></div>' +
        '<div class="mi-train">+</div>';
      if (isUnlocked && check.ok) {
        item.onclick = function () {
          Eco.queueTrain(state, type);
          UI.renderArmyMenu();
          UI.updateTopbar();
          game.requestSave();
        };
      }
      list.appendChild(item);
    });

    // training queue
    const q = $('train-queue');
    q.innerHTML = '';
    if (state.training.length === 0) {
      q.innerHTML = '<div class="queue-empty">No troops training.</div>';
    } else {
      state.training.forEach(function (item, i) {
        const t = COC.TROOPS[item.type];
        const remaining = Math.max(0, (item.endsAt - Date.now()) / 1000);
        const chip = document.createElement('div');
        chip.className = 'queue-chip';
        chip.style.borderColor = t.color;
        chip.innerHTML = t.name[0] + '<small>' + Math.ceil(remaining) + 's</small>';
        q.appendChild(chip);
      });
    }
  };

  UI.refreshArmyIfOpen = function () {
    if (!$('army-menu').classList.contains('hidden')) UI.renderArmyMenu();
  };

  // ---------- Upgrade popup ----------
  UI.showUpgrade = function (bld) {
    const pop = $('upgrade-popup');
    pop.classList.remove('hidden');
    UI.updateUpgrade(bld);
  };

  UI.hideUpgrade = function () {
    $('upgrade-popup').classList.add('hidden');
  };

  UI.updateUpgrade = function (bld) {
    if (!bld) return;
    const def = COC.BUILDINGS[bld.type];
    $('up-title').textContent = def.name;
    $('up-level').textContent = 'Level ' + bld.level + (B.isMaxLevel(bld) ? ' (Max)' : '');
    $('up-icon').style.background = def.color;

    const next = B.nextStats(bld);
    const upBtn = $('up-upgrade');
    const finBtn = $('up-finish');
    const colBtn = $('up-collect');
    const lines = $('up-stats');

    // stats summary
    const s = B.stats(bld);
    let html = 'HP: ' + Math.ceil(bld.hp) + ' / ' + s.hp;
    if (s.rate) html += '<br>Production: ' + s.rate + '/hr (cap ' + s.cap + ')';
    if (s.dps) html += '<br>DPS: ' + s.dps + ' · Range: ' + s.range;
    if (s.storage) html += '<br>Storage: ' + (s.storage.gold ? '🪙' + COC.fmt(s.storage.gold) + ' ' : '') + (s.storage.elixir ? '💧' + COC.fmt(s.storage.elixir) : '');
    if (s.housing) html += '<br>Housing: ' + s.housing;
    if (s.unlock) html += '<br>Unlocks: ' + s.unlock.join(', ');
    lines.innerHTML = html;

    // collect button
    const pending = Eco.pending(bld);
    if (pending > 0) {
      colBtn.classList.remove('hidden');
      colBtn.textContent = 'Collect ' + COC.fmt(pending) + (def.resource === 'gold' ? ' 🪙' : ' 💧');
    } else colBtn.classList.add('hidden');

    if (bld.upgrading) {
      upBtn.classList.add('hidden');
      finBtn.classList.remove('hidden');
      finBtn.textContent = 'Finish ' + COC.fmtTime(B.upgradeRemaining(bld)) + ' · 💎' + B.gemFinishCost(bld);
    } else if (next) {
      finBtn.classList.add('hidden');
      upBtn.classList.remove('hidden');
      const aff = State.canAfford(game.state, next.cost);
      upBtn.disabled = !aff;
      upBtn.classList.toggle('disabled', !aff);
      upBtn.textContent = 'Upgrade → Lv' + (bld.level + 1) + '  ' + costStr(next.cost) + '  ⏱' + COC.fmtTime(next.time);
    } else {
      upBtn.classList.add('hidden');
      finBtn.classList.add('hidden');
    }
  };

  // ---------- Battle HUD ----------
  UI.enterBattleUI = function () {
    $('topbar').classList.add('hidden');
    $('actionbar').classList.add('hidden');
    $('build-menu').classList.add('hidden');
    $('army-menu').classList.add('hidden');
    UI.hideUpgrade();
    $('battle-hud').classList.remove('hidden');
    $('result-screen').classList.add('hidden');
    UI.renderTroopTray();
  };

  UI.exitBattleUI = function () {
    $('battle-hud').classList.add('hidden');
    $('result-screen').classList.add('hidden');
    $('topbar').classList.remove('hidden');
    $('actionbar').classList.remove('hidden');
  };

  UI.renderTroopTray = function () {
    const tray = $('troop-tray');
    tray.innerHTML = '';
    const battle = game.battle;
    COC.TROOP_ORDER.forEach(function (type) {
      const avail = battle.available[type] || 0;
      const t = COC.TROOPS[type];
      const slot = document.createElement('div');
      slot.className = 'troop-slot' + (battle.selectedTroop === type ? ' active' : '') + (avail <= 0 ? ' disabled' : '');
      slot.style.borderColor = t.color;
      slot.innerHTML = '<div class="ts-dot" style="background:' + t.color + '"></div>' +
        '<div class="ts-name">' + t.name + '</div>' +
        '<div class="ts-count">x' + avail + '</div>';
      if (avail > 0) {
        slot.onclick = function () {
          battle.selectedTroop = (battle.selectedTroop === type) ? null : type;
          UI.renderTroopTray();
        };
      }
      tray.appendChild(slot);
    });
  };

  UI.updateBattleHUD = function () {
    const battle = game.battle;
    $('bt-timer').textContent = COC.fmtTime(battle.timeLeft);
    $('bt-destruction').textContent = Math.round(COC.Battle.destructionPct(battle) * 100) + '%';
    $('bt-troops').textContent = COC.Battle.troopsRemaining(battle);
    const stars = COC.Battle.computeStars(battle);
    $('bt-stars').innerHTML = '★'.repeat(stars) + '<span class="dim">' + '★'.repeat(3 - stars) + '</span>';
  };

  // ---------- Result screen ----------
  UI.showResult = function (res) {
    $('battle-hud').classList.add('hidden');
    const el = $('result-screen');
    el.classList.remove('hidden');
    $('rs-title').textContent = res.result === 'victory' ? 'Victory!' : 'Defeat';
    $('rs-title').className = res.result === 'victory' ? 'victory' : 'defeat';
    $('rs-stars').innerHTML = '★'.repeat(res.stars) + '<span class="dim">' + '★'.repeat(3 - res.stars) + '</span>';
    $('rs-destruction').textContent = res.destruction + '%';
    $('rs-loot').innerHTML = '🪙 ' + COC.fmt(res.gold) + '  💧 ' + COC.fmt(res.elixir);
  };

  // ---------- Toast ----------
  let toastTimer = null;
  UI.toast = function (msg) {
    const el = UI.toastEl || $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  };

  COC.UI = UI;
})(window.COC);
