// Client behavior for Airstream Explorer. CSP-safe: no eval, no innerHTML with
// untrusted strings, no inline handlers. Independent modules guarded by the
// elements they need, so one script serves every page.
(function () {
  'use strict';

  // =========================================================================
  // 0. PERSISTENCE — remember the visitor's selections across visits.
  //    Thin, fail-safe localStorage wrapper (private-mode / disabled storage
  //    just becomes a no-op). Each module owns a namespaced key and decides
  //    what to save; deep-link query params always win over saved state.
  // =========================================================================
  var Store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem('ae:' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { localStorage.setItem('ae:' + key, JSON.stringify(val)); } catch (e) {}
    },
    del: function (key) {
      try { localStorage.removeItem('ae:' + key); } catch (e) {}
    },
  };


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

    // Restore saved explore preferences (sort, year, sleeps, use-case tags, tow
    // rating). Search text stays transient.
    var X_PREFS = 'explore.prefs';
    (function restoreXPrefs() {
      var p = Store.get(X_PREFS, null);
      if (!p || typeof p !== 'object') return;
      if (typeof p.sort === 'string') state.sort = p.sort;
      if (typeof p.year === 'string') state.year = p.year;
      if (typeof p.sleeps === 'number') state.sleeps = p.sleeps;
      if (Array.isArray(p.tags)) state.tags = p.tags.filter(function (t) { return typeof t === 'string'; });
      if (typeof p.tow === 'number' && p.tow > 0) state.tow = p.tow;
    })();
    function persistX() {
      Store.set(X_PREFS, { sort: state.sort, year: state.year, sleeps: state.sleeps, tags: state.tags, tow: state.tow });
    }

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
    if (elSort) elSort.addEventListener('change', function () { state.sort = this.value; persistX(); apply(); });
    if (elYear) elYear.addEventListener('change', function () { state.year = this.value; persistX(); apply(); });
    if (elSleeps) elSleeps.addEventListener('change', function () { state.sleeps = parseInt(this.value, 10) || 0; persistX(); apply(); });
    tagBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tag = btn.getAttribute('data-tag');
        var i = state.tags.indexOf(tag);
        if (i === -1) { state.tags.push(tag); btn.setAttribute('aria-pressed', 'true'); }
        else { state.tags.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
        persistX(); apply();
      });
    });

    function setTow(v, opts) {
      state.tow = v > 0 ? v : 0;
      if (towInput) towInput.value = v > 0 ? v : '';
      if (towClear) { if (v > 0) towClear.removeAttribute('hidden'); else towClear.setAttribute('hidden', ''); }
      towPresets.forEach(function (p) {
        p.classList.toggle('is-active', parseInt(p.getAttribute('data-tow'), 10) === v);
      });
      if (!opts || opts.persist !== false) persistX();
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
      Store.del(X_PREFS);
      setTow(0, { persist: false });
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

    // ---- hydrate DOM controls from restored prefs ----
    (function hydrateXControls() {
      if (elSort && state.sort) elSort.value = state.sort;
      if (elYear) elYear.value = state.year;
      if (elSleeps) elSleeps.value = state.sleeps ? String(state.sleeps) : '';
      if (state.tags && state.tags.length) {
        tagBtns.forEach(function (b) {
          if (state.tags.indexOf(b.getAttribute('data-tag')) !== -1) b.setAttribute('aria-pressed', 'true');
        });
      }
      if (state.tow > 0) setTow(state.tow, { persist: false });
    })();

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

  // ---- Campground Finder (campgrounds.html only) ---------------------------
  // Hybrid data model:
  //  * STATIC baked set (2561 sites, 47 states) powers the instant national view
  //    and is the offline fallback — the live API ranks by distance and can't
  //    return a clean nationwide set, so static is actually better at national zoom.
  //  * LIVE Recreation.gov search refreshes whatever region you pan/zoom/search
  //    into (fresh ratings, prices, posted limits), falling back to static on
  //    any failure/timeout. Source is labeled honestly in the UI.
  (function campgrounds() {
    var root = document.getElementById('cg-list');
    var mapEl = document.getElementById('cg-map');
    var dataEl = document.getElementById('cg-data');
    if (!root || !mapEl || !dataEl || typeof L === 'undefined') return;

    var STATIC = [];
    try { STATIC = (JSON.parse(dataEl.textContent) || {}).campgrounds || []; } catch (e) { STATIC = []; }

    var CLEARANCE = 3;
    var STATE_NAME = {}; // filled from option text if present
    // map full state name <-> 2-letter code so the state filter works whether the
    // active pool is static (stores full name in .s) or live (stores code in .s).
    var STATE_PAIRS = [['Alabama','AL'],['Alaska','AK'],['Arizona','AZ'],['Arkansas','AR'],['California','CA'],['Colorado','CO'],['Connecticut','CT'],['Delaware','DE'],['Florida','FL'],['Georgia','GA'],['Hawaii','HI'],['Idaho','ID'],['Illinois','IL'],['Indiana','IN'],['Iowa','IA'],['Kansas','KS'],['Kentucky','KY'],['Louisiana','LA'],['Maine','ME'],['Maryland','MD'],['Massachusetts','MA'],['Michigan','MI'],['Minnesota','MN'],['Mississippi','MS'],['Missouri','MO'],['Montana','MT'],['Nebraska','NE'],['Nevada','NV'],['New Hampshire','NH'],['New Jersey','NJ'],['New Mexico','NM'],['New York','NY'],['North Carolina','NC'],['North Dakota','ND'],['Ohio','OH'],['Oklahoma','OK'],['Oregon','OR'],['Pennsylvania','PA'],['Rhode Island','RI'],['South Carolina','SC'],['South Dakota','SD'],['Tennessee','TN'],['Texas','TX'],['Utah','UT'],['Vermont','VT'],['Virginia','VA'],['Washington','WA'],['West Virginia','WV'],['Wisconsin','WI'],['Wyoming','WY'],['District of Columbia','DC'],['Puerto Rico','PR']];
    var STATE_CODE_OF = {}, STATE_NAME_OF = {};
    STATE_PAIRS.forEach(function (p) { STATE_CODE_OF[p[0]] = p[1]; STATE_NAME_OF[p[1]] = p[0]; });
    var ORG_LONG = { NPS: 'National Park Service', USFS: 'USDA Forest Service', BLM: 'Bureau of Land Management', USACE: 'US Army Corps of Engineers', BOR: 'Bureau of Reclamation', USFWS: 'US Fish & Wildlife Service', TVA: 'Tennessee Valley Authority' };

    // Controls
    var elRig = document.getElementById('cg-rig');
    var elLen = document.getElementById('cg-len');
    var elState = document.getElementById('cg-state');
    var elSearch = document.getElementById('cg-search');
    var elSort = document.getElementById('cg-sort');
    var elHideUnknown = document.getElementById('cg-hide-unknown');
    var elFitsOnly = document.getElementById('cg-fits-only');
    var elReset = document.getElementById('cg-reset');
    var elSummary = document.getElementById('cg-summary');
    var elMore = document.getElementById('cg-more');
    var elMoreBtn = document.getElementById('cg-more-btn');

    var state = { len: 0, st: '', q: '', sort: 'rank', hideUnknown: false, fitsOnly: false, shown: 30, live: null, source: 'static' };

    // Restore saved preferences (rig/length, state, sort, fit toggles). Search
    // text is intentionally NOT persisted — it's a transient lookup, not a pref.
    var CG_PREFS = 'cg.prefs';
    var savedRig = '';
    (function restoreCgPrefs() {
      var p = Store.get(CG_PREFS, null);
      if (!p || typeof p !== 'object') return;
      if (typeof p.len === 'number' && p.len > 0) state.len = p.len;
      if (typeof p.rig === 'string') savedRig = p.rig;
      if (typeof p.st === 'string') state.st = p.st;
      if (typeof p.sort === 'string') state.sort = p.sort;
      if (typeof p.hideUnknown === 'boolean') state.hideUnknown = p.hideUnknown;
      if (typeof p.fitsOnly === 'boolean') state.fitsOnly = p.fitsOnly;
    })();
    function persistCg() {
      Store.set(CG_PREFS, {
        rig: elRig ? elRig.value : '', len: state.len, st: state.st,
        sort: state.sort, hideUnknown: state.hideUnknown, fitsOnly: state.fitsOnly,
      });
    }

    // ---- fit logic (mirrors src/lib/campgrounds.mjs exactly) ----
    function fitClass(len, max) {
      if (max == null) return 'unknown';
      if (max >= len + CLEARANCE) return 'fits';
      if (max >= len) return 'tight';
      return 'no';
    }
    var FIT_LABEL = { fits: 'Fits comfortably', tight: 'Fits — tight', no: 'Too long', unknown: 'No posted limit' };

    function num(n) { return typeof n === 'number' && !isNaN(n) ? n : null; }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function rankScore(c) { return (c.r || 0) * Math.log10((c.v || 0) + 1); }

    // Active pool: live results for the current region if present, else static.
    function pool() { return state.live && state.live.length ? state.live : STATIC; }

    function visible() {
      var len = state.len;
      var list = pool().filter(function (c) {
        if (state.st && c.s !== state.st && STATE_CODE_OF[c.s] !== state.st && STATE_NAME_OF[c.s] !== state.st) return false;
        if (state.q) {
          var hay = ((c.n || '') + ' ' + (c.p || '') + ' ' + (c.s || '')).toLowerCase();
          if (hay.indexOf(state.q) < 0) return false;
        }
        if (len > 0) {
          var f = fitClass(len, num(c.m));
          if (f === 'no') return false;
          if (state.fitsOnly && f !== 'fits') return false;
        }
        if (state.hideUnknown && c.m == null) return false;
        return true;
      });
      list.sort(function (a, b) {
        switch (state.sort) {
          case 'reviews': return (b.v || 0) - (a.v || 0);
          case 'length': return (num(b.m) || 0) - (num(a.m) || 0);
          case 'price': return (a.pr == null ? 1e9 : a.pr) - (b.pr == null ? 1e9 : b.pr);
          case 'name': return (a.n || '').localeCompare(b.n || '');
          default: { var d = rankScore(b) - rankScore(a); return d !== 0 ? d : (b.v || 0) - (a.v || 0); }
        }
      });
      return list;
    }

    // ---- map ----
    // worldCopyJump OFF: it can hand back wrapped longitudes (e.g. +240) that
    // break the geo query. Keep one world copy and clamp lon ourselves.
    var map = L.map(mapEl, { scrollWheelZoom: true, worldCopyJump: false, maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 1 }).setView([39.5, -98.35], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 18, noWrap: true,
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    var FIT_COLOR = { fits: '#2e7d4f', tight: '#c98a16', no: '#c0392b', unknown: '#8a8f98', limit: '#6B6258' };

    // Single source of truth for the fit verdict + confidence + plain-language
    // "why". Used by the list card, the map dot/popup, so they never disagree.
    //   - Rig selected -> fit verdict (fits/tight/no) with the arithmetic.
    //   - No rig       -> the campground's own posted-limit status.
    // Confidence is HONEST about provenance: 'posted' when Recreation.gov gives
    // a real max-vehicle-length, 'unverified' when the field is null. We never
    // invent a number or claim a fit we can't source. (Per-SITE precision is a
    // later upgrade; today's number is the campground's blanket posted max.)
    function fmtFtShort(n) { return (Math.round(n * 10) / 10) + '\u2032'; }
    function fitInfo(c, len) {
      var max = num(c.m);
      if (!(len > 0)) {
        if (max != null) return { cls: 'limit', label: 'Up to ' + max + '\u2032', conf: 'posted', why: '' };
        return { cls: 'unknown', label: 'No posted limit', conf: 'unverified', why: '' };
      }
      var rigTxt = fmtFtShort(len);
      if (max == null) {
        return {
          cls: 'unknown', label: 'Fit unverified', conf: 'unverified',
          why: 'No max length is posted here, so a ' + rigTxt + ' fit can\u2019t be confirmed \u2014 check Recreation.gov.',
        };
      }
      if (max >= len + CLEARANCE) {
        return {
          cls: 'fits', label: 'Fits comfortably', conf: 'posted',
          why: 'Posted ' + max + '\u2032 max \u2212 your ' + rigTxt + ' = ' + fmtFtShort(max - len) + ' to spare (clears the 3\u2032 buffer).',
        };
      }
      if (max >= len) {
        return {
          cls: 'tight', label: 'Fits \u2014 tight', conf: 'posted',
          why: 'Posted ' + max + '\u2032 max leaves just ' + fmtFtShort(max - len) + ' over your ' + rigTxt + ', under the 3\u2032 buffer \u2014 verify the exact site.',
        };
      }
      return {
        cls: 'no', label: 'Too long', conf: 'posted',
        why: 'Your ' + rigTxt + ' is ' + fmtFtShort(len - max) + ' over the posted ' + max + '\u2032 max.',
      };
    }
    // Back-compat alias: callers that only need {cls,label}.
    function chipFor(c, len) { return fitInfo(c, len); }

    function drawMarkers(list) {
      layer.clearLayers();
      var len = state.len;
      var capped = list.slice(0, 600); // keep the map snappy
      capped.forEach(function (c) {
        var lat = c.la, lon = c.lo;
        if (lat == null || lon == null) return;
        var chip = chipFor(c, len);
        var col = FIT_COLOR[chip.cls] || '#8a8f98';
        var mk = L.circleMarker([lat, lon], {
          radius: 5, color: '#fff', weight: 1, fillColor: col, fillOpacity: 0.9,
        });
        mk.bindPopup(popupHtml(c, chip));
        layer.addLayer(mk);
      });
    }

    function popupHtml(c, chip) {
      var len = state.len;
      var info = (chip && chip.why !== undefined) ? chip : fitInfo(c, len);
      var lenTxt = c.m ? c.m + "' max" : 'No posted limit';
      var price = c.pr != null ? '$' + c.pr + '/night' : '';
      var rating = c.r ? '\u2605 ' + c.r.toFixed(1) + ' (' + (c.v || 0) + ')' : '';
      var why = (len > 0 && info.why) ? '<span class="cg-pop-why">' + esc(info.why) + '</span>' : '';
      return '<div class="cg-pop"><strong>' + esc(c.n) + '</strong><br>' +
        (c.p ? esc(c.p) + '<br>' : '') +
        '<span class="cg-pop-fit cg-fit-' + info.cls + '">' + esc(info.label) + '</span> \u00b7 ' + esc(lenTxt) + '<br>' +
        why +
        [rating, price].filter(Boolean).join(' \u00b7 ') +
        (c.u ? '<br><a href="' + esc(c.u) + '" target="_blank" rel="noopener">View on Recreation.gov \u2192</a>' : '') +
        '</div>';
    }

    // ---- list ----
    function card(c, len) {
      var where = [c.s].filter(Boolean).join(', ');
      var info = fitInfo(c, len);
      var confDot = (len > 0)
        ? '<span class="cg-conf cg-conf-' + info.conf + '" title="' + (info.conf === 'posted' ? 'Based on Recreation.gov\u2019s posted max length' : 'No posted length \u2014 not verified') + '"></span>'
        : '';
      var fitChip = '<span class="cg-fit cg-fit-' + info.cls + '">' + confDot + esc(info.label) + '</span>';
      // Rig set -> chip is a verdict, so the row repeats raw max for context.
      // No rig -> chip already says "Up to N'", so do not repeat it in the row.
      var lenTxt = len > 0 ? (c.m ? c.m + "&prime; max" : 'No posted limit') : '';
      var price = c.pr != null ? '$' + c.pr + '/night' : '';
      var img = c.g
        ? '<img src="' + esc(c.g) + '" alt="' + esc(c.n) + '" loading="lazy" class="cg-card-img" width="320" height="200" referrerpolicy="no-referrer">'
        : '<div class="cg-card-img cg-card-noimg" aria-hidden="true">\u25b2</div>';
      var org = c.o ? (ORG_LONG[c.o] || c.o) : '';
      var meta = [lenTxt, price, (c.v ? c.v + ' reviews' : '')].filter(Boolean)
        .map(function (s) { return '<span>' + s + '</span>'; }).join('');
      // The "why" explainer: only when a rig is set (it explains the verdict).
      var why = (len > 0 && info.why) ? '<p class="cg-fit-why cg-fit-why-' + info.cls + '">' + esc(info.why) + '</p>' : '';
      return '<a class="cg-card" href="' + esc(c.u || '#') + '" target="_blank" rel="noopener">' + img +
        '<div class="cg-card-body"><div class="cg-card-top">' + fitChip + (c.r ? '<span class="cg-stars">\u2605 ' + c.r.toFixed(1) + '</span>' : '') + '</div>' +
        '<h3 class="cg-card-name">' + esc(c.n) + '</h3>' +
        '<p class="cg-card-where">' + esc(where) + (org ? ' \u00b7 ' + esc(org) : '') + '</p>' +
        why +
        '<p class="cg-card-meta">' + meta + '</p>' +
        '</div></a>';
    }
    function render() {
      var list = visible();
      var len = state.len;
      drawMarkers(list);
      var slice = list.slice(0, state.shown);
      root.innerHTML = slice.map(function (c) { return card(c, len); }).join('') ||
        '<p class="cg-empty">No campgrounds match in this area. Try widening the length, clearing filters, or moving the map.</p>';
      if (elMore) elMore.hidden = list.length <= state.shown;
      // summary - the count always equals exactly what is listed/plotted
      var srcTxt = state.source === 'live'
        ? 'Live from Recreation.gov'
        : (state.source === 'fallback' ? 'Live unavailable \u2014 cached set' : 'Cached set');
      var scopeTxt = state.source === 'live' ? ' in view' : '';
      var rigTxt = len > 0 ? (' \u00b7 fitting a ' + (Math.round(len * 10) / 10) + "&prime; rig") : '';
      elSummary.innerHTML = '<strong>' + list.length.toLocaleString('en-US') + '</strong> campgrounds' + scopeTxt + rigTxt +
        ' <span class="cg-src-tag cg-src-' + state.source + '">' + esc(srcTxt) + '</span>';
    }

    // ---- live scheduling ----
    var liveTimer = null, liveSeq = 0;
    function scheduleLive() {
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(fetchLive, 450);
    }
    // ---- live fetch (viewport-scoped, clipped to bounds, with fallback) ----
    var R_MI = 3958.8;
    function miBetween(aLat, aLng, bLat, bLng) {
      var dLat = (bLat - aLat) * Math.PI / 180, dLng = (bLng - aLng) * Math.PI / 180;
      var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return R_MI * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
    function fetchLive() {
      var z = map.getZoom();
      if (z < 5) { // national view: the distance-ranked API cannot return a clean nationwide set
        state.live = null; state.source = 'static'; render(); return;
      }
      var b = map.getBounds();
      var ctr = b.getCenter();
      var lat = ctr.lat, lng = ((ctr.lng + 540) % 360) - 180; // clamp to [-180,180]
      // radius = center->corner so the query covers the whole visible rectangle (+10% pad), capped at the API useful max
      var radius = Math.min(500, Math.ceil(miBetween(lat, lng, b.getNorth(), b.getEast()) * 1.1));
      var url = 'https://www.recreation.gov/api/search?entity_type=campground&size=500&lat=' +
        lat.toFixed(4) + '&lng=' + lng.toFixed(4) + '&radius=' + radius;
      var seq = ++liveSeq;
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
      fetch(url, { headers: { accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          clearTimeout(to);
          if (seq !== liveSeq) return; // a newer move superseded this one
          var rv = (d.results || []).filter(function (x) {
            return x.entity_type === 'campground' &&
              (x.campsite_equipment_name || []).some(function (e) { return /RV|Trailer|Fifth/i.test(e); }) &&
              x.latitude && x.longitude &&
              // CLIP to the actual visible rectangle so list + markers match the map exactly
              b.contains([Number(x.latitude), Number(x.longitude)]);
          }).map(normalizeLive);
          state.live = rv; state.source = 'live'; render();
        })
        .catch(function () {
          clearTimeout(to);
          if (seq !== liveSeq) return;
          state.live = null; state.source = 'fallback'; render();
        });
    }
    function maxNum(x) { return Array.isArray(x) ? Math.max.apply(null, [0].concat(x.map(Number).filter(function (n) { return !isNaN(n); }))) : (Number(x) || 0); }
    function normalizeLive(x) {
      var maxL = maxNum(x.campsite_max_vehicle_length);
      return {
        i: String(x.entity_id || x.id), n: (x.name || '').replace(/\s+/g, ' ').trim(),
        p: (x.parent_name || '').trim() || undefined, s: x.state_code || undefined,
        o: x.org_name || undefined, r: x.average_rating ? Math.round(x.average_rating * 10) / 10 : undefined,
        v: x.number_of_ratings ? Number(x.number_of_ratings) : undefined,
        m: maxL > 0 ? maxL : undefined, pr: x.price_range ? x.price_range.amount_min : undefined,
        g: x.preview_image_url || undefined, la: Number(x.latitude), lo: Number(x.longitude),
        u: 'https://www.recreation.gov/camping/campgrounds/' + (x.entity_id || x.id),
      };
    }

    // ---- wire controls ----
    function applyRigFromSelect() {
      if (!elRig) return;
      var v = parseFloat(elRig.value);
      state.len = isNaN(v) ? 0 : v;
      if (elLen) elLen.value = state.len > 0 ? Math.round(state.len) : '';
    }
    if (elRig) elRig.addEventListener('change', function () { applyRigFromSelect(); state.shown = 30; persistCg(); render(); });
    if (elLen) elLen.addEventListener('input', function () {
      var v = parseFloat(this.value); state.len = isNaN(v) ? 0 : v;
      if (elRig) elRig.value = ''; state.shown = 30; persistCg(); render();
    });
    if (elState) elState.addEventListener('change', function () {
      state.st = this.value; state.shown = 30;
      // recenter the map on the chosen state if we have a campground there
      if (this.value) {
        var inState = STATIC.filter(function (c) { return c.s === this.value; }, this);
        // static slim has no coords; just refit using live after a search is moot — keep map, filter list
      }
      persistCg(); render();
    });
    if (elSearch) elSearch.addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); state.shown = 30; render(); });
    if (elSort) elSort.addEventListener('change', function () { state.sort = this.value; persistCg(); render(); });
    if (elHideUnknown) elHideUnknown.addEventListener('change', function () { state.hideUnknown = this.checked; state.shown = 30; persistCg(); render(); });
    if (elFitsOnly) elFitsOnly.addEventListener('change', function () { state.fitsOnly = this.checked; state.shown = 30; persistCg(); render(); });
    if (elMoreBtn) elMoreBtn.addEventListener('click', function () { state.shown += 30; render(); });
    if (elReset) elReset.addEventListener('click', function () {
      state = { len: 0, st: '', q: '', sort: 'rank', hideUnknown: false, fitsOnly: false, shown: 30, live: state.live, source: state.source };
      if (elRig) elRig.value = ''; if (elLen) elLen.value = ''; if (elState) elState.value = '';
      if (elSearch) elSearch.value = ''; if (elSort) elSort.value = 'rank';
      if (elHideUnknown) elHideUnknown.checked = false; if (elFitsOnly) elFitsOnly.checked = false;
      Store.del(CG_PREFS);
      map.setView([39.5, -98.35], 4); render();
    });
    map.on('moveend', scheduleLive);

    // ---- hydrate DOM controls from restored prefs (before deep-link) ----
    (function hydrateCgControls() {
      if (elRig && savedRig) {
        for (var i = 0; i < elRig.options.length; i++) {
          if (elRig.options[i].value === savedRig) { elRig.selectedIndex = i; break; }
        }
      }
      if (elLen) elLen.value = state.len > 0 ? Math.round(state.len) : '';
      if (elState && state.st) elState.value = state.st;
      if (elSort && state.sort) elSort.value = state.sort;
      if (elHideUnknown) elHideUnknown.checked = !!state.hideUnknown;
      if (elFitsOnly) elFitsOnly.checked = !!state.fitsOnly;
    })();

    // ---- deep-link: ?len= & ?from= (coming from a detail page) ----
    var qs = new URLSearchParams(location.search);
    var qlen = parseFloat(qs.get('len'));
    if (!isNaN(qlen) && qlen > 0) {
      state.len = qlen;
      if (elLen) elLen.value = Math.round(qlen);
      // try to select the matching rig option by length
      if (elRig) {
        for (var i = 0; i < elRig.options.length; i++) {
          if (parseFloat(elRig.options[i].value) === qlen) { elRig.selectedIndex = i; break; }
        }
      }
    }

    render();
  })();
})();
