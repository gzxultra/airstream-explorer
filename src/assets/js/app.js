// Client filtering for the catalog. CSP-safe: no eval, no innerHTML, no inline handlers.
(function () {
  'use strict';
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  if (!cards.length) return; // detail pages have no cards

  var yearBtns = Array.prototype.slice.call(document.querySelectorAll('.seg-btn'));
  var modelSel = document.getElementById('model-filter');
  var countEl = document.getElementById('result-count');

  // Initial year comes from whichever segment button is marked active in the
  // server-rendered HTML (family pages default to the latest model year), so
  // the client state matches what's already on screen. Falls back to 'all'.
  var activeBtn = document.querySelector('.seg-btn.is-active');
  var initialYear = activeBtn ? activeBtn.getAttribute('data-year') : 'all';
  var state = { year: initialYear, model: 'all' };

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var y = card.getAttribute('data-year');
      var m = card.getAttribute('data-model');
      var ok = (state.year === 'all' || y === state.year) &&
               (state.model === 'all' || m === state.model);
      if (ok) { card.removeAttribute('hidden'); shown++; }
      else { card.setAttribute('hidden', ''); }
    });
    if (countEl) {
      countEl.textContent = shown + (shown === 1 ? ' floorplan' : ' floorplans');
    }
  }

  yearBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      yearBtns.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.year = btn.getAttribute('data-year');
      apply();
    });
  });

  if (modelSel) {
    modelSel.addEventListener('change', function () {
      state.model = modelSel.value;
      apply();
    });
  }

  apply();
})();
