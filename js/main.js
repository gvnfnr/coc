/* main.js — bootstrap once the DOM is ready. */
(function (COC) {
  'use strict';
  function boot() { COC.Game.start(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.COC);
