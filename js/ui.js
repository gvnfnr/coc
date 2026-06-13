/* ui.js — DOM UI: top bar, action bar, build/army/spell menus, upgrade popup, battle HUD, results. */
(function (COC) {
  'use strict';

  const UI = {};
  const B = COC.Buildings, State = COC.State, Eco = COC.Economy;
  let game = null;
  function $(id) { return document.getElementById(id); }

  UI.init = function (g) {
    game = g;
    $('btn-build').onclick = function () { UI.toggleBuildMenu(); };
    $('btn-army').onclick = function () { UI.toggleArmyMenu(); };
    $('btn-attack').onclick = function () { game.startBattle(); };
    $('btn-collect').onclick = function () { game.collectAll(); };
    $('btn-reset').onclick = function () { if (confirm('Reset all progress and start a new village?')) game.resetGame(); };
    $('btn-mute').onclick = function () { const m = COC.Audio.toggleMute(); $('btn-mute').textContent = m ? '🔇' : '🔊'; };
    $('btn-end-battle').onclick = function () { game.endBattle(true); };
    $('btn-return-home').onclick = function () { game.returnHome(); };
    $('btn-again').onclick = function () { game.returnHome(true); };
    $('up-close').onclick = function () { game.deselect(); };
    $('up-upgrade').onclick = function () { game.upgradeSelected(); };
    $('up-finish').onclick = function () { game.finishSelected(); };
    $('up-collect').onclick = function () { game.collectSelected(); };
    $('up-move').onclick = function () { game.moveSelected(); };
    UI.toastEl = $('toast');
  };

  // ---------- Top bar ----------
  UI.updateTopbar = function () {
    const r = game.state.resources, caps = State.caps(game.state);
    $('res-gold').textContent = COC.fmt(r.gold) + ' / ' + COC.fmt(caps.gold);
    $('res-elixir').textContent = COC.fmt(r.elixir) + ' / ' + COC.fmt(caps.elixir);
    $('res-dark').textContent = COC.fmt(r.dark) + ' / ' + COC.fmt(caps.dark);
    $('res-gems').textContent = COC.fmt(r.gems);
    $('top-trophies').textContent = game.state.trophies;
    $('top-builders').textContent = State.buildersFree(game.state) + '/' + game.state.builders;
  };

  // ---------- Build menu ----------
  UI.toggleBuildMenu = function () {
    const el = $('build-menu');
    if (el.classList.contains('hidden')) { UI.renderBuildMenu(); el.classList.remove('hidden'); $('army-menu').classList.add('hidden'); }
    else el.classList.add('hidden');
  };
  UI.renderBuildMenu = function () {
    const list = $('build-list'); list.innerHTML = '';
    const state = game.state;
    $('builders-info').textContent = 'Builders free: ' + State.buildersFree(state) + ' / ' + state.builders;
    COC.BUILD_ORDER.forEach(function (type) {
      const def = COC.BUILDINGS[type];
      const cost = def.levels[0].cost;
      const block = B.buildBlockReason(state, type);
      const affordable = State.canAfford(state, cost);
      const disabled = !!block || !affordable;
      const count = B.count(state, type), maxN = B.maxAllowed(state, type);
      const item = document.createElement('div');
      item.className = 'menu-item' + (disabled ? ' disabled' : '');
      const countStr = isFinite(maxN) ? (count + '/' + maxN) : (count ? 'x' + count : '');
      item.innerHTML = '<div class="mi-icon" style="background:' + def.color + '"></div>' +
        '<div class="mi-body"><div class="mi-name">' + def.name + (countStr ? ' <span class="mi-count">' + countStr + '</span>' : '') + '</div>' +
        '<div class="mi-desc">' + def.desc + '</div>' +
        '<div class="mi-cost">' + COC.costStr(cost) + (block ? ' · <span class="warn">' + (block === 'Max' ? 'Max reached' : 'Needs ' + block) + '</span>' : '') + '</div></div>';
      if (!disabled) item.onclick = function () { $('build-menu').classList.add('hidden'); game.beginPlacement(type); };
      list.appendChild(item);
    });
  };

  // ---------- Army + Spells menu ----------
  UI.toggleArmyMenu = function () {
    const el = $('army-menu');
    if (el.classList.contains('hidden')) { UI.renderArmyMenu(); el.classList.remove('hidden'); $('build-menu').classList.add('hidden'); }
    else el.classList.add('hidden');
  };
  UI.renderArmyMenu = function () {
    const state = game.state, unlocked = State.unlockedTroops(state);
    $('army-cap').textContent = State.armyUsed(state) + ' / ' + State.armyCapacity(state);
    const list = $('army-list'); list.innerHTML = '';
    COC.TROOP_ORDER.forEach(function (type) {
      const t = COC.TROOPS[type], isU = !!unlocked[type], check = Eco.canTrain(state, type), ready = state.army[type] || 0;
      const item = document.createElement('div');
      item.className = 'menu-item' + ((!isU || !check.ok) ? ' disabled' : '');
      item.innerHTML = '<div class="mi-icon" style="background:' + t.color + '"></div>' +
        '<div class="mi-body"><div class="mi-name">' + t.name + ' <span class="mi-count">ready x' + ready + '</span></div>' +
        '<div class="mi-desc">' + (isU ? t.desc : 'Locked — upgrade Barracks.') + '</div>' +
        '<div class="mi-cost">' + COC.costStr(t.cost) + ' · 🏠' + t.housing + ' · ⏱' + t.trainTime + 's' + (isU && !check.ok ? ' · <span class="warn">' + check.reason + '</span>' : '') + '</div></div><div class="mi-train">+</div>';
      if (isU && check.ok) item.onclick = function () { Eco.queueTrain(state, type); UI.renderArmyMenu(); UI.updateTopbar(); game.requestSave(); COC.Audio.play('click'); };
      list.appendChild(item);
    });
    UI.renderQueue($('train-queue'), state.training, COC.TROOPS, 'No troops training.');

    // spells
    const sunlocked = State.unlockedSpells(state), scap = State.spellCapacity(state);
    const spellSection = $('spell-section');
    if (scap > 0) {
      spellSection.classList.remove('hidden');
      $('spell-cap').textContent = State.spellUsed(state) + ' / ' + scap;
      const sl = $('spell-list'); sl.innerHTML = '';
      COC.SPELL_ORDER.forEach(function (type) {
        if (!sunlocked[type]) return;
        const sp = COC.SPELLS[type], check = Eco.canBrew(state, type), ready = state.spells[type] || 0;
        const item = document.createElement('div');
        item.className = 'menu-item' + (!check.ok ? ' disabled' : '');
        item.innerHTML = '<div class="mi-icon" style="background:' + sp.color + '"></div>' +
          '<div class="mi-body"><div class="mi-name">' + sp.name + ' <span class="mi-count">ready x' + ready + '</span></div>' +
          '<div class="mi-desc">' + sp.desc + '</div><div class="mi-cost">' + COC.costStr(sp.cost) + ' · 🏠' + sp.housing + ' · ⏱' + sp.brewTime + 's' + (!check.ok ? ' · <span class="warn">' + check.reason + '</span>' : '') + '</div></div><div class="mi-train">+</div>';
        if (check.ok) item.onclick = function () { Eco.queueBrew(state, type); UI.renderArmyMenu(); UI.updateTopbar(); game.requestSave(); COC.Audio.play('click'); };
        sl.appendChild(item);
      });
      UI.renderQueue($('brew-queue'), state.brewing, COC.SPELLS, 'No spells brewing.');
    } else spellSection.classList.add('hidden');
  };
  UI.renderQueue = function (el, queue, defs, emptyMsg) {
    el.innerHTML = '';
    if (!queue.length) { el.innerHTML = '<div class="queue-empty">' + emptyMsg + '</div>'; return; }
    queue.forEach(function (item) {
      const d = defs[item.type], remaining = Math.max(0, (item.endsAt - Date.now()) / 1000);
      const chip = document.createElement('div'); chip.className = 'queue-chip'; chip.style.borderColor = d.color;
      chip.innerHTML = d.name[0] + '<small>' + Math.ceil(remaining) + 's</small>'; el.appendChild(chip);
    });
  };
  UI.refreshArmyIfOpen = function () { if (!$('army-menu').classList.contains('hidden')) UI.renderArmyMenu(); };

  // ---------- Upgrade popup ----------
  UI.showUpgrade = function (b) { $('upgrade-popup').classList.remove('hidden'); UI.updateUpgrade(b); };
  UI.hideUpgrade = function () { $('upgrade-popup').classList.add('hidden'); };
  UI.updateUpgrade = function (bld) {
    if (!bld) return;
    const def = COC.BUILDINGS[bld.type];
    $('up-title').textContent = def.name;
    $('up-level').textContent = bld.constructing ? 'Under construction' : ('Level ' + bld.level + (B.isMaxLevel(bld) ? ' (Max)' : ''));
    $('up-icon').style.background = def.color;
    const s = B.stats(bld);
    let html = 'HP: ' + Math.ceil(bld.hp) + ' / ' + (s.hp || '—');
    if (s.rate) html += '<br>Production: ' + s.rate + '/hr · cap ' + s.cap;
    if (s.dps) html += '<br>DPS: ' + s.dps + ' · Range: ' + s.range + (def.targets ? ' · ' + def.targets : '');
    if (s.storage) { html += '<br>Storage: ' + Object.keys(s.storage).map(function (k) { return COC.RES_ICON[k] + COC.fmt(s.storage[k]); }).join(' '); }
    if (s.housing) html += '<br>Housing: ' + s.housing;
    if (s.spellCap) html += '<br>Spell capacity: ' + s.spellCap;
    if (s.unlock) html += '<br>Unlocks: ' + s.unlock.join(', ');
    if (s.dmg) html += '<br>Damage: ' + s.dmg;
    $('up-stats').innerHTML = html;

    const next = B.nextStats(bld), upBtn = $('up-upgrade'), finBtn = $('up-finish'), colBtn = $('up-collect');
    const pending = Eco.pending(bld);
    if (pending > 0) { colBtn.classList.remove('hidden'); colBtn.textContent = 'Collect ' + COC.fmt(pending) + ' ' + COC.RES_ICON[def.resource]; } else colBtn.classList.add('hidden');

    if (bld.upgrading) {
      upBtn.classList.add('hidden'); finBtn.classList.remove('hidden');
      finBtn.textContent = 'Finish ' + COC.fmtTime(B.upgradeRemaining(bld)) + ' · 💎' + B.gemFinishCost(bld);
    } else if (next) {
      finBtn.classList.add('hidden'); upBtn.classList.remove('hidden');
      const free = State.buildersFree(game.state) > 0;
      const aff = State.canAfford(game.state, next.cost) && free;
      upBtn.disabled = !aff; upBtn.classList.toggle('disabled', !aff);
      upBtn.textContent = (free ? '' : '🔨 busy · ') + 'Upgrade → Lv' + (bld.level + 1) + '  ' + COC.costStr(next.cost) + '  ⏱' + COC.fmtTime(next.time);
    } else { upBtn.classList.add('hidden'); finBtn.classList.add('hidden'); }
  };

  // ---------- Battle HUD ----------
  UI.enterBattleUI = function () {
    ['topbar', 'actionbar', 'build-menu', 'army-menu'].forEach(function (id) { $(id).classList.add('hidden'); });
    UI.hideUpgrade();
    $('battle-hud').classList.remove('hidden'); $('result-screen').classList.add('hidden');
    UI.renderTrays();
  };
  UI.exitBattleUI = function () {
    $('battle-hud').classList.add('hidden'); $('result-screen').classList.add('hidden');
    $('topbar').classList.remove('hidden'); $('actionbar').classList.remove('hidden');
  };
  UI.renderTrays = function () {
    const battle = game.battle;
    const tray = $('troop-tray'); tray.innerHTML = '';
    COC.TROOP_ORDER.forEach(function (type) {
      const avail = battle.available[type] || 0; if (!(type in battle.available)) return;
      const t = COC.TROOPS[type];
      const slot = document.createElement('div');
      slot.className = 'troop-slot' + (battle.selectedTroop === type ? ' active' : '') + (avail <= 0 ? ' disabled' : '');
      slot.style.borderColor = t.color;
      slot.innerHTML = '<div class="ts-dot" style="background:' + t.color + '"></div><div class="ts-name">' + t.name + '</div><div class="ts-count">x' + avail + '</div>';
      if (avail > 0) slot.onclick = function () { battle.selectedTroop = battle.selectedTroop === type ? null : type; battle.selectedSpell = null; UI.renderTrays(); COC.Audio.play('click'); };
      tray.appendChild(slot);
    });
    const stray = $('spell-tray'); stray.innerHTML = '';
    COC.SPELL_ORDER.forEach(function (type) {
      const avail = battle.availableSpells[type] || 0; if (!(type in battle.availableSpells)) return;
      const sp = COC.SPELLS[type];
      const slot = document.createElement('div');
      slot.className = 'troop-slot spell' + (battle.selectedSpell === type ? ' active' : '') + (avail <= 0 ? ' disabled' : '');
      slot.style.borderColor = sp.color;
      slot.innerHTML = '<div class="ts-dot" style="background:' + sp.color + '"></div><div class="ts-name">' + sp.name + '</div><div class="ts-count">x' + avail + '</div>';
      if (avail > 0) slot.onclick = function () { battle.selectedSpell = battle.selectedSpell === type ? null : type; battle.selectedTroop = null; UI.renderTrays(); COC.Audio.play('click'); };
      stray.appendChild(slot);
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

  // ---------- Result ----------
  UI.showResult = function (res) {
    $('battle-hud').classList.add('hidden');
    const el = $('result-screen'); el.classList.remove('hidden');
    $('rs-title').textContent = res.result === 'victory' ? 'Victory!' : 'Defeat';
    $('rs-title').className = res.result === 'victory' ? 'victory' : 'defeat';
    $('rs-stars').innerHTML = '★'.repeat(res.stars) + '<span class="dim">' + '★'.repeat(3 - res.stars) + '</span>';
    $('rs-destruction').textContent = res.destruction + '%';
    let loot = '🪙 ' + COC.fmt(res.gold) + '  💧 ' + COC.fmt(res.elixir); if (res.dark) loot += '  🌑 ' + COC.fmt(res.dark);
    $('rs-loot').innerHTML = loot;
    const tEl = $('rs-trophies'); tEl.textContent = (res.trophies >= 0 ? '+' : '') + res.trophies + ' 🏆';
    tEl.className = res.trophies >= 0 ? 'win' : 'lose';
  };

  let toastTimer = null;
  UI.toast = function (msg) {
    const el = UI.toastEl || $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  };

  COC.UI = UI;
})(window.COC);
