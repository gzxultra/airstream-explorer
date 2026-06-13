// Client behavior for Airstream Explorer. CSP-safe: no eval, no innerHTML with
// untrusted strings, no inline handlers. Independent modules guarded by the
// elements they need, so one script serves every page.
(function () {
  'use strict';

  // =========================================================================
  // 1. FAMILY PAGE — year segmented filter over server-rendered .card list
  // =========================================================================
  (function familyFilter() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.cards .card'));
    if (!cards.length) return;
    var yearBtns = Array.prototype.slice.call(document.querySelectorAll('.seg-btn'));
    var countEl = document.getElementById('result-count');
    var activeBtn = document.querySelector('.seg-btn.is-active');
    var state = { year: activeBtn ? activeBtn.getAttribute('data-year') : 'all' };

    function apply() {
      var shown = 0;
      cards.forEach(function (card) {
        var y = card.getAttribute('data-year');
        var ok = state.year === 'all' || y === state.year;
        if (ok) { card.removeAttribute('hidden'); shown++; }
        else { card.setAttribute('hidden', ''); }
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' floorplan' : ' floorplans');
    }
    yearBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        yearBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        state.year = btn.getAttribute('data-year');
        apply();
      });
    });
    apply();
  })();

  // Shared helpers ----------------------------------------------------------
  function fmtLb(n) { return Math.round(n).toLocaleString('en-US') + ' lb'; }
  function fmtUsd(n) { return n > 0 ? '$' + Math.round(n).toLocaleString('en-US') : 'Price TBA'; }
  // Compare selection is shared between Explore and Compare pages via storage.
  var CMP_KEY = 'ax-compare';
  function cmpGet() {
    try { return JSON.parse(sessionStorage.getItem(CMP_KEY) || '[]'); } catch (e) { return []; }
  }
  function cmpSet(list) {
    try { sessionStorage.setItem(CMP_KEY, JSON.stringify(list.slice(0, 3))); } catch (e) {}
  }

  // =========================================================================
  // 2. EXPLORE PAGE — search / sort / filter + tow-vehicle matcher
  // =========================================================================
  (function explore() {
    var grid = document.getElementById('xgrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.xcard'));

    var elSearch = document.getElementById('x-search');
    var elSort = document.getElementById('x-sort');
    var elYear = document.getElementById('x-year');
    var elSleeps = document.getElementById('x-sleeps');
    var elCount = document.getElementById('x-count');
    var elEmpty = document.getElementById('x-empty');
    var elReset = document.getElementById('x-reset');
    var tagBtns = Array.prototype.slice.call(document.querySelectorAll('.tagfilter'));
    var towInput = document.getElementById('tow-input');
    var towClear = document.getElementById('tow-clear');
    var towSummary = document.getElementById('tow-summary');
    var towPresets = Array.prototype.slice.call(document.querySelectorAll('.tow-preset'));

    var state = { q: '', sort: 'price-asc', year: '2026', sleeps: 0, tags: [], tow: 0 };

    function num(card, k) { return parseFloat(card.getAttribute(k)); }

    function towVerdict(gvwr, tow) {
      if (!tow) return null;
      if (gvwr > tow) return 'over';
      if (gvwr > tow * 0.8) return 'within';
      return 'comfortable';
    }

    function apply() {
      var shown = 0, fit = 0;
      cards.forEach(function (card) {
        var name = card.getAttribute('data-name');
        var year = card.getAttribute('data-year');
        var sleeps = num(card, 'data-sleeps');
        var gvwr = num(card, 'data-gvwr');
        var tags = (card.getAttribute('data-tags') || '').split(' ');
        var ok = true;
        if (state.q && name.indexOf(state.q) === -1) ok = false;
        if (ok && state.year && year !== state.year) ok = false;
        if (ok && state.sleeps && sleeps < state.sleeps) ok = false;
        if (ok && state.tags.length) {
          for (var i = 0; i < state.tags.length; i++) {
            if (tags.indexOf(state.tags[i]) === -1) { ok = false; break; }
          }
        }
        // Tow filter is non-destructive: when set, "over" trailers are dimmed,
        // not hidden — so buyers see what's just out of reach, not a blank grid.
        var verdict = towVerdict(gvwr, state.tow);
        var fitEl = card.querySelector('[data-fit]');
        card.classList.remove('is-over', 'is-within', 'is-comfortable');
        if (verdict && fitEl) {
          card.classList.add('is-' + verdict);
          fitEl.removeAttribute('hidden');
          if (verdict === 'comfortable') { fitEl.textContent = '\u2713 Comfortable tow'; }
          else if (verdict === 'within') { fitEl.textContent = '\u25b3 Within limit'; }
          else { fitEl.textContent = '\u2715 Over your rating'; }
          fitEl.className = 'xcard-fit fit-' + verdict;
        } else if (fitEl) {
          fitEl.setAttribute('hidden', '');
        }
        if (ok) { card.removeAttribute('hidden'); shown++; if (verdict && verdict !== 'over') fit++; }
        else { card.setAttribute('hidden', ''); }
      });

      // Sort the visible cards by reordering DOM nodes.
      var keymap = {
        'price-asc': ['data-msrp', 1], 'price-desc': ['data-msrp', -1],
        'weight-asc': ['data-weight', 1], 'length-asc': ['data-length', 1],
        'length-desc': ['data-length', -1], 'sleeps-desc': ['data-sleeps', -1],
        'offgrid-desc': ['data-offgrid', -1],
      };
      var sk = keymap[state.sort] || keymap['price-asc'];
      var visible = cards.filter(function (c) { return !c.hasAttribute('hidden'); });
      visible.sort(function (a, b) {
        var d = (num(a, sk[0]) - num(b, sk[0])) * sk[1];
        if (d !== 0) return d;
        return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      });
      visible.forEach(function (c) { grid.appendChild(c); });

      if (elCount) elCount.textContent = shown;
      if (elEmpty) { if (shown === 0) elEmpty.removeAttribute('hidden'); else elEmpty.setAttribute('hidden', ''); }

      if (towSummary) {
        if (state.tow) {
          towSummary.removeAttribute('hidden');
          towSummary.textContent = 'With a ' + state.tow.toLocaleString('en-US') +
            ' lb tow rating, ' + fit + ' of the ' + shown + ' shown ' +
            (fit === 1 ? 'floorplan is' : 'floorplans are') + ' a safe match. Over-rating ones are dimmed.';
        } else {
          towSummary.setAttribute('hidden', '');
        }
      }
    }

    if (elSearch) elSearch.addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); apply(); });
    if (elSort) elSort.addEventListener('change', function () { state.sort = this.value; apply(); });
    if (elYear) elYear.addEventListener('change', function () { state.year = this.value; apply(); });
    if (elSleeps) elSleeps.addEventListener('change', function () { state.sleeps = parseInt(this.value, 10) || 0; apply(); });
    tagBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tag = btn.getAttribute('data-tag');
        var i = state.tags.indexOf(tag);
        if (i === -1) { state.tags.push(tag); btn.setAttribute('aria-pressed', 'true'); }
        else { state.tags.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
        apply();
      });
    });

    function setTow(v) {
      state.tow = v > 0 ? v : 0;
      if (towInput) towInput.value = v > 0 ? v : '';
      if (towClear) { if (v > 0) towClear.removeAttribute('hidden'); else towClear.setAttribute('hidden', ''); }
      towPresets.forEach(function (p) {
        p.classList.toggle('is-active', parseInt(p.getAttribute('data-tow'), 10) === v);
      });
      apply();
    }
    if (towInput) towInput.addEventListener('input', function () { setTow(parseInt(this.value, 10) || 0); });
    if (towClear) towClear.addEventListener('click', function () { setTow(0); });
    towPresets.forEach(function (p) {
      p.addEventListener('click', function () { setTow(parseInt(p.getAttribute('data-tow'), 10)); });
    });

    function resetAll() {
      state = { q: '', sort: 'price-asc', year: '2026', sleeps: 0, tags: [], tow: 0 };
      if (elSearch) elSearch.value = '';
      if (elSort) elSort.value = 'price-asc';
      if (elYear) elYear.value = '2026';
      if (elSleeps) elSleeps.value = '';
      tagBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      setTow(0);
    }
    if (elReset) elReset.addEventListener('click', resetAll);
    var emptyReset = document.getElementById('x-empty-reset');
    if (emptyReset) emptyReset.addEventListener('click', resetAll);

    // ---- Compare selection on explore cards -------------------------------
    var boxes = Array.prototype.slice.call(grid.querySelectorAll('.cmp-box'));
    var cmpBar = document.getElementById('cmp-bar');
    var cmpCount = document.getElementById('cmp-count');
    var cmpClear = document.getElementById('cmp-clear');
    function syncCompare() {
      var sel = cmpGet();
      boxes.forEach(function (b) {
        var on = sel.indexOf(b.getAttribute('data-slug')) !== -1;
        b.checked = on;
        b.disabled = !on && sel.length >= 3; // cap at 3
      });
      if (cmpCount) cmpCount.textContent = sel.length;
      if (cmpBar) { if (sel.length) cmpBar.removeAttribute('hidden'); else cmpBar.setAttribute('hidden', ''); }
    }
    boxes.forEach(function (b) {
      b.addEventListener('change', function () {
        var sel = cmpGet();
        var slug = b.getAttribute('data-slug');
        var i = sel.indexOf(slug);
        if (b.checked && i === -1) sel.push(slug);
        else if (!b.checked && i !== -1) sel.splice(i, 1);
        cmpSet(sel);
        syncCompare();
      });
    });
    if (cmpClear) cmpClear.addEventListener('click', function () { cmpSet([]); syncCompare(); });

    apply();
    syncCompare();
  })();

  // =========================================================================
  // 3. COMPARE PAGE — build the side-by-side table from selection + search
  // =========================================================================
  (function compare() {
    var dataEl = document.getElementById('cmp-data');
    var wrap = document.getElementById('cmp-table-wrap');
    if (!dataEl || !wrap) return;
    var DATA;
    try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var bySlug = {};
    DATA.forEach(function (d) { bySlug[d.slug] = d; });

    var table = document.getElementById('cmp-table');
    var placeholder = document.getElementById('cmp-placeholder');
    var chosenWrap = document.getElementById('cmp-chosen');
    var search = document.getElementById('cmp-search');
    var suggest = document.getElementById('cmp-suggest');

    function fmtLen2(ft) {
      var whole = Math.floor(ft), inch = Math.round((ft - whole) * 12);
      if (inch === 0) return whole + "'";
      if (inch === 12) return (whole + 1) + "'";
      return whole + "' " + inch + '"';
    }

    // Seed from ?ids= (shareable) else the shared compare selection.
    var params = new URLSearchParams(location.search);
    var ids = (params.get('ids') || '').split(',').filter(Boolean);
    if (!ids.length) ids = cmpGet();
    ids = ids.filter(function (s) { return bySlug[s]; }).slice(0, 3);

    function persist() { cmpSet(ids); }

    // Rows: [label, accessor, formatter, betterDir] — betterDir highlights the
    // best value in each numeric row (1=higher better, -1=lower better, 0=none).
    var ROWS = [
      ['Length', function (d) { return d.lengthFt; }, function (v) { return fmtLen2(v); }, -1],
      ['Dry weight', function (d) { return d.weightLb; }, fmtLb, -1],
      ['GVWR', function (d) { return d.gvwrLb; }, fmtLb, 0],
      ['Cargo capacity', function (d) { return d.cccLb; }, fmtLb, 1],
      ['Hitch weight', function (d) { return d.hitchWeightLb; }, fmtLb, 0],
      ['Sleeps', function (d) { return d.sleeps; }, function (v) { return String(v); }, 1],
      ['Fresh water', function (d) { return d.freshGal; }, function (v) { return v == null ? '\u2014' : v + ' gal'; }, 1],
      ['Gray / black', function (d) { return null; }, function (v, d) {
        var g = (d.grayGal == null) ? '\u2014' : d.grayGal;
        var b = (d.blackGal == null) ? '\u2014' : d.blackGal;
        return g + ' / ' + b + ' gal';
      }, 0],
      ['Solar', function (d) { return d.solarW; }, function (v) { return v ? v + ' W' : '\u2014'; }, 1],
      ['Battery', function (d) { return d.batteryKwh; }, function (v) { return v ? v + ' kWh' : '\u2014'; }, 1],
      ['Off-grid score', function (d) { return d.offGridScore; }, function (v) { return v + ' / 100'; }, 1],
      ['MSRP', function (d) { return d.msrp; }, fmtUsd, -1],
    ];

    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    function render() {
      persist();
      clear(chosenWrap);
      ids.forEach(function (slug) {
        var d = bySlug[slug];
        var chip = document.createElement('span');
        chip.className = 'cmp-chip';
        chip.appendChild(document.createTextNode(d.model + ' ' + d.floorplan + ' '));
        var x = document.createElement('button');
        x.type = 'button'; x.className = 'cmp-chip-x'; x.setAttribute('aria-label', 'Remove'); x.textContent = '\u00d7';
        x.addEventListener('click', function () {
          ids = ids.filter(function (s) { return s !== slug; });
          render();
        });
        chip.appendChild(x);
        chosenWrap.appendChild(chip);
      });

      if (!ids.length) {
        wrap.setAttribute('hidden', '');
        if (placeholder) placeholder.removeAttribute('hidden');
        clear(table);
        return;
      }
      if (placeholder) placeholder.setAttribute('hidden', '');
      wrap.removeAttribute('hidden');
      clear(table);
      var cols = ids.map(function (s) { return bySlug[s]; });

      var thead = document.createElement('thead');
      var htr = document.createElement('tr');
      htr.appendChild(document.createElement('th'));
      cols.forEach(function (d) {
        var th = document.createElement('th');
        var a = document.createElement('a');
        a.href = 'm/' + d.slug + '.html'; a.className = 'cmp-col-head';
        var img = document.createElement('img');
        img.src = d.thumb; img.alt = d.model + ' ' + d.floorplan; img.loading = 'lazy';
        img.width = 200; img.height = 130;
        a.appendChild(img);
        var nm = document.createElement('span');
        nm.className = 'cmp-col-name';
        nm.textContent = d.model + ' ' + d.floorplan;
        a.appendChild(nm);
        var yr = document.createElement('span');
        yr.className = 'cmp-col-year'; yr.textContent = d.year;
        a.appendChild(yr);
        th.appendChild(a);
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      ROWS.forEach(function (row) {
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.scope = 'row'; th.textContent = row[0];
        tr.appendChild(th);
        var vals = cols.map(row[1]);
        var best = null;
        if (row[3] !== 0) {
          var nums = vals.filter(function (v) { return typeof v === 'number' && !isNaN(v); });
          if (nums.length) best = row[3] === 1 ? Math.max.apply(null, nums) : Math.min.apply(null, nums);
        }
        cols.forEach(function (d, i) {
          var td = document.createElement('td');
          td.textContent = row[2](vals[i], d);
          if (best !== null && vals[i] === best && cols.length > 1) td.className = 'cmp-best';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    function closeSuggest() { if (suggest) { suggest.setAttribute('hidden', ''); clear(suggest); } }
    if (search) {
      search.addEventListener('input', function () {
        var q = this.value.trim().toLowerCase();
        clear(suggest);
        if (!q) { closeSuggest(); return; }
        var hits = DATA.filter(function (d) {
          return (d.model + ' ' + d.floorplan + ' ' + d.year).toLowerCase().indexOf(q) !== -1 &&
            ids.indexOf(d.slug) === -1;
        }).slice(0, 8);
        if (!hits.length) { closeSuggest(); return; }
        hits.forEach(function (d) {
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'cmp-suggest-item';
          b.textContent = d.model + ' ' + d.floorplan + ' (' + d.year + ')';
          b.addEventListener('click', function () {
            if (ids.length >= 3) return;
            if (ids.indexOf(d.slug) === -1) ids.push(d.slug);
            search.value = ''; closeSuggest(); render();
          });
          li.appendChild(b);
          suggest.appendChild(li);
        });
        suggest.removeAttribute('hidden');
      });
      search.addEventListener('blur', function () { setTimeout(closeSuggest, 150); });
    }

    render();
  })();

  // =========================================================================
  // 5. OFF-GRID ESTIMATOR (detail page) — mirrors src/lib/estimate.mjs exactly
  // =========================================================================
  (function offGrid() {
    var root = document.querySelector('.offgrid-tool');
    if (!root) return;
    var LOAD = { light: 1500, moderate: 2800, heavy: 5000 };
    var PSH = { summer: 5.5, shoulder: 4.0, winter: 2.5 };
    var USABLE = 0.8, DERATE = 0.7, GRAY_FRAC = 0.8;
    var WATER = {
      light: { fresh: 3.0, black: 0.75 },
      moderate: { fresh: 5.0, black: 1.0 },
      heavy: { fresh: 8.0, black: 1.5 },
    };
    function attr(k) { var v = root.getAttribute(k); return v === '' || v == null ? null : parseFloat(v); }
    var spec = {
      batteryKwh: attr('data-battery') || 0,
      solarW: attr('data-solar') || 0,
      freshGal: attr('data-fresh') || 0,
      grayGal: attr('data-gray'),
      blackGal: attr('data-black'),
    };
    var elPeople = document.getElementById('og-people');
    var elIntensity = document.getElementById('og-intensity');
    var elSeason = document.getElementById('og-season');
    var elSolar = document.getElementById('og-solar');
    var elNights = document.getElementById('og-nights');
    var elLimiter = document.getElementById('og-limiter');
    var elDetail = document.getElementById('og-detail');
    var elBars = document.getElementById('og-bars');

    function nightsLabel(d) {
      if (!isFinite(d) || d >= 13.5) return '14+ nights';
      if (d < 2) return d.toFixed(1) + ' nights';
      return Math.round(d) + ' nights';
    }
    function daysLabel(d) {
      if (!isFinite(d) || d >= 13.5) return '14+ days';
      if (d < 2) return d.toFixed(1) + ' days';
      return Math.round(d) + ' days';
    }
    function barPct(d) { return Math.max(2, Math.min(100, (Math.min(d, 14) / 14) * 100)); }

    function compute() {
      var people = parseInt(elPeople.value, 10) || 2;
      var intensity = LOAD[elIntensity.value] ? elIntensity.value : 'moderate';
      var season = PSH[elSeason.value] != null ? elSeason.value : 'summer';
      var useSolar = elSolar.checked;

      var usableWh = spec.batteryKwh * 1000 * USABLE;
      var loadWh = LOAD[intensity];
      var solarWh = useSolar ? spec.solarW * PSH[season] * DERATE : 0;
      var netWh = loadWh - solarWh;
      var powerDays = netWh > 0 ? usableWh / netWh : null;

      var w = WATER[intensity];
      var freshPerDay = w.fresh * people;
      var grayPerDay = w.fresh * GRAY_FRAC * people;
      var blackPerDay = w.black * people;
      var freshDays = freshPerDay > 0 ? spec.freshGal / freshPerDay : Infinity;
      var grayDays = (grayPerDay > 0 && spec.grayGal != null) ? spec.grayGal / grayPerDay : Infinity;
      var blackDays = (blackPerDay > 0 && spec.blackGal != null) ? spec.blackGal / blackPerDay : Infinity;
      var waterDays = Math.min(freshDays, grayDays, blackDays);
      var binds = waterDays === freshDays ? 'fresh water' : (waterDays === grayDays ? 'gray tank' : 'black tank');

      var days, limiter, detail;
      if (powerDays == null || waterDays <= powerDays) {
        days = waterDays; limiter = 'water'; detail = binds + ' fills first';
      } else {
        days = powerDays; limiter = 'power'; detail = 'house battery runs down first';
      }
      if (!isFinite(days)) days = 14;

      elNights.textContent = nightsLabel(days);
      elLimiter.textContent = limiter === 'power' ? 'Battery-limited' : 'Water-limited';
      elDetail.textContent = detail.charAt(0).toUpperCase() + detail.slice(1) + ' under these assumptions.';

      var waste = Math.min(grayDays, blackDays);
      var rows = [
        ['Battery', powerDays == null ? Infinity : powerDays, powerDays == null ? 'Solar covers it' : daysLabel(powerDays)],
        ['Fresh water', freshDays, daysLabel(freshDays)],
        ['Waste tanks', waste, daysLabel(waste)],
      ];
      // Rebuild bars without innerHTML of untrusted data (all values are numbers/fixed labels).
      while (elBars.firstChild) elBars.removeChild(elBars.firstChild);
      rows.forEach(function (r) {
        var bar = document.createElement('div'); bar.className = 'est-bar';
        var lab = document.createElement('span'); lab.className = 'est-bar-label'; lab.textContent = r[0];
        var track = document.createElement('span'); track.className = 'est-bar-track';
        var fill = document.createElement('span'); fill.className = 'est-bar-fill'; fill.style.width = barPct(r[1]) + '%';
        track.appendChild(fill);
        var val = document.createElement('span'); val.className = 'est-bar-val'; val.textContent = r[2];
        bar.appendChild(lab); bar.appendChild(track); bar.appendChild(val);
        elBars.appendChild(bar);
      });
    }
    [elPeople, elIntensity, elSeason].forEach(function (el) { if (el) el.addEventListener('change', compute); });
    if (elSolar) elSolar.addEventListener('change', compute);
    compute();
  })();
})();
