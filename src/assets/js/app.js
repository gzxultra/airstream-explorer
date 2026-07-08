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
  // 0a-THEME — light/dark toggle. The <head> inline script already set the
  //     initial data-theme (from saved choice or OS preference) before paint,
  //     so there's no flash. Here we just (1) wire the nav button to flip and
  //     persist the choice, and (2) follow OS changes UNLESS the visitor has
  //     made an explicit choice. Guarded by #theme-toggle.
  // =========================================================================
  (function themeToggle() {
    var root = document.documentElement;
    var btn = document.getElementById('theme-toggle');
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function current() {
      return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    function apply(theme) {
      root.setAttribute('data-theme', theme);
      if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
    }
    // Reflect initial state on the button for AT.
    if (btn) btn.setAttribute('aria-pressed', String(current() === 'dark'));

    if (btn) {
      btn.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        apply(next);
        // Stored RAW (not via the JSON Store) so the <head> no-flash script,
        // which reads localStorage directly before app.js, sees a bare
        // 'dark'/'light' string and can match it.
        try { localStorage.setItem('ae:theme', next); } catch (e) {}
      });
    }
    // OS theme changes only steer the page when the user hasn't chosen.
    if (mq) {
      var onChange = function (e) {
        var saved = null;
        try { saved = localStorage.getItem('ae:theme'); } catch (e2) {}
        if (saved !== 'dark' && saved !== 'light') apply(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  // =========================================================================
  // 0b-UNITS — imperial↔metric toggle for all spec values across the site.
  //     Reads data-unit (weight|length|tanks) + data-raw attributes baked into
  //     the server-rendered HTML. Persistent via localStorage('ae:units').
  //     Conversions: lb→kg, ft→m, gal→L. Prices and dimensionless values
  //     (sleeps, off-grid score) are unchanged.
  // =========================================================================
  (function unitToggle() {
    var btn = document.getElementById('unit-toggle');
    var label = document.getElementById('unit-label');
    if (!btn) return;

    var LB_TO_KG = 0.453592;
    var FT_TO_M = 0.3048;
    var GAL_TO_L = 3.78541;

    function isMetric() {
      try { return localStorage.getItem('ae:units') === 'metric'; } catch (e) { return false; }
    }

    function fmtWeight(lb) { return Math.round(lb * LB_TO_KG).toLocaleString('en-US') + ' kg'; }
    function fmtLength(ft) {
      var m = ft * FT_TO_M;
      return m.toFixed(1).replace(/\.0$/, '') + ' m';
    }
    function fmtGal(g) { return Math.round(g * GAL_TO_L) + ' L'; }
    function fmtWeightImp(lb) { return Math.round(lb).toLocaleString('en-US') + ' lb'; }
    function fmtLengthImp(ft) {
      var whole = Math.floor(ft);
      var inches = Math.round((ft - whole) * 12);
      if (inches === 0) return whole + "'";
      if (inches === 12) return (whole + 1) + "'";
      return whole + "' " + inches + '"';
    }
    function fmtTanks(raw, metric) {
      var parts = raw.split(',');
      return parts.map(function (p) {
        var n = parseFloat(p);
        if (isNaN(n)) return '—';
        return metric ? fmtGal(n) : Math.round(n).toString();
      }).join(' / ');
    }

    function apply(metric) {
      var els = document.querySelectorAll('[data-unit]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var unit = el.getAttribute('data-unit');
        var raw = el.getAttribute('data-raw');
        if (!raw) continue;
        var text;
        if (unit === 'weight') {
          var lb = parseFloat(raw);
          if (isNaN(lb)) continue;
          text = metric ? fmtWeight(lb) : fmtWeightImp(lb);
          // Preserve trailing " GVWR" suffix if present
          if (el.className && el.className.indexOf('weight-bar-gvwr') >= 0) text += ' GVWR';
        } else if (unit === 'length') {
          var ft = parseFloat(raw);
          if (isNaN(ft)) continue;
          text = metric ? fmtLength(ft) : fmtLengthImp(ft);
        } else if (unit === 'tanks') {
          text = fmtTanks(raw, metric);
        } else {
          continue;
        }
        el.textContent = text;
      }
      if (label) label.textContent = metric ? 'kg/m' : 'lb/ft';
      btn.setAttribute('aria-pressed', String(metric));
      btn.setAttribute('aria-label', metric ? 'Switch units to imperial' : 'Switch units to metric');
      btn.setAttribute('title', metric ? 'Switch to imperial units' : 'Switch to metric units');
    }

    // Apply on load
    if (isMetric()) apply(true);

    btn.addEventListener('click', function () {
      var next = !isMetric();
      try { localStorage.setItem('ae:units', next ? 'metric' : 'imperial'); } catch (e) {}
      apply(next);
    });
  })();
    // =========================================================================
  // 7. KEYBOARD SHORTCUTS — site-wide hotkeys for power users. ? opens the
  //     help overlay, / focuses explore search, j/k navigates explore cards,
  //     d toggles dark/light, s saves the current detail-page floorplan.
  //     All shortcuts are suppressed when focus is inside an input, textarea,
  //     select, or contenteditable element, so they never interfere with typing.
  // =========================================================================
  (function keyboardShortcuts() {
    var helpEl = document.getElementById('kb-help');
    if (!helpEl) return;
    var isOpen = false;

    function openHelp() {
      helpEl.removeAttribute('hidden');
      helpEl.setAttribute('aria-hidden', 'false');
      isOpen = true;
    }
    function closeHelp() {
      helpEl.setAttribute('hidden', '');
      helpEl.setAttribute('aria-hidden', 'true');
      isOpen = false;
    }
    // Close buttons
    Array.prototype.slice.call(helpEl.querySelectorAll('[data-kb-close]')).forEach(function (el) {
      el.addEventListener('click', closeHelp);
    });

    // Explore card keyboard nav state
    var kbIdx = -1;
    function getVisibleCards() {
      var grid = document.getElementById('xgrid');
      if (!grid) return [];
      return Array.prototype.slice.call(grid.querySelectorAll('.xcard:not([hidden])'));
    }
    function clearKbFocus() {
      var old = document.querySelector('.xcard.is-kb-focus');
      if (old) old.classList.remove('is-kb-focus');
    }
    function setKbFocus(cards, idx) {
      clearKbFocus();
      if (idx < 0 || idx >= cards.length) return;
      kbIdx = idx;
      cards[idx].classList.add('is-kb-focus');
      cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function inInput(e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (e.target.isContentEditable) return true;
      return false;
    }

    document.addEventListener('keydown', function (e) {
      // Escape always closes overlays
      if (e.key === 'Escape') {
        if (isOpen) { closeHelp(); e.preventDefault(); return; }
        clearKbFocus(); kbIdx = -1;
        return;
      }
      // Don't intercept when typing in inputs
      if (inInput(e)) return;
      // Don't intercept modified keys (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      var key = e.key;

      // ? — show help
      if (key === '?') { e.preventDefault(); isOpen ? closeHelp() : openHelp(); return; }

      // / — focus search
      if (key === '/') {
        var search = document.getElementById('x-search');
        if (search) { e.preventDefault(); search.focus(); search.select(); }
        return;
      }

      // d — toggle dark mode
      if (key === 'd') {
        var toggle = document.getElementById('theme-toggle');
        if (toggle) { e.preventDefault(); toggle.click(); }
        return;
      }

      // u — toggle imperial/metric units
      if (key === 'u') {
        var unitBtn = document.getElementById('unit-toggle');
        if (unitBtn) { e.preventDefault(); unitBtn.click(); }
        return;
      }

      // s — save/unsave on detail page
      if (key === 's') {
        var detailSave = document.querySelector('.save-btn--detail');
        if (detailSave) { e.preventDefault(); detailSave.click(); }
        return;
      }

      // j/k — navigate explore cards
      if (key === 'j' || key === 'k') {
        var cards = getVisibleCards();
        if (!cards.length) return;
        e.preventDefault();
        if (key === 'j') {
          setKbFocus(cards, kbIdx < cards.length - 1 ? kbIdx + 1 : 0);
        } else {
          setKbFocus(cards, kbIdx > 0 ? kbIdx - 1 : cards.length - 1);
        }
        return;
      }

      // Enter — open focused card
      if (key === 'Enter' && kbIdx >= 0) {
        var cards2 = getVisibleCards();
        if (cards2[kbIdx]) {
          var link = cards2[kbIdx].querySelector('.xcard-link');
          if (link) { e.preventDefault(); link.click(); }
        }
        return;
      }
    });
  })();

})();

  // =========================================================================
  // 0b-LIGHTBOX — full-screen gallery viewer. Each gallery cell is a
  //     <button data-lightbox data-full data-index data-caption> inside a
  //     [data-gallery] grid. Opening reads the sibling buttons as the photo
  //     set so prev/next wrap the whole gallery. Keyboard (←/→/Esc), touch
  //     swipe, backdrop-click, and focus-trap + restore. Guarded by #lightbox.
  // =========================================================================
  (function lightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
    if (!triggers.length) return;

    var imgEl = document.getElementById('lightbox-img');
    var capEl = document.getElementById('lightbox-caption');
    var elClose = lb.querySelector('[data-lb-close]');
    var btnPrev = lb.querySelector('[data-lb-prev]');
    var btnNext = lb.querySelector('[data-lb-next]');
    var items = triggers.map(function (t) {
      return { full: t.getAttribute('data-full'), cap: t.getAttribute('data-caption') || '', trigger: t };
    });
    var idx = 0;
    var lastFocus = null;
    var single = items.length < 2;
    if (single) lb.classList.add('is-single');

    function preload(i) {
      if (i < 0 || i >= items.length) return;
      var im = new Image(); im.src = items[i].full;
    }
    function render() {
      var it = items[idx];
      imgEl.src = it.full;
      imgEl.alt = it.cap;
      capEl.textContent = it.cap;
      preload(idx + 1); preload(idx - 1);
    }
    function open(i) {
      idx = i;
      lastFocus = document.activeElement;
      lb.hidden = false;
      lb.setAttribute('aria-hidden', 'false');
      render();
      // Force a reflow so the .is-open transition runs from the hidden state.
      void lb.offsetWidth;
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      (single ? elClose : btnNext).focus();
    }
    function close() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      lb.setAttribute('aria-hidden', 'true');
      var done = function () {
        lb.hidden = true;
        lb.removeEventListener('transitionend', done);
      };
      // Respect reduced motion / no transition: hide promptly either way.
      lb.addEventListener('transitionend', done);
      setTimeout(done, 280);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function go(delta) {
      if (single) return;
      idx = (idx + delta + items.length) % items.length;
      render();
    }

    triggers.forEach(function (t, i) {
      t.addEventListener('click', function (e) { e.preventDefault(); open(i); });
    });
    Array.prototype.slice.call(lb.querySelectorAll('[data-lb-close]')).forEach(function (el) {
      el.addEventListener('click', close);
    });
    if (btnPrev) btnPrev.addEventListener('click', function () { go(-1); });
    if (btnNext) btnNext.addEventListener('click', function () { go(1); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') {
        // Simple focus trap across the visible controls.
        var f = [elClose, btnPrev, btnNext].filter(function (b) { return b && b.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Touch swipe on the image stage.
    var tx = 0, ty = 0;
    lb.addEventListener('touchstart', function (e) {
      if (!e.touches[0]) return; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (!e.changedTouches[0]) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.6) { go(dx < 0 ? 1 : -1); }
      else if (dy > 70 && Math.abs(dy) > Math.abs(dx) * 1.4) { close(); } // swipe-down to dismiss
    }, { passive: true });
  })();

  // =========================================================================
  // 0c-INSTANT NAV — prefetch a family/detail page on hover or touchstart so
  //     the click lands on an already-warm page. Each prefetch fires once;
  //     skipped for reduced-data users and only for same-origin .html links.
  //     Pairs with the CSS @view-transition for a near-instant card→detail.
  // =========================================================================
  (function instantNav() {
    var conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return;
    var seen = {};
    function prefetch(href) {
      if (!href || seen[href]) return;
      if (!/\.html(?:[#?].*)?$/.test(href) && href.indexOf('.html') === -1) return;
      seen[href] = 1;
      var l = document.createElement('link');
      l.rel = 'prefetch'; l.href = href; l.as = 'document';
      document.head.appendChild(l);
    }
    function fromEvent(e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href[0] === '#' || /^[a-z]+:/i.test(href) && href.indexOf('http') === 0 && a.host !== location.host) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      prefetch(a.href);
    }
    document.addEventListener('mouseover', fromEvent, { passive: true });
    document.addEventListener('touchstart', fromEvent, { passive: true });
  })();

  // =========================================================================
  // 0a. STICKY NAV — the top bar is pinned (CSS position:sticky). This module
  //     (1) keeps the --nav-h custom property equal to the bar's REAL height
  //     so other sticky elements (filter controls, the campground map) and
  //     anchor-jump scroll-padding offset correctly — the bar is taller on
  //     phones, where the brand stacks above the tab strip; and (2) toggles
  //     .is-stuck once the page scrolls, for the hairline + shadow "floating
  //     layer" treatment. Guarded by .topnav; no-op if the bar is absent.
  // =========================================================================
  (function stickyNav() {
    var bar = document.querySelector('.topnav');
    if (!bar) return;
    var root = document.documentElement;
    function measure() {
      var h = Math.round(bar.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty('--nav-h', h + 'px');
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var stuck = window.scrollY > 4;
        if (stuck !== bar.classList.contains('is-stuck')) {
          bar.classList.toggle('is-stuck', stuck);
          // The bar shrinks on scroll via a CSS transition; re-measure both
          // immediately (so dependents update right away) and once the
          // transition settles (so --nav-h lands on the exact final height).
          measure();
          window.setTimeout(measure, 300);
        }
        ticking = false;
      });
    }
    measure();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    // Fonts load after first paint and can reflow the bar's height; re-measure.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(function () {});
    }
  })();

  // =========================================================================
  // 0b. EXPLORE.HTML SHIM — old bookmark lands here; bounce to the canonical
  //     hub view. Guarded by [data-redirect]; no-op everywhere else. Without
  //     JS the shim still shows the full Explore experience inline.
  // =========================================================================
  (function exploreShim() {
    var shim = document.querySelector('.explore-shim[data-redirect]');
    if (!shim) return;
    location.replace(shim.getAttribute('data-redirect'));
  })();

  // =========================================================================
  // 0c. EXPLORE HUB — toggle "By family" vs "All floorplans" on index.html.
  //     Both views are server-rendered; we just show one and reflect it in the
  //     URL hash (#families default / #all) for deep-linking + back-button.
  //     Distinct markup (.viewseg / .hub-view) from the family-page year
  //     toggle (.seg-btn) so the modules never collide.
  // =========================================================================
  (function exploreHub() {
    var toggle = document.getElementById('view-toggle');
    if (!toggle) return;
    var btns = Array.prototype.slice.call(toggle.querySelectorAll('.viewseg-btn'));
    var views = {
      families: document.getElementById('view-families'),
      all: document.getElementById('view-all'),
    };
    if (!views.families || !views.all) return;

    function show(view, push) {
      if (view !== 'all') view = 'families';
      Object.keys(views).forEach(function (k) {
        if (k === view) views[k].removeAttribute('hidden');
        else views[k].setAttribute('hidden', '');
      });
      btns.forEach(function (b) {
        var on = b.getAttribute('data-view') === view;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      if (push) {
        var hash = '#' + view;
        if (location.hash !== hash) {
          try { history.pushState(null, '', view === 'families' ? location.pathname + location.search : hash); }
          catch (e) { location.hash = view === 'families' ? '' : view; }
        }
      }
    }

    function fromHash() {
      return (location.hash.replace('#', '').split('&')[0] === 'all') ? 'all' : 'families';
    }

    // Only the toggle buttons + the hero CTA drive the view switch.
    // NOTE: do NOT bind to a bare [data-view] selector — the two .hub-view
    // <section data-view="..."> wrappers also carry data-view, and binding
    // them would catch every bubbled card click and preventDefault() it,
    // killing all family/floorplan links on the homepage. Bind only to the
    // actual controls: the segmented buttons and [data-view-go] CTAs.
    var controls = btns.slice();
    Array.prototype.slice.call(document.querySelectorAll('[data-view-go]')).forEach(function (el) {
      controls.push(el);
    });
    controls.forEach(function (el) {
      el.addEventListener('click', function (e) {
        var v = el.getAttribute('data-view') || el.getAttribute('data-view-go');
        if (v !== 'all' && v !== 'families') return;
        e.preventDefault();
        show(v, true);
        if (v === 'all') { try { views.all.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {} }
      });
    });
    window.addEventListener('popstate', function () { show(fromHash(), false); });
    window.addEventListener('hashchange', function () { show(fromHash(), false); });

    show(fromHash(), false);
  })();


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
  // Compare selection is shared between Explore and Compare pages. Persist it in
  // localStorage (via Store) so a shopper's shortlist survives across visits —
  // matching the saved-campgrounds behavior, not the old per-session storage.
  var CMP_KEY = 'compare';
  function cmpGet() {
    var v = Store.get(CMP_KEY, []);
    return Array.isArray(v) ? v : [];
  }
  function cmpSet(list) {
    Store.set(CMP_KEY, (list || []).slice(0, 3));
  }

  // =========================================================================
  // 1b. SAVED FLOORPLANS — a site-wide shortlist (no cap, both types).
  //     Stored as ae:saved = [{slug, type, at}] newest-last. Exposed via the
  //     `Saved` object so the global save-button wiring (runs on every page),
  //     the nav count badge, and the Saved page all share one source of truth.
  //     A 'storage' listener keeps multiple open tabs in sync.
  // =========================================================================
  var Saved = (function () {
    var KEY = 'saved';
    function read() {
      var v = Store.get(KEY, []);
      if (!Array.isArray(v)) return [];
      return v.filter(function (x) { return x && typeof x.slug === 'string'; });
    }
    function write(list) { Store.set(KEY, list); }
    function has(slug) {
      var l = read();
      for (var i = 0; i < l.length; i++) if (l[i].slug === slug) return true;
      return false;
    }
    function add(slug, type) {
      var l = read();
      for (var i = 0; i < l.length; i++) if (l[i].slug === slug) return l;
      l.push({ slug: slug, type: (type === 'motorhome' ? 'motorhome' : 'trailer'), at: Date.now() });
      write(l); return l;
    }
    function remove(slug) {
      var l = read().filter(function (x) { return x.slug !== slug; });
      write(l); return l;
    }
    function toggle(slug, type) {
      return has(slug) ? (remove(slug), false) : (add(slug, type), true);
    }
    function clear() { write([]); }
    function count() { return read().length; }
    // Subscribe to changes (this tab's own toggles + other tabs via 'storage').
    var subs = [];
    function emit() { subs.forEach(function (fn) { try { fn(); } catch (e) {} }); }
    function onChange(fn) { subs.push(fn); }
    // Wrap mutators so local changes notify subscribers too.
    function mAdd(s, t) { var r = add(s, t); emit(); return r; }
    function mRemove(s) { var r = remove(s); emit(); return r; }
    function mToggle(s, t) { var r = toggle(s, t); emit(); return r; }
    function mClear() { clear(); emit(); }
    if (window.addEventListener) {
      window.addEventListener('storage', function (e) {
        if (e && e.key === 'ae:' + KEY) emit();
      });
    }
    return { read: read, has: has, add: mAdd, remove: mRemove, toggle: mToggle,
      clear: mClear, count: count, onChange: onChange };
  })();

  // ---- Global: wire every .save-btn + the nav count badge (all pages) ------
  (function savedGlobal() {
    var badge = document.getElementById('nav-saved-count');
    function paintBadge() {
      if (!badge) return;
      var n = Saved.count();
      if (n > 0) { badge.textContent = String(n); badge.removeAttribute('hidden'); }
      else { badge.textContent = ''; badge.setAttribute('hidden', ''); }
    }
    function paintBtn(btn) {
      var on = Saved.has(btn.getAttribute('data-slug'));
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-saved', on);
      var txt = btn.querySelector('.save-btn-text');
      if (txt) txt.textContent = on ? 'Saved' : 'Save';
      var label = btn.getAttribute('data-label-base');
      if (!label) { label = btn.getAttribute('aria-label') || 'this floorplan'; }
    }
    function paintAllBtns() {
      var btns = document.querySelectorAll('.save-btn');
      Array.prototype.forEach.call(btns, paintBtn);
    }
    var allBtns = document.querySelectorAll('.save-btn');
    Array.prototype.forEach.call(allBtns, function (btn) {
      paintBtn(btn);
      btn.addEventListener('click', function (e) {
        // On cards the button sits inside/over an <a>; never navigate on save.
        e.preventDefault(); e.stopPropagation();
        var slug = btn.getAttribute('data-slug');
        var type = btn.getAttribute('data-type');
        var nowOn = Saved.toggle(slug, type);
        btn.classList.toggle('is-saved', nowOn);
        btn.setAttribute('aria-pressed', String(nowOn));
        // brief pop animation
        btn.classList.remove('save-pop'); void btn.offsetWidth; btn.classList.add('save-pop');
      });
    });
    Saved.onChange(function () { paintBadge(); paintAllBtns(); });
    paintBadge();
  })();

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
    var typeBtns = Array.prototype.slice.call(document.querySelectorAll('#x-type .xc-type-btn'));
    var towTool = document.querySelector('.tow-tool');
    var towInput = document.getElementById('tow-input');
    var towClear = document.getElementById('tow-clear');
    var towSummary = document.getElementById('tow-summary');
    var towPresets = Array.prototype.slice.call(document.querySelectorAll('.tow-preset'));

    var state = { q: '', sort: 'price-asc', year: '2026', sleeps: 0, tags: [], tow: 0, type: 'all', price: 0 };

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
      if (p.type === 'trailer' || p.type === 'motorhome' || p.type === 'all') state.type = p.type;
      if (typeof p.price === 'number' && p.price > 0) state.price = p.price;
    })();
    function persistX() {
      Store.set(X_PREFS, { sort: state.sort, year: state.year, sleeps: state.sleeps, tags: state.tags, tow: state.tow, type: state.type, price: state.price });
    }

    function num(card, k) { return parseFloat(card.getAttribute(k)); }

    function towVerdict(gvwr, tow) {
      if (!tow) return null;
      if (gvwr > tow) return 'over';
      if (gvwr > tow * 0.8) return 'within';
      return 'comfortable';
    }

    function apply() {
      // Motorhomes are driven, not towed — the tow-vehicle matcher is
      // meaningless for them, so hide the whole section when the active type is
      // motorhomes (show it for All and Travel trailers).
      var towApplies = state.type !== 'motorhome';
      if (towTool) { if (towApplies) towTool.removeAttribute('hidden'); else towTool.setAttribute('hidden', ''); }
      var shown = 0, fit = 0;
      cards.forEach(function (card) {
        var name = card.getAttribute('data-name');
        var year = card.getAttribute('data-year');
        var type = card.getAttribute('data-type');
        var sleeps = num(card, 'data-sleeps');
        var gvwr = num(card, 'data-gvwr');
        var tags = (card.getAttribute('data-tags') || '').split(' ');
        var ok = true;
        if (state.type !== 'all' && type !== state.type) ok = false;
        if (ok && state.q && name.indexOf(state.q) === -1) ok = false;
        if (ok && state.year && year !== state.year) ok = false;
        if (ok && state.sleeps && sleeps < state.sleeps) ok = false;
        if (ok && state.price) {
          var msrp = num(card, 'data-msrp');
          if (msrp > state.price) ok = false;
        }
        if (ok && state.tags.length) {
          for (var i = 0; i < state.tags.length; i++) {
            if (tags.indexOf(state.tags[i]) === -1) { ok = false; break; }
          }
        }
        // Tow filter is non-destructive: when set, "over" trailers are dimmed,
        // not hidden — so buyers see what's just out of reach, not a blank grid.
        // Only trailers get a tow verdict; motorhomes never do.
        var verdict = (towApplies && type === 'trailer') ? towVerdict(gvwr, state.tow) : null;
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

      // Live aggregate stats for visible cards
      var statsEl = document.getElementById('x-stats');
      if (statsEl) {
        if (shown === 0) { statsEl.textContent = ''; }
        else {
          var prices = [], weights = [], lengths = [];
          visible.forEach(function (c) {
            var p = num(c, 'data-msrp'), w = num(c, 'data-weight'), l = num(c, 'data-length');
            if (p > 0) prices.push(p);
            if (w > 0) weights.push(w);
            if (l > 0) lengths.push(l);
          });
          var parts = [];
          if (prices.length >= 2) {
            var pMin = Math.min.apply(null, prices), pMax = Math.max.apply(null, prices);
            var fmtK = function (n) { return n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : '$' + n.toLocaleString('en-US'); };
            parts.push(fmtK(pMin) + ' – ' + fmtK(pMax));
          }
          if (weights.length >= 2) {
            parts.push(Math.min.apply(null, weights).toLocaleString('en-US') + ' – ' + Math.max.apply(null, weights).toLocaleString('en-US') + ' lb');
          }
          if (lengths.length >= 2) {
            var lMin = Math.min.apply(null, lengths), lMax = Math.max.apply(null, lengths);
            parts.push(Math.round(lMin) + "'" + ' – ' + Math.round(lMax) + "'" + ' long');
          }
          statsEl.textContent = parts.length ? parts.join(' · ') : '';
        }
      }

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
    var elPrice = document.getElementById('x-price');
    if (elPrice) elPrice.addEventListener('change', function () { state.price = parseInt(this.value, 10) || 0; persistX(); apply(); });
    tagBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tag = btn.getAttribute('data-tag');
        var i = state.tags.indexOf(tag);
        if (i === -1) { state.tags.push(tag); btn.setAttribute('aria-pressed', 'true'); }
        else { state.tags.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
        persistX(); apply();
      });
    });

    // Type segmented control: All / Travel trailers / Motorhomes. Reflects the
    // active type on the buttons (aria-pressed + is-active) and re-applies the
    // grid filter (which also shows/hides the tow matcher).
    function setType(t, opts) {
      if (t !== 'trailer' && t !== 'motorhome') t = 'all';
      state.type = t;
      // Most motorhomes are a later model year than the trailer default (2026),
      // so a bare type switch to Motorhomes would show almost nothing. When the
      // user narrows to a single type, widen the year to "all years" so the
      // full lineup of that type is visible; they can re-narrow the year after.
      if (t !== 'all' && state.year) {
        state.year = '';
        if (elYear) elYear.value = '';
      }
      typeBtns.forEach(function (b) {
        var on = b.getAttribute('data-type') === t;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (!opts || opts.persist !== false) persistX();
      apply();
    }
    typeBtns.forEach(function (b) {
      b.addEventListener('click', function () { setType(b.getAttribute('data-type')); });
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
      state = { q: '', sort: 'price-asc', year: '2026', sleeps: 0, tags: [], tow: 0, type: 'all', price: 0 };
      if (elSearch) elSearch.value = '';
      if (elSort) elSort.value = 'price-asc';
      if (elYear) elYear.value = '2026';
      if (elSleeps) elSleeps.value = '';
      if (elPrice) elPrice.value = '';
      tagBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      Store.del(X_PREFS);
      setType('all', { persist: false });
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
      // Compare is single-type: trailers compare with trailers, motorhomes with
      // motorhomes (their spec rows don't align). Lock the active type to the
      // first selected card's type and disable the other type's checkboxes.
      var lockType = null;
      if (sel.length) {
        for (var s = 0; s < boxes.length; s++) {
          if (sel.indexOf(boxes[s].getAttribute('data-slug')) !== -1) {
            lockType = boxes[s].getAttribute('data-type'); break;
          }
        }
      }
      boxes.forEach(function (b) {
        var on = sel.indexOf(b.getAttribute('data-slug')) !== -1;
        b.checked = on;
        var wrongType = lockType && b.getAttribute('data-type') !== lockType;
        b.disabled = (!on && sel.length >= 3) || (!on && wrongType); // cap at 3, same-type only
      });
      if (cmpCount) cmpCount.textContent = sel.length;
      if (cmpBar) { if (sel.length) cmpBar.removeAttribute('hidden'); else cmpBar.setAttribute('hidden', ''); }
    }
    boxes.forEach(function (b) {
      // tag each box with its card's type so compare can stay single-type
      var card = b.closest ? b.closest('.xcard') : null;
      if (card) b.setAttribute('data-type', card.getAttribute('data-type'));
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
    // Deep-link: motorhomes.html bounces here with #all&type=motorhome (or
    // ?type=motorhome). When present it WINS over saved prefs so the nav link
    // always lands on the motorhomes view.
    (function readTypeDeepLink() {
      var hash = location.hash || '';
      var search = location.search || '';
      var m = (hash + '&' + search).match(/type=(trailer|motorhome|all)/);
      if (m) {
        state.type = m[1];
        // arriving pre-filtered to a single type: show its full lineup (years
        // differ between trailers and motorhomes), not just the 2026 default.
        if (state.type !== 'all') state.year = '';
      }
    })();
    (function hydrateXControls() {
      if (elSort && state.sort) elSort.value = state.sort;
      if (elYear) elYear.value = state.year;
      if (elSleeps) elSleeps.value = state.sleeps ? String(state.sleeps) : '';
      if (elPrice) elPrice.value = state.price ? String(state.price) : '';
      if (state.tags && state.tags.length) {
        tagBtns.forEach(function (b) {
          if (state.tags.indexOf(b.getAttribute('data-tag')) !== -1) b.setAttribute('aria-pressed', 'true');
        });
      }
      // reflect the restored/deep-linked type on the segmented buttons
      typeBtns.forEach(function (b) {
        var on = b.getAttribute('data-type') === state.type;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (state.tow > 0) setTow(state.tow, { persist: false });
    })();

    apply();
    syncCompare();
  })();

  // =========================================================================
  // 2b. UPGRADES PAGE — filter the owner-recommended options by community
  //     signal (consensus tier), source (factory/aftermarket) and use-case.
  //     Progressive enhancement: the page is fully readable with no JS; this
  //     only reveals the filter lens and wires it up when JS is available.
  // =========================================================================
  (function upgradesFilter() {
    var lens = document.getElementById('up-lens');
    var main = document.getElementById('up-main');
    if (!lens || !main) return;

    var cards = Array.prototype.slice.call(main.querySelectorAll('.up-card'));
    if (!cards.length) return;
    var sections = Array.prototype.slice.call(main.querySelectorAll('[data-sec]'));
    var chips = Array.prototype.slice.call(lens.querySelectorAll('.up-chip'));
    var countEl = document.getElementById('up-count');
    var resetEl = document.getElementById('up-reset');
    var emptyEl = document.getElementById('up-empty');
    var emptyReset = document.getElementById('up-empty-reset');

    // The lens is server-rendered hidden so it never flashes for no-JS readers.
    lens.removeAttribute('hidden');

    // state: each filter dimension is a Set of selected values. Within a
    // dimension values are OR'd; across dimensions they are AND'd. Use-case
    // chips selected together require ALL (a card must serve every chosen use).
    var state = { fits: [], consensus: [], type: [], uc: [] };

    var UP_PREFS = 'upgrades.prefs';
    (function restore() {
      var p = Store.get(UP_PREFS, null);
      if (!p || typeof p !== 'object') return;
      ['fits', 'consensus', 'type', 'uc'].forEach(function (k) {
        if (Array.isArray(p[k])) state[k] = p[k].filter(function (v) { return typeof v === 'string'; });
      });
    })();
    function persist() { Store.set(UP_PREFS, state); }

    function matches(card) {
      if (state.fits.length) {
        // A "both" card fits whether you filter for trailers or coaches.
        var f = card.getAttribute('data-fits');
        var okf = state.fits.indexOf(f) !== -1 || (f === 'both');
        if (!okf) return false;
      }
      if (state.consensus.length && state.consensus.indexOf(card.getAttribute('data-consensus')) === -1) return false;
      if (state.type.length) {
        // "Both" cards satisfy either a Factory or an Aftermarket filter.
        var t = card.getAttribute('data-type');
        var ok = state.type.indexOf(t) !== -1 || (t === 'Both');
        if (!ok) return false;
      }
      if (state.uc.length) {
        var ucs = (card.getAttribute('data-uc') || '').split(' ');
        for (var i = 0; i < state.uc.length; i++) {
          if (ucs.indexOf(state.uc[i]) === -1) return false;
        }
      }
      return true;
    }

    function apply() {
      var shown = 0;
      cards.forEach(function (card) {
        if (matches(card)) { card.removeAttribute('hidden'); shown++; }
        else { card.setAttribute('hidden', ''); }
      });
      // Per-section counts + hide sections with nothing left.
      sections.forEach(function (sec) {
        var secCards = Array.prototype.slice.call(sec.querySelectorAll('.up-card'));
        var vis = secCards.filter(function (c) { return !c.hasAttribute('hidden'); }).length;
        var c = sec.querySelector('[data-seccount]');
        if (c) c.textContent = vis;
        if (vis === 0) sec.setAttribute('hidden', '');
        else sec.removeAttribute('hidden');
      });
      var any = state.fits.length || state.consensus.length || state.type.length || state.uc.length;
      if (countEl) {
        countEl.textContent = any
          ? (shown + ' of ' + cards.length + ' upgrades')
          : (cards.length + ' upgrades');
      }
      if (resetEl) { if (any) resetEl.removeAttribute('hidden'); else resetEl.setAttribute('hidden', ''); }
      if (emptyEl) { if (shown === 0) emptyEl.removeAttribute('hidden'); else emptyEl.setAttribute('hidden', ''); }
    }

    function toggle(dim, val, btn) {
      var arr = state[dim];
      var i = arr.indexOf(val);
      if (i === -1) { arr.push(val); btn.setAttribute('aria-pressed', 'true'); }
      else { arr.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
      persist(); apply();
    }

    chips.forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggle(btn.getAttribute('data-filter'), btn.getAttribute('data-value'), btn);
      });
    });

    function resetAll() {
      state = { fits: [], consensus: [], type: [], uc: [] };
      chips.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      Store.del(UP_PREFS);
      apply();
    }
    if (resetEl) resetEl.addEventListener('click', resetAll);
    if (emptyReset) emptyReset.addEventListener('click', resetAll);

    // Hydrate chip pressed-state from restored prefs, then apply.
    chips.forEach(function (btn) {
      var dim = btn.getAttribute('data-filter');
      var val = btn.getAttribute('data-value');
      if (state[dim] && state[dim].indexOf(val) !== -1) btn.setAttribute('aria-pressed', 'true');
    });
    apply();
  })();

  // =========================================================================
  // 2a-2. MAINTENANCE PAGE — filter the service-task cards by cadence (when)
  //     and severity. Two dimensions: within a dimension values are OR'd,
  //     across dimensions they're AND'd. Progressive enhancement: the page is
  //     fully readable with no JS; this only reveals the lens and wires it up.
  //     Self-guards off every other page.
  // =========================================================================
  (function maintenanceFilter() {
    var lens = document.getElementById('mt-lens');
    var main = document.getElementById('mt-main');
    if (!lens || !main) return;

    var cards = Array.prototype.slice.call(main.querySelectorAll('.mt-card'));
    if (!cards.length) return;
    var sections = Array.prototype.slice.call(main.querySelectorAll('[data-sec]'));
    var chips = Array.prototype.slice.call(lens.querySelectorAll('.mt-chip'));
    var countEl = document.getElementById('mt-count');
    var resetEl = document.getElementById('mt-reset');
    var emptyEl = document.getElementById('mt-empty');
    var emptyReset = document.getElementById('mt-empty-reset');

    // Server-rendered hidden so it never flashes for no-JS readers.
    lens.removeAttribute('hidden');

    var state = { cadence: [], severity: [] };
    var rig = { axle: 'any', heater: 'any', battery: 'any' };

    var MT_PREFS = 'maintenance.prefs';
    (function restore() {
      var p = Store.get(MT_PREFS, null);
      if (!p || typeof p !== 'object') return;
      ['cadence', 'severity'].forEach(function (k) {
        if (Array.isArray(p[k])) state[k] = p[k].filter(function (v) { return typeof v === 'string'; });
      });
    })();
    function persist() { Store.set(MT_PREFS, state); }

    var MT_RIG = 'maintenance.rig';
    function persistRig() { Store.set(MT_RIG, rig); }
    (function restoreRig() {
      var r = Store.get(MT_RIG, null);
      if (r && typeof r === 'object') ['axle', 'heater', 'battery'].forEach(function (k) {
        if (typeof r[k] === 'string') rig[k] = r[k];
      });
    })();

    // A task scoped to a specific rig (e.g. Nev-R-Lube axle) is hidden when the
    // owner has picked the OTHER rig. Tasks tagged "any" always show.
    function rigOk(card) {
      var keys = ['axle', 'heater', 'battery'];
      for (var i = 0; i < keys.length; i++) {
        var sel = rig[keys[i]];
        if (sel === 'any') continue;
        var cardVal = card.getAttribute('data-rig-' + keys[i]) || 'any';
        if (cardVal !== 'any' && cardVal !== sel) return false;
      }
      return true;
    }

    function matches(card) {
      if (state.cadence.length && state.cadence.indexOf(card.getAttribute('data-cadence')) === -1) return false;
      if (state.severity.length && state.severity.indexOf(card.getAttribute('data-severity')) === -1) return false;
      if (!rigOk(card)) return false;
      return true;
    }

    function apply() {
      var shown = 0;
      cards.forEach(function (card) {
        if (matches(card)) { card.removeAttribute('hidden'); shown++; }
        else { card.setAttribute('hidden', ''); }
      });
      sections.forEach(function (sec) {
        var secCards = Array.prototype.slice.call(sec.querySelectorAll('.mt-card'));
        var vis = secCards.filter(function (c) { return !c.hasAttribute('hidden'); }).length;
        var c = sec.querySelector('[data-seccount]');
        if (c) c.textContent = vis;
        if (vis === 0) sec.setAttribute('hidden', '');
        else sec.removeAttribute('hidden');
      });
      var any = state.cadence.length || state.severity.length ||
        rig.axle !== 'any' || rig.heater !== 'any' || rig.battery !== 'any';
      if (countEl) {
        countEl.textContent = any
          ? (shown + ' of ' + cards.length + ' tasks')
          : (cards.length + ' tasks');
      }
      if (resetEl) { if (any) resetEl.removeAttribute('hidden'); else resetEl.setAttribute('hidden', ''); }
      if (emptyEl) { if (shown === 0) emptyEl.removeAttribute('hidden'); else emptyEl.setAttribute('hidden', ''); }
      // Let dependent widgets (budget rollup, progress) recompute against the
      // new visibility. Single source of truth for what's shown lives here.
      if (window.__mtAfterApply) window.__mtAfterApply(cards);
    }

    function toggle(dim, val, btn) {
      var arr = state[dim];
      if (!arr) return;
      var i = arr.indexOf(val);
      if (i === -1) { arr.push(val); btn.setAttribute('aria-pressed', 'true'); }
      else { arr.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
      persist(); apply();
    }

    chips.forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggle(btn.getAttribute('data-filter'), btn.getAttribute('data-value'), btn);
      });
    });

    function resetAll() {
      state = { cadence: [], severity: [] };
      rig = { axle: 'any', heater: 'any', battery: 'any' };
      chips.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      Store.del(MT_PREFS);
      Store.del(MT_RIG);
      if (window.__mtSyncRigSelects) window.__mtSyncRigSelects(rig);
      apply();
    }
    if (resetEl) resetEl.addEventListener('click', resetAll);
    if (emptyReset) emptyReset.addEventListener('click', resetAll);

    chips.forEach(function (btn) {
      var dim = btn.getAttribute('data-filter');
      var val = btn.getAttribute('data-value');
      if (state[dim] && state[dim].indexOf(val) !== -1) btn.setAttribute('aria-pressed', 'true');
    });

    // Public hooks for the tools IIFE (my-rig selects live there, visibility here).
    window.__mtSetRig = function (dim, val) {
      if (dim in rig) { rig[dim] = val; persistRig(); apply(); }
    };
    window.__mtApply = apply;
    window.__mtResetAll = resetAll;

    apply();
  })();

  // =========================================================================
  // 2a-3. MAINTENANCE TOOLS — "my rig" selects, DIY/Shop yearly budget rollup,
  //     checklist mode, compact density + print. All progressive enhancement;
  //     no-JS readers get the full static schedule. Reads visibility from the
  //     filter IIFE (single source of truth) via window.__mtAfterApply.
  //     Self-guards off every other page.
  // =========================================================================
  (function maintenanceTools() {
    var tools = document.getElementById('mt-tools');
    var main = document.getElementById('mt-main');
    if (!tools || !main) return;
    var cards = Array.prototype.slice.call(main.querySelectorAll('.mt-card'));
    if (!cards.length) return;

    tools.removeAttribute('hidden');
    var budget = document.getElementById('mt-budget');
    if (budget) budget.removeAttribute('hidden');

    // --- My-rig selects: delegate to the filter IIFE's shared hook ----------
    var MT_RIG = 'maintenance.rig';
    var savedRig = Store.get(MT_RIG, null) || {};
    var rigSelects = Array.prototype.slice.call(tools.querySelectorAll('select[data-rig]'));
    rigSelects.forEach(function (sel) {
      var dim = sel.getAttribute('data-rig');
      if (savedRig && typeof savedRig[dim] === 'string') sel.value = savedRig[dim];
      sel.addEventListener('change', function () {
        if (window.__mtSetRig) window.__mtSetRig(dim, sel.value);
      });
    });
    // Let "Clear filters" reset the selects too.
    window.__mtSyncRigSelects = function (rig) {
      rigSelects.forEach(function (sel) {
        var dim = sel.getAttribute('data-rig');
        if (rig && typeof rig[dim] === 'string') sel.value = rig[dim];
      });
    };

    // --- Budget rollup ------------------------------------------------------
    // Transparent per-cadence "times per year" assumptions, shown to the user so
    // the annual figure is honest, not a hidden black box. The cost bands carry
    // only the recurring per-service spend (one-time tooling and rare conditional
    // repairs are kept out of the band and live in each card's note).
    var TRIPS_PER_YEAR = 6;
    var MT_FREQ = {
      trip: TRIPS_PER_YEAR, monthly: 6, quarterly: 4,
      semiannual: 2, annual: 1, multiyear: 0.25, seasonal: 2,
    };
    var basis = 'diy';
    var figEl = document.getElementById('mt-budget-fig');
    var noteEl = document.getElementById('mt-budget-note');
    var diyBtn = document.getElementById('mt-basis-diy');
    var proBtn = document.getElementById('mt-basis-pro');

    function num(card, k) { var v = parseFloat(card.getAttribute(k)); return isFinite(v) ? v : null; }

    function rollup(visibleCards) {
      var lo = 0, hi = 0, counted = 0, missing = 0;
      visibleCards.forEach(function (card) {
        var freq = MT_FREQ[card.getAttribute('data-cadence')] || 1;
        var bl = num(card, basis === 'diy' ? 'data-diy-low' : 'data-pro-low');
        var bh = num(card, basis === 'diy' ? 'data-diy-high' : 'data-pro-high');
        if (bl === null && bh === null) { missing++; return; }
        if (bl === null) bl = bh;
        if (bh === null) bh = bl;
        // A $0 task (your-time-only) still counts as "costed" — it's a real $0.
        lo += bl * freq; hi += bh * freq; counted++;
      });
      lo = Math.round(lo); hi = Math.round(hi);
      if (figEl) figEl.textContent = counted ? (lo === hi ? '$' + lo + '/yr' : '$' + lo + '\u2013' + hi + '/yr') : '\u2014';
      if (noteEl) {
        noteEl.textContent = (basis === 'diy'
          ? 'Parts & consumables only, doing the work yourself. '
          : 'Typical shop / dealer labor. ')
          + 'Annualized across ' + counted + ' costed task' + (counted === 1 ? '' : 's')
          + ' currently shown (trips assumed ' + TRIPS_PER_YEAR + '\u00D7/yr; monthly 6\u00D7, quarterly 4\u00D7, twice-a-year 2\u00D7, annual 1\u00D7, every-few-years \u00BC\u00D7, seasonal 2\u00D7).'
          + ' One-time tools and rare conditional repairs are noted on the cards but kept out of this figure.'
          + (missing ? ' ' + missing + ' shown task' + (missing === 1 ? '' : 's') + ' have no published cost and aren\u2019t included.' : '')
          + ' Estimates only \u2014 not quotes.';
      }
    }

    function setBasis(b) {
      basis = b;
      if (diyBtn) { diyBtn.classList.toggle('is-on', b === 'diy'); diyBtn.setAttribute('aria-pressed', b === 'diy'); }
      if (proBtn) { proBtn.classList.toggle('is-on', b === 'pro'); proBtn.setAttribute('aria-pressed', b === 'pro'); }
      main.classList.toggle('basis-diy', b === 'diy');
      main.classList.toggle('basis-pro', b === 'pro');
      Store.set('maintenance.basis', b);
      recompute();
    }
    if (diyBtn) diyBtn.addEventListener('click', function () { setBasis('diy'); });
    if (proBtn) proBtn.addEventListener('click', function () { setBasis('pro'); });

    function visible() { return cards.filter(function (c) { return !c.hasAttribute('hidden'); }); }
    function recompute() { rollup(visible()); }

    // Recompute whenever the filter changes visibility (rig/cadence/severity).
    window.__mtAfterApply = function () { recompute(); refreshProgress(); };

    // --- Checklist mode -----------------------------------------------------
    var MT_DONE = 'maintenance.done';
    var done = Store.get(MT_DONE, null);
    if (!done || typeof done !== 'object') done = {};
    var checkBtn = document.getElementById('mt-toggle-check');
    var progEl = document.getElementById('mt-progress');
    var checkOn = false;

    function paintDone(card) {
      var cid = card.getAttribute('data-cid');
      var box = card.querySelector('.mt-check-box');
      var on = !!done[cid];
      if (box) box.checked = on;
      card.classList.toggle('is-done', on);
    }
    function refreshProgress() {
      if (!progEl) return;
      if (!checkOn) { progEl.setAttribute('hidden', ''); return; }
      var vis = visible(), total = vis.length, n = 0;
      vis.forEach(function (c) { if (done[c.getAttribute('data-cid')]) n++; });
      progEl.textContent = n + ' of ' + total + ' done';
      progEl.removeAttribute('hidden');
    }
    cards.forEach(function (card) {
      var box = card.querySelector('.mt-check-box');
      if (!box) return;
      paintDone(card);
      box.addEventListener('change', function () {
        var cid = card.getAttribute('data-cid');
        if (box.checked) done[cid] = 1; else delete done[cid];
        Store.set(MT_DONE, done);
        card.classList.toggle('is-done', box.checked);
        refreshProgress();
      });
    });
    function setCheck(on) {
      checkOn = on;
      cards.forEach(function (card) {
        var w = card.querySelector('.mt-check');
        if (w) { if (on) w.removeAttribute('hidden'); else w.setAttribute('hidden', ''); }
      });
      if (checkBtn) { checkBtn.setAttribute('aria-pressed', on); checkBtn.classList.toggle('is-on', on); }
      Store.set('maintenance.checkmode', on ? 1 : 0);
      refreshProgress();
    }
    if (checkBtn) checkBtn.addEventListener('click', function () { setCheck(!checkOn); });

    // --- Compact density ----------------------------------------------------
    var compactBtn = document.getElementById('mt-toggle-print');
    function setCompact(on) {
      main.classList.toggle('is-compact', on);
      if (compactBtn) { compactBtn.setAttribute('aria-pressed', on); compactBtn.classList.toggle('is-on', on); }
      Store.set('maintenance.compact', on ? 1 : 0);
    }
    if (compactBtn) compactBtn.addEventListener('click', function () { setCompact(!main.classList.contains('is-compact')); });

    // --- Print button -------------------------------------------------------
    var printBtn = document.getElementById('mt-print');
    if (printBtn) printBtn.addEventListener('click', function () {
      if (!checkOn) setCheck(true); // a printed checklist wants tick boxes
      window.print();
    });

    // --- Restore persisted UI state ----------------------------------------
    var savedBasis = Store.get('maintenance.basis', 'diy');
    setBasis(savedBasis === 'pro' ? 'pro' : 'diy'); // also triggers first rollup
    if (Store.get('maintenance.checkmode', 0)) setCheck(true);
    if (Store.get('maintenance.compact', 0)) setCompact(true);
    recompute();
  })();

  // =========================================================================
  // 2b. UNIQUE STAYS PAGE — filter the stay cards by type (lookout / cabin /
  //     dispersed). Single dimension, "All" resets. Server-rendered full;
  //     this only enhances. Self-guards off every other page.
  // =========================================================================
  (function overnightFilter() {
    var lens = document.getElementById('ov-lens');
    var main = document.getElementById('ov-main');
    if (!lens || !main) return;

    var grid = main.querySelector('.ov-grid');
    var cards = Array.prototype.slice.call(main.querySelectorAll('.ov-card'));
    if (!grid || !cards.length) return;
    var chips = Array.prototype.slice.call(lens.querySelectorAll('.ov-chip'));
    var sortEl = document.getElementById('ov-sort');
    var countEl = document.getElementById('ov-count');
    var emptyEl = document.getElementById('ov-empty');
    var emptyReset = document.getElementById('ov-empty-reset');

    // Server-rendered hidden so it never flashes for no-JS readers (they get
    // the full, already-sorted static list).
    lens.removeAttribute('hidden');

    var OV_PREFS = 'overnight.prefs';
    var sel = 'all';          // selected lens, or 'all'
    var sort = 'rating';      // rating | reviews | price-asc | price-desc
    (function restore() {
      var p = Store.get(OV_PREFS, null);
      if (p && typeof p === 'object') {
        if (typeof p.lens === 'string' && p.lens) sel = p.lens;
        if (typeof p.sort === 'string' && p.sort) sort = p.sort;
      }
    })();
    if (sortEl) sortEl.value = sort;

    function num(card, k) { return parseFloat(card.getAttribute(k)) || 0; }

    // Lens display order (Big Views → Full Hookups → Boondocking), so the "All"
    // view stays grouped by intent instead of interleaving rating-less
    // boondocking cards among the rated gov ones.
    var LENS_ORDER = { view: 0, utility: 1, boondock: 2 };
    function lensRank(card) {
      var l = card.getAttribute('data-lens');
      return (l in LENS_ORDER) ? LENS_ORDER[l] : 9;
    }

    // Comparators. Ties fall back to rating then review count so the order is
    // always stable and the best-reviewed places lead. Within "All" we keep the
    // lens grouping first; when a single lens is selected, rank is constant so
    // it has no effect and the chosen sort fully governs.
    function cmp(a, b) {
      var lr = lensRank(a) - lensRank(b);
      if (lr) return lr;
      switch (sort) {
        case 'reviews':    return num(b, 'data-reviews') - num(a, 'data-reviews') || num(b, 'data-rating') - num(a, 'data-rating');
        case 'price-asc':  return num(a, 'data-price') - num(b, 'data-price') || num(b, 'data-rating') - num(a, 'data-rating');
        case 'price-desc': return num(b, 'data-price') - num(a, 'data-price') || num(b, 'data-rating') - num(a, 'data-rating');
        case 'rating':
        default:           return num(b, 'data-rating') - num(a, 'data-rating') || num(b, 'data-reviews') - num(a, 'data-reviews');
      }
    }

    function apply() {
      // Reorder the DOM to the chosen sort, then show/hide by lens. Reattaching
      // nodes in sorted order is cheap at this scale (72 cards) and keeps the
      // grid's source order correct for tabbing + no surprise on re-filter.
      cards.slice().sort(cmp).forEach(function (card) { grid.appendChild(card); });

      var shown = 0;
      cards.forEach(function (card) {
        var ok = (sel === 'all') || card.getAttribute('data-lens') === sel;
        if (ok) { card.removeAttribute('hidden'); shown++; }
        else { card.setAttribute('hidden', ''); }
      });
      chips.forEach(function (b) {
        var on = b.getAttribute('data-value') === sel;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      // Tell the map (campsitesMap, if present) which lens is showing so it can
      // hide/show the matching pins. Decoupled via a DOM event so the list and
      // map have no direct dependency and either can be absent.
      try { document.dispatchEvent(new CustomEvent('ae:lens', { detail: { lens: sel } })); } catch (e) {}
      if (countEl) {
        countEl.textContent = (sel === 'all')
          ? (cards.length + ' sites')
          : (shown + ' of ' + cards.length + ' sites');
      }
      if (emptyEl) { if (shown === 0) emptyEl.removeAttribute('hidden'); else emptyEl.setAttribute('hidden', ''); }
    }

    function persist() { Store.set(OV_PREFS, { lens: sel, sort: sort }); }

    function chooseLens(val) { sel = val; persist(); apply(); }

    chips.forEach(function (btn) {
      btn.addEventListener('click', function () { chooseLens(btn.getAttribute('data-value')); });
    });
    if (sortEl) sortEl.addEventListener('change', function () { sort = this.value; persist(); apply(); });
    if (emptyReset) emptyReset.addEventListener('click', function () { chooseLens('all'); });

    apply();
  })();

  // =========================================================================
  // 2b. CAMPSITES MAP — one interactive map for all three lenses on the
  //     Campsites hub. Self-contained and independent of the campground
  //     Finder map (that one is a much heavier live-fetch + clustering module
  //     on its own page). Reuses the SAME China-safe basemap infrastructure:
  //     a self-hosted vector basemap (assets/map/*, zero external CDN), the
  //     same /tiles/ same-origin raster proxy for satellite/terrain, and the
  //     same lazy-loaded vendored MapLibre. The LIST is the source of truth and
  //     renders with zero dependency on this; the map upgrades in place when
  //     (and only if) WebGL + the library are available, and degrades to an
  //     honest notice otherwise. Listens for 'ae:lens' from overnightFilter so
  //     the visible pins always match the chosen filter chip.
  // =========================================================================
  (function campsitesMap() {
    var mapEl = document.getElementById('cs-map');
    var dataEl = document.getElementById('cs-map-data');
    if (!mapEl || !dataEl) return;

    var POINTS = [];
    try { POINTS = JSON.parse(dataEl.textContent) || []; } catch (e) { return; }
    if (!POINTS.length) return;

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Per-lens dot colors — mirror the card/legend accents exactly:
    // view-green, utility-copper, boondock slate-indigo.
    var LENS_COLOR = { view: '#3f7d54', utility: '#b05c32', boondock: '#4a5568' };
    var byId = {};
    POINTS.forEach(function (p) { byId[p.i] = p; });

    // ---- China-safe basemap config (same origin as the Finder map) ---------
    var MAP_BASE = (window.__AE_MAP_BASE__ || 'assets/map/');
    var GLYPHS = MAP_BASE + 'glyphs/{fontstack}/{range}.pbf';
    var STATES_URL = MAP_BASE + 'us-states.json';
    var MAP_FONT = ['Open Sans Regular'];
    var ESRI_ATTR = 'Tiles \u00a9 Esri';
    var BASEMAPS = {
      editorial: { label: 'Map', kind: 'vector' },
      satellite: { label: 'Satellite', kind: 'raster', tiles: ['/tiles/sat/{z}/{y}/{x}'], attribution: ESRI_ATTR + ', Maxar, Earthstar Geographics', maxzoom: 19 },
      terrain: { label: 'Terrain', kind: 'raster', tiles: ['/tiles/topo/{z}/{y}/{x}'], attribution: ESRI_ATTR + ', USGS, NOAA', maxzoom: 19 },
    };
    var DEFAULT_BASEMAP = 'editorial';
    function currentBasemap() {
      var v = Store.get('cs.basemap', DEFAULT_BASEMAP);
      return BASEMAPS[v] ? v : DEFAULT_BASEMAP;
    }
    function onDarkBasemap() {
      var b = BASEMAPS[currentBasemap()];
      return !!(b && b.kind === 'raster');
    }
    function localStyle() {
      return {
        version: 8, glyphs: GLYPHS,
        sources: { states: { type: 'geojson', data: STATES_URL } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#dbe3e7' } },
          { id: 'state-fill', type: 'fill', source: 'states', paint: { 'fill-color': '#f0e9dc' } },
          { id: 'state-line', type: 'line', source: 'states', paint: { 'line-color': '#d2c6b1', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 5, 1, 8, 1.6] } },
          { id: 'state-label', type: 'symbol', source: 'states', maxzoom: 7,
            layout: { 'text-field': ['get', 'name'], 'text-font': MAP_FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 5, 12], 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 8 },
            paint: { 'text-color': '#a99c86', 'text-halo-color': 'rgba(255,255,255,.85)', 'text-halo-width': 1.2 } },
        ],
      };
    }
    function rasterStyle(kind) {
      var b = BASEMAPS[kind];
      return {
        version: 8, glyphs: GLYPHS,
        sources: { base: { type: 'raster', tiles: b.tiles, tileSize: 256, minzoom: 0, maxzoom: b.maxzoom || 19, attribution: b.attribution, scheme: 'xyz' } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#1a2730' } },
          { id: 'base', type: 'raster', source: 'base', paint: { 'raster-fade-duration': 200 } },
        ],
      };
    }
    function bareStyle() {
      return { version: 8, glyphs: GLYPHS, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dbe3e7' } }] };
    }
    function styleFor(name) {
      return (BASEMAPS[name] && BASEMAPS[name].kind === 'raster') ? rasterStyle(name) : localStyle();
    }

    // ---- GeoJSON the pin layer reads. `sel` controls which lenses show. -----
    var selLens = 'all';
    function features() {
      var feats = [];
      for (var i = 0; i < POINTS.length; i++) {
        var p = POINTS[i];
        if (selLens !== 'all' && p.l !== selLens) continue;
        feats.push({
          type: 'Feature',
          properties: { i: p.i, col: LENS_COLOR[p.l] || '#8a8f98' },
          geometry: { type: 'Point', coordinates: [Number(p.x), Number(p.y)] },
        });
      }
      return { type: 'FeatureCollection', features: feats };
    }

    function showUnavailable() {
      var html = '<div class="cs-map-fallback" role="note">'
        + '<span class="cs-map-fallback-pin" aria-hidden="true">\u25b2</span>'
        + '<strong>Map unavailable</strong>'
        + '<span>The interactive map couldn\u2019t load on this connection \u2014 but the full list below works fine.</span>'
        + '</div>';
      var p = mapEl.querySelector('.cs-map-loading');
      if (p) p.outerHTML = html; else mapEl.innerHTML = html;
    }

    var map = null, mapReady = false, didFallback = false, popup = null, watchdog = null;

    function addPins() {
      if (!map || map.getSource('cs')) return;
      map.addSource('cs', { type: 'geojson', data: features(), cluster: true, clusterRadius: 46, clusterMaxZoom: 9 });
      map.addLayer({
        id: 'cs-clusters', type: 'circle', source: 'cs', filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#C2703F', 25, '#A6532C', 75, '#8A4524'],
          'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 75, 23],
          'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(255,255,255,.85)',
        },
      });
      map.addLayer({
        id: 'cs-cluster-count', type: 'symbol', source: 'cs', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': MAP_FONT, 'text-size': 12, 'text-allow-overlap': true },
        paint: { 'text-color': '#fff' },
      });
      map.addLayer({
        id: 'cs-pts', type: 'circle', source: 'cs', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'col'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4.5, 9, 7],
          'circle-stroke-width': onDarkBasemap() ? 2 : 1.4, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95,
        },
      });
    }

    function refreshPins() {
      if (map && mapReady && map.getSource('cs')) map.getSource('cs').setData(features());
    }

    function popupHtml(p) {
      var lensName = p.l === 'view' ? 'Big Views' : p.l === 'utility' ? 'Full Hookups' : 'Boondocking';
      var meta = [];
      if (typeof p.r === 'number') meta.push('\u2605 ' + p.r.toFixed(1));
      if (p.p) meta.push(esc(p.p) + '/night');
      var metaLine = meta.length ? '<span class="cs-pop-meta">' + meta.join(' \u00b7 ') + '</span>' : '';
      var tier = p.t === 'community'
        ? '<span class="cs-pop-tier cs-pop-tier--community">Unverified \u00b7 OpenStreetMap</span>'
        : '';
      var linkLabel = p.t === 'community' ? 'Open in map \u2192' : 'Recreation.gov \u2192';
      return '<div class="cs-pop">'
        + '<span class="cs-pop-lens cs-pop-lens--' + esc(p.l) + '">' + esc(lensName) + '</span>'
        + '<strong>' + esc(p.n) + '</strong>'
        + '<span class="cs-pop-loc">' + esc(p.s) + '</span>'
        + metaLine + tier
        + '<div class="cs-pop-actions"><a href="' + esc(p.u) + '" target="_blank" rel="noopener nofollow">' + linkLabel + '</a></div>'
        + '</div>';
    }

    function wireInteractions() {
      ['cs-pts', 'cs-clusters'].forEach(function (lyr) {
        map.on('mouseenter', lyr, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', lyr, function () { map.getCanvas().style.cursor = ''; });
      });
      map.on('click', 'cs-pts', function (e) {
        var f = e.features && e.features[0]; if (!f) return;
        var rec = byId[f.properties.i]; if (!rec) return;
        if (popup) popup.remove();
        popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', className: 'cs-ml-popup', offset: 10 })
          .setLngLat(f.geometry.coordinates.slice())
          .setHTML(popupHtml(rec))
          .addTo(map);
      });
      map.on('click', 'cs-clusters', function (e) {
        var f = map.queryRenderedFeatures(e.point, { layers: ['cs-clusters'] })[0]; if (!f) return;
        map.getSource('cs').getClusterExpansionZoom(f.properties.cluster_id).then(function (z) {
          map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.3 });
        });
      });
    }

    function onReady() {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      mapReady = true;
      var loadingEl = mapEl.querySelector('.cs-map-loading');
      if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
      addPins();
    }

    // ---- basemap switcher (Map / Satellite / Terrain) ----------------------
    function applyBasemap(name) {
      if (!map || !BASEMAPS[name]) return;
      Store.set('cs.basemap', name);
      mapReady = false;
      try {
        map.setStyle(styleFor(name), { diff: false });
        map.once('styledata', function () { mapReady = true; addPins(); });
      } catch (e) {}
    }
    function addBasemapSwitcher() {
      if (mapEl.querySelector('.cs-basemap')) return;
      var cur = currentBasemap();
      var wrap = document.createElement('div');
      wrap.className = 'cs-basemap';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Basemap style');
      Object.keys(BASEMAPS).forEach(function (key) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cs-basemap-btn' + (key === cur ? ' is-on' : '');
        b.setAttribute('data-basemap', key);
        b.setAttribute('aria-pressed', key === cur ? 'true' : 'false');
        b.textContent = BASEMAPS[key].label;
        b.addEventListener('click', function () {
          if (key === currentBasemap()) return;
          applyBasemap(key);
          wrap.querySelectorAll('.cs-basemap-btn').forEach(function (x) {
            var on = x.getAttribute('data-basemap') === key;
            x.classList.toggle('is-on', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
        wrap.appendChild(b);
      });
      mapEl.appendChild(wrap);
    }

    function initMap() {
      if (typeof maplibregl === 'undefined') { showUnavailable(); return; }
      try {
        map = new maplibregl.Map({
          container: mapEl, style: styleFor(currentBasemap()),
          center: [-110, 39.5], zoom: 3.3, minZoom: 2, maxZoom: 19,
          renderWorldCopies: false, attributionControl: false, dragRotate: false,
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }));
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.touchZoomRotate.disableRotation();
      } catch (err) { showUnavailable(); return; }

      map.on('load', function () { onReady(); wireInteractions(); addBasemapSwitcher(); });
      map.on('error', function () {
        if (didFallback || mapReady) return;
        didFallback = true;
        try { map.setStyle(bareStyle()); map.once('styledata', onReady); } catch (e) {}
      });
      watchdog = setTimeout(function () {
        if (mapReady || didFallback) return;
        didFallback = true;
        try { map.setStyle(bareStyle()); map.once('styledata', onReady); } catch (e) {}
      }, 8000);
    }

    // ---- lazy-load MapLibre (same vendored file as the Finder) -------------
    function loadLibrary() {
      if (typeof maplibregl !== 'undefined') { initMap(); return; }
      var src = (window.__AE_MAPLIBRE_SRC__ || 'assets/vendor/maplibre/maplibre-gl.js');
      var s = document.createElement('script');
      s.src = src; s.async = true;
      var done = false;
      s.onload = function () { if (done) return; done = true; initMap(); };
      s.onerror = function () { if (done) return; done = true; showUnavailable(); };
      setTimeout(function () { if (done || typeof maplibregl !== 'undefined') return; done = true; showUnavailable(); }, 12000);
      document.head.appendChild(s);
    }

    // Keep pins in sync with the lens filter chips (overnightFilter dispatches).
    document.addEventListener('ae:lens', function (e) {
      var l = e && e.detail && e.detail.lens;
      if (!l || l === selLens) return;
      selLens = l;
      if (popup) { popup.remove(); popup = null; }
      refreshPins();
    });

    // Only pull the heavy library when the map is near the viewport, so the
    // list-first page stays fast. Falls back to immediate load without IO.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) {
          io.disconnect();
          loadLibrary();
        }
      }, { rootMargin: '300px' });
      io.observe(mapEl);
    } else {
      loadLibrary();
    }
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
    // Compare is single-type: keep only items matching the first item's type.
    if (ids.length) {
      var lockType = bySlug[ids[0]].type;
      ids = ids.filter(function (s) { return bySlug[s].type === lockType; });
    }

    function persist() { cmpSet(ids); }

    // Rows depend on the compared set's type. Trailers show tow/cargo rows;
    // motorhomes show chassis/engine/fuel/seats rows. Each row is
    // [label, accessor, formatter, betterDir] — betterDir highlights the best
    // value (1=higher better, -1=lower better, 0=none).
    var ROWS_TRAILER = [
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
    var ROWS_MOTORHOME = [
      ['Length', function (d) { return d.lengthFt; }, function (v) { return fmtLen2(v); }, 0],
      ['Base weight', function (d) { return d.weightLb; }, fmtLb, -1],
      ['GVWR', function (d) { return d.gvwrLb; }, fmtLb, 0],
      ['Net carrying cap.', function (d) { return d.nccLb; }, fmtLb, 1],
      ['Chassis', function (d) { return null; }, function (v, d) { return d.chassis || '\u2014'; }, 0],
      ['Engine', function (d) { return null; }, function (v, d) { return d.engine || '\u2014'; }, 0],
      ['Fuel', function (d) { return null; }, function (v, d) { return d.fuelType || '\u2014'; }, 0],
      ['Fuel tank', function (d) { return d.fuelTankGal; }, function (v) { return v ? v + ' gal' : '\u2014'; }, 0],
      ['Sleeps', function (d) { return d.sleeps; }, function (v) { return String(v); }, 1],
      ['Seats', function (d) { return d.seats; }, function (v) { return v ? String(v) : '\u2014'; }, 0],
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
        a.href = (d.linkDir || 'm') + '/' + d.slug + '.html'; a.className = 'cmp-col-head';
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
      var ROWS = (cols[0] && cols[0].type === 'motorhome') ? ROWS_MOTORHOME : ROWS_TRAILER;
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
        var lockType = ids.length ? bySlug[ids[0]].type : null;
        var hits = DATA.filter(function (d) {
          return (d.model + ' ' + d.floorplan + ' ' + d.year).toLowerCase().indexOf(q) !== -1 &&
            ids.indexOf(d.slug) === -1 &&
            (!lockType || d.type === lockType);
        }).slice(0, 8);
        if (!hits.length) { closeSuggest(); return; }
        hits.forEach(function (d) {
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'cmp-suggest-item';
          b.textContent = d.model + ' ' + d.floorplan + ' (' + d.year + ')' + (d.type === 'motorhome' ? ' · Motorhome' : '');
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

  // ---- Tow-safety calculator (detail pages) --------------------------------
  // Mirrors the server-side math in src/lib/tow.mjs EXACTLY so the rendered
  // default and any client recompute agree. Reads the vehicle table + trailer
  // from a CSP-safe JSON island (#tow-data); no network, works offline. All DOM
  // is built with textContent / createElement (no innerHTML of data).
  (function towTool() {
    var root = document.querySelector('.towtool');
    if (!root) return;
    var dataEl = document.getElementById('tow-data');
    if (!dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!data || !data.vehicles || !data.vehicles.length || !data.trailer) return;

    // Constants must match tow.mjs.
    var COMFORT = 0.80, CAUTION = 1.00;
    var tonguePct = typeof data.tonguePct === 'number' ? data.tonguePct : 0.13;

    var VMETA = {
      comfortable: { label: 'Comfortable match', cls: 'tow-ok', blurb: 'Good margin on every limit.' },
      tight: { label: 'Tight but legal', cls: 'tow-tight', blurb: 'Within ratings, but little headroom — load carefully.' },
      over: { label: 'Over a limit', cls: 'tow-over', blurb: 'Exceeds a rating loaded — not a safe match as configured.' },
    };

    var trailer = data.trailer;
    var trailerLoaded = trailer.gvwrLb || trailer.weightLb || 0;
    var byId = {};
    data.vehicles.forEach(function (v) { byId[v.id] = v; });

    var elVehicle = document.getElementById('tow-vehicle');
    var elLoad = document.getElementById('tow-load');
    var elVerdict = document.getElementById('tow-verdict');
    var elVLabel = document.getElementById('tow-verdict-label');
    var elVVehicle = document.getElementById('tow-verdict-vehicle');
    var elVBlurb = document.getElementById('tow-verdict-blurb');
    var elChecks = document.getElementById('tow-checks');
    var elConfig = document.getElementById('tow-config');
    var elSources = document.getElementById('tow-sources');

    function fmtLbLocal(n) { return Math.round(n).toLocaleString('en-US') + ' lb'; }
    function pctLabel(frac) { return isFinite(frac) ? Math.round(frac * 100) + '%' : '—'; }
    function grade(frac) {
      if (frac > CAUTION) return 'over';
      if (frac > COMFORT) return 'tight';
      return 'comfortable';
    }

    // Pure mirror of evaluateTow() in tow.mjs.
    function evaluate(v, truckLoad) {
      var tongueLoaded = Math.round(trailerLoaded * tonguePct);
      var curb = v.curbWeightLb || 0;
      var combined = trailerLoaded + curb + truckLoad;
      var payloadUsed = tongueLoaded + truckLoad;
      var checks = [
        { key: 'tow', label: 'Trailer tow rating', used: trailerLoaded, limit: v.maxTowLb },
        { key: 'payload', label: 'Truck payload', used: payloadUsed, limit: v.payloadLb },
        { key: 'gcwr', label: 'Combined weight (GCWR)', used: combined, limit: v.gcwrLb },
      ].map(function (c) {
        var frac = c.limit > 0 ? c.used / c.limit : Infinity;
        c.frac = frac; c.grade = grade(frac); return c;
      });
      var binding = checks.reduce(function (a, b) { return b.frac > a.frac ? b : a; });
      var order = { comfortable: 0, tight: 1, over: 2 };
      var verdict = checks.reduce(function (worst, c) {
        return order[c.grade] > order[worst] ? c.grade : worst;
      }, 'comfortable');
      return { verdict: verdict, binding: binding, checks: checks };
    }

    function rebuildChecks(result) {
      while (elChecks.firstChild) elChecks.removeChild(elChecks.firstChild);
      result.checks.forEach(function (c) {
        var meta = VMETA[c.grade];
        var pctW = Math.max(2, Math.min(100, Math.round(c.frac * 100)));
        var wrap = document.createElement('div');
        wrap.className = 'tow-check tow-check-' + c.grade;
        wrap.setAttribute('data-key', c.key);

        var top = document.createElement('div'); top.className = 'tow-check-top';
        var lab = document.createElement('span'); lab.className = 'tow-check-label'; lab.textContent = c.label;
        var pc = document.createElement('span'); pc.className = 'tow-check-pct'; pc.textContent = pctLabel(c.frac);
        top.appendChild(lab); top.appendChild(pc);

        var track = document.createElement('div'); track.className = 'tow-check-track';
        var fill = document.createElement('span'); fill.className = 'tow-check-fill ' + meta.cls;
        fill.style.width = pctW + '%';
        track.appendChild(fill);

        var nums = document.createElement('div'); nums.className = 'tow-check-nums';
        var u = document.createElement('span'); u.textContent = fmtLbLocal(c.used) + ' used';
        var l = document.createElement('span'); l.textContent = 'of ' + fmtLbLocal(c.limit);
        nums.appendChild(u); nums.appendChild(l);

        wrap.appendChild(top); wrap.appendChild(track); wrap.appendChild(nums);
        elChecks.appendChild(wrap);
      });
    }

    function rebuildSources(v) {
      while (elSources.firstChild) elSources.removeChild(elSources.firstChild);
      (v.sources || []).forEach(function (s, i) {
        if (i > 0) elSources.appendChild(document.createTextNode(' · '));
        var a = document.createElement('a');
        a.href = s; a.target = '_blank'; a.rel = 'noopener nofollow';
        a.textContent = v.sources.length > 1 ? 'source ' + (i + 1) : 'source';
        elSources.appendChild(a);
      });
    }

    function compute() {
      var v = byId[elVehicle.value] || data.vehicles[0];
      var truckLoad = parseInt(elLoad.value, 10);
      if (isNaN(truckLoad)) truckLoad = data.defaultTruckLoadLb || 300;
      var result = evaluate(v, truckLoad);
      var meta = VMETA[result.verdict];

      elVerdict.className = 'tow-verdict ' + meta.cls;
      elVerdict.setAttribute('data-verdict', result.verdict);
      elVLabel.textContent = meta.label;
      elVVehicle.textContent = v.name;
      elVBlurb.textContent = meta.blurb + ' Binds on ' + result.binding.label.toLowerCase() + ' at ' + pctLabel(result.binding.frac) + '.';

      rebuildChecks(result);

      // Config text: keep the leading label, swap the config + sources.
      while (elConfig.firstChild) elConfig.removeChild(elConfig.firstChild);
      elConfig.appendChild(document.createTextNode('Modeled config: ' + v.config + '. '));
      var srcSpan = document.createElement('span'); srcSpan.id = 'tow-sources';
      elConfig.appendChild(srcSpan);
      elSources = srcSpan;
      rebuildSources(v);
    }

    if (elVehicle) elVehicle.addEventListener('change', compute);
    if (elLoad) elLoad.addEventListener('change', compute);
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
    // The LIST is the core feature and must render even if the (heavy, ~940 KB)
    // MapLibre library never loads — slow/throttled/blocked networks, an aborted
    // download, or a CDN block. So we DON'T gate the module on `maplibregl`
    // here; the map is wired up separately and degrades on its own (see initMap
    // below). Only bail if the page's own list scaffold is missing.
    if (!root || !mapEl || !dataEl) return;

    var STATIC = [];
    // The dataset is loaded ASYNC from an external, cache-forever file (see
    // loadData() near the end) instead of being inlined into this page. Records
    // ship slimmed to cut transfer size: `.u` (the Recreation.gov page URL) is
    // omitted and rebuilt from `.i`, and `.g` (photo) ships without its shared
    // CDN prefix. hydrate() restores both so the rest of the module is unchanged.
    var REC_URL_PREFIX = 'https://www.recreation.gov/camping/campgrounds/';
    var REC_PHOTO_PREFIX = 'https://cdn.recreation.gov/';
    // Same-origin proxy for campground photos: cdn.recreation.gov is not reliably
    // reachable from mainland China, so every photo is served through our own
    // origin via the /cdn/* Pages Function. Mirror of photoProxy() in
    // src/lib/campgrounds.mjs — keep the two in sync.
    var REC_PHOTO_PROXY = '/cdn/';
    function proxyPhoto(ref) {
      if (!ref) return ref;
      if (ref.indexOf(REC_PHOTO_PREFIX) === 0) return REC_PHOTO_PROXY + ref.slice(REC_PHOTO_PREFIX.length);
      if (ref.indexOf('http') === 0) return ref; // foreign host — leave as-is
      return REC_PHOTO_PROXY + ref.replace(/^\/+/, ''); // bare tail from slim record
    }
    function hydrate(c) {
      if (c && c.g) c.g = proxyPhoto(c.g);
      if (c && !c.u && c.i != null) c.u = REC_URL_PREFIX + c.i;
      return c;
    }

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
    var elHookup = document.getElementById('cg-hookup');
    var elElev = document.getElementById('cg-elev');
    var elPullthrough = document.getElementById('cg-pullthrough');
    var elReset = document.getElementById('cg-reset');
    var elShare = document.getElementById('cg-share');
    var elSummary = document.getElementById('cg-summary');
    var elMore = document.getElementById('cg-more');
    var elMoreBtn = document.getElementById('cg-more-btn');

    var state = { len: 0, st: '', collection: '', q: '', sort: 'rank', hideUnknown: false, fitsOnly: false, hookup: '', elev: '', pullthrough: false, shown: 30, live: null, source: 'static' };

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
      if (typeof p.collection === 'string') state.collection = p.collection;
      if (typeof p.sort === 'string') state.sort = p.sort;
      if (typeof p.hideUnknown === 'boolean') state.hideUnknown = p.hideUnknown;
      if (typeof p.fitsOnly === 'boolean') state.fitsOnly = p.fitsOnly;
      if (typeof p.hookup === 'string') state.hookup = p.hookup;
      if (typeof p.elev === 'string') state.elev = p.elev;
      if (typeof p.pullthrough === 'boolean') state.pullthrough = p.pullthrough;
    })();
    function persistCg() {
      Store.set(CG_PREFS, {
        rig: elRig ? elRig.value : '', len: state.len, st: state.st,
        collection: state.collection,
        sort: state.sort, hideUnknown: state.hideUnknown, fitsOnly: state.fitsOnly,
        hookup: state.hookup, elev: state.elev, pullthrough: state.pullthrough,
      });
    }

    // ---- saved shortlist (localStorage) -----------------------------------
    // Persist a lean copy of each saved campground so it survives even after
    // the user leaves its map region / live results. Keyed by stable id (i).
    var CG_SAVED = 'cg.saved';
    var savedList = [];
    (function restoreSaved() {
      var arr = Store.get(CG_SAVED, []);
      if (Array.isArray(arr)) savedList = arr.filter(function (x) { return x && x.i != null; });
    })();
    var savedSet = {};
    savedList.forEach(function (x) { savedSet[x.i] = true; });
    function isSaved(c) { return !!(c && savedSet[c.i]); }
    function leanSave(c) {
      return { i: c.i, n: c.n, p: c.p, s: c.s, o: c.o, r: c.r, v: c.v, m: c.m, pr: c.pr, g: c.g, u: c.u, la: c.la, lo: c.lo,
        th: c.th, tm: c.tm, h: c.h, am: c.am, pt: c.pt, el: c.el };
    }
    function toggleSave(c) {
      if (c == null || c.i == null) return;
      if (savedSet[c.i]) {
        delete savedSet[c.i];
        savedList = savedList.filter(function (x) { return x.i !== c.i; });
      } else {
        savedSet[c.i] = true;
        savedList.push(leanSave(c));
      }
      Store.set(CG_SAVED, savedList);
    }

    // ---- fit logic (mirrors src/lib/campgrounds.mjs exactly) ----
    function fitClass(len, max) {
      if (max == null) return 'unknown';
      if (max >= len + CLEARANCE) return 'fits';
      if (max >= len) return 'tight';
      return 'no';
    }
    var FIT_LABEL = { fits: 'Fits comfortably', tight: 'Fits — tight', no: 'Too long', unknown: 'No posted limit' };

    // ---- enriched per-site fit logic ----
    // MIRRORS src/lib/campsite-fit.mjs EXACTLY (trailerFit, hookupMatch,
    // nightsHere, elevationContext, ELEVATION_BANDS). A parity tripwire test
    // (test/client-parity.test.mjs) re-runs both copies over shared fixtures so
    // these can never silently drift. Slim record keys: th=trailerLenHistogram,
    // tm=trailerMaxFt, h=hookups, am=ampService, pt=pullThrough, el=elevationFt,
    // rc=rvSiteCount, uv=unverified. The off-grid constants here also mirror
    // src/lib/estimate.mjs (kept local so this module is self-contained).
    /* PARITY-MIRROR:BEGIN (extracted verbatim by test/client-parity.test.mjs) */
    var OG = {
      LOAD: { light: 1500, moderate: 2800, heavy: 5000 },
      PSH: { summer: 5.5, shoulder: 4.0, winter: 2.5 },
      USABLE: 0.8, DERATE: 0.7, GRAY_FRAC: 0.8,
      WATER: { light: { fresh: 3.0, black: 0.75 }, moderate: { fresh: 5.0, black: 1.0 }, heavy: { fresh: 8.0, black: 1.5 } },
    };
    var PSH_LAT_REF = 35;
    var PSH_BAND = {
      summer: { perDeg: -0.004, min: 0.9, max: 1.06 },
      shoulder: { perDeg: -0.010, min: 0.72, max: 1.12 },
      winter: { perDeg: -0.020, min: 0.5, max: 1.25 },
    };
    function peakSunHoursAt(season, lat) {
      var s = OG.PSH[season] != null ? season : 'summer';
      var base = OG.PSH[s];
      if (lat == null || !isFinite(lat)) return { psh: base, base: base, factor: 1, refined: false };
      var band = PSH_BAND[s];
      var dist = Math.abs(Math.abs(lat) - PSH_LAT_REF);
      var factor = 1 + band.perDeg * dist;
      factor = Math.max(band.min, Math.min(band.max, factor));
      var psh = Math.round(base * factor * 100) / 100;
      return { psh: psh, base: base, factor: Math.round(factor * 1000) / 1000, refined: true };
    }
    // nightsHere: off-grid endurance for THIS rig at THIS park's latitude. Same
    // structure as estimate.mjs estimateOffGrid + the latitude PSH refinement.
    function nightsHere(t, opts) {
      opts = opts || {};
      var season = OG.PSH[opts.season] != null ? opts.season : 'summer';
      var intensity = OG.LOAD[opts.intensity] ? opts.intensity : 'moderate';
      var people = Math.max(1, opts.people || 2);
      var useSolar = opts.useSolar !== false;
      var ref = peakSunHoursAt(season, opts.lat);
      var usableWh = (t.batteryKwh || 0) * 1000 * OG.USABLE;
      var loadWh = OG.LOAD[intensity];
      var solarWh = useSolar ? (t.solarW || 0) * ref.psh * OG.DERATE : 0;
      var netWh = loadWh - solarWh;
      var powerDays = netWh > 0 ? usableWh / netWh : null;
      var w = OG.WATER[intensity];
      var freshPerDay = w.fresh * people;
      var grayPerDay = w.fresh * OG.GRAY_FRAC * people;
      var blackPerDay = w.black * people;
      var freshDays = freshPerDay > 0 ? (t.freshGal || 0) / freshPerDay : Infinity;
      var grayDays = (grayPerDay > 0 && t.grayGal != null) ? t.grayGal / grayPerDay : Infinity;
      var blackDays = (blackPerDay > 0 && t.blackGal != null) ? t.blackGal / blackPerDay : Infinity;
      var waterDays = Math.min(freshDays, grayDays, blackDays);
      var days, limiter;
      if (powerDays == null || waterDays <= powerDays) { days = waterDays; limiter = 'water'; }
      else { days = powerDays; limiter = 'power'; }
      if (!isFinite(days)) days = 14;
      return { days: Math.max(0, days), limiter: limiter, psh: ref.psh, pshRefined: ref.refined };
    }
    function formatNights(days) {
      if (!isFinite(days) || days >= 13.5) return '14+ nights';
      if (days < 2) return days.toFixed(1) + ' nights';
      return Math.round(days) + ' nights';
    }
    var HOOKUP_LABEL = { full: 'Full hookups', electric: 'Electric hookups', none: 'No hookups (dry camping)', unknown: 'Hookups unverified' };
    function hookupMatch(hookups, ampService) {
      if (hookups == null) {
        return { level: 'unknown', label: HOOKUP_LABEL.unknown, solar: 'unknown',
          note: 'No per-site hookup data published for this campground — confirm on Recreation.gov before counting on power.' };
      }
      var amps = (ampService || []).filter(function (a) { return a === 30 || a === 50; });
      var ampTxt = amps.length ? amps.join('/') + '-amp' : '';
      if (hookups === 'full') {
        return { level: 'full', label: HOOKUP_LABEL.full, solar: 'not-needed',
          note: ('Water, ' + (ampTxt || 'electric') + ' and sewer at the site — your battery and solar are backup only here.').replace('  ', ' ') };
      }
      if (hookups === 'electric') {
        return { level: 'electric', label: HOOKUP_LABEL.electric, solar: 'nice',
          note: 'Shore power (' + (ampTxt || 'electric') + ') covers the battery, but there\'s no sewer — you\'ll still manage your own tanks.' };
      }
      return { level: 'none', label: HOOKUP_LABEL.none, solar: 'must',
        note: 'No hookups here — your battery, solar and tanks are all you have. See the nights-here estimate below.' };
    }
    // trailerFit: honest "% of sites that take YOUR length" from the per-site
    // histogram (slim key .th). NEVER from the single all-equipment max.
    function trailerFit(c, lengthFt) {
      var hist = c && c.th;
      if (!hist || typeof hist !== 'object' || !(lengthFt > 0)) {
        return { conf: 'unverified', sitesTotal: null, sitesFit: null, sitesTight: null,
          pct: null, maxFt: (c && c.tm) || null, cls: 'unknown',
          why: 'No per-site trailer-length data published here — fit can\u2019t be confirmed; check Recreation.gov.' };
      }
      var total = 0, fit = 0, tight = 0, maxFt = 0, k;
      for (k in hist) {
        if (!Object.prototype.hasOwnProperty.call(hist, k)) continue;
        var cap = Number(k), n = Number(hist[k]) || 0;
        if (!(cap > 0) || n <= 0) continue;
        total += n;
        if (cap > maxFt) maxFt = cap;
        if (cap >= lengthFt + CLEARANCE) fit += n;
        else if (cap >= lengthFt) tight += n;
      }
      if (total === 0) {
        return { conf: 'unverified', sitesTotal: 0, sitesFit: 0, sitesTight: 0,
          pct: null, maxFt: maxFt || null, cls: 'unknown',
          why: 'No per-site trailer-length data published here — fit can\u2019t be confirmed; check Recreation.gov.' };
      }
      var usable = fit + tight;
      var pct = Math.round((usable / total) * 100);
      var rig = Math.round(lengthFt * 10) / 10;
      var cls, why;
      if (fit > 0 && pct >= 50) {
        cls = 'fits';
        why = fit + ' of ' + total + ' trailer sites take your ' + rig + '\u2032 with room to maneuver (' + pct + '% usable incl. tight).';
      } else if (usable > 0) {
        cls = 'tight';
        why = 'Only ' + usable + ' of ' + total + ' trailer sites (' + pct + '%) take your ' + rig + '\u2032 — and ' + tight + ' of those are a tight squeeze. Book carefully.';
      } else {
        cls = 'no';
        why = 'None of this park\'s ' + total + ' trailer sites take your ' + rig + '\u2032 (biggest is ' + maxFt + '\u2032). Look elsewhere.';
      }
      return { conf: 'per-site', sitesTotal: total, sitesFit: fit, sitesTight: tight, pct: pct, maxFt: maxFt, cls: cls, why: why };
    }
    function elevationContext(elevationFt) {
      if (elevationFt == null || !isFinite(elevationFt)) return null;
      var ft = Math.round(elevationFt);
      var band, note;
      if (ft >= 8000) { band = 'high'; note = 'High altitude — expect cold nights even in summer and noticeably weaker generator/engine output; plan battery for heating loads.'; }
      else if (ft >= 5000) { band = 'elevated'; note = 'Elevated — nights run cold in shoulder/winter seasons; factor heater draw into the off-grid estimate.'; }
      else if (ft >= 2000) { band = 'moderate'; note = 'Moderate elevation — mild altitude effects only.'; }
      else { band = 'low'; note = 'Low elevation — no significant altitude effects.'; }
      return { ft: ft, band: band, note: note };
    }
    var ELEVATION_BANDS = [
      { key: 'low', label: 'Low (under 2,000\u2032)', min: -1000, max: 2000 },
      { key: 'moderate', label: 'Moderate (2,000–5,000\u2032)', min: 2000, max: 5000 },
      { key: 'elevated', label: 'Elevated (5,000–8,000\u2032)', min: 5000, max: 8000 },
      { key: 'high', label: 'High (8,000\u2032+)', min: 8000, max: 100000 },
    ];
    function inElevationBand(elevationFt, key) {
      if (!key) return true;
      if (elevationFt == null || !isFinite(elevationFt)) return false;
      var b = null;
      for (var i = 0; i < ELEVATION_BANDS.length; i++) if (ELEVATION_BANDS[i].key === key) b = ELEVATION_BANDS[i];
      if (!b) return true;
      return elevationFt >= b.min && elevationFt < b.max;
    }
    /* PARITY-MIRROR:END */

    function num(n) { return typeof n === 'number' && !isNaN(n) ? n : null; }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function rankScore(c) { return (c.r || 0) * Math.log10((c.v || 0) + 1); }

    // Active pool: live results for the current region if present, else static.
    // Curated collections are a property of the BAKED static set (live API rows
    // carry no .cl membership), so an active collection always reads from STATIC
    // — otherwise zooming into live mode would empty a collection view.
    function pool() {
      if (state.collection) return STATIC;
      return state.live && state.live.length ? state.live : STATIC;
    }

    function visible() {
      var len = state.len;
      var list = pool().filter(function (c) {
        if (state.st && c.s !== state.st && STATE_CODE_OF[c.s] !== state.st && STATE_NAME_OF[c.s] !== state.st) return false;
        // Curated collection lens. Reads the baked membership array .cl (set by
        // toClientRecord from the FULL record). Live Recreation.gov API rows
        // carry no .cl, so an active collection honestly excludes them rather
        // than guessing membership from slimmed fields.
        if (state.collection) {
          if (!c.cl || c.cl.indexOf(state.collection) < 0) return false;
        }
        if (state.q) {
          var hay = ((c.n || '') + ' ' + (c.p || '') + ' ' + (c.s || '')).toLowerCase();
          if (hay.indexOf(state.q) < 0) return false;
        }
        if (len > 0) {
          // HONEST fit filter: prefer per-site histogram truth (.th) when the
          // record has it; fall back to the legacy posted-max only when it
          // doesn't (e.g. live API rows). 'no' = nothing takes the rig.
          if (c.th) {
            var tf = trailerFit(c, len);
            if (tf.cls === 'no') return false;
            if (state.fitsOnly && tf.cls !== 'fits') return false;
          } else {
            var f = fitClass(len, num(c.m));
            if (f === 'no') return false;
            if (state.fitsOnly && f !== 'fits') return false;
          }
        }
        if (state.hideUnknown && c.m == null) return false;
        // Hookup filter. 'electric' = electric-or-better (electric|full),
        // 'full'/'none' exact. Records without a hookup level are excluded
        // (honest: we won't guess they match a hookup requirement).
        if (state.hookup) {
          if (state.hookup === 'electric') { if (c.h !== 'electric' && c.h !== 'full') return false; }
          else if (c.h !== state.hookup) return false;
        }
        // Pull-through toggle (slim key .pt = 1 when present).
        if (state.pullthrough && c.pt !== 1) return false;
        // Elevation band (unknown elevation excluded when a band is chosen).
        if (state.elev && !inElevationBand(num(c.el), state.elev)) return false;
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

    // ---- map (MapLibre GL JS: SELF-HOSTED vector basemap, GPU clustering) ----
    // Everything the map needs — basemap geometry AND label glyphs — is served
    // from THIS origin (assets/map/*). No CARTO, no external tile/glyph CDN, so
    // the map now loads anywhere the page itself loads, including networks that
    // throttle or block those CDNs. renderWorldCopies OFF keeps longitudes in
    // [-180,180] so the viewport->geo query never sees a wrapped value (e.g. +240).
    var MAP_BASE = (window.__AE_MAP_BASE__ || 'assets/map/');
    var GLYPHS = MAP_BASE + 'glyphs/{fontstack}/{range}.pbf';
    var STATES_URL = MAP_BASE + 'us-states.json';
    var MAP_FONT = ['Open Sans Regular'];
    // Basemap registry. The default 'editorial' basemap is the self-hosted
    // vector style (warm paper, hairline borders) — fast, on-brand, and the
    // offline fallback. 'satellite' and 'terrain' are no-key raster basemaps
    // (Esri World Imagery + Esri World Topo), which make a fire lookout on a
    // ridgeline or a boat-in cove read instantly — you SEE the landscape the
    // stay sits in. A small switcher (added in wireRealMap) lets the user flip
    // between them; the choice persists in the Store.
    var ESRI_ATTR = 'Tiles \u00a9 Esri';
    var BASEMAPS = {
      editorial: { label: 'Map', kind: 'vector' },
      satellite: {
        label: 'Satellite', kind: 'raster',
        tiles: ['/tiles/sat/{z}/{y}/{x}'],
        attribution: ESRI_ATTR + ', Maxar, Earthstar Geographics', maxzoom: 19, labelColor: '#fff', haloColor: 'rgba(0,0,0,.55)',
      },
      terrain: {
        label: 'Terrain', kind: 'raster',
        tiles: ['/tiles/topo/{z}/{y}/{x}'],
        attribution: ESRI_ATTR + ', USGS, NOAA', maxzoom: 19, labelColor: '#33312c', haloColor: 'rgba(255,255,255,.9)',
      },
    };
    var DEFAULT_BASEMAP = 'editorial';
    function currentBasemap() {
      var v = Store.get('cg.basemap', DEFAULT_BASEMAP);
      return BASEMAPS[v] ? v : DEFAULT_BASEMAP;
    }
    // A compact, editorial light basemap drawn entirely from a local US-states
    // GeoJSON: warm-paper land, soft slate water, hairline state borders, quiet
    // collision-managed state labels. Zero network dependency beyond this origin.
    function localStyle() {
      return {
        version: 8,
        glyphs: GLYPHS,
        sources: { states: { type: 'geojson', data: STATES_URL } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#dbe3e7' } },
          { id: 'state-fill', type: 'fill', source: 'states', paint: { 'fill-color': '#f0e9dc' } },
          { id: 'state-line', type: 'line', source: 'states',
            paint: { 'line-color': '#d2c6b1', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 5, 1, 8, 1.6] } },
          { id: 'state-label', type: 'symbol', source: 'states', maxzoom: 7,
            layout: {
              'text-field': ['get', 'name'], 'text-font': MAP_FONT,
              'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 5, 12],
              'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 8,
            },
            paint: { 'text-color': '#a99c86', 'text-halo-color': 'rgba(255,255,255,.85)', 'text-halo-width': 1.2 } },
        ],
      };
    }
    // A no-key raster basemap (satellite or terrain) from the BASEMAPS registry.
    // Still serves label glyphs from THIS origin so the cluster counts render.
    function rasterStyle(kind) {
      var b = BASEMAPS[kind];
      return {
        version: 8,
        glyphs: GLYPHS,
        sources: { base: { type: 'raster', tiles: b.tiles, tileSize: 256, minzoom: 0, maxzoom: b.maxzoom || 19, attribution: b.attribution, scheme: 'xyz' } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#1a2730' } },
          { id: 'base', type: 'raster', source: 'base', paint: { 'raster-fade-duration': 200 } },
        ],
      };
    }
    // The style for whichever basemap is active (used at init + on switch).
    function styleFor(name) {
      return (BASEMAPS[name] && BASEMAPS[name].kind === 'raster') ? rasterStyle(name) : localStyle();
    }

    // No-op MapLibre stand-in, used ONLY when WebGL is unavailable so the dozens
    // of map.xxx() calls scattered through this module degrade to harmless no-ops
    // instead of throwing. Safe defaults for the few getters the list/share code
    // reads: a low zoom keeps data on the static national set; getCenter feeds
    // the share URL.
    function mapStub() {
      var noop = function () {};
      return {
        addControl: noop, addSource: noop, addLayer: noop, setStyle: noop,
        on: noop, once: noop, off: noop, jumpTo: noop, easeTo: noop, remove: noop,
        touchZoomRotate: { disableRotation: noop },
        getSource: function () { return null; },
        getCanvas: function () { return { style: {} }; },
        queryRenderedFeatures: function () { return []; },
        getZoom: function () { return 3.4; },
        getCenter: function () { return { lat: 39.5, lng: -98.35 }; },
        getBounds: function () {
          return {
            getCenter: function () { return { lat: 39.5, lng: -98.35 }; },
            getNorth: function () { return 49; }, getEast: function () { return -66; },
            getSouth: function () { return 25; }, getWest: function () { return -125; },
          };
        },
      };
    }
    // Swap the "Loading map…" placeholder for an honest notice: the interactive
    // map can't draw (WebGL off, or the map library couldn't load on this
    // network), but the full list below still works.
    function showMapUnavailable(el) {
      var html = '<div class="cg-map-fallback" role="note">'
        + '<span class="cg-map-fallback-pin" aria-hidden="true">\u25b2</span>'
        + '<strong>Map unavailable</strong>'
        + '<span>The interactive map couldn\u2019t load on this connection \u2014 but the full campground list below works fine.</span>'
        + '</div>';
      var p = el.querySelector('.cg-map-loading');
      if (p) p.outerHTML = html; else el.innerHTML = html;
    }
    // ---- map bootstrap -----------------------------------------------------
    // `map` starts as the no-op stub so EVERY map.xxx() call sprinkled through
    // this module (controls, getCenter for share links, jumpTo, moveend, etc.)
    // is harmless before — or forever, if — the real map exists. initMap()
    // upgrades `map` to a real MapLibre instance once the library has loaded.
    // This keeps the LIST fully functional with zero dependency on the map.
    var map = mapStub(), mapAvailable = false;
    function initMap() {
      // Library still not here (lazy load failed / blocked / aborted): leave the
      // stub in place and show an honest notice. The list already works.
      if (typeof maplibregl === 'undefined') { showMapUnavailable(mapEl); return; }
      var real;
      try {
        real = new maplibregl.Map({
          container: mapEl, style: styleFor(currentBasemap()),
          center: [-98.35, 39.5], zoom: 3.4, minZoom: 2, maxZoom: 19,
          renderWorldCopies: false,
          attributionControl: false, dragRotate: false,
        });
        real.addControl(new maplibregl.AttributionControl({ compact: true }));
        real.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        real.touchZoomRotate.disableRotation();
      } catch (err) {
        // WebGL unavailable (disabled, blocklisted, no GPU context) OR the
        // library partly failed. The map is optional chrome; degrade to the
        // stub + honest notice and let the list carry the page.
        showMapUnavailable(mapEl);
        return;
      }
      map = real;
      mapAvailable = true;
      wireRealMap();
    }


    var FIT_COLOR = { fits: '#2e7d4f', tight: '#c98a16', no: '#c0392b', unknown: '#8a8f98', limit: '#6B6258' };

    // ---- native GPU clustering: one GeoJSON source, three layers --------
    // (cluster bubbles sized+shaded by count, the count label, and fit-colored
    // dots). Far smoother than DOM markers, and plots the whole set at once.
    var mapReady = false, didFallback = false, interactionsBound = false, lastList = [], watchdog = null, mapPopup = null;
    function buildFeatures(list) {
      var len = state.len, feats = [], capped = list.slice(0, 3000);
      for (var i = 0; i < capped.length; i++) {
        var c = capped[i];
        if (c.la == null || c.lo == null) continue;
        var chip = chipFor(c, len);
        feats.push({
          type: 'Feature',
          properties: { i: String(c.i), col: FIT_COLOR[chip.cls] || '#8a8f98' },
          geometry: { type: 'Point', coordinates: [Number(c.lo), Number(c.la)] },
        });
      }
      return { type: 'FeatureCollection', features: feats };
    }
    function addCgLayers() {
      if (map.getSource('cg')) return;
      map.addSource('cg', { type: 'geojson', data: buildFeatures(lastList), cluster: true, clusterRadius: 52, clusterMaxZoom: 11 });
      map.addLayer({
        id: 'cg-clusters', type: 'circle', source: 'cg', filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#C2703F', 50, '#A6532C', 200, '#8A4524'],
          'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24, 200, 30],
          'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(255,255,255,.85)',
        },
      });
      map.addLayer({
        id: 'cg-cluster-count', type: 'symbol', source: 'cg', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': MAP_FONT, 'text-size': ['step', ['get', 'point_count'], 12, 50, 13, 200, 14], 'text-allow-overlap': true },
        paint: { 'text-color': '#fff' },
      });
      map.addLayer({
        id: 'cg-pts', type: 'circle', source: 'cg', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'col'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 10, 7],
          'circle-stroke-width': onDarkBasemap() ? 2 : 1.4, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95,
        },
      });
    }
    // Satellite/terrain are dark/busy — points need a heavier white ring there.
    function onDarkBasemap() {
      var b = BASEMAPS[currentBasemap()];
      return !!(b && b.kind === 'raster');
    }
    function wireMapInteractions() {
      ['cg-pts', 'cg-clusters'].forEach(function (lyr) {
        map.on('mouseenter', lyr, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', lyr, function () { map.getCanvas().style.cursor = ''; });
      });
      map.on('click', 'cg-pts', function (e) {
        var f = e.features && e.features[0]; if (!f) return;
        var rec = recordById(f.properties.i); if (!rec) return;
        if (mapPopup) mapPopup.remove();
        mapPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'cg-ml-popup', offset: 10 })
          .setLngLat(f.geometry.coordinates.slice())
          .setHTML(popupHtml(rec, fitInfo(rec, state.len)))
          .addTo(map);
      });
      map.on('click', 'cg-clusters', function (e) {
        var f = map.queryRenderedFeatures(e.point, { layers: ['cg-clusters'] })[0]; if (!f) return;
        map.getSource('cg').getClusterExpansionZoom(f.properties.cluster_id).then(function (z) {
          map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.2 });
        });
      });
    }
    function onMapReady() {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      mapReady = true;
      var loadingEl = mapEl.querySelector('.cg-map-loading');
      if (loadingEl) loadingEl.parentNode.removeChild(loadingEl);
      addCgLayers();
      if (!interactionsBound) { wireMapInteractions(); interactionsBound = true; }
      drawMarkers(lastList);
    }
    // Bare local fallback: if the basemap source ever fails to load, drop to a
    // plain background that still carries the glyphs, so the campground clusters
    // and counts keep rendering. No external CDN is ever contacted.
    function bareStyle() {
      return {
        version: 8, glyphs: GLYPHS,
        sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dbe3e7' } }],
      };
    }
    function wireRealMap() {
      map.on('load', onMapReady);
      // If the basemap style/source errors, degrade to the bare local style once.
      map.on('error', function (e) {
        if (didFallback || mapReady) return;
        didFallback = true;
        try { map.setStyle(bareStyle()); map.once('styledata', onMapReady); } catch (_) {}
      });
      watchdog = setTimeout(function () {
        if (mapReady || didFallback) return;
        didFallback = true;
        try { map.setStyle(bareStyle()); map.once('styledata', onMapReady); } catch (_) {}
      }, 8000);
      map.on('moveend', scheduleLive);
      addBasemapSwitcher();
      // Honor a shared/deep-linked viewport now that the real map exists.
      if (pendingMapView) map.jumpTo({ center: [pendingMapView.lng, pendingMapView.lat], zoom: pendingMapView.z });
    }

    // ---- basemap switcher (Map / Satellite / Terrain) ----------------------
    // A small segmented control overlaid on the map. Switching swaps the style;
    // because setStyle wipes all sources+layers, we re-add the campground layers
    // once the new style's glyphs are parsed (addCgLayers is guarded, so the
    // re-add is safe). The cluster-count text color adapts to the basemap so
    // labels stay legible over dark satellite imagery.
    function applyBasemap(name) {
      if (!mapAvailable || !BASEMAPS[name]) return;
      Store.set('cg.basemap', name);
      mapReady = false;
      try {
        // diff:false forces a clean style reload. A diffed swap between the
        // vector and raster styles leaves the style stuck in a half-loaded
        // state (isStyleLoaded never flips true), so no tiles are ever
        // requested. A full reload makes the raster basemap request + paint.
        map.setStyle(styleFor(name), { diff: false });
        map.once('styledata', function () { mapReady = true; addCgLayers(); drawMarkers(lastList); });
      } catch (_) {}
    }
    function addBasemapSwitcher() {
      if (mapEl.querySelector('.cg-basemap')) return;
      var cur = currentBasemap();
      var wrap = document.createElement('div');
      wrap.className = 'cg-basemap';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Basemap style');
      Object.keys(BASEMAPS).forEach(function (key) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cg-basemap-btn' + (key === cur ? ' is-on' : '');
        b.setAttribute('data-basemap', key);
        b.setAttribute('aria-pressed', key === cur ? 'true' : 'false');
        b.textContent = BASEMAPS[key].label;
        b.addEventListener('click', function () {
          if (key === currentBasemap()) return;
          applyBasemap(key);
          wrap.querySelectorAll('.cg-basemap-btn').forEach(function (x) {
            var on = x.getAttribute('data-basemap') === key;
            x.classList.toggle('is-on', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
        wrap.appendChild(b);
      });
      mapEl.appendChild(wrap);
    }

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

    // ---- live availability helpers (mirror src/lib/availability.mjs) -------
    function avDateKey(d) {
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    }
    function avHookups(campsiteType) {
      var t = String(campsiteType || '').toUpperCase();
      var nonElectric = t.indexOf('NONELECTRIC') >= 0 || t.indexOf('NON-ELECTRIC') >= 0 || t.indexOf('NO ELECTRIC') >= 0;
      var electric = !nonElectric && t.indexOf('ELECTRIC') >= 0;
      var label;
      if (electric) label = 'Electric';
      else if (nonElectric) label = 'No hookups';
      else label = 'Hookups not listed';
      return { electric: electric, label: label, nonElectric: nonElectric };
    }
    function avTrailerMax(eq) {
      eq = eq || [];
      function byName(name) {
        for (var i = 0; i < eq.length; i++) {
          if (String(eq[i].equipment_name || '').toLowerCase() === name && eq[i].max_length > 0) return eq[i].max_length;
        }
        return null;
      }
      var tr = byName('trailer'); if (tr != null) return tr;
      var rv = byName('rv'); if (rv != null) return rv;
      var best = null;
      for (var j = 0; j < eq.length; j++) if (eq[j].max_length > 0 && (best == null || eq[j].max_length > best)) best = eq[j].max_length;
      return best;
    }
    function avSiteFit(len, max) {
      if (!(len > 0)) return max != null ? 'limit' : 'unknown';
      if (max == null) return 'unknown';
      if (max >= len + CLEARANCE) return 'fits';
      if (max >= len) return 'tight';
      return 'no';
    }
    function avParse(payload) {
      var cs = (payload && payload.campsites) || {};
      var out = [];
      Object.keys(cs).forEach(function (id) {
        var v = cs[id] || {};
        var nights = {}; var av = v.availabilities || {};
        Object.keys(av).forEach(function (k) { nights[avDateKey(k)] = av[k]; });
        out.push({
          id: String(id), site: v.site || '', loop: v.loop || '', type: v.campsite_type || '',
          maxPeople: v.max_num_people != null ? v.max_num_people : null,
          hookups: avHookups(v.campsite_type), nights: nights,
        });
      });
      return out;
    }
    function avFreeForRange(site, startYmd, endYmd) {
      var start = new Date(startYmd + 'T00:00:00Z'), end = new Date(endYmd + 'T00:00:00Z');
      if (!(start < end)) return false;
      for (var d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        if (site.nights[avDateKey(d)] !== 'Available') return false;
      }
      return true;
    }
    function avUpcomingWeekend(from) {
      from = from || new Date();
      var d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
      var dow = d.getUTCDay(); var toFri;
      if (dow === 5 || dow === 6) toFri = dow === 5 ? 0 : -1;
      else toFri = (5 - dow + 7) % 7;
      var fri = new Date(d); fri.setUTCDate(d.getUTCDate() + toFri);
      var sun = new Date(fri); sun.setUTCDate(fri.getUTCDate() + 2);
      return { start: avDateKey(fri), end: avDateKey(sun) };
    }
    function avMonthsForRange(startYmd, endYmd) {
      var out = []; var start = new Date(startYmd + 'T00:00:00Z'), end = new Date(endYmd + 'T00:00:00Z');
      var cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      while (cur <= end) { out.push(cur.toISOString().slice(0, 10)); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)); }
      return out;
    }

    function drawMarkers(list) {
      lastList = list || [];
      if (!mapReady) return; // queued; onMapReady will draw once the source exists
      var src = map.getSource('cg');
      if (src) src.setData(buildFeatures(lastList));
    }

    function popupHtml(c, chip) {
      var len = state.len;
      var info = (chip && chip.why !== undefined) ? chip : fitInfo(c, len);
      var lenTxt = c.m ? c.m + "' max" : 'No posted limit';
      var price = c.pr != null ? '$' + c.pr + '/night' : '';
      var rating = c.r ? '\u2605 ' + c.r.toFixed(1) + ' (' + (c.v || 0) + ')' : '';
      var why = (len > 0 && info.why) ? '<span class="cg-pop-why">' + esc(info.why) + '</span>' : '';
      var saved = isSaved(c);
      var saveBtn = '<button type="button" class="cg-pop-save' + (saved ? ' is-saved' : '') + '" data-save="' + esc(c.i) + '" aria-pressed="' + (saved ? 'true' : 'false') + '">'
        + (saved ? '\u2665 Saved' : '\u2661 Save') + '</button>';
      var availBtn = /^\d+$/.test(String(c.i))
        ? '<button type="button" class="cg-pop-avail" data-avail="' + esc(c.i) + '">Availability</button>'
        : '';
      return '<div class="cg-pop"><strong>' + esc(c.n) + '</strong><br>' +
        (c.p ? esc(c.p) + '<br>' : '') +
        '<span class="cg-pop-fit cg-fit-' + info.cls + '">' + esc(info.label) + '</span> \u00b7 ' + esc(lenTxt) + '<br>' +
        why +
        [rating, price].filter(Boolean).join(' \u00b7 ') +
        '<div class="cg-pop-actions">' + saveBtn + availBtn +
        (c.u ? '<a href="' + esc(c.u) + '" target="_blank" rel="noopener">Recreation.gov \u2192</a>' : '') +
        '</div></div>';
    }

    // ---- list ----
    function card(c, len) {
      var where = [c.s].filter(Boolean).join(', ');
      // Per-site honest fit when we have the histogram (static records); fall
      // back to the legacy posted-max verdict for live API rows (no .th).
      var perSite = (len > 0 && c.th) ? trailerFit(c, len) : null;
      var info = fitInfo(c, len);
      var fitChip, why, lenTxt;
      if (perSite) {
        var psLabel = perSite.cls === 'fits' ? (perSite.pct + '% of sites fit')
          : perSite.cls === 'tight' ? ('Tight — ' + perSite.pct + '% fit') : 'No site takes it';
        fitChip = '<span class="cg-fit cg-fit-' + perSite.cls + '"><span class="cg-conf cg-conf-persite" title="Per-site trailer-length data from Recreation.gov"></span>' + esc(psLabel) + '</span>';
        why = '<p class="cg-fit-why cg-fit-why-' + perSite.cls + '">' + esc(perSite.why) + '</p>';
        lenTxt = (perSite.sitesFit + perSite.sitesTight).toLocaleString('en-US') + ' of ' + perSite.sitesTotal.toLocaleString('en-US') + ' sites';
      } else {
        var confDot = (len > 0)
          ? '<span class="cg-conf cg-conf-' + info.conf + '" title="' + (info.conf === 'posted' ? 'Based on Recreation.gov\u2019s posted max length' : 'No posted length \u2014 not verified') + '"></span>'
          : '';
        fitChip = '<span class="cg-fit cg-fit-' + info.cls + '">' + confDot + esc(info.label) + '</span>';
        lenTxt = len > 0 ? (c.m ? c.m + "&prime; max" : 'No posted limit') : '';
        why = (len > 0 && info.why) ? '<p class="cg-fit-why cg-fit-why-' + info.cls + '">' + esc(info.why) + '</p>' : '';
      }
      var price = c.pr != null ? '$' + c.pr + '/night' : '';
      var img = c.g
        ? '<img src="' + esc(c.g) + '" alt="' + esc(c.n) + '" loading="lazy" class="cg-card-img" width="320" height="200" referrerpolicy="no-referrer">'
        : '<div class="cg-card-img cg-card-noimg" aria-hidden="true">\u25b2</div>';
      var org = c.o ? (ORG_LONG[c.o] || c.o) : '';
      var meta = [lenTxt, price, (c.v ? c.v + ' reviews' : '')].filter(Boolean)
        .map(function (s) { return '<span>' + s + '</span>'; }).join('');
      // Enriched pills: hookups (+amp), pull-through, elevation. Only when the
      // record carries the field (static set); omitted for live rows.
      var pills = '';
      if (c.h) {
        var hl = c.h === 'full' ? 'Full hookups' : c.h === 'electric' ? 'Electric' : 'No hookups';
        var amp = (c.h !== 'none' && c.am && c.am.length) ? ' \u00b7 ' + c.am.join('/') + 'A' : '';
        pills += '<span class="cg-pill cg-pill-hook-' + esc(c.h) + '">' + esc(hl + amp) + '</span>';
      }
      if (c.pt === 1) pills += '<span class="cg-pill cg-pill-pt">Pull-through</span>';
      if (c.el != null) {
        var ev = elevationContext(c.el);
        if (ev) pills += '<span class="cg-pill cg-pill-el-' + esc(ev.band) + '">' + esc(ev.ft.toLocaleString('en-US')) + '\u2032</span>';
      }
      var pillRow = pills ? '<p class="cg-card-pills">' + pills + '</p>' : '';
      var saved = isSaved(c);
      var saveBtn = '<button type="button" class="cg-save' + (saved ? ' is-saved' : '') + '" '
        + 'data-save="' + esc(c.i) + '" aria-pressed="' + (saved ? 'true' : 'false') + '" '
        + 'aria-label="' + (saved ? 'Saved \u2014 remove from shortlist' : 'Save to shortlist') + '" '
        + 'title="' + (saved ? 'Saved' : 'Save') + '">' + (saved ? '\u2665' : '\u2661') + '</button>';
      // Availability button — opens the live drawer (#7/#8/#10). Only useful
      // for reservable Recreation.gov campgrounds (those carry a numeric id).
      var availBtn = /^\d+$/.test(String(c.i))
        ? '<button type="button" class="cg-avail-btn" data-avail="' + esc(c.i) + '">Check availability &amp; site fit</button>'
        : '';
      return '<div class="cg-card-outer">' +
        '<a class="cg-card" href="' + esc(c.u || '#') + '" target="_blank" rel="noopener">' + img +
        '<div class="cg-card-body"><div class="cg-card-top">' + fitChip + (c.r ? '<span class="cg-stars">\u2605 ' + c.r.toFixed(1) + '</span>' : '') + '</div>' +
        '<h3 class="cg-card-name">' + esc(c.n) + '</h3>' +
        '<p class="cg-card-where">' + esc(where) + (org ? ' \u00b7 ' + esc(org) : '') + '</p>' +
        why +
        pillRow +
        '<p class="cg-card-meta">' + meta + '</p>' +
        availBtn +
        '</div></a>' + saveBtn + '</div>';
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
      // A collection view always reads the national baked set, so label it
      // honestly as the cached set regardless of the live/fallback source.
      var effSource = state.collection ? 'static' : state.source;
      var srcTxt = effSource === 'live'
        ? 'Live from Recreation.gov'
        : (effSource === 'fallback' ? 'Live unavailable \u2014 cached set' : 'Cached set');
      var scopeTxt = effSource === 'live' ? ' in view' : '';
      var rigTxt = len > 0 ? (' \u00b7 fitting a ' + (Math.round(len * 10) / 10) + "&prime; rig") : '';
      // When a curated collection is active, fold its label into the noun so the
      // count reads like "487 Editor's Picks campgrounds". Pulled from the live
      // chip text so the wording stays in one place (the rail).
      var colTxt = '';
      if (state.collection) {
        var activeChip = document.querySelector('.cg-col[data-col="' + state.collection + '"] .cg-col-label');
        if (activeChip) colTxt = ' ' + esc(activeChip.textContent.trim());
      }
      elSummary.innerHTML = '<strong>' + list.length.toLocaleString('en-US') + '</strong>' + colTxt + ' campgrounds' + scopeTxt + rigTxt +
        ' <span class="cg-src-tag cg-src-' + effSource + '">' + esc(srcTxt) + '</span>';
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
              // CLIP to the actual visible rectangle so list + markers match the map exactly.
              // MapLibre bounds.contains expects [lng, lat] (opposite of Leaflet's [lat, lng]).
              b.contains([Number(x.longitude), Number(x.latitude)]);
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
        g: proxyPhoto(x.preview_image_url) || undefined, la: Number(x.latitude), lo: Number(x.longitude),
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
    if (elHookup) elHookup.addEventListener('change', function () { state.hookup = this.value; state.shown = 30; persistCg(); render(); });
    if (elElev) elElev.addEventListener('change', function () { state.elev = this.value; state.shown = 30; persistCg(); render(); });
    if (elPullthrough) elPullthrough.addEventListener('change', function () { state.pullthrough = this.checked; state.shown = 30; persistCg(); render(); });
    // ---- curated collections rail ----
    var colRail = document.querySelector('.cg-collections');
    var colBlurb = document.getElementById('cg-col-blurb');
    var colChips = colRail ? [].slice.call(colRail.querySelectorAll('.cg-col')) : [];
    // Visually sync the rail to state.collection: pressed chip, blurb text. The
    // blurb (and its title attr source) lives on each chip so there's no second
    // copy of the editorial strings in JS.
    function syncCollectionRail() {
      if (!colRail) return;
      // Validate the active key against the real chips; an unknown key (stale or
      // hand-edited share link) falls back to "All campgrounds".
      if (state.collection) {
        var valid = colChips.some(function (ch) { return ch.getAttribute('data-col') === state.collection; });
        if (!valid) state.collection = '';
      }
      var activeBlurb = '';
      colChips.forEach(function (chip) {
        var on = (chip.getAttribute('data-col') || '') === (state.collection || '');
        chip.classList.toggle('is-on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && chip.getAttribute('data-col')) activeBlurb = chip.getAttribute('title') || '';
      });
      if (colBlurb) {
        if (activeBlurb) { colBlurb.textContent = activeBlurb; colBlurb.hidden = false; }
        else { colBlurb.textContent = ''; colBlurb.hidden = true; }
      }
    }
    colChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var key = this.getAttribute('data-col') || '';
        // Toggle: clicking the active collection clears it back to "All".
        state.collection = (state.collection === key) ? '' : key;
        state.shown = 30;
        syncCollectionRail(); persistCg(); render();
      });
    });
    // NOTE: the authoritative initial sync runs AFTER prefs + share-hash are
    // applied (search for "syncCollectionRail(); // init") so a deep-linked
    // col= is reflected on the chips. Don't sync here — state isn't final yet.
    if (elMoreBtn) elMoreBtn.addEventListener('click', function () { state.shown += 30; render(); });
    if (elReset) elReset.addEventListener('click', function () {
      state = { len: 0, st: '', collection: '', q: '', sort: 'rank', hideUnknown: false, fitsOnly: false, hookup: '', elev: '', pullthrough: false, shown: 30, live: state.live, source: state.source };
      if (elRig) elRig.value = ''; if (elLen) elLen.value = ''; if (elState) elState.value = '';
      if (elSearch) elSearch.value = ''; if (elSort) elSort.value = 'rank';
      if (elHideUnknown) elHideUnknown.checked = false; if (elFitsOnly) elFitsOnly.checked = false;
      if (elHookup) elHookup.value = ''; if (elElev) elElev.value = ''; if (elPullthrough) elPullthrough.checked = false;
      syncCollectionRail();
      Store.del(CG_PREFS);
      map.jumpTo({ center: [-98.35, 39.5], zoom: 3.4 }); render();
    });
    // (map 'moveend' -> scheduleLive is bound in wireRealMap once the real map exists)

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
      if (elHookup && state.hookup) elHookup.value = state.hookup;
      if (elElev && state.elev) elElev.value = state.elev;
      if (elPullthrough) elPullthrough.checked = !!state.pullthrough;
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

    // ---- shareable view via URL hash (#len=..&st=..&sort=..&hu=1&fo=1&map=lat,lng,z)
    // A share link reflects the sender's exact view, so it wins over both saved
    // prefs and ?len=. We re-sync DOM controls after applying it.
    var pendingMapView = null;
    (function applyShareHash() {
      var h = (location.hash || '').replace(/^#/, '');
      if (!h) return;
      var sp = new URLSearchParams(h);
      if (sp.has('len')) {
        var l = parseFloat(sp.get('len'));
        state.len = (!isNaN(l) && l > 0) ? l : 0;
      }
      if (sp.has('st')) state.st = sp.get('st') || '';
      if (sp.has('col')) state.collection = sp.get('col') || '';
      if (sp.has('sort')) state.sort = sp.get('sort') || 'rank';
      if (sp.has('q')) state.q = (sp.get('q') || '').toLowerCase();
      if (sp.has('hu')) state.hideUnknown = sp.get('hu') === '1';
      if (sp.has('fo')) state.fitsOnly = sp.get('fo') === '1';
      if (sp.has('hk')) state.hookup = sp.get('hk') || '';
      if (sp.has('ev')) state.elev = sp.get('ev') || '';
      if (sp.has('pt')) state.pullthrough = sp.get('pt') === '1';
      var mv = sp.get('map');
      if (mv) {
        var parts = mv.split(',').map(parseFloat);
        if (parts.length === 3 && parts.every(function (x) { return !isNaN(x); })) {
          pendingMapView = { lat: parts[0], lng: parts[1], z: Math.max(2, Math.min(18, parts[2])) };
        }
      }
      // Re-sync the controls to the shared state.
      if (elLen) elLen.value = state.len > 0 ? Math.round(state.len) : '';
      if (elRig) {
        elRig.value = '';
        for (var i = 0; i < elRig.options.length; i++) {
          if (parseFloat(elRig.options[i].value) === state.len) { elRig.selectedIndex = i; break; }
        }
      }
      if (elState) elState.value = state.st;
      if (elSort) elSort.value = state.sort;
      if (elSearch && state.q) elSearch.value = state.q;
      if (elHideUnknown) elHideUnknown.checked = state.hideUnknown;
      if (elFitsOnly) elFitsOnly.checked = state.fitsOnly;
      if (elHookup) elHookup.value = state.hookup || '';
      if (elElev) elElev.value = state.elev || '';
      if (elPullthrough) elPullthrough.checked = !!state.pullthrough;
    })();
    // (pendingMapView is applied inside wireRealMap once the real map exists)
    // Authoritative initial rail sync: now that saved prefs AND a deep-linked
    // col= (share hash) have both been applied to state.collection, reflect it
    // on the chips (pressed state + blurb), validating unknown keys to "All".
    syncCollectionRail(); // init

    // Build a shareable URL that reproduces the current view.
    function buildShareUrl() {
      var sp = new URLSearchParams();
      if (state.len > 0) sp.set('len', String(Math.round(state.len * 10) / 10));
      if (state.st) sp.set('st', state.st);
      if (state.collection) sp.set('col', state.collection);
      if (state.sort && state.sort !== 'rank') sp.set('sort', state.sort);
      if (state.q) sp.set('q', state.q);
      if (state.hideUnknown) sp.set('hu', '1');
      if (state.fitsOnly) sp.set('fo', '1');
      if (state.hookup) sp.set('hk', state.hookup);
      if (state.elev) sp.set('ev', state.elev);
      if (state.pullthrough) sp.set('pt', '1');
      var c = map.getCenter();
      sp.set('map', (Math.round(c.lat * 1e4) / 1e4) + ',' + (Math.round(c.lng * 1e4) / 1e4) + ',' + map.getZoom());
      return location.origin + location.pathname + '#' + sp.toString();
    }

    // Share button: copy the link to the current view; graceful fallback.
    if (elShare) {
      elShare.addEventListener('click', function () {
        var url = buildShareUrl();
        var btn = this;
        function flash(msg) {
          var prev = btn.getAttribute('data-label') || btn.textContent;
          btn.setAttribute('data-label', prev);
          btn.textContent = msg; btn.classList.add('is-copied');
          setTimeout(function () { btn.textContent = btn.getAttribute('data-label') || 'Share view'; btn.classList.remove('is-copied'); }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { flash('Link copied \u2713'); }, function () { fallbackCopy(url, flash); });
        } else {
          fallbackCopy(url, flash);
        }
      });
    }
    function fallbackCopy(text, flash) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        flash('Link copied \u2713');
      } catch (e) {
        // Last resort: drop it in the address bar so the user can copy manually.
        location.hash = buildShareUrl().split('#')[1] || '';
        flash('Link in address bar');
      }
    }

    // ---- saved shortlist tray + compare -----------------------------------
    // Resolve an id back to a full record (live pool first, then static, then
    // the saved snapshot) so save/compare works regardless of current view.
    function recordById(id) {
      var p = pool();
      for (var k = 0; k < p.length; k++) if (String(p[k].i) === String(id)) return p[k];
      for (var j = 0; j < STATIC.length; j++) if (String(STATIC[j].i) === String(id)) return STATIC[j];
      for (var s = 0; s < savedList.length; s++) if (String(savedList[s].i) === String(id)) return savedList[s];
      return null;
    }

    // Delegated: the heart button on each card toggles the shortlist without
    // following the card's link.
    root.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.cg-save');
      if (!btn || !root.contains(btn)) return;
      e.preventDefault(); e.stopPropagation();
      var rec = recordById(btn.getAttribute('data-save'));
      if (rec) { toggleSave(rec); render(); drawSavedTray(); }
    });

    // Delegated: save button inside a map popup.
    mapEl.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.cg-pop-save');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      var rec = recordById(btn.getAttribute('data-save'));
      if (!rec) return;
      toggleSave(rec);
      var nowSaved = isSaved(rec);
      btn.classList.toggle('is-saved', nowSaved);
      btn.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
      btn.innerHTML = nowSaved ? '\u2665 Saved' : '\u2661 Save';
      render(); drawSavedTray();
    });

    // Build the saved tray once and reuse. Lives just under the summary.
    var trayWrap = null, trayPanel = null, trayOpen = false;
    function ensureTray() {
      if (trayWrap) return;
      trayWrap = document.createElement('div');
      trayWrap.className = 'cg-tray';
      trayWrap.innerHTML =
        '<button type="button" class="cg-tray-toggle" aria-expanded="false">'
        + '<span class="cg-tray-heart">\u2665</span> Saved <span class="cg-tray-count">0</span></button>'
        + '<div class="cg-tray-panel" hidden></div>';
      var summary = document.getElementById('cg-summary');
      if (summary && summary.parentNode) summary.parentNode.insertBefore(trayWrap, summary.nextSibling);
      else root.parentNode.insertBefore(trayWrap, root);
      trayPanel = trayWrap.querySelector('.cg-tray-panel');
      trayWrap.querySelector('.cg-tray-toggle').addEventListener('click', function () {
        trayOpen = !trayOpen;
        this.setAttribute('aria-expanded', trayOpen ? 'true' : 'false');
        trayPanel.hidden = !trayOpen;
      });
      trayPanel.addEventListener('click', function (e) {
        var rm = e.target.closest && e.target.closest('[data-unsave]');
        if (rm) {
          var rec = recordById(rm.getAttribute('data-unsave'));
          if (rec) { toggleSave(rec); render(); drawSavedTray(); }
          return;
        }
        if (e.target.closest && e.target.closest('.cg-tray-clear')) {
          savedList = []; savedSet = {}; Store.set(CG_SAVED, savedList);
          render(); drawSavedTray();
        }
      });
    }
    function fmtFitForLen(c) {
      var info = fitInfo(c, state.len);
      return '<span class="cg-fit cg-fit-' + info.cls + '">' + esc(info.label) + '</span>';
    }
    function drawSavedTray() {
      ensureTray();
      var n = savedList.length;
      trayWrap.querySelector('.cg-tray-count').textContent = n;
      trayWrap.classList.toggle('has-saved', n > 0);
      if (!n) {
        trayPanel.innerHTML = '<p class="cg-tray-empty">No saved campgrounds yet. Tap the \u2661 on any campground to build a shortlist you can compare.</p>';
        return;
      }
      var rows = savedList.map(function (c) {
        var where = [c.s].filter(Boolean).join(', ');
        var len = c.m ? c.m + '\u2032 max' : 'No posted limit';
        var price = c.pr != null ? '$' + c.pr + '/night' : '\u2014';
        var rating = c.r ? '\u2605 ' + c.r.toFixed(1) : '\u2014';
        return '<tr>'
          + '<td class="cg-tr-name"><a href="' + esc(c.u || '#') + '" target="_blank" rel="noopener">' + esc(c.n) + '</a>'
          + '<span class="cg-tr-where">' + esc(where) + '</span></td>'
          + '<td>' + (state.len > 0 ? fmtFitForLen(c) : esc(len)) + '</td>'
          + '<td>' + esc(len) + '</td>'
          + '<td>' + esc(rating) + '</td>'
          + '<td>' + esc(price) + '</td>'
          + '<td><button type="button" class="cg-tr-x" data-unsave="' + esc(c.i) + '" aria-label="Remove">\u00d7</button></td>'
          + '</tr>';
      }).join('');
      trayPanel.innerHTML =
        '<div class="cg-tray-head"><strong>' + n + '</strong> saved'
        + (state.len > 0 ? ' \u00b7 fit shown for your ' + (Math.round(state.len * 10) / 10) + '\u2032 rig' : '')
        + ' <button type="button" class="cg-tray-clear">Clear all</button></div>'
        + '<div class="cg-tray-scroll"><table class="cg-tray-table"><thead><tr>'
        + '<th>Campground</th><th>Fit</th><th>Posted max</th><th>Rating</th><th>Price</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    // ---- load the dataset (external, cache-forever file), THEN boot the UI --
    // The ~905 KB dataset is no longer inlined in the page; it's fetched from a
    // fingerprinted, immutable-cached JSON file so the HTML stays tiny and the
    // data is downloaded once and reused. The list, saved tray, and map all wait
    // on this. Same-origin (Cloudflare Pages) so it loads wherever the page does.
    function boot() {
      render();
      drawSavedTray();
      loadMapLibrary();
    }
    (function loadData() {
      var url = (dataEl && dataEl.getAttribute('data-src')) || 'assets/data/campgrounds.json';
      root.innerHTML = '<p class="cg-loading"><span class="cg-spinner"></span> Loading campgrounds\u2026</p>';
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
      fetch(url, { signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          STATIC = ((d && d.campgrounds) || []).map(hydrate);
          boot();
        })
        .catch(function () {
          clearTimeout(to);
          STATIC = [];
          root.innerHTML = '<p class="cg-empty">Couldn\u2019t load the campground list on this connection. '
            + '<button type="button" class="cg-retry" id="cg-retry">Try again</button></p>';
          var rb = document.getElementById('cg-retry');
          if (rb) rb.addEventListener('click', function () { location.reload(); });
          showMapUnavailable(mapEl);
        });
    })();

    // ---- lazy-load the map AFTER the list is on screen --------------------
    // MapLibre is ~940 KB — by far the heaviest asset on the site. Loading it
    // render-blocking (a <script defer> in <head>) meant the campground LIST
    // couldn't appear until that download finished, and if the download failed
    // the whole page looked broken ("打不开"). So we ship the list first, then
    // fetch the map library on demand and upgrade the map in place. The list is
    // already fully interactive (filter/sort/search/save/availability) by now.
    function loadMapLibrary() {
      if (typeof maplibregl !== 'undefined') { initMap(); return; } // already present
      var src = (window.__AE_MAPLIBRE_SRC__ || 'assets/vendor/maplibre/maplibre-gl.js');
      var s = document.createElement('script');
      s.src = src; s.async = true;
      var done = false;
      s.onload = function () { if (done) return; done = true; initMap(); };
      s.onerror = function () {
        if (done) return; done = true;
        // Library couldn't be fetched (offline / blocked / aborted): the list
        // stands on its own; just swap the placeholder for an honest notice.
        showMapUnavailable(mapEl);
      };
      // Safety net: if the script neither loads nor errors within 12s (stalled
      // connection), stop showing the map "Loading…" spinner.
      setTimeout(function () {
        if (done || typeof maplibregl !== 'undefined') return;
        done = true; showMapUnavailable(mapEl);
      }, 12000);
      document.head.appendChild(s);
    }

    // ---- availability drawer (#7 per-site fit, #8 hookups, #10 this weekend) -
    // Opens on a card/popup "Check availability" click and fetches live data
    // from Recreation.gov's public month endpoint (CORS-open). One call covers
    // a whole campground-month; we fetch the month(s) the chosen range spans.
    var drawer = null, drawerBody = null, drawerTitle = null, drawerCache = {};
    var drawerCtx = { id: null, range: null, mode: 'weekend' };
    function ensureDrawer() {
      if (drawer) return;
      drawer = document.createElement('div');
      drawer.className = 'cg-drawer'; drawer.setAttribute('hidden', '');
      drawer.innerHTML =
        '<div class="cg-drawer-scrim" data-close="1"></div>' +
        '<aside class="cg-drawer-panel" role="dialog" aria-modal="true" aria-label="Campground availability">' +
        '<header class="cg-drawer-head"><h2 class="cg-drawer-title">Availability</h2>' +
        '<button type="button" class="cg-drawer-x" data-close="1" aria-label="Close">\u00d7</button></header>' +
        '<div class="cg-drawer-body"></div></aside>';
      document.body.appendChild(drawer);
      drawerBody = drawer.querySelector('.cg-drawer-body');
      drawerTitle = drawer.querySelector('.cg-drawer-title');
      drawer.addEventListener('click', function (e) {
        if (e.target.getAttribute && e.target.getAttribute('data-close')) closeDrawer();
        var seg = e.target.closest && e.target.closest('[data-range]');
        if (seg) { drawerCtx.mode = seg.getAttribute('data-range'); loadDrawer(); }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer && !drawer.hasAttribute('hidden')) closeDrawer(); });
    }
    function openDrawer(rec) {
      ensureDrawer();
      drawerCtx.id = rec.i; drawerCtx.rec = rec; drawerCtx.mode = 'weekend';
      drawer.removeAttribute('hidden'); document.body.classList.add('cg-drawer-open');
      drawerTitle.textContent = rec.n || 'Availability';
      loadDrawer();
    }
    function closeDrawer() {
      if (!drawer) return;
      drawer.setAttribute('hidden', ''); document.body.classList.remove('cg-drawer-open');
    }
    function rangeFor(mode) {
      if (mode === 'weekend') return avUpcomingWeekend(new Date());
      if (mode === 'next-weekend') {
        var wk = avUpcomingWeekend(new Date());
        var fri = new Date(wk.start + 'T00:00:00Z'); fri.setUTCDate(fri.getUTCDate() + 7);
        var sun = new Date(fri); sun.setUTCDate(fri.getUTCDate() + 2);
        return { start: avDateKey(fri), end: avDateKey(sun) };
      }
      // month: today -> +30d, summarized per-night (we show the best week)
      var t = new Date(); var s = avDateKey(t);
      var e = new Date(t); e.setUTCDate(e.getUTCDate() + 30);
      return { start: s, end: avDateKey(e) };
    }
    function monthUrl(id, monthStart) {
      return 'https://www.recreation.gov/api/camps/availability/campground/' + id +
        '/month?start_date=' + encodeURIComponent(monthStart + 'T00:00:00.000Z');
    }
    function fetchMonth(id, monthStart) {
      var key = id + '|' + monthStart;
      if (drawerCache[key]) return Promise.resolve(drawerCache[key]);
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      return fetch(monthUrl(id, monthStart), { headers: { accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { drawerCache[key] = d; return d; });
    }
    function loadDrawer() {
      var rec = drawerCtx.rec; if (!rec) return;
      var range = rangeFor(drawerCtx.mode); drawerCtx.range = range;
      drawerBody.innerHTML = drawerControlsHtml(rec, range) +
        '<div class="cg-av-status"><span class="cg-spinner"></span> Checking live availability on Recreation.gov\u2026</div>';
      var months = avMonthsForRange(range.start, range.end);
      Promise.all(months.map(function (m) { return fetchMonth(rec.i, m); }))
        .then(function (payloads) {
          // merge sites across months (union of night maps)
          var merged = {};
          payloads.forEach(function (p) {
            avParse(p).forEach(function (s) {
              if (!merged[s.id]) merged[s.id] = s;
              else { for (var k in s.nights) merged[s.id].nights[k] = s.nights[k]; }
            });
          });
          var sites = Object.keys(merged).map(function (k) { return merged[k]; });
          renderDrawerResults(rec, range, sites);
        })
        .catch(function () {
          drawerBody.querySelector('.cg-av-status').innerHTML =
            '<div class="cg-av-error"><strong>Couldn\u2019t load live availability.</strong> Recreation.gov may be busy or this campground isn\u2019t reservable online. ' +
            '<a href="' + esc(rec.u || '#') + '" target="_blank" rel="noopener">Open it on Recreation.gov \u2192</a></div>';
        });
    }
    function drawerControlsHtml(rec, range) {
      function seg(mode, label) {
        return '<button type="button" class="cg-av-seg' + (drawerCtx.mode === mode ? ' is-on' : '') + '" data-range="' + mode + '">' + label + '</button>';
      }
      var rig = state.len > 0 ? (Math.round(state.len * 10) / 10) + '\u2032 rig' : 'no rig set';
      return '<div class="cg-av-controls">' +
        '<div class="cg-av-segs">' + seg('weekend', 'This weekend') + seg('next-weekend', 'Next weekend') + seg('month', 'Next 30 days') + '</div>' +
        '<p class="cg-av-range">' + fmtRange(range) + ' \u00b7 fitting your <strong>' + rig + '</strong></p>' +
        '</div>';
    }
    function fmtRange(range) {
      function d(ymd) { var x = new Date(ymd + 'T00:00:00Z'); return x.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); }
      return d(range.start) + ' \u2013 ' + d(range.end);
    }
    function renderDrawerResults(rec, range, sites) {
      var len = state.len;
      var cgMax = rec.m != null ? rec.m : null;
      // Sites free for the whole range, classified by per-site Trailer fit.
      var free = sites.filter(function (s) { return avFreeForRange(s, range.start, range.end); });
      var rows = free.map(function (s) {
        var max = (s.trailerMax != null) ? s.trailerMax : cgMax; // detail not fetched yet -> cg blanket
        var fit = avSiteFit(len, max);
        return { s: s, max: max, fit: fit };
      }).filter(function (r) { return r.fit !== 'no'; });
      // Sort: best fit first, then has-hookup, then site name.
      var ORDER = { fits: 0, tight: 1, limit: 2, unknown: 3 };
      rows.sort(function (a, b) {
        var d = (ORDER[a.fit] || 9) - (ORDER[b.fit] || 9); if (d) return d;
        var h = (b.s.hookups.electric ? 1 : 0) - (a.s.hookups.electric ? 1 : 0); if (h) return h;
        return (a.s.site || '').localeCompare(b.s.site || '');
      });
      var FITLAB = { fits: 'Fits', tight: 'Tight', limit: 'Open', unknown: 'No site limit' };
      var head;
      if (!free.length) {
        head = '<div class="cg-av-headline cg-av-none">No sites are open for ' + esc(fmtRange(range).toLowerCase()) +
          '. <a href="' + esc(rec.u || '#') + '" target="_blank" rel="noopener">Try other dates on Recreation.gov \u2192</a></div>';
      } else if (len > 0) {
        var fitCount = rows.filter(function (r) { return r.fit === 'fits' || r.fit === 'tight'; }).length;
        head = '<div class="cg-av-headline">' +
          '<strong>' + free.length + '</strong> site' + (free.length === 1 ? '' : 's') + ' open' +
          (fitCount < free.length ? ' \u00b7 <strong>' + fitCount + '</strong> fit your rig' : ' \u00b7 all fit your rig') +
          '</div>';
      } else {
        head = '<div class="cg-av-headline"><strong>' + free.length + '</strong> site' + (free.length === 1 ? '' : 's') + ' open. Set your rig length to see which ones fit.</div>';
      }
      var note = (cgMax != null)
        ? '<p class="cg-av-note">Fit shown against this campground\u2019s posted ' + cgMax + '\u2032 max. Open a site on Recreation.gov for its exact per-site length.</p>'
        : '<p class="cg-av-note">This campground posts no max length; confirm each site\u2019s length on Recreation.gov before booking.</p>';
      var list = rows.length ? '<ul class="cg-av-list">' + rows.map(function (r) {
        var s = r.s;
        return '<li class="cg-av-site cg-av-' + r.fit + '">' +
          '<span class="cg-av-site-id">' + esc(s.site || s.id) + (s.loop ? ' <span class="cg-av-loop">' + esc(s.loop) + '</span>' : '') + '</span>' +
          '<span class="cg-av-tags">' +
          '<span class="cg-av-fit cg-fit-' + (r.fit === 'limit' ? 'limit' : r.fit) + '">' + (FITLAB[r.fit] || r.fit) + (r.max != null ? ' \u00b7 ' + r.max + '\u2032' : '') + '</span>' +
          '<span class="cg-av-hook' + (s.hookups.electric ? ' has-elec' : '') + '">' + esc(s.hookups.label) + '</span>' +
          '</span></li>';
      }).join('') + '</ul>' : '';
      var book = '<a class="cg-av-book" href="' + esc(rec.u || '#') + '" target="_blank" rel="noopener">Book on Recreation.gov \u2192</a>';
      drawerBody.innerHTML = drawerControlsHtml(rec, range) + head + (free.length ? note + list + book : book);
    }

    // Delegated open handlers (cards in the list + popups on the map).
    root.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.cg-avail-btn');
      if (!btn || !root.contains(btn)) return;
      e.preventDefault(); e.stopPropagation();
      var rec = recordById(btn.getAttribute('data-avail'));
      if (rec) openDrawer(rec);
    });
    mapEl.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.cg-pop-avail');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      var rec = recordById(btn.getAttribute('data-avail'));
      if (rec) openDrawer(rec);
    });
  })();

  /* Interactive floorplan zones — touch/click/keyboard, no hover dependency.
     Tap a numbered dot to open its bubble and highlight the matching legend
     row; tap again, tap elsewhere, or press Escape to close. With JS off the
     dots are still focusable labels and the legend lists every zone. */
  (function floorplanZones() {
    var section = document.querySelector('.floorplan--interactive');
    if (!section) return;
    var overlay = section.querySelector('[data-fp-overlay]');
    if (!overlay) return;
    var dots = Array.prototype.slice.call(overlay.querySelectorAll('.fp-dot'));
    if (!dots.length) return;
    var legendItems = Array.prototype.slice.call(section.querySelectorAll('.fp-leg-item'));
    var openId = null;

    function popFor(id) { return section.querySelector('#fp-pop-' + cssEsc(id)); }
    function legFor(id) {
      for (var i = 0; i < legendItems.length; i++) {
        if (legendItems[i].getAttribute('data-fp-leg') === id) return legendItems[i];
      }
      return null;
    }
    // Minimal id escaper for querySelector (ids here are simple slugs anyway).
    function cssEsc(s) {
      if (window.CSS && CSS.escape) return CSS.escape(s);
      return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    function close() {
      if (openId == null) return;
      var d = overlay.querySelector('.fp-dot[data-fp-dot="' + cssEsc(openId) + '"]');
      var p = popFor(openId);
      var l = legFor(openId);
      if (d) d.setAttribute('aria-expanded', 'false');
      if (p) p.hidden = true;
      if (l) l.classList.remove('is-active');
      openId = null;
    }
    function open(id) {
      if (openId === id) { close(); return; }
      close();
      var d = overlay.querySelector('.fp-dot[data-fp-dot="' + cssEsc(id) + '"]');
      var p = popFor(id);
      var l = legFor(id);
      if (d) d.setAttribute('aria-expanded', 'true');
      if (p) p.hidden = false;
      if (l) l.classList.add('is-active');
      openId = id;
    }

    dots.forEach(function (d) {
      d.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        open(d.getAttribute('data-fp-dot'));
      });
    });
    // Tapping/clicking a legend row also opens its zone (and scrolls the dot
    // into view on small screens where the diagram may be above the fold).
    legendItems.forEach(function (l) {
      l.addEventListener('click', function () {
        open(l.getAttribute('data-fp-leg'));
      });
      l.style.cursor = 'pointer';
    });
    // Outside tap closes.
    document.addEventListener('click', function (e) {
      if (openId == null) return;
      if (section.contains(e.target)) return;
      close();
    });
    // Escape closes.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') close();
    });
  })();

  // =========================================================================
  // 9. FUEL COST ESTIMATOR (detail pages)
  //    Mirrors the server-side math in src/lib/fuel.mjs. Reads the vehicle
  //    table from a CSP-safe JSON island (#fuel-data); no network, works offline.
  // =========================================================================
  (function fuelTool() {
    var root = document.querySelector('.fuel-tool');
    if (!root) return;
    var dataEl = document.getElementById('fuel-data');
    if (!dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!data || !data.vehicles || !data.trailer) return;

    var BASE_PENALTY = 0.20;
    var WEIGHT_FACTOR = 0.25;
    var MAX_PENALTY = 0.60;
    var MIN_MPG = 5.0;
    var DEFAULT_MPG = 18;
    var MIN_MI_PER_KWH = 0.5;
    var DEFAULT_KWH_100 = (data.defaults && data.defaults.kwhPer100mi) || 48;

    var byId = {};
    data.vehicles.forEach(function (v) { byId[v.id] = v; });

    var elVehicle = document.getElementById('fuel-vehicle');
    var elDistance = document.getElementById('fuel-distance');
    var elPrice = document.getElementById('fuel-price');
    var elPriceLabel = document.getElementById('fuel-price-label');
    var elPriceSuffix = document.getElementById('fuel-price-suffix');
    var elCost = document.getElementById('fuel-cost');
    var elCostNoun = document.getElementById('fuel-cost-noun');
    var elMpg = document.getElementById('fuel-mpg');
    var elMpgLabel = document.getElementById('fuel-mpg-label');
    var elGallons = document.getElementById('fuel-gallons');
    var elGallonsLabel = document.getElementById('fuel-gallons-label');
    var elCpm = document.getElementById('fuel-cpm');
    var elSub = document.getElementById('fuel-sub');

    function money(n) { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    // Remember the last price the user set for each fuel type, so switching
    // gas<->electric restores a sensible per-unit price instead of reusing a
    // gas $/gal as an absurd $/kWh.
    var lastPrice = {
      gas: (data.defaults && data.defaults.fuelPriceGal) || 3.50,
      electric: (data.defaults && data.defaults.kwhPriceKwh) || 0.16,
    };
    var curMode = null; // 'gas' | 'electric'

    function applyMode(mode) {
      if (mode === curMode) return;
      // Save the price the user had under the previous mode before swapping.
      if (curMode) {
        var prev = parseFloat(elPrice.value);
        if (prev > 0) lastPrice[curMode] = prev;
      }
      curMode = mode;
      var isEv = mode === 'electric';
      if (elPriceLabel) elPriceLabel.textContent = isEv ? 'Electricity price' : 'Fuel price';
      if (elPriceSuffix) elPriceSuffix.textContent = isEv ? '$/kWh' : '$/gal';
      if (elCostNoun) elCostNoun.textContent = isEv ? 'estimated energy' : 'estimated fuel';
      if (elMpgLabel) elMpgLabel.textContent = isEv ? 'Towing efficiency' : 'Towing economy';
      if (elGallonsLabel) elGallonsLabel.textContent = isEv ? 'Energy needed' : 'Fuel needed';
      elPrice.step = isEv ? '0.01' : '0.10';
      elPrice.max = isEv ? '2' : '10';
      elPrice.min = '0.05';
      elPrice.value = lastPrice[mode].toFixed(2);
    }

    function compute() {
      var v = byId[elVehicle.value] || data.vehicles[0];
      var isEv = v.fuel === 'electric';
      applyMode(isEv ? 'electric' : 'gas');

      var dist = parseFloat(elDistance.value) || data.defaults.distanceMi;
      var price = parseFloat(elPrice.value) || lastPrice[curMode];
      var trailerWt = data.trailer.gvwrLb || data.trailer.weightLb || 0;
      var vehicleCurb = v.curbWeightLb || 0;
      var ratio = (trailerWt > 0 && vehicleCurb > 0) ? trailerWt / vehicleCurb : 0;
      var penalty = Math.min(BASE_PENALTY + WEIGHT_FACTOR * ratio, MAX_PENALTY);

      var cost, cpm, economyText, usedText;
      if (isEv) {
        var baseKwh = v.kwhPer100mi || DEFAULT_KWH_100;
        var towKwh100 = Math.min(baseKwh / (1 - penalty), 100 / MIN_MI_PER_KWH);
        var kwhUsed = (dist / 100) * towKwh100;
        cost = kwhUsed * price;
        cpm = cost / dist;
        economyText = towKwh100.toFixed(1) + ' kWh/100mi';
        usedText = kwhUsed.toFixed(1) + ' kWh';
      } else {
        var unladenMpg = (data.classmpg && data.classmpg[v.class]) || DEFAULT_MPG;
        var towMpg = Math.max(unladenMpg * (1 - penalty), MIN_MPG);
        var gallons = dist / towMpg;
        cost = gallons * price;
        cpm = cost / dist;
        economyText = towMpg.toFixed(1) + ' MPG';
        usedText = gallons.toFixed(1) + ' gal';
      }

      elCost.textContent = money(cost);
      elMpg.textContent = economyText;
      elGallons.textContent = usedText;
      elCpm.textContent = money(cpm) + '/mi';
      if (elSub) {
        elSub.textContent = elSub.textContent.replace(
          /(?:Fuel economy drops|Energy use climbs) \d+%/,
          (isEv ? 'Energy use climbs ' : 'Fuel economy drops ') + Math.round(penalty * 100) + '%'
        );
      }
    }

    if (elVehicle) elVehicle.addEventListener('change', compute);
    if (elDistance) elDistance.addEventListener('input', compute);
    if (elPrice) elPrice.addEventListener('input', compute);
    compute();
  })();

  // =========================================================================
  // 10. PAYLOAD / PACKING CALCULATOR (detail pages)
  //     Mirrors the server-side math in src/lib/payload.mjs. Reads config from
  //     a CSP-safe JSON island (#payload-data); no network, works offline.
  // =========================================================================
  (function payloadTool() {
    var root = document.querySelector('.payload-tool');
    if (!root) return;
    var dataEl = document.getElementById('payload-data');
    if (!dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!data) return;

    var WATER_LB = data.waterLbPerGal || 8.34;
    var ccc = data.cccLb || 0;
    var freshGal = data.freshGal || 0;

    var elWater = document.getElementById('payload-water');
    var elPropane = document.getElementById('payload-propane');
    var elRemaining = document.getElementById('payload-remaining');
    var elStatus = document.getElementById('payload-status');
    var elDetail = document.getElementById('payload-detail');
    var elBars = document.getElementById('payload-bars');
    var gearChecks = Array.prototype.slice.call(root.querySelectorAll('.payload-gear-check'));

    var STATUS_META = {
      ok: { label: 'Good capacity', cls: 'payload-ok' },
      tight: { label: 'Getting tight', cls: 'payload-tight' },
      over: { label: 'Over capacity', cls: 'payload-over' },
    };

    function fmtLb(n) { return Math.round(n).toLocaleString('en-US') + ' lb'; }

    function compute() {
      var waterFill = parseFloat(elWater.value) || 0;
      var propaneKey = elPropane.value;
      var propaneLb = (data.propanePresets[propaneKey] || {}).weightLb || 0;
      var waterLb = Math.round(freshGal * waterFill * WATER_LB);

      var gearLb = 0;
      gearChecks.forEach(function (cb) {
        if (cb.checked) gearLb += parseInt(cb.getAttribute('data-weight'), 10) || 0;
      });

      var totalUsed = waterLb + propaneLb + gearLb;
      var remaining = ccc - totalUsed;
      var usedPct = ccc > 0 ? totalUsed / ccc : 0;
      var status = usedPct > 1.0 ? 'over' : (usedPct > 0.85 ? 'tight' : 'ok');
      var meta = STATUS_META[status];

      elRemaining.textContent = fmtLb(Math.abs(remaining)) + (remaining < 0 ? ' OVER' : '');
      elStatus.className = 'est-number-cap ' + meta.cls;
      elStatus.textContent = meta.label;
      elDetail.textContent = 'Remaining for personal gear after consumables (' + Math.round(usedPct * 100) + '% of CCC used).';

      // Rebuild bars
      var barPct = function (lb) { return Math.max(2, Math.min(100, (lb / (ccc || 1)) * 100)); };
      var rows = [
        ['Fresh water', waterLb, fmtLb(waterLb) + ' (' + freshGal + ' gal \u00d7 ' + waterFill * 100 + '%)'  ],
        ['Propane', propaneLb, fmtLb(propaneLb)],
      ];
      if (gearLb > 0) rows.push(['Gear', gearLb, fmtLb(gearLb)]);

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

    if (elWater) elWater.addEventListener('change', compute);
    if (elPropane) elPropane.addEventListener('change', compute);
    gearChecks.forEach(function (cb) { cb.addEventListener('change', compute); });
    compute();
  })();

  // =========================================================================
  // 12. SAVED PAGE — render the shortlist from localStorage over the embedded
  //     catalog island. Cards newest-first, each with remove + "compare these"
  //     (loads up to the first 3 of the dominant type into Compare) + a small
  //     rollup (count, price range, length range). Guarded by #saved-grid.
  // =========================================================================
  (function savedPage() {
    var grid = document.getElementById('saved-grid');
    if (!grid) return;
    var dataEl = document.getElementById('saved-data');
    var CATALOG = {};
    try { CATALOG = JSON.parse(dataEl.textContent) || {}; } catch (e) { CATALOG = {}; }

    var toolbar = document.getElementById('saved-toolbar');
    var summary = document.getElementById('saved-summary');
    var emptyEl = document.getElementById('saved-empty');
    var clearBtn = document.getElementById('saved-clear');
    var cmpBtn = document.getElementById('saved-compare');

    function fmtUsdShort(n) {
      if (!(n > 0)) return 'Price TBA';
      if (n >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
      return '$' + n;
    }
    function lenLabel(ft) {
      if (ft == null) return '—';
      var whole = Math.floor(ft);
      var inch = Math.round((ft - whole) * 12);
      if (inch === 12) { whole += 1; inch = 0; }
      return whole + "' " + inch + '"';
    }

    function card(rec) {
      var href = rec.linkDir + '/' + rec.slug + '.html';
      var fig = document.createElement('article');
      fig.className = 'saved-card';
      fig.setAttribute('data-slug', rec.slug);
      fig.setAttribute('data-type', rec.type);

      var a = document.createElement('a');
      a.className = 'saved-card-link';
      a.href = href;

      var media = document.createElement('div');
      media.className = 'saved-card-media';
      var img = document.createElement('img');
      img.src = rec.thumb; img.alt = rec.model + ' ' + rec.floorplan;
      img.loading = 'lazy'; img.width = 400; img.height = 260;
      media.appendChild(img);
      var yr = document.createElement('span');
      yr.className = 'saved-card-year'; yr.textContent = rec.year;
      media.appendChild(yr);
      if (rec.type === 'motorhome') {
        var badge = document.createElement('span');
        badge.className = 'saved-card-type'; badge.textContent = 'Motorhome';
        media.appendChild(badge);
      }
      a.appendChild(media);

      var bodyEl = document.createElement('div');
      bodyEl.className = 'saved-card-body';
      var h = document.createElement('h3');
      h.className = 'saved-card-title';
      h.innerHTML = '';
      h.appendChild(document.createTextNode(rec.model + ' '));
      var sp = document.createElement('span'); sp.textContent = rec.floorplan; h.appendChild(sp);
      bodyEl.appendChild(h);

      var specs = document.createElement('p');
      specs.className = 'saved-card-specs';
      var weight = rec.weightLb ? Math.round(rec.weightLb).toLocaleString('en-US') + ' lb' : '—';
      specs.textContent = lenLabel(rec.lengthFt) + ' · ' + weight + ' · sleeps ' + (rec.sleeps != null ? rec.sleeps : '—');
      bodyEl.appendChild(specs);

      var price = document.createElement('p');
      price.className = 'saved-card-price';
      price.textContent = rec.msrp > 0 ? '$' + Math.round(rec.msrp).toLocaleString('en-US') : 'Price TBA';
      bodyEl.appendChild(price);
      a.appendChild(bodyEl);
      fig.appendChild(a);

      var foot = document.createElement('div');
      foot.className = 'saved-card-foot';
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'saved-remove';
      rm.setAttribute('aria-label', 'Remove ' + rec.model + ' ' + rec.floorplan + ' from saved');
      rm.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg> Remove';
      rm.addEventListener('click', function () { Saved.remove(rec.slug); });
      foot.appendChild(rm);
      fig.appendChild(foot);
      return fig;
    }

    function render() {
      var list = Saved.read();
      // newest-first
      list = list.slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      var recs = [];
      for (var i = 0; i < list.length; i++) {
        var r = CATALOG[list[i].slug];
        if (r) recs.push(r);
      }
      while (grid.firstChild) grid.removeChild(grid.firstChild);

      if (!recs.length) {
        grid.setAttribute('hidden', '');
        if (toolbar) toolbar.setAttribute('hidden', '');
        if (emptyEl) emptyEl.removeAttribute('hidden');
        return;
      }
      grid.removeAttribute('hidden');
      if (emptyEl) emptyEl.setAttribute('hidden', '');
      if (toolbar) toolbar.removeAttribute('hidden');

      recs.forEach(function (r) { grid.appendChild(card(r)); });

      // rollup summary
      var prices = recs.map(function (r) { return r.msrp; }).filter(function (n) { return n > 0; });
      var lens = recs.map(function (r) { return r.lengthFt; }).filter(function (n) { return n != null; });
      var nT = recs.filter(function (r) { return r.type === 'trailer'; }).length;
      var nM = recs.length - nT;
      var parts = [recs.length + ' saved'];
      if (nT && nM) parts.push(nT + ' trailer' + (nT > 1 ? 's' : '') + ' · ' + nM + ' motorhome' + (nM > 1 ? 's' : ''));
      if (prices.length) {
        var lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
        parts.push(lo === hi ? fmtUsdShort(lo) : fmtUsdShort(lo) + '–' + fmtUsdShort(hi));
      }
      if (lens.length) {
        var ll = Math.min.apply(null, lens), lh = Math.max.apply(null, lens);
        parts.push(ll === lh ? lenLabel(ll) : lenLabel(ll) + '–' + lenLabel(lh));
      }
      if (summary) summary.textContent = parts.join('  ·  ');

      // "Compare these": pick the dominant type, send its first 3 (newest) to
      // Compare via the same ?ids= deep-link the compare page already supports.
      if (cmpBtn) {
        var domType = nM > nT ? 'motorhome' : 'trailer';
        var ofType = recs.filter(function (r) { return r.type === domType; }).slice(0, 3);
        if (ofType.length >= 2) {
          cmpBtn.removeAttribute('hidden');
          cmpBtn.href = 'compare.html?ids=' + ofType.map(function (r) { return r.slug; }).join(',');
          cmpBtn.textContent = (nT && nM)
            ? 'Compare ' + domType + 's →'
            : 'Compare these →';
        } else {
          cmpBtn.setAttribute('hidden', '');
        }
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (Saved.count() === 0) return;
        if (window.confirm('Remove all saved floorplans?')) Saved.clear();
      });
    }
    Saved.onChange(render);
    render();
  })();

  // =========================================================================
  // BACK-TO-TOP FAB — appears after scrolling 400px, smooth-scrolls to top.
  // =========================================================================
  (function backToTop() {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;
    var visible = false;
    function check() {
      var show = window.scrollY > 400;
      if (show !== visible) {
        visible = show;
        btn.classList.toggle('is-visible', show);
        btn.removeAttribute('hidden');
      }
    }
    window.addEventListener('scroll', check, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    check();
  })();

  // =========================================================================
  // SECTION NAV SCROLL-SPY — highlights the active section link as you scroll.
  // =========================================================================
  (function sectionNavSpy() {
    var nav = document.querySelector('[data-secnav]');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('.secnav-link'));
    if (!links.length) return;
    var sections = [];
    links.forEach(function (a) {
      var id = a.getAttribute('href');
      if (id && id.charAt(0) === '#') {
        var el = document.getElementById(id.slice(1));
        if (el) sections.push({ el: el, link: a });
      }
    });
    if (!sections.length) return;
    var active = null;
    var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56;
    var offset = navH + nav.offsetHeight + 24;
    function update() {
      var scrollY = window.scrollY + offset;
      var current = null;
      for (var i = sections.length - 1; i >= 0; i--) {
        if (sections[i].el.offsetTop <= scrollY) { current = sections[i]; break; }
      }
      if (!current && sections.length) current = sections[0];
      if (current && current.link !== active) {
        if (active) active.classList.remove('is-active');
        current.link.classList.add('is-active');
        active = current.link;
        // Scroll the nav to keep active link visible
        if (nav.scrollWidth > nav.clientWidth) {
          var linkLeft = active.offsetLeft - nav.offsetLeft;
          var linkCenter = linkLeft + active.offsetWidth / 2;
          nav.scrollTo({ left: linkCenter - nav.clientWidth / 2, behavior: 'smooth' });
        }
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  // =========================================================================
  // TOUCH TOOLTIPS — the CSS-only spec glossary tooltips rely on :hover and
  //     :focus which don't work reliably on mobile (iOS Safari tap != focus for
  //     non-input elements). This module adds click/tap toggling so mobile
  //     users can access glossary definitions. Tapping elsewhere closes any
  //     open tooltip.
  // =========================================================================
  (function touchTooltips() {
    var tips = document.querySelectorAll('.spec-tip');
    if (!tips.length) return;
    var current = null;

    function close() {
      if (current) {
        current.classList.remove('is-tip-open');
        current = null;
      }
    }

    Array.prototype.slice.call(tips).forEach(function (tip) {
      tip.addEventListener('click', function (e) {
        e.stopPropagation();
        if (current === tip) {
          close();
        } else {
          close();
          tip.classList.add('is-tip-open');
          current = tip;
        }
      });
    });

    document.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  })();

  // =========================================================================
  // DETAIL PAGE: Share, Copy Specs, Print — the action buttons row.
  // =========================================================================
  (function detailActions() {
    var article = document.querySelector('article.detail');
    if (!article) return;

    // --- Shared flash helper (reused by share + copy) ----------------------
    function flash(btn, msg) {
      var prev = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', prev);
      btn.innerHTML = msg; btn.classList.add('is-copied');
      setTimeout(function () {
        btn.innerHTML = btn.getAttribute('data-label') || prev;
        btn.classList.remove('is-copied');
      }, 1800);
    }

    function copyText(text, btn, successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { flash(btn, successMsg); },
          function () { fallbackCopy(text, btn, successMsg); }
        );
      } else {
        fallbackCopy(text, btn, successMsg);
      }
    }

    function fallbackCopy(text, btn, successMsg) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        flash(btn, successMsg);
      } catch (e) {
        flash(btn, 'Copy failed');
      }
    }

    // --- Share button (Web Share API → clipboard fallback) -----------------
    var shareBtn = document.getElementById('detail-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        var url = location.href;
        var title = document.title;
        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
        } else {
          copyText(url, shareBtn, '✓ Link copied');
        }
      });
    }

    // --- Copy specs --------------------------------------------------------
    var copyBtn = document.getElementById('detail-copy-specs');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var raw = article.getAttribute('data-spec-text') || '';
        var specText = raw.replace(/ \|\| /g, '\n');
        if (specText) {
          copyText(specText, copyBtn, '✓ Specs copied');
        }
      });
    }

    // --- Print button ------------------------------------------------------
    var printBtn = document.getElementById('detail-print');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  })();

  // =========================================================================
  // READING PROGRESS BAR — copper gradient showing scroll depth on detail pages.
  // =========================================================================
  (function readingProgress() {
    var bar = document.getElementById('reading-progress');
    if (!bar) return;
    var ticking = false;
    function update() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) { bar.style.width = '0%'; return; }
      var pct = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
      bar.style.width = pct + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  // =========================================================================
  // SECTION REVEAL — subtle entrance animations for detail-page sections.
  //     Uses IntersectionObserver to add .is-revealed on first scroll into
  //     view. Respects prefers-reduced-motion (skips animation entirely).
  // =========================================================================
  (function sectionReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var sections = document.querySelectorAll('.spec-table, .tow-callout, .towtool, .fuel-tool, .offgrid-tool, .payload-tool, .floorplan, .decor, .gallery, .proscons, .related, .cg-fit, .fam-compare');
    if (!sections.length) return;
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.add('reveal-ready');
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    for (var j = 0; j < sections.length; j++) {
      observer.observe(sections[j]);
    }
  })();

  // 11. LAZY-LOAD IMAGE FADE-IN
  // Observe every lazy image; add .is-loaded when it finishes loading so CSS
  // can transition opacity smoothly. If the image is already complete (cached),
  // add the class immediately.
  (function lazyFade() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Skip — CSS already sets opacity:1 for reduced-motion
      return;
    }
    var imgs = document.querySelectorAll('img[loading="lazy"]');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        if (img.complete && img.naturalWidth > 0) {
          img.classList.add('is-loaded');
        } else {
          img.addEventListener('load', function () { img.classList.add('is-loaded'); }, { once: true });
          // Fallback: if load never fires (e.g. decode error), show anyway
          img.addEventListener('error', function () { img.classList.add('is-loaded'); }, { once: true });
        }
      })(imgs[i]);
    }
  })();

  // 12. EXPLORE SHAREABLE FILTER URL
  // Encode explore filter state into the URL hash so a filtered view can be
  // shared, bookmarked, or navigated back to. Only active on pages with the
  // explore grid (#xgrid). Reads hash on load; writes hash after every filter
  // change. Coexists with the hub hash (#all / #families) by only acting when
  // the page is in the #all view.
  (function exploreShareUrl() {
    var grid = document.getElementById('xgrid');
    if (!grid) return;
    // The explore hub has #families (default) and #all views. Our shareable
    // hash only applies when the All view is active.
    var DEFAULTS = { sort: 'price-asc', year: '2026', sleeps: '', tow: '', type: 'all', price: '', q: '' };
    var PARAM_KEYS = ['sort', 'year', 'sleeps', 'tow', 'type', 'price', 'q', 'tags'];

    function currentState() {
      // Read from the DOM controls directly
      var elSort = document.getElementById('x-sort');
      var elYear = document.getElementById('x-year');
      var elSleeps = document.getElementById('x-sleeps');
      var elPrice = document.getElementById('x-price');
      var towInput = document.getElementById('tow-input');
      var typeBtns = document.querySelectorAll('#x-type .xc-type-btn');
      var tagBtns = document.querySelectorAll('.tagfilter[aria-pressed="true"]');
      var elSearch = document.getElementById('x-search');
      var type = 'all';
      for (var i = 0; i < typeBtns.length; i++) {
        if (typeBtns[i].classList.contains('is-active')) {
          type = typeBtns[i].getAttribute('data-type') || 'all';
          break;
        }
      }
      var tags = [];
      for (var j = 0; j < tagBtns.length; j++) {
        tags.push(tagBtns[j].getAttribute('data-tag'));
      }
      return {
        sort: elSort ? elSort.value : DEFAULTS.sort,
        year: elYear ? elYear.value : DEFAULTS.year,
        sleeps: elSleeps ? elSleeps.value : '',
        tow: towInput ? towInput.value : '',
        type: type,
        price: elPrice ? elPrice.value : '',
        q: elSearch ? elSearch.value : '',
        tags: tags
      };
    }

    function encodeHash(st) {
      var parts = ['all'];
      for (var i = 0; i < PARAM_KEYS.length; i++) {
        var k = PARAM_KEYS[i];
        var v = k === 'tags' ? (st.tags || []).join(',') : (st[k] || '');
        var def = DEFAULTS[k] || '';
        if (k === 'tags') def = '';
        if (v && v !== def) parts.push(k + '=' + encodeURIComponent(v));
      }
      return parts.length > 1 ? '#' + parts.join('&') : '#all';
    }

    // Write hash after filter changes (debounced to avoid rapid-fire)
    var timer = null;
    function scheduleHashUpdate() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        // Only update hash when in the "all" view
        var hash = location.hash || '';
        if (hash && hash.indexOf('all') === -1 && hash !== '#') return;
        var newHash = encodeHash(currentState());
        if ('#' + hash.replace(/^#/, '') !== newHash) {
          try { history.replaceState(null, '', newHash); } catch (e) {}
        }
      }, 300);
    }

    // Observe filter control changes
    var controls = document.querySelectorAll('#x-sort, #x-year, #x-sleeps, #x-price, #tow-input, #x-search');
    for (var c = 0; c < controls.length; c++) {
      controls[c].addEventListener('input', scheduleHashUpdate);
      controls[c].addEventListener('change', scheduleHashUpdate);
    }
    // Tag + type button clicks
    var clickables = document.querySelectorAll('.tagfilter, #x-type .xc-type-btn, .tow-preset, #x-reset, #x-empty-reset, #tow-clear');
    for (var d = 0; d < clickables.length; d++) {
      clickables[d].addEventListener('click', function () { setTimeout(scheduleHashUpdate, 50); });
    }

    // On page load: parse hash and apply to controls (only if hash has filter params)
    function applyHashOnLoad() {
      var hash = (location.hash || '').replace(/^#/, '');
      if (!hash || hash.indexOf('all') !== 0) return;
      var params = {};
      var pairs = hash.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var eq = pairs[i].indexOf('=');
        if (eq > 0) params[pairs[i].substring(0, eq)] = decodeURIComponent(pairs[i].substring(eq + 1));
      }
      if (!Object.keys(params).length) return;
      // Apply to DOM controls
      var elSort = document.getElementById('x-sort');
      var elYear = document.getElementById('x-year');
      var elSleeps = document.getElementById('x-sleeps');
      var elPrice = document.getElementById('x-price');
      var towInput = document.getElementById('tow-input');
      var elSearch = document.getElementById('x-search');
      if (params.sort && elSort) elSort.value = params.sort;
      if (params.year != null && elYear) elYear.value = params.year;
      if (params.sleeps && elSleeps) elSleeps.value = params.sleeps;
      if (params.price && elPrice) elPrice.value = params.price;
      if (params.tow && towInput) towInput.value = params.tow;
      if (params.q && elSearch) elSearch.value = params.q;
      if (params.type) {
        var typeBtns = document.querySelectorAll('#x-type .xc-type-btn');
        for (var j = 0; j < typeBtns.length; j++) {
          var isMatch = typeBtns[j].getAttribute('data-type') === params.type;
          typeBtns[j].classList.toggle('is-active', isMatch);
          typeBtns[j].setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        }
      }
      if (params.tags) {
        var wantTags = params.tags.split(',');
        var tagBtns = document.querySelectorAll('.tagfilter');
        for (var k = 0; k < tagBtns.length; k++) {
          var tag = tagBtns[k].getAttribute('data-tag');
          var pressed = wantTags.indexOf(tag) >= 0;
          tagBtns[k].setAttribute('aria-pressed', pressed ? 'true' : 'false');
        }
      }
      // Trigger a synthetic input event on the sort/year/sleeps/price selects
      // so the existing explore module picks up the changes
      [elSort, elYear, elSleeps, elPrice, towInput, elSearch].forEach(function (el) {
        if (el) {
          try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      });
    }
    applyHashOnLoad();
  })();

})();

  // -----------------------------------------------------------------------
  // QUICK VIEW — spec popover on explore cards (no navigation needed)
  // -----------------------------------------------------------------------
  (function quickView() {
    var qv = document.getElementById('quick-view');
    if (!qv) return;
    var img = document.getElementById('qv-img');
    var titleEl = document.getElementById('qv-title');
    var yearEl = document.getElementById('qv-year');
    var descEl = document.getElementById('qv-desc');
    var specsEl = document.getElementById('qv-specs');
    var linkEl = document.getElementById('qv-detail-link');
    var savedFocus = null;

    function fmtMoney(n) {
      if (!n || n <= 0) return '—';
      return '$' + Number(n).toLocaleString('en-US');
    }
    function fmtLen(ft) {
      if (!ft) return '—';
      ft = Number(ft);
      var whole = Math.floor(ft), inch = Math.round((ft - whole) * 12);
      if (inch === 12) { whole++; inch = 0; }
      return inch ? whole + "' " + inch + '"' : whole + "'";
    }
    function fmtLb(n) {
      return n ? Number(n).toLocaleString('en-US') + ' lb' : '—';
    }
    function fmtGal(n) { return n ? n + ' gal' : '—'; }

    function open(card) {
      var d = card.dataset;
      img.src = d.thumb || card.querySelector('img').src;
      img.alt = d.model + ' ' + d.floorplan;
      titleEl.textContent = d.model + ' ' + d.floorplan;
      yearEl.textContent = d.year + ' MODEL YEAR';
      descEl.textContent = d.desc || '';
      var type = d.type || 'trailer';
      var href = (type === 'motorhome' ? 'mm/' : 'm/') + d.slug + '.html';
      linkEl.href = href;

      var specs = [
        ['Length', fmtLen(d.length)],
        ['Dry weight', fmtLb(d.weight)],
        ['GVWR', fmtLb(d.gvwr)],
        ['Cargo (CCC)', fmtLb(d.ccc)],
        ['Sleeps', d.sleeps || '—'],
        ['Off-grid', d.offgrid ? d.offgrid + '/100' : '—'],
        ['Fresh tank', fmtGal(d.fresh)],
        ['Solar', d.solar ? d.solar + ' W' : '—'],
        ['Hitch weight', fmtLb(d.hitch)],
        ['MSRP', fmtMoney(d.msrp)],
      ];
      specsEl.innerHTML = specs.map(function (s) {
        return '<div class="qv-spec-item"><span class="qv-spec-label">' + s[0] + '</span><span class="qv-spec-value">' + s[1] + '</span></div>';
      }).join('');

      savedFocus = document.activeElement;
      qv.hidden = false;
      qv.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      qv.querySelector('[data-qv-close]').focus();
    }

    function close() {
      qv.hidden = true;
      qv.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (savedFocus) { savedFocus.focus(); savedFocus = null; }
    }

    // Delegate click on all peek buttons
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-peek]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        var card = btn.closest('.xcard');
        if (card) open(card);
        return;
      }
      if (e.target.closest('[data-qv-close]')) {
        close();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (qv.hidden) return;
      if (e.key === 'Escape') { close(); e.preventDefault(); }
    });
  })();

  // -----------------------------------------------------------------------
  // ANIMATED KEY STATS — count-up animation when scrolled into view
  // -----------------------------------------------------------------------
  (function animateKeyStats() {
    var container = document.querySelector('.key-stats');
    if (!container || !('IntersectionObserver' in window)) return;

    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var values = Array.prototype.slice.call(container.querySelectorAll('.key-stat-value'));
    if (!values.length) return;

    var animated = false;

    function parseNumeric(text) {
      // Extract leading number from strings like "$118K", "3,150 lb", "16' 3\"", "5", "47/100"
      var clean = text.replace(/[$,]/g, '');
      var m = clean.match(/^(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    }

    function formatBack(n, template) {
      // Reconstruct the formatted string: keep the suffix/prefix from template
      var clean = template.replace(/[$,]/g, '');
      var m = clean.match(/^(\d+(?:\.\d+)?)(.*)/);
      if (!m) return template;
      var hasDollar = template.charAt(0) === '$';
      var suffix = m[2];
      var isInt = !template.includes('.') || template.includes("'") || template.includes('/');
      var formatted = isInt ? Math.round(n).toLocaleString('en-US') : n.toFixed(1);
      // Handle K suffix from formatMsrpShort
      if (suffix.startsWith('K')) {
        formatted = Math.round(n).toLocaleString('en-US');
      }
      return (hasDollar ? '$' : '') + formatted + suffix;
    }

    function animate() {
      if (animated) return;
      animated = true;

      values.forEach(function (el) {
        var original = el.textContent;
        var target = parseNumeric(original);
        if (target === null || target === 0) return;

        var duration = 800; // ms
        var start = null;
        el.classList.add('is-counting');

        function step(ts) {
          if (!start) start = ts;
          var progress = Math.min((ts - start) / duration, 1);
          // Ease-out cubic
          var ease = 1 - Math.pow(1 - progress, 3);
          var current = target * ease;
          el.textContent = formatBack(current, original);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = original; // Restore exact original
            el.classList.remove('is-counting');
          }
        }
        requestAnimationFrame(step);
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate();
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    observer.observe(container);
  })();
