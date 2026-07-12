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
    // Build counter + dot elements once
    var counterEl = document.createElement('div');
    counterEl.className = 'lightbox-counter';
    counterEl.setAttribute('aria-live', 'polite');
    lb.appendChild(counterEl);

    var dotsWrap = null;
    if (items.length > 1 && items.length <= 20) {
      dotsWrap = document.createElement('div');
      dotsWrap.className = 'lightbox-dots';
      items.forEach(function (_, di) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'lightbox-dot';
        dot.setAttribute('aria-label', 'Go to photo ' + (di + 1));
        dot.addEventListener('click', function () { idx = di; render(); });
        dotsWrap.appendChild(dot);
      });
      lb.appendChild(dotsWrap);
    }

    function render() {
      var it = items[idx];
      imgEl.src = it.full;
      imgEl.alt = it.cap;
      capEl.textContent = it.cap;
      counterEl.textContent = (idx + 1) + ' / ' + items.length;
      // Update dot active state
      if (dotsWrap) {
        var dots = dotsWrap.children;
        for (var d = 0; d < dots.length; d++) {
          dots[d].classList.toggle('is-active', d === idx);
        }
      }
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

    var state = { q: '', sort: 'price-asc', year: '2026', sleeps: 0, tags: [], tow: 0, type: 'all', price: 0, maxLength: 0, maxWeight: 0, axle: '', layoutKeys: [] };

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
      if (typeof p.maxLength === 'number' && p.maxLength > 0) state.maxLength = p.maxLength;
      if (typeof p.maxWeight === 'number' && p.maxWeight > 0) state.maxWeight = p.maxWeight;
      if (p.axle === 'single' || p.axle === 'dual') state.axle = p.axle;
      if (Array.isArray(p.layoutKeys)) state.layoutKeys = p.layoutKeys.filter(function (k) { return typeof k === 'string'; });
    })();
    function persistX() {
      Store.set(X_PREFS, { sort: state.sort, year: state.year, sleeps: state.sleeps, tags: state.tags, tow: state.tow, type: state.type, price: state.price, maxLength: state.maxLength, maxWeight: state.maxWeight, axle: state.axle, layoutKeys: state.layoutKeys });
    }

    // Encode explore filter state into URL hash for shareable links.
    // Uses replaceState to avoid history spam on every filter tweak.
    function syncHashFromState() {
      if (typeof history.replaceState !== 'function') return;
      var view = (location.hash.replace('#','').split('&')[0] === 'all') ? 'all' : 'families';
      if (view !== 'all') return; // only encode when in "all" view
      var parts = ['all'];
      if (state.year && state.year !== '2026') parts.push('year=' + state.year);
      if (!state.year) parts.push('year=');
      if (state.sleeps) parts.push('sleeps=' + state.sleeps);
      if (state.price) parts.push('price=' + state.price);
      if (state.maxLength) parts.push('len=' + state.maxLength);
      if (state.maxWeight) parts.push('wt=' + state.maxWeight);
      if (state.axle) parts.push('axle=' + state.axle);
      if (state.tow) parts.push('tow=' + state.tow);
      if (state.sort && state.sort !== 'price-asc') parts.push('sort=' + state.sort);
      if (state.type && state.type !== 'all') parts.push('type=' + state.type);
      if (state.tags.length) parts.push('tags=' + state.tags.join(','));
      if (state.layoutKeys.length) parts.push('layout=' + state.layoutKeys.join(','));
      var hash = '#' + parts.join('&');
      // Only update if it changed (avoid redundant replaceState calls)
      if (location.hash !== hash) {
        try { history.replaceState(null, '', hash); } catch(e) {}
      }
    }

    // Parse explore filters from URL hash on page load.
    function readHashFilters() {
      var hash = location.hash || '';
      if (hash.indexOf('#all') !== 0) return;
      var params = {};
      hash.replace('#', '').split('&').forEach(function(p) {
        var eq = p.indexOf('=');
        if (eq > 0) params[p.substring(0, eq)] = p.substring(eq + 1);
      });
      var hadParams = false;
      if ('year' in params) { state.year = params.year; hadParams = true; }
      if (params.sleeps) { state.sleeps = parseInt(params.sleeps, 10) || 0; hadParams = true; }
      if (params.price) { state.price = parseInt(params.price, 10) || 0; hadParams = true; }
      if (params.len) { state.maxLength = parseInt(params.len, 10) || 0; hadParams = true; }
      if (params.wt) { state.maxWeight = parseInt(params.wt, 10) || 0; hadParams = true; }
      if (params.axle === 'single' || params.axle === 'dual') { state.axle = params.axle; hadParams = true; }
      if (params.tow) { state.tow = parseInt(params.tow, 10) || 0; hadParams = true; }
      if (params.sort) { state.sort = params.sort; hadParams = true; }
      // type deep-link is already handled elsewhere (readTypeDeepLink)
      if (params.tags) { state.tags = params.tags.split(',').filter(Boolean); hadParams = true; }
      if (params.layout) { state.layoutKeys = params.layout.split(',').filter(Boolean); hadParams = true; }
      return hadParams;
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
        if (ok && state.maxLength) {
          var length = num(card, 'data-length');
          if (length > state.maxLength) ok = false;
        }
        if (ok && state.maxWeight) {
          var weight = num(card, 'data-weight');
          if (weight > state.maxWeight) ok = false;
        }
        if (ok && state.axle) {
          if ((card.getAttribute('data-axle') || '') !== state.axle) ok = false;
        }
        if (ok && state.tags.length) {
          for (var i = 0; i < state.tags.length; i++) {
            if (tags.indexOf(state.tags[i]) === -1) { ok = false; break; }
          }
        }
        if (ok && state.layoutKeys.length) {
          var layoutStr = (card.getAttribute('data-layout') || '').split(' ');
          for (var li = 0; li < state.layoutKeys.length; li++) {
            if (layoutStr.indexOf(state.layoutKeys[li]) === -1) { ok = false; break; }
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
          var headroom = state.tow - gvwr;
          var fmtH = Math.abs(headroom).toLocaleString('en-US');
          if (verdict === 'comfortable') { fitEl.textContent = '\u2713 ' + fmtH + ' lb headroom'; }
          else if (verdict === 'within') { fitEl.textContent = '\u25b3 ' + fmtH + ' lb margin'; }
          else { fitEl.textContent = '\u2715 ' + fmtH + ' lb over'; }
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
        'ccc-desc': ['data-ccc', -1],
        'hitch-asc': ['data-hitch', 1],
        'fresh-desc': ['data-fresh', -1],
        'value-lb-asc': null, // handled below
      };
      var sk = keymap[state.sort] || keymap['price-asc'];
      var visible = cards.filter(function (c) { return !c.hasAttribute('hidden'); });
      visible.sort(function (a, b) {
        var d;
        if (state.sort === 'value-asc') {
          var msrpA = num(a, 'data-msrp'), msrpB = num(b, 'data-msrp');
          var lenA = num(a, 'data-length'), lenB = num(b, 'data-length');
          var vA = lenA > 0 ? msrpA / lenA : Infinity;
          var vB = lenB > 0 ? msrpB / lenB : Infinity;
          d = vA - vB;
        } else if (state.sort === 'value-lb-asc') {
          var msrpA2 = num(a, 'data-msrp'), msrpB2 = num(b, 'data-msrp');
          var wA = num(a, 'data-weight'), wB = num(b, 'data-weight');
          var vwA = wA > 0 ? msrpA2 / wA : Infinity;
          var vwB = wB > 0 ? msrpB2 / wB : Infinity;
          d = vwA - vwB;
        } else {
          d = (num(a, sk[0]) - num(b, sk[0])) * sk[1];
        }
        if (d !== 0) return d;
        return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      });
      visible.forEach(function (c) { grid.appendChild(c); });

      if (elCount) elCount.textContent = shown;
      if (elEmpty) { if (shown === 0) elEmpty.removeAttribute('hidden'); else elEmpty.setAttribute('hidden', ''); }

      // Nearest-match suggestions when 0 results
      var nearestEl = document.getElementById('x-nearest');
      var nearestGrid = document.getElementById('x-nearest-grid');
      if (nearestEl && nearestGrid) {
        if (shown === 0) {
          // Find closest matches from ALL cards, scoring how close each is
          var candidates = cards.map(function (c) {
            var penalty = 0;
            var reasons = [];
            var cy = c.getAttribute('data-year');
            var cs = num(c, 'data-sleeps');
            var cm = num(c, 'data-msrp');
            var cw = num(c, 'data-weight');
            var cl = num(c, 'data-length');
            var cg = num(c, 'data-gvwr');
            var ca = c.getAttribute('data-axle') || '';
            var ct = c.getAttribute('data-type');
            var cTags = (c.getAttribute('data-tags') || '').split(' ');
            if (state.type !== 'all' && ct !== state.type) { penalty += 5; }
            if (state.year && cy !== state.year) { penalty += 0.3; reasons.push(cy + ' model'); }
            if (state.q && (c.getAttribute('data-name') || '').indexOf(state.q) === -1) { penalty += 5; }
            if (state.sleeps && cs < state.sleeps) { penalty += (state.sleeps - cs) * 0.5; reasons.push('sleeps ' + cs); }
            if (state.price && cm > state.price) { penalty += ((cm - state.price) / state.price) * 2; reasons.push('$' + Math.round((cm - state.price) / 1000) + 'K over budget'); }
            if (state.maxWeight && cw > state.maxWeight) { penalty += ((cw - state.maxWeight) / state.maxWeight) * 2; reasons.push((cw - state.maxWeight) + ' lb over'); }
            if (state.maxLength && cl > state.maxLength) { penalty += (cl - state.maxLength) / state.maxLength; reasons.push(Math.round(cl - state.maxLength) + "' over length"); }
            if (state.tow && cg > state.tow) { penalty += ((cg - state.tow) / state.tow) * 2; reasons.push((cg - state.tow) + ' lb over tow'); }
            if (state.axle && ca !== state.axle) { penalty += 0.5; reasons.push(ca + ' axle'); }
            if (state.tags.length) {
              for (var ti = 0; ti < state.tags.length; ti++) {
                if (cTags.indexOf(state.tags[ti]) === -1) { penalty += 0.5; }
              }
            }
            return { card: c, penalty: penalty, reason: reasons[0] || 'close match' };
          }).filter(function (x) { return x.penalty > 0 && x.penalty < 8; });
          candidates.sort(function (a, b) { return a.penalty - b.penalty; });
          var top3 = candidates.slice(0, 3);
          if (top3.length) {
            nearestGrid.innerHTML = top3.map(function (m) {
              var slug = m.card.getAttribute('data-slug');
              var thumb = m.card.getAttribute('data-thumb') || '';
              var model = m.card.getAttribute('data-model') || '';
              var fp = m.card.getAttribute('data-floorplan') || '';
              return '<a class="x-nearest-card" href="m/' + slug + '.html">' +
                (thumb ? '<img class="x-nearest-thumb" src="' + thumb + '" alt="" loading="lazy">' : '') +
                '<div class="x-nearest-info"><p class="x-nearest-name">' + model + ' ' + fp + '</p>' +
                '<p class="x-nearest-reason">' + m.reason + '</p></div></a>';
            }).join('');
            nearestEl.removeAttribute('hidden');
          } else {
            nearestEl.setAttribute('hidden', '');
          }
        } else {
          nearestEl.setAttribute('hidden', '');
        }
      }

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

      syncHashFromState();

      if (towSummary) {
        if (state.tow) {
          towSummary.removeAttribute('hidden');
          // Build rich insights: find compatible cards and pick recommendations
          var compatible = visible.filter(function (c) {
            var gvwr = num(c, 'data-gvwr');
            return gvwr > 0 && gvwr <= state.tow;
          });
          var summaryHtml = '<span class="tow-insights-stat">' + fit + ' of ' + shown +
            ' floorplans fit your ' + state.tow.toLocaleString('en-US') + ' lb tow rating.</span>';
          if (compatible.length >= 2) {
            // Smart picks: easiest (lightest GVWR), value (cheapest), off-grid (highest score)
            var picks = [];
            var sorted;
            sorted = compatible.slice().sort(function (a, b) { return num(a, 'data-gvwr') - num(b, 'data-gvwr'); });
            if (sorted[0]) {
              var easiest = sorted[0];
              picks.push({ icon: '🚗', label: 'Easiest to tow', name: easiest.getAttribute('data-model') + ' ' + easiest.getAttribute('data-floorplan'),
                stat: num(easiest, 'data-gvwr').toLocaleString('en-US') + ' lb GVWR', slug: easiest.getAttribute('data-slug'), type: easiest.getAttribute('data-type') });
            }
            sorted = compatible.slice().sort(function (a, b) { return num(a, 'data-msrp') - num(b, 'data-msrp'); });
            if (sorted[0] && sorted[0].getAttribute('data-slug') !== (picks[0] && picks[0].slug)) {
              var cheapest = sorted[0];
              var msrpK = Math.round(num(cheapest, 'data-msrp') / 1000);
              picks.push({ icon: '💎', label: 'Best value', name: cheapest.getAttribute('data-model') + ' ' + cheapest.getAttribute('data-floorplan'),
                stat: '$' + msrpK + 'k', slug: cheapest.getAttribute('data-slug'), type: cheapest.getAttribute('data-type') });
            }
            sorted = compatible.slice().sort(function (a, b) { return num(b, 'data-offgrid') - num(a, 'data-offgrid'); });
            if (sorted[0] && num(sorted[0], 'data-offgrid') > 0) {
              var bestOg = sorted[0];
              var isDupe = picks.some(function (p) { return p.slug === bestOg.getAttribute('data-slug'); });
              if (!isDupe) {
                picks.push({ icon: '⛺', label: 'Best off-grid', name: bestOg.getAttribute('data-model') + ' ' + bestOg.getAttribute('data-floorplan'),
                  stat: num(bestOg, 'data-offgrid') + '/100', slug: bestOg.getAttribute('data-slug'), type: bestOg.getAttribute('data-type') });
              }
            }
            if (picks.length) {
              summaryHtml += '<span class="tow-insights-picks">' + picks.map(function (p) {
                var dir = p.type === 'motorhome' ? 'mm/' : 'm/';
                return '<a class="tow-pick" href="' + dir + p.slug + '.html"><span class="tow-pick-icon" aria-hidden="true">' + p.icon +
                  '</span><span class="tow-pick-body"><span class="tow-pick-label">' + p.label +
                  '</span><span class="tow-pick-name">' + p.name +
                  '</span><span class="tow-pick-stat">' + p.stat + '</span></span></a>';
              }).join('') + '</span>';
            }
          }
          towSummary.innerHTML = summaryHtml;
        } else {
          towSummary.setAttribute('hidden', '');
          towSummary.innerHTML = '';
        }
      }

      // Active filter pills — show a summary of what's currently filtered
      var afEl = document.getElementById('active-filters');
      if (afEl) {
        var pills = [];
        var LABEL_MAP = {
          'rear-bed': 'Rear bed', 'front-bed': 'Front bed', 'wet-bath': 'Wet bath',
          'bunk': 'Bunk beds', 'rear-hatch': 'Rear hatch', 'u-dinette': 'U-seat dinette',
          'couples': 'Couples', 'solo': 'Solo', 'family': 'Family', 'full-time': 'Full-time',
          'off-grid': 'Off-grid', 'national_parks': 'National parks', 'luxury': 'Luxury'
        };
        if (state.year) pills.push({ label: 'Year: ' + state.year, kind: 'year' });
        if (state.sleeps) pills.push({ label: 'Sleeps ≥ ' + state.sleeps, kind: 'sleeps' });
        if (state.price) pills.push({ label: 'Under $' + Math.round(state.price / 1000) + 'k', kind: 'price' });
        if (state.maxLength) pills.push({ label: "Under " + state.maxLength + "'", kind: 'length' });
        if (state.maxWeight) pills.push({ label: 'Under ' + state.maxWeight.toLocaleString('en-US') + ' lb', kind: 'weight' });
        if (state.axle) pills.push({ label: state.axle === 'single' ? 'Single axle' : 'Dual axle', kind: 'axle' });
        if (state.tow) pills.push({ label: 'Tow: ' + state.tow.toLocaleString('en-US') + ' lb', kind: 'tow' });
        state.tags.forEach(function (tag) { pills.push({ label: LABEL_MAP[tag] || tag, kind: 'tag', val: tag }); });
        state.layoutKeys.forEach(function (key) { pills.push({ label: LABEL_MAP[key] || key, kind: 'layout', val: key }); });
        if (state.type !== 'all') pills.push({ label: state.type === 'trailer' ? 'Travel trailers' : 'Motorhomes', kind: 'type' });
        if (pills.length <= 1) { afEl.setAttribute('hidden', ''); afEl.innerHTML = ''; }
        else {
          afEl.removeAttribute('hidden');
          afEl.innerHTML = pills.map(function (p) {
            return '<span class="filter-pill">' + p.label + '<button type="button" class="filter-pill-x" data-pill-kind="' + p.kind + '"' + (p.val ? ' data-pill-val="' + p.val + '"' : '') + ' aria-label="Remove ' + p.label + ' filter">×</button></span>';
          }).join('') + '<button type="button" class="filter-clear-all" id="filter-clear-all">Clear all</button>';
        }
      }
    }

    if (elSearch) elSearch.addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); apply(); });
    if (elSort) elSort.addEventListener('change', function () { state.sort = this.value; persistX(); apply(); });
    if (elYear) elYear.addEventListener('change', function () { state.year = this.value; persistX(); apply(); });
    if (elSleeps) elSleeps.addEventListener('change', function () { state.sleeps = parseInt(this.value, 10) || 0; persistX(); apply(); });
    var elPrice = document.getElementById('x-price');
    if (elPrice) elPrice.addEventListener('change', function () { state.price = parseInt(this.value, 10) || 0; persistX(); apply(); });
    var elLength = document.getElementById('x-length');
    if (elLength) elLength.addEventListener('change', function () { state.maxLength = parseInt(this.value, 10) || 0; persistX(); apply(); });
    var elWeight = document.getElementById('x-weight');
    if (elWeight) elWeight.addEventListener('change', function () { state.maxWeight = parseInt(this.value, 10) || 0; persistX(); apply(); });
    var elAxle = document.getElementById('x-axle');
    if (elAxle) elAxle.addEventListener('change', function () { state.axle = this.value; persistX(); apply(); });
    tagBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tag = btn.getAttribute('data-tag');
        var i = state.tags.indexOf(tag);
        if (i === -1) { state.tags.push(tag); btn.setAttribute('aria-pressed', 'true'); }
        else { state.tags.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
        persistX(); apply();
      });
    });
    // Layout feature filter chips
    var layoutBtns = Array.prototype.slice.call(document.querySelectorAll('.layoutfilter'));
    layoutBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-layout-key');
        var i = state.layoutKeys.indexOf(key);
        if (i === -1) { state.layoutKeys.push(key); btn.setAttribute('aria-pressed', 'true'); }
        else { state.layoutKeys.splice(i, 1); btn.setAttribute('aria-pressed', 'false'); }
        persistX(); apply();
      });
    });
    // Active filter pill removal — event delegation on the container
    var afContainer = document.getElementById('active-filters');
    if (afContainer) {
      afContainer.addEventListener('click', function (e) {
        var pill = e.target.closest('.filter-pill-x');
        var clearAll = e.target.closest('#filter-clear-all');
        if (clearAll) { resetAll(); apply(); return; }
        if (!pill) return;
        var kind = pill.getAttribute('data-pill-kind');
        var val = pill.getAttribute('data-pill-val');
        if (kind === 'year') { state.year = ''; if (elYear) elYear.value = ''; }
        else if (kind === 'sleeps') { state.sleeps = 0; if (elSleeps) elSleeps.value = ''; }
        else if (kind === 'price') { state.price = 0; if (elPrice) elPrice.value = ''; }
        else if (kind === 'length') { state.maxLength = 0; if (elLength) elLength.value = ''; }
        else if (kind === 'weight') { state.maxWeight = 0; if (elWeight) elWeight.value = ''; }
        else if (kind === 'axle') { state.axle = ''; if (elAxle) elAxle.value = ''; }
        else if (kind === 'tow') { setTow(0); if (towVehiclePick) towVehiclePick.value = ''; }
        else if (kind === 'tag' && val) {
          var ti = state.tags.indexOf(val);
          if (ti !== -1) state.tags.splice(ti, 1);
          tagBtns.forEach(function (b) { if (b.getAttribute('data-tag') === val) b.setAttribute('aria-pressed', 'false'); });
        }
        else if (kind === 'layout' && val) {
          var lki = state.layoutKeys.indexOf(val);
          if (lki !== -1) state.layoutKeys.splice(lki, 1);
          layoutBtns.forEach(function (b) { if (b.getAttribute('data-layout-key') === val) b.setAttribute('aria-pressed', 'false'); });
        }
        else if (kind === 'type') { setType('all'); return; }
        persistX(); apply();
      });
    }

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
      // Persist tow vehicle globally so detail pages can show compatibility
      if (v > 0) {
        var vName = '';
        if (towVehiclePick && towVehiclePick.value && towVehiclePick.value !== 'custom') {
          var selOpt = towVehiclePick.options[towVehiclePick.selectedIndex];
          if (selOpt) vName = selOpt.textContent.split(' \u2014')[0] || '';
        }
        try { localStorage.setItem('ae:towVehicle', JSON.stringify({ rating: v, name: vName })); } catch (e) {}
      } else {
        try { localStorage.removeItem('ae:towVehicle'); } catch (e) {}
      }
      if (!opts || opts.persist !== false) persistX();
      apply();
    }
    // Tow vehicle picker dropdown
    var towVehiclePick = document.getElementById('tow-vehicle-pick');
    if (towVehiclePick) {
      towVehiclePick.addEventListener('change', function () {
        var opt = this.options[this.selectedIndex];
        if (opt && opt.getAttribute('data-tow')) {
          setTow(parseInt(opt.getAttribute('data-tow'), 10));
        } else if (this.value === 'custom') {
          // Focus the manual input
          if (towInput) towInput.focus();
        }
      });
    }

    if (towInput) towInput.addEventListener('input', function () {
      setTow(parseInt(this.value, 10) || 0);
      // Clear vehicle picker when manual input is used
      if (towVehiclePick) towVehiclePick.value = this.value ? 'custom' : '';
    });
    if (towClear) towClear.addEventListener('click', function () {
      setTow(0);
      if (towVehiclePick) towVehiclePick.value = '';
    });

    function resetAll() {
      state = { q: '', sort: 'price-asc', year: '2026', sleeps: 0, tags: [], tow: 0, type: 'all', price: 0, maxLength: 0, maxWeight: 0, axle: '', layoutKeys: [] };
      if (elSearch) elSearch.value = '';
      if (elSort) elSort.value = 'price-asc';
      if (elYear) elYear.value = '2026';
      if (elSleeps) elSleeps.value = '';
      if (elPrice) elPrice.value = '';
      if (elLength) elLength.value = '';
      if (elWeight) elWeight.value = '';
      if (elAxle) elAxle.value = '';
      tagBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      layoutBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      // Clear active preset
      activePreset = null;
      presetBtns.forEach(function (b) { b.classList.remove('is-active'); });
      Store.del(X_PREFS);
      setType('all', { persist: false });
      setTow(0, { persist: false });
    }
    if (elReset) elReset.addEventListener('click', resetAll);
    var emptyReset = document.getElementById('x-empty-reset');
    if (emptyReset) emptyReset.addEventListener('click', resetAll);

    // ---- Smart presets — one-click filter combinations --------------------
    var presetBtns = Array.prototype.slice.call(document.querySelectorAll('.smart-preset'));
    var activePreset = null;
    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-preset');
        var filters;
        try { filters = JSON.parse(btn.getAttribute('data-filters')); } catch (e) { return; }
        // Toggle: clicking active preset deactivates it
        if (activePreset === id) {
          activePreset = null;
          presetBtns.forEach(function (b) { b.classList.remove('is-active'); });
          resetAll();
          return;
        }
        // Reset first, then apply preset filters
        state.q = ''; state.sort = 'price-asc'; state.year = '2026'; state.sleeps = 0;
        state.tags = []; state.tow = 0; state.price = 0; state.maxLength = 0;
        state.maxWeight = 0; state.axle = ''; state.layoutKeys = [];
        if (filters.msrpMax) state.price = filters.msrpMax;
        if (filters.maxWeight) state.maxWeight = filters.maxWeight;
        if (filters.sleepsMin) state.sleeps = filters.sleepsMin;
        if (filters.axle) state.axle = filters.axle;
        if (filters.sort) state.sort = filters.sort;
        if (filters.tags) state.tags = filters.tags.slice();
        // Sync UI controls
        if (elSearch) elSearch.value = '';
        if (elSort) elSort.value = state.sort;
        if (elYear) elYear.value = state.year;
        if (elSleeps) elSleeps.value = state.sleeps || '';
        if (elPrice) elPrice.value = state.price || '';
        if (elLength) elLength.value = '';
        if (elWeight) elWeight.value = state.maxWeight || '';
        if (elAxle) elAxle.value = state.axle;
        tagBtns.forEach(function (tb) {
          var pressed = state.tags.indexOf(tb.getAttribute('data-tag')) !== -1;
          tb.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          tb.classList.toggle('is-active', pressed);
        });
        activePreset = id;
        presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-preset') === id); });
        persistX(); apply();
      });
    });

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
      // Inline delta preview: when exactly 2 models are selected, show key spec differences
      var deltaEl = document.getElementById('cmp-delta');
      if (deltaEl) {
        if (sel.length === 2) {
          var cardA = null, cardB = null;
          cards.forEach(function (c) {
            if (c.getAttribute('data-slug') === sel[0]) cardA = c;
            if (c.getAttribute('data-slug') === sel[1]) cardB = c;
          });
          if (cardA && cardB) {
            var wA = Number(cardA.getAttribute('data-weight')) || 0;
            var wB = Number(cardB.getAttribute('data-weight')) || 0;
            var pA = Number(cardA.getAttribute('data-msrp')) || 0;
            var pB = Number(cardB.getAttribute('data-msrp')) || 0;
            var lA = Number(cardA.getAttribute('data-length')) || 0;
            var lB = Number(cardB.getAttribute('data-length')) || 0;
            var nameA = (cardA.getAttribute('data-model') || '') + ' ' + (cardA.getAttribute('data-floorplan') || '');
            var nameB = (cardB.getAttribute('data-model') || '') + ' ' + (cardB.getAttribute('data-floorplan') || '');
            var dW = Math.abs(wB - wA);
            var dP = Math.abs(pB - pA);
            var dL = Math.abs(lB - lA);
            var parts = [];
            if (dW) parts.push('Δ ' + dW.toLocaleString('en-US') + ' lb');
            if (dP) parts.push('Δ $' + dP.toLocaleString('en-US'));
            if (dL) parts.push('Δ ' + dL.toFixed(1) + "'");
            deltaEl.textContent = nameA.trim() + ' vs ' + nameB.trim() + (parts.length ? ': ' + parts.join(' · ') : '');
            deltaEl.removeAttribute('hidden');
          } else {
            deltaEl.setAttribute('hidden', '');
          }
        } else {
          deltaEl.setAttribute('hidden', '');
        }
      }
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
    // Read shareable explore filters from URL hash (before deep-link/hydrate)
    readHashFilters();

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
      if (state.layoutKeys && state.layoutKeys.length) {
        layoutBtns.forEach(function (b) {
          if (state.layoutKeys.indexOf(b.getAttribute('data-layout-key')) !== -1) b.setAttribute('aria-pressed', 'true');
        });
      }
      // reflect the restored/deep-linked type on the segmented buttons
      typeBtns.forEach(function (b) {
        var on = b.getAttribute('data-type') === state.type;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (state.tow > 0) setTow(state.tow, { persist: false });
      if (elAxle && state.axle) elAxle.value = state.axle;
    })();

    apply();
    syncCompare();
  })();

  // =========================================================================
  // 2a. SEARCH AUTOCOMPLETE — real-time dropdown as the user types in the
  //     explore search box. Shows up to 8 matching models with thumbnails;
  //     arrow keys navigate, Enter/click selects and navigates to detail page.
  //     Complements the existing filter behavior (which still runs via input).
  // =========================================================================
  (function searchAutocomplete() {
    var input = document.getElementById('x-search');
    var list = document.getElementById('x-suggest');
    var combobox = input ? input.closest('[role="combobox"]') : null;
    if (!input || !list || !combobox) return;

    var grid = document.getElementById('xgrid');
    if (!grid) return;
    var allCards = Array.prototype.slice.call(grid.querySelectorAll('.xcard'));

    var focusIdx = -1;
    var items = [];
    var MAX = 8;

    function clear() {
      list.innerHTML = '';
      list.setAttribute('hidden', '');
      combobox.setAttribute('aria-expanded', 'false');
      items = [];
      focusIdx = -1;
    }

    function setFocus(idx) {
      items.forEach(function (li, i) {
        li.classList.toggle('is-focused', i === idx);
        if (i === idx) li.setAttribute('aria-selected', 'true');
        else li.removeAttribute('aria-selected');
      });
      focusIdx = idx;
      if (idx >= 0 && items[idx]) {
        input.setAttribute('aria-activedescendant', items[idx].id);
        items[idx].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function navigate(href) {
      clear();
      // Determine if we're in an explore section (index.html) or standalone
      var isNested = window.location.pathname.indexOf('/m/') >= 0
        || window.location.pathname.indexOf('/f/') >= 0;
      var prefix = isNested ? '' : 'm/';
      window.location.href = prefix + href;
    }

    function update() {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { clear(); return; }

      var matches = [];
      for (var i = 0; i < allCards.length && matches.length < MAX; i++) {
        var card = allCards[i];
        var name = card.getAttribute('data-name') || '';
        var slug = card.getAttribute('data-slug') || '';
        var type = card.getAttribute('data-type') || 'trailer';
        if (name.indexOf(q) < 0) continue;
        var thumb = card.getAttribute('data-thumb') || '';
        var model = card.getAttribute('data-model') || '';
        var fp = card.getAttribute('data-floorplan') || '';
        var year = card.getAttribute('data-year') || '';
        var msrp = card.getAttribute('data-msrp') || '';
        var price = msrp && parseInt(msrp, 10) > 0
          ? '$' + Math.round(parseInt(msrp, 10)).toLocaleString('en-US')
          : '';
        matches.push({ slug: slug, type: type, model: model, fp: fp, year: year, thumb: thumb, price: price });
      }

      if (!matches.length) { clear(); return; }

      var html = '';
      for (var j = 0; j < matches.length; j++) {
        var m = matches[j];
        var href = m.slug + '.html';
        var imgHtml = m.thumb
          ? '<img class="x-sug-thumb" src="' + m.thumb + '" alt="" width="48" height="32" loading="lazy">'
          : '<span class="x-sug-thumb" aria-hidden="true"></span>';
        html += '<li class="x-suggest-item" id="x-sug-' + j + '" role="option" data-href="' + href + '">'
          + imgHtml
          + '<span class="x-sug-label"><strong>' + m.model + '</strong> ' + m.fp + '</span>'
          + '<span class="x-sug-meta">' + m.year + (m.price ? ' · ' + m.price : '') + '</span>'
          + '</li>';
      }
      list.innerHTML = html;
      list.removeAttribute('hidden');
      combobox.setAttribute('aria-expanded', 'true');
      items = Array.prototype.slice.call(list.querySelectorAll('.x-suggest-item'));
      focusIdx = -1;
    }

    input.addEventListener('input', function () {
      // Small delay so the existing filter runs first
      setTimeout(update, 60);
    });

    input.addEventListener('keydown', function (e) {
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus(focusIdx < items.length - 1 ? focusIdx + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus(focusIdx > 0 ? focusIdx - 1 : items.length - 1);
      } else if (e.key === 'Enter' && focusIdx >= 0) {
        e.preventDefault();
        var href = items[focusIdx].getAttribute('data-href');
        if (href) navigate(href);
      } else if (e.key === 'Escape') {
        clear();
      }
    });

    list.addEventListener('click', function (e) {
      var li = e.target.closest('.x-suggest-item');
      if (!li) return;
      var href = li.getAttribute('data-href');
      if (href) navigate(href);
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!combobox.contains(e.target)) clear();
    });

    // Close on focus leaving the combobox
    input.addEventListener('blur', function () {
      // Small delay so click on suggestion registers first
      setTimeout(function () {
        if (!combobox.contains(document.activeElement)) clear();
      }, 150);
    });
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
      ['Ext. width', function (d) { return d.extWidthFt; }, function (v) { return v ? fmtLen2(v) : '\u2014'; }, -1],
      ['Ext. height', function (d) { return d.extHeightFt; }, function (v) { return v ? fmtLen2(v) : '\u2014'; }, -1],
      ['Interior height', function (d) { return d.intHeightFt; }, function (v) { return v ? fmtLen2(v) : '\u2014'; }, 1],
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
      var winCounts = {};
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
          var displayText = row[2](vals[i], d);
          td.textContent = displayText;
          if (best !== null && vals[i] === best && cols.length > 1) td.className = 'cmp-best';
          // Diff annotation: show gap vs best when 2+ models and numeric values
          if (best !== null && cols.length > 1 && typeof vals[i] === 'number' && !isNaN(vals[i]) && vals[i] !== best) {
            var gap = vals[i] - best;
            var absGap = Math.abs(gap);
            var gapStr = '';
            // Format gap based on magnitude
            if (row[0] === 'MSRP' || row[0] === 'Total cost') {
              gapStr = (gap > 0 ? '+' : '−') + '$' + absGap.toLocaleString('en-US');
            } else {
              gapStr = (gap > 0 ? '+' : '−') + absGap.toLocaleString('en-US');
            }
            var diff = document.createElement('span');
            diff.className = 'cmp-diff';
            diff.textContent = ' ' + gapStr;
            td.appendChild(diff);
          }
          // Track wins
          if (best !== null && vals[i] === best && cols.length > 1) {
            if (!winCounts[i]) winCounts[i] = 0;
            winCounts[i]++;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      // Floor plan image row (trailers only)
      if (cols[0] && cols[0].type === 'trailer' && cols.some(function (d) { return d.floorplanImg; })) {
        var fptr = document.createElement('tr');
        fptr.className = 'cmp-floorplan-row';
        var fpth = document.createElement('th');
        fpth.scope = 'row'; fpth.textContent = 'Floor plan';
        fptr.appendChild(fpth);
        cols.forEach(function (d) {
          var fptd = document.createElement('td');
          if (d.floorplanImg) {
            var fpimg = document.createElement('img');
            fpimg.src = d.floorplanImg; fpimg.alt = d.model + ' ' + d.floorplan + ' floor plan';
            fpimg.loading = 'lazy'; fpimg.className = 'cmp-floorplan-img';
            fpimg.width = 200; fpimg.height = 325;
            fptd.appendChild(fpimg);
          } else {
            fptd.textContent = '\u2014';
          }
          fptr.appendChild(fptd);
        });
        tbody.appendChild(fptr);
      }

      // Verdict row: show which model leads the most specs
      if (cols.length >= 2) {
        var maxWins = 0;
        for (var w = 0; w < cols.length; w++) { if ((winCounts[w] || 0) > maxWins) maxWins = winCounts[w] || 0; }
        var tfoot = document.createElement('tfoot');
        var vtr = document.createElement('tr');
        vtr.className = 'cmp-verdict';
        var vth = document.createElement('th');
        vth.scope = 'row'; vth.textContent = 'Spec wins';
        vtr.appendChild(vth);
        cols.forEach(function (d, i) {
          var vtd = document.createElement('td');
          var wins = winCounts[i] || 0;
          vtd.textContent = wins + ' of ' + ROWS.length;
          if (wins === maxWins && maxWins > 0) vtd.className = 'cmp-verdict-lead';
          vtr.appendChild(vtd);
        });
        tfoot.appendChild(vtr);
        table.appendChild(tfoot);
      }

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

    // ---- RADAR OVERLAY CHART ----
    var radarWrap = document.getElementById('cmp-radar-wrap');
    var radarChart = document.getElementById('cmp-radar-chart');
    var radarLegend = document.getElementById('cmp-radar-legend');
    var RADAR_COLORS = ['#B8763E', '#4A8C5C', '#5B7FBF'];
    var RADAR_AXES = [
      { key: 'offGridScore', label: 'Off-grid',  min: 35,  max: 95,  better: 'higher' },
      { key: 'cccLb',        label: 'Cargo',     min: 300, max: 2300, better: 'higher' },
      { key: 'sleeps',       label: 'Sleeps',    min: 2,   max: 8,    better: 'higher' },
      { key: 'lengthFt',     label: 'Compact',   min: 16,  max: 34,   better: 'lower'  },
      { key: 'weightLb',     label: 'Light',     min: 2600,max: 8500, better: 'lower'  },
      { key: 'msrp',         label: 'Value',     min: 50000, max: 225000, better: 'lower' },
    ];
    function radarNorm(val, axis) {
      if (val == null || val <= 0) return 0;
      var clamped = Math.max(axis.min, Math.min(axis.max, val));
      var ratio = (clamped - axis.min) / (axis.max - axis.min);
      return axis.better === 'lower' ? 1 - ratio : ratio;
    }
    function buildRadarSvg(models) {
      var cx = 120, cy = 120, R = 90, n = RADAR_AXES.length;
      var step = (2 * Math.PI) / n, start = -Math.PI / 2;
      // Guide rings
      var rings = [0.33, 0.66, 1].map(function (frac) {
        var r = R * frac, pts = [];
        for (var i = 0; i < n; i++) {
          var a = start + i * step;
          pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
        }
        return '<polygon points="' + pts.join(' ') + '" fill="none" stroke="var(--line,#E2DDD8)" stroke-width="0.5"/>';
      }).join('');
      // Spokes
      var spokes = '';
      for (var i = 0; i < n; i++) {
        var a = start + i * step;
        spokes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(a)).toFixed(1) + '" y2="' + (cy + R * Math.sin(a)).toFixed(1) + '" stroke="var(--line,#E2DDD8)" stroke-width="0.5"/>';
      }
      // Labels
      var labels = RADAR_AXES.map(function (axis, i) {
        var a = start + i * step, lr = R + 22;
        var x = cx + lr * Math.cos(a), y = cy + lr * Math.sin(a);
        var anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        var dy = Math.abs(Math.sin(a)) > 0.8 ? (Math.sin(a) > 0 ? '0.9em' : '-0.3em') : '0.35em';
        return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" dy="' + dy + '" fill="var(--muted,#8C8579)" font-size="11" font-family="inherit">' + axis.label + '</text>';
      }).join('');
      // Overlay polygons
      var polys = models.map(function (d, mi) {
        var pts = RADAR_AXES.map(function (axis, ai) {
          var v = radarNorm(d[axis.key], axis);
          var r = Math.max(R * 0.05, R * v);
          var a = start + ai * step;
          return (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1);
        }).join(' ');
        var color = RADAR_COLORS[mi] || '#888';
        return '<polygon points="' + pts + '" fill="' + color + '" fill-opacity="0.15" stroke="' + color + '" stroke-width="2"/>';
      }).join('');
      return '<svg viewBox="0 0 240 240" width="280" height="280" role="img" aria-label="Comparison radar chart" style="max-width:100%;height:auto">' + rings + spokes + polys + labels + '</svg>';
    }

    var origRender = render;
    render = function () {
      origRender();
      // Build radar overlay
      if (radarWrap && radarChart && radarLegend) {
        if (ids.length < 2) { radarWrap.hidden = true; return; }
        var models = ids.map(function (s) { return bySlug[s]; }).filter(Boolean);
        radarChart.innerHTML = buildRadarSvg(models);
        radarLegend.innerHTML = models.map(function (d, i) {
          return '<span class="cmp-radar-legend-item" style="color:' + (RADAR_COLORS[i] || '#888') + '"><span class="cmp-radar-legend-dot" style="background:' + (RADAR_COLORS[i] || '#888') + '"></span>' + d.model + ' ' + d.floorplan + '</span>';
        }).join('');
        radarWrap.hidden = false;
      }
    };
    render();

    // Share comparison URL
    var shareBtn = document.getElementById('cmp-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (!ids.length) return;
        var url = location.origin + location.pathname + '?ids=' + ids.join(',');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            shareBtn.textContent = '✓ Link copied';
            setTimeout(function () { shareBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"></path></svg> Share comparison'; }, 2000);
          });
        }
      });
    }
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
  // 9b. FINANCING / MONTHLY PAYMENT CALCULATOR (detail pages)
  //     Amortization formula, all client-side. Reads MSRP from a JSON island
  //     (#finance-data). Sliders for down payment % and APR; select for term.
  // =========================================================================
  (function financeTool() {
    var root = document.querySelector('.finance-tool');
    if (!root) return;
    var island = document.getElementById('finance-data');
    if (!island) return;
    var cfg;
    try { cfg = JSON.parse(island.textContent); } catch (e) { return; }
    var msrp = cfg.msrp;
    if (!(msrp > 0)) return;

    var elDown = document.getElementById('finance-down');
    var elDownVal = document.getElementById('finance-down-val');
    var elApr = document.getElementById('finance-apr');
    var elAprVal = document.getElementById('finance-apr-val');
    var elTerm = document.getElementById('finance-term');
    var elMonthly = document.getElementById('finance-monthly');
    var elPrincipal = document.getElementById('finance-principal');
    var elInterest = document.getElementById('finance-interest');
    var elTotal = document.getElementById('finance-total');

    function fmt(n) {
      if (n == null || isNaN(n) || n <= 0) return '$0';
      return '$' + Math.round(n).toLocaleString('en-US');
    }

    function calc() {
      var downPct = parseFloat(elDown.value) || 0;
      var apr = parseFloat(elApr.value) || 0;
      var termYears = parseInt(elTerm.value, 10) || 15;
      var down = Math.round(msrp * downPct / 100);
      var principal = msrp - down;
      var r = apr / 100 / 12;
      var n = termYears * 12;
      var monthly = 0;
      if (principal > 0) {
        monthly = r > 0
          ? principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
          : principal / n;
      }
      monthly = Math.round(monthly);
      var totalCost = monthly * n + down;
      var totalInterest = totalCost - msrp;
      elDownVal.textContent = downPct + '% (' + fmt(down) + ')';
      elAprVal.textContent = apr.toFixed(apr % 1 === 0 ? 0 : 2) + '%';
      elMonthly.textContent = fmt(monthly);
      elPrincipal.textContent = fmt(principal);
      elInterest.textContent = fmt(totalInterest);
      elTotal.textContent = fmt(totalCost);
    }

    if (elDown) elDown.addEventListener('input', calc);
    if (elApr) elApr.addEventListener('input', calc);
    if (elTerm) elTerm.addEventListener('change', calc);
  })();

  // =========================================================================
  // 9c. OWNERSHIP COST CALCULATOR (detail pages)
  //     Annual cost estimator: insurance, storage, maintenance, depreciation.
  //     Reads MSRP from a JSON island (#ownership-data). All client-side.
  // =========================================================================
  (function ownershipTool() {
    var root = document.querySelector('.ownership-tool');
    if (!root) return;
    var island = document.getElementById('ownership-data');
    if (!island) return;
    var cfg;
    try { cfg = JSON.parse(island.textContent); } catch (e) { return; }
    var msrp = cfg.msrp;
    if (!(msrp > 0)) return;

    var elIns = document.getElementById('own-insurance');
    var elInsVal = document.getElementById('own-insurance-val');
    var elSto = document.getElementById('own-storage');
    var elStoVal = document.getElementById('own-storage-val');
    var elMnt = document.getElementById('own-maintenance');
    var elMntVal = document.getElementById('own-maintenance-val');
    var elDep = document.getElementById('own-depreciation');
    var elDepVal = document.getElementById('own-depreciation-val');
    var elTotal = document.getElementById('own-total');
    var elInsDd = document.getElementById('own-ins-dd');
    var elStoDd = document.getElementById('own-sto-dd');
    var elMntDd = document.getElementById('own-mnt-dd');
    var elDepDd = document.getElementById('own-dep-dd');
    var elTotDd = document.getElementById('own-tot-dd');
    var bars = root.querySelectorAll('.own-bar');

    function fmt(n) {
      if (n == null || isNaN(n) || n <= 0) return '$0';
      return '$' + Math.round(n).toLocaleString('en-US');
    }

    function calc() {
      var insPct = parseFloat(elIns.value) || 0;
      var stoMo = parseFloat(elSto.value) || 0;
      var mntYr = parseFloat(elMnt.value) || 0;
      var depPct = parseFloat(elDep.value) || 0;

      var insurance = Math.round(msrp * insPct / 100);
      var storage = Math.round(stoMo * 12);
      var maintenance = Math.round(mntYr);
      var depreciation = Math.round(msrp * depPct / 100);
      var total = insurance + storage + maintenance + depreciation;

      elInsVal.textContent = insPct + '% (' + fmt(insurance) + '/yr)';
      elStoVal.textContent = '$' + Math.round(stoMo) + '/mo (' + fmt(storage) + '/yr)';
      elMntVal.textContent = fmt(maintenance) + '/yr';
      elDepVal.textContent = depPct + '% (' + fmt(depreciation) + ')';
      elTotal.textContent = fmt(total);
      if (elInsDd) elInsDd.textContent = fmt(insurance) + '/yr';
      if (elStoDd) elStoDd.textContent = fmt(storage) + '/yr';
      if (elMntDd) elMntDd.textContent = fmt(maintenance) + '/yr';
      if (elDepDd) elDepDd.textContent = fmt(depreciation);
      if (elTotDd) elTotDd.textContent = fmt(total) + '/yr';

      // Update stacked bar widths
      var vals = [insurance, storage, maintenance, depreciation];
      for (var i = 0; i < bars.length && i < vals.length; i++) {
        bars[i].style.flex = String(vals[i] || 1);
      }
    }

    if (elIns) elIns.addEventListener('input', calc);
    if (elSto) elSto.addEventListener('input', calc);
    if (elMnt) elMnt.addEventListener('input', calc);
    if (elDep) elDep.addEventListener('input', calc);
  })();

  // =========================================================================
  // 9d. COLLAPSIBLE DETAIL SECTIONS
  //     Tool sections on detail pages can be collapsed/expanded. State is
  //     persisted per section id in localStorage. Sections are open by default.
  // =========================================================================
  (function collapsibleSections() {
    var detail = document.querySelector('.detail');
    if (!detail) return;

    var STORE_KEY = 'ae:collapsed';
    var collapsed;
    try { collapsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { collapsed = {}; }

    // Target sections: the estimator/tool sections (not specs, gallery, proscons)
    var selectors = [
      '.towtool', '.fuel-tool', '.payload-tool', '.finance-tool',
      '.ownership-tool', '.offgrid-tool', '.compat-vehicles',
      '.year-diff', '.campground-fit',
    ];

    selectors.forEach(function (sel) {
      var section = detail.querySelector(sel);
      if (!section) return;
      var id = section.id;
      if (!id) return;

      section.setAttribute('data-collapsible', '');

      // Find the toggle target — either a direct h2 or h2 inside .est-head
      var heading = section.querySelector('.est-head > h2') || section.querySelector(':scope > h2');
      if (!heading) return;

      // Wrap everything after h2/est-head in a collapsible body div
      var wrapper = document.createElement('div');
      wrapper.className = 'section-collapse-body';
      var toggleParent = heading.parentElement === section ? heading : heading.closest('.est-head');
      var sibling = toggleParent.nextElementSibling;
      while (sibling) {
        var next = sibling.nextElementSibling;
        wrapper.appendChild(sibling);
        sibling = next;
      }
      section.appendChild(wrapper);

      // Restore collapsed state
      if (collapsed[id]) {
        section.classList.add('is-collapsed');
      }

      heading.setAttribute('role', 'button');
      heading.setAttribute('aria-expanded', collapsed[id] ? 'false' : 'true');
      heading.setAttribute('tabindex', '0');

      // Set initial max-height for smooth CSS transitions
      if (!collapsed[id]) {
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
      }

      function toggle() {
        var isNowCollapsed = section.classList.toggle('is-collapsed');
        heading.setAttribute('aria-expanded', isNowCollapsed ? 'false' : 'true');
        if (isNowCollapsed) {
          wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
          void wrapper.offsetHeight;
          wrapper.style.maxHeight = '0';
          collapsed[id] = true;
        } else {
          wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
          var onEnd = function () {
            wrapper.removeEventListener('transitionend', onEnd);
            if (!section.classList.contains('is-collapsed')) {
              wrapper.style.maxHeight = 'none';
            }
          };
          wrapper.addEventListener('transitionend', onEnd);
          delete collapsed[id];
        }
        try { localStorage.setItem(STORE_KEY, JSON.stringify(collapsed)); } catch (e) { /* noop */ }
      }

      heading.addEventListener('click', toggle);
      heading.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  })();

  // =========================================================================
  // 9d-b. SPEC ROW TAP-TO-COPY — click a spec row to copy value to clipboard
  // =========================================================================
  (function specCopy() {
    var detail = document.querySelector('.detail');
    if (!detail) return;
    var specGrid = detail.querySelector('.specs-grid');
    if (!specGrid) return;
    // Get the model name from the page heading
    var heading = detail.querySelector('.detail-head h1');
    var modelName = heading ? heading.textContent.trim() : '';

    // Create toast element once
    var toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.setAttribute('aria-live', 'polite');
    toast.hidden = true;
    document.body.appendChild(toast);
    var toastTimer = null;

    function showToast(text) {
      toast.textContent = text;
      toast.hidden = false;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.classList.remove('is-visible');
        setTimeout(function () { toast.hidden = true; }, 200);
      }, 1600);
    }

    specGrid.addEventListener('click', function (e) {
      // Find the clicked dt/dd pair
      var el = e.target.closest('dt, dd');
      if (!el) return;
      // Don't interfere with tooltips or links
      if (e.target.closest('a, button, .glossary-tip')) return;
      var dt, dd;
      if (el.tagName === 'DT') {
        dt = el;
        dd = el.nextElementSibling;
      } else {
        dd = el;
        dt = el.previousElementSibling;
      }
      if (!dt || !dd) return;
      var label = dt.textContent.trim().replace(/\s+/g, ' ');
      var value = dd.textContent.trim().replace(/\s+/g, ' ');
      var copyText = modelName ? modelName + ': ' + value + ' ' + label.toLowerCase() : value + ' ' + label.toLowerCase();
      if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText).then(function () {
          showToast('Copied \u2713');
        }).catch(function () {
          showToast('Copied \u2713');
        });
      } else {
        showToast('Copied \u2713');
      }
      // Brief visual feedback on the row
      dt.classList.add('is-copied');
      dd.classList.add('is-copied');
      setTimeout(function () { dt.classList.remove('is-copied'); dd.classList.remove('is-copied'); }, 600);
    });

    // Add cursor hint to spec grid
    specGrid.classList.add('specs-copyable');
  })();

  // =========================================================================
  // 9e. TRIP READY CHECKLIST — model-specific pre-departure checklist with
  //     progress persistence in localStorage. Guarded by .trip-ready.
  // =========================================================================
  (function tripReady() {
    var root = document.querySelector('.trip-ready');
    if (!root) return;

    var trigger = root.querySelector('.collapsible-trigger');
    var body = root.querySelector('.collapsible-body');
    var fill = document.getElementById('trip-progress-fill');
    var countEl = document.getElementById('trip-count');
    var resetBtn = document.getElementById('trip-reset');
    var checks = Array.prototype.slice.call(root.querySelectorAll('.trip-check'));
    if (!checks.length) return;

    // Get slug from article data-canonical
    var article = document.querySelector('.detail[data-canonical]');
    var slug = '';
    if (article) {
      var can = article.getAttribute('data-canonical') || '';
      var m = can.match(/m\/(.+)\.html$/);
      if (m) slug = m[1];
    }
    var STORE_KEY = 'ae:trip:' + slug;

    function readState() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
    }
    function writeState(st) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) {}
    }

    // Toggle collapsible with smooth animation
    if (trigger && body) {
      trigger.addEventListener('click', function () {
        var expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (expanded) {
          body.style.maxHeight = body.scrollHeight + 'px';
          void body.offsetHeight;
          body.setAttribute('hidden', '');
        } else {
          body.removeAttribute('hidden');
          body.style.maxHeight = body.scrollHeight + 'px';
          var onEnd = function () {
            body.removeEventListener('transitionend', onEnd);
            if (!body.hasAttribute('hidden')) {
              body.style.maxHeight = 'none';
            }
          };
          body.addEventListener('transitionend', onEnd);
        }
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
      });
    }

    function updateProgress() {
      var done = 0;
      checks.forEach(function (cb) { if (cb.checked) done++; });
      var pct = Math.round(done / checks.length * 100);
      if (fill) fill.style.width = pct + '%';
      if (countEl) countEl.textContent = done + '/' + checks.length;
    }

    // Restore state
    var state = readState();
    checks.forEach(function (cb) {
      var key = cb.getAttribute('data-trip-item');
      if (state[key]) cb.checked = true;
      cb.addEventListener('change', function () {
        var st = readState();
        if (cb.checked) st[key] = true;
        else delete st[key];
        writeState(st);
        updateProgress();
      });
    });
    updateProgress();

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        checks.forEach(function (cb) { cb.checked = false; });
        writeState({});
        updateProgress();
      });
    }
  })();

  // =========================================================================
  // WINTERIZATION CHECKLIST — mirrors tripReady with its own localStorage
  // =========================================================================
  (function winterization() {
    var root = document.querySelector('.winterization');
    if (!root) return;

    var trigger = root.querySelector('.collapsible-trigger');
    var body = root.querySelector('.collapsible-body');
    var fill = document.getElementById('wz-progress-fill');
    var countEl = document.getElementById('wz-count');
    var resetBtn = document.getElementById('wz-reset');
    var checks = Array.prototype.slice.call(root.querySelectorAll('.wz-check'));
    if (!checks.length) return;

    var article = document.querySelector('.detail[data-canonical]');
    var slug = '';
    if (article) {
      var can = article.getAttribute('data-canonical') || '';
      var m = can.match(/m\/(.+)\.html$/);
      if (m) slug = m[1];
    }
    var STORE_KEY = 'ae:wz:' + slug;

    function readState() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
    }
    function writeState(st) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) {}
    }

    // Collapsible toggle
    if (trigger && body) {
      trigger.addEventListener('click', function () {
        var expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (expanded) {
          body.style.maxHeight = body.scrollHeight + 'px';
          void body.offsetHeight;
          body.setAttribute('hidden', '');
        } else {
          body.removeAttribute('hidden');
          body.style.maxHeight = body.scrollHeight + 'px';
          var onEnd = function () {
            body.removeEventListener('transitionend', onEnd);
            if (!body.hasAttribute('hidden')) body.style.maxHeight = 'none';
          };
          body.addEventListener('transitionend', onEnd);
        }
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
      });
    }

    function updateProgress() {
      var done = 0;
      checks.forEach(function (cb) { if (cb.checked) done++; });
      var pct = Math.round(done / checks.length * 100);
      if (fill) fill.style.width = pct + '%';
      if (countEl) countEl.textContent = done + '/' + checks.length;
    }

    var state = readState();
    checks.forEach(function (cb) {
      var key = cb.getAttribute('data-wz-item');
      if (state[key]) cb.checked = true;
      cb.addEventListener('change', function () {
        var st = readState();
        if (cb.checked) st[key] = true;
        else delete st[key];
        writeState(st);
        updateProgress();
      });
    });
    updateProgress();

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        checks.forEach(function (cb) { cb.checked = false; });
        writeState({});
        updateProgress();
      });
    }
  })();

  // =========================================================================
  // DETAIL COMPARE BUTTON — add/remove from compare selection on detail page
  // =========================================================================
  (function detailCompare() {
    var btn = document.getElementById('detail-compare');
    if (!btn) return;
    var slug = btn.getAttribute('data-compare-slug');
    var type = btn.getAttribute('data-compare-type') || 'trailer';
    if (!slug) return;

    var CMP_KEY = 'ae:compare';

    function readSet() {
      try {
        var raw = localStorage.getItem(CMP_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    function writeSet(arr) {
      try { localStorage.setItem(CMP_KEY, JSON.stringify(arr)); } catch (e) {}
    }

    function updateUI() {
      var set = readSet();
      var inSet = set.some(function (item) {
        return typeof item === 'string' ? item === slug : (item && item.slug === slug);
      });
      if (inSet) {
        btn.classList.add('is-compared');
        btn.setAttribute('aria-label', 'Remove from comparison');
        btn.title = 'Remove from comparison';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> In compare';
      } else {
        btn.classList.remove('is-compared');
        btn.setAttribute('aria-label', 'Add to comparison');
        btn.title = 'Add to comparison';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> Compare';
      }
    }

    btn.addEventListener('click', function () {
      var set = readSet();
      var idx = -1;
      set.forEach(function (item, i) {
        var s = typeof item === 'string' ? item : (item && item.slug);
        if (s === slug) idx = i;
      });
      if (idx >= 0) {
        set.splice(idx, 1);
      } else {
        set.push({ slug: slug, type: type });
      }
      writeSet(set);
      updateUI();
      // Update nav badge if present
      var badge = document.getElementById('nav-saved-count');
      if (badge && set.length > 0) {
        badge.removeAttribute('hidden');
      }
    });

    updateUI();
  })();

  // =========================================================================
  // 9e-b. GENERIC COLLAPSIBLE — handles any .collapsible sections not already
  //       wired (e.g. weight-budget). Smooth animated expand/collapse.
  // =========================================================================
  (function genericCollapsible() {
    var triggers = Array.prototype.slice.call(document.querySelectorAll('.collapsible .collapsible-trigger'));
    triggers.forEach(function (trig) {
      if (trig.closest('.trip-ready')) return;
      if (trig.closest('.winterization')) return;
      var body = trig.parentElement.querySelector('.collapsible-body');
      if (!body) return;
      trig.addEventListener('click', function () {
        var expanded = trig.getAttribute('aria-expanded') === 'true';
        trig.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (expanded) {
          body.style.maxHeight = body.scrollHeight + 'px';
          void body.offsetHeight;
          body.setAttribute('hidden', '');
        } else {
          body.removeAttribute('hidden');
          body.style.maxHeight = body.scrollHeight + 'px';
          var onEnd = function () {
            body.removeEventListener('transitionend', onEnd);
            if (!body.hasAttribute('hidden')) body.style.maxHeight = 'none';
          };
          body.addEventListener('transitionend', onEnd);
        }
      });
      trig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trig.click(); }
      });
    });
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

    // --- "You might also like" recommendations based on saved items ---
    (function savedRecs() {
      var recsSection = document.getElementById('recs-section');
      var recsGrid = document.getElementById('recs-grid');
      if (!recsSection || !recsGrid) return;

      // Euclidean distance on normalized specs (mirrors trailerDistance in render.mjs)
      function dist(a, b) {
        var dims = [
          ['weightLb', 2600, 8500], ['lengthFt', 16, 34], ['msrp', 50000, 225000],
          ['sleeps', 2, 8], ['offGridScore', 35, 95]
        ];
        var sum = 0;
        for (var d = 0; d < dims.length; d++) {
          var k = dims[d][0], lo = dims[d][1], hi = dims[d][2];
          var va = a[k] != null ? (a[k] - lo) / (hi - lo) : 0.5;
          var vb = b[k] != null ? (b[k] - lo) / (hi - lo) : 0.5;
          sum += (va - vb) * (va - vb);
        }
        return Math.sqrt(sum);
      }

      function renderRecs() {
        var saved = Saved.read();
        if (saved.length === 0) { recsSection.setAttribute('hidden', ''); return; }

        var savedSlugs = {};
        var savedModels = {};
        var savedItems = [];
        for (var i = 0; i < saved.length; i++) {
          var s = CATALOG[saved[i].slug];
          if (s) { savedSlugs[s.slug] = true; savedModels[s.model] = true; savedItems.push(s); }
        }
        if (savedItems.length === 0) { recsSection.setAttribute('hidden', ''); return; }

        // Score every unsaved model by average distance to saved items
        var candidates = [];
        var allSlugs = Object.keys(CATALOG);
        for (var c = 0; c < allSlugs.length; c++) {
          var cand = CATALOG[allSlugs[c]];
          if (savedSlugs[cand.slug]) continue;
          // Prefer cross-family: skip models from saved families (but allow if pool is thin)
          var totalDist = 0;
          for (var j = 0; j < savedItems.length; j++) totalDist += dist(cand, savedItems[j]);
          candidates.push({ rec: cand, avg: totalDist / savedItems.length, sameFamily: !!savedModels[cand.model] });
        }
        // Sort: prefer cross-family, then by closest distance
        candidates.sort(function (a, b) {
          if (a.sameFamily !== b.sameFamily) return a.sameFamily ? 1 : -1;
          return a.avg - b.avg;
        });

        // Take top 4
        var top = candidates.slice(0, 4);
        if (top.length === 0) { recsSection.setAttribute('hidden', ''); return; }

        recsSection.removeAttribute('hidden');
        while (recsGrid.firstChild) recsGrid.removeChild(recsGrid.firstChild);

        for (var t = 0; t < top.length; t++) {
          var rec = top[t].rec;
          var dir = rec.type === 'motorhome' ? 'mm' : 'm';
          var a = document.createElement('a');
          a.className = 'recs-card';
          a.href = dir + '/' + rec.slug + '.html';
          var img = document.createElement('img');
          img.src = rec.thumb; img.alt = rec.model + ' ' + rec.floorplan;
          img.loading = 'lazy'; img.width = 280; img.height = 180;
          a.appendChild(img);
          var info = document.createElement('div');
          info.className = 'recs-card-info';
          var name = document.createElement('strong');
          name.textContent = rec.model + ' ' + rec.floorplan;
          info.appendChild(name);
          var meta = document.createElement('span');
          meta.className = 'recs-card-meta';
          var weight = rec.weightLb ? Math.round(rec.weightLb).toLocaleString('en-US') + ' lb' : '—';
          var price = rec.msrp > 0 ? '$' + Math.round(rec.msrp).toLocaleString('en-US') : 'Price TBA';
          meta.textContent = rec.year + ' · ' + weight + ' · ' + price;
          info.appendChild(meta);
          a.appendChild(info);
          recsGrid.appendChild(a);
        }
      }

      Saved.onChange(renderRecs);
      renderRecs();
    })();
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

    // Auto-expand collapsed sections when clicking a secnav link
    nav.addEventListener('click', function (e) {
      var link = e.target.closest('.secnav-link');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      // Check for collapsible pattern: section.is-collapsed or .collapsible with hidden body
      var section = target.closest('.is-collapsed') || target;
      if (section.classList.contains('is-collapsed')) {
        // Find the heading/trigger and simulate a click to expand
        var trigger = section.querySelector('[role="button"][aria-expanded="false"]');
        if (trigger) trigger.click();
      }
      // Also handle the collapsible-trigger/collapsible-body pattern
      var collTrigger = target.querySelector('.collapsible-trigger[aria-expanded="false"]');
      if (collTrigger) collTrigger.click();
    });
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

  // -----------------------------------------------------------------------
  // STICKY DETAIL SUMMARY BAR — compact bar below nav on scroll
  // -----------------------------------------------------------------------
  (function detailStickyBar() {
    var bar = document.getElementById('detail-sticky-summary');
    var hero = document.querySelector('.detail-hero');
    if (!bar || !hero || !('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bar.hidden = true;
          bar.setAttribute('aria-hidden', 'true');
        } else {
          bar.hidden = false;
          bar.setAttribute('aria-hidden', 'false');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });
    observer.observe(hero);
  })();

  // =========================================================================
  // TOW COMPATIBILITY BANNER — persistent tow vehicle context on detail pages.
  //     If the user picked a tow vehicle on the Explore page, show whether
  //     this trailer is towable. Reads ae:towVehicle from localStorage.
  //     Guarded by .tow-callout (only present on detail pages with GVWR).
  // =========================================================================
  (function towBanner() {
    var callout = document.querySelector('.tow-callout');
    if (!callout) return;
    var gvwrEl = callout.querySelector('[data-unit="weight"]');
    if (!gvwrEl) return;
    var gvwr = parseInt(gvwrEl.getAttribute('data-raw'), 10);
    if (!gvwr) return;
    var stored;
    try { stored = JSON.parse(localStorage.getItem('ae:towVehicle')); } catch (e) {}
    if (!stored || !stored.rating) return;

    var ok = stored.rating >= gvwr;
    var name = stored.name || (stored.rating.toLocaleString('en-US') + ' lb rating');
    var banner = document.createElement('div');
    banner.className = 'tow-banner ' + (ok ? 'tow-banner--ok' : 'tow-banner--over');
    banner.setAttribute('role', 'status');
    banner.innerHTML = ok
      ? '<span class="tow-banner-icon" aria-hidden="true">✓</span> <strong>' + name + '</strong> can tow this — ' + gvwr.toLocaleString('en-US') + ' lb GVWR is within your rating.'
      : '<span class="tow-banner-icon" aria-hidden="true">⚠</span> <strong>' + name + '</strong> may not be enough — this trailer\'s ' + gvwr.toLocaleString('en-US') + ' lb GVWR exceeds your ' + stored.rating.toLocaleString('en-US') + ' lb rating.';
    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'tow-banner-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', function () { banner.remove(); });
    banner.appendChild(dismiss);
    callout.parentNode.insertBefore(banner, callout);
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
    var clickables = document.querySelectorAll('.tagfilter, .layoutfilter, #x-type .xc-type-btn, .tow-preset, .smart-preset, #x-reset, #x-empty-reset, #tow-clear');
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
      [elSort, elYear, elSleeps, elPrice, elLength, elWeight, elAxle, towInput, elSearch].forEach(function (el) {
        if (el) {
          try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      });
    }
    applyHashOnLoad();

    // Share View button — copies the current URL (with hash-encoded filters)
    var shareViewBtn = document.getElementById('x-share-view');
    if (shareViewBtn) {
      shareViewBtn.addEventListener('click', function () {
        // Ensure we're in the #all view with current filters encoded
        var hash = location.hash || '';
        var url = location.href;
        if (hash.indexOf('all') === -1) {
          // Force #all view URL
          url = location.origin + location.pathname + '#' + encodeHash(currentState());
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            var orig = shareViewBtn.innerHTML;
            shareViewBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
            setTimeout(function () { shareViewBtn.innerHTML = orig; }, 2000);
          });
        }
      });
    }
  })();

})();

  // -----------------------------------------------------------------------
  // QUICK VIEW — spec popover on explore cards with prev/next navigation
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
    var prevBtn = document.getElementById('qv-prev');
    var nextBtn = document.getElementById('qv-next');
    var counterEl = document.getElementById('qv-counter');
    var savedFocus = null;
    var currentCard = null;

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

    /** Get all currently visible explore cards in DOM order. */
    function getVisibleCards() {
      return Array.prototype.slice.call(document.querySelectorAll('.xcard')).filter(function (c) {
        return !c.hidden && c.offsetParent !== null;
      });
    }

    function populate(card) {
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
        ['Axle', d.axle === 'single' ? 'Single' : d.axle === 'dual' ? 'Dual' : '—'],
        ['Off-grid', d.offgrid ? d.offgrid + '/100' : '—'],
        ['Fresh tank', fmtGal(d.fresh)],
        ['Solar', d.solar ? d.solar + ' W' : '—'],
        ['Hitch weight', fmtLb(d.hitch)],
        ['MSRP', fmtMoney(d.msrp)],
      ];
      specsEl.innerHTML = specs.map(function (s) {
        return '<div class="qv-spec-item"><span class="qv-spec-label">' + s[0] + '</span><span class="qv-spec-value">' + s[1] + '</span></div>';
      }).join('');

      currentCard = card;
      updateNav();
    }

    function updateNav() {
      var cards = getVisibleCards();
      var idx = cards.indexOf(currentCard);
      var hasPrev = idx > 0;
      var hasNext = idx >= 0 && idx < cards.length - 1;
      if (prevBtn) { prevBtn.style.display = hasPrev ? '' : 'none'; }
      if (nextBtn) { nextBtn.style.display = hasNext ? '' : 'none'; }
      if (counterEl && idx >= 0) {
        counterEl.textContent = (idx + 1) + ' / ' + cards.length;
      }
    }

    function go(delta) {
      var cards = getVisibleCards();
      var idx = cards.indexOf(currentCard);
      if (idx < 0) return;
      var next = idx + delta;
      if (next < 0 || next >= cards.length) return;
      populate(cards[next]);
    }

    function open(card) {
      savedFocus = document.activeElement;
      populate(card);
      qv.hidden = false;
      qv.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      qv.querySelector('[data-qv-close]').focus();
    }

    function close() {
      qv.hidden = true;
      qv.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      currentCard = null;
      if (savedFocus) { savedFocus.focus(); savedFocus = null; }
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(1); });

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
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
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

  // =========================================================================
  // GALLERY SLIDESHOW — auto-play button cycles gallery images in lightbox.
  //     Pauses on any user interaction. 4-second interval per image.
  // =========================================================================
  (function gallerySlideshow() {
    var btn = document.getElementById('gallery-autoplay');
    if (!btn) return;
    var playing = false;
    var timer = null;
    var INTERVAL = 4000;

    // SVG icons
    var playIcon = '<svg viewBox="0 0 24 24" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Slideshow';
    var pauseIcon = '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause';

    function getGalleryButtons() {
      return Array.prototype.slice.call(document.querySelectorAll('[data-gallery] [data-lightbox]'));
    }

    function openAt(idx) {
      var btns = getGalleryButtons();
      if (btns[idx]) btns[idx].click();
    }

    function currentLbIndex() {
      var counter = document.querySelector('.lb-counter');
      if (!counter) return -1;
      var m = counter.textContent.match(/^(\d+)/);
      return m ? parseInt(m[1], 10) - 1 : -1;
    }

    function advance() {
      var btns = getGalleryButtons();
      if (!btns.length) { stop(); return; }
      var lb = document.getElementById('lightbox');
      if (!lb || lb.hidden) {
        // Lightbox not open — open first gallery image
        openAt(0);
        return;
      }
      var cur = currentLbIndex();
      // The lightbox counter counts from hero (idx 0), gallery images start after hero
      // Find the "next" button and click it, or loop around
      var btnNext = lb.querySelector('[data-lb-next]');
      if (btnNext && btnNext.offsetParent !== null) {
        btnNext.click();
      } else {
        // We're at the last image — loop to first gallery
        stop();
      }
    }

    function start() {
      if (playing) return;
      playing = true;
      btn.classList.add('is-playing');
      btn.innerHTML = pauseIcon;
      // Open lightbox on first gallery image if not open
      var lb = document.getElementById('lightbox');
      if (!lb || lb.hidden) openAt(0);
      timer = setInterval(advance, INTERVAL);
    }

    function stop() {
      playing = false;
      btn.classList.remove('is-playing');
      btn.innerHTML = playIcon;
      if (timer) { clearInterval(timer); timer = null; }
    }

    btn.addEventListener('click', function () {
      if (playing) stop(); else start();
    });

    // Pause on any lightbox user interaction
    document.addEventListener('keydown', function (e) {
      if (!playing) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') stop();
    });
    document.addEventListener('click', function (e) {
      if (!playing) return;
      var lb = document.getElementById('lightbox');
      if (!lb) return;
      // If user clicked prev/next/close in lightbox, pause slideshow
      if (e.target.closest('[data-lb-prev]') || e.target.closest('[data-lb-next]') || e.target.closest('[data-lb-close]')) {
        stop();
      }
    });
    // Pause when lightbox closes
    var lbEl = document.getElementById('lightbox');
    if (lbEl) {
      var lbObs = new MutationObserver(function () {
        if (lbEl.hidden && playing) stop();
      });
      lbObs.observe(lbEl, { attributes: true, attributeFilter: ['hidden'] });
    }
  })();

  // =========================================================================
  // HOMEPAGE HERO COUNTER — count-up animation for the hero stats on index.
  //     Numbers animate from 0 to target on page load for a premium editorial
  //     feel. Respects prefers-reduced-motion.
  // =========================================================================
  (function heroCountUp() {
    var stats = Array.prototype.slice.call(document.querySelectorAll('[data-hero-num]'));
    if (!stats.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var animated = false;
    function animate() {
      if (animated) return;
      animated = true;
      stats.forEach(function (el) {
        var target = parseInt(el.getAttribute('data-hero-num'), 10);
        if (!target || target <= 0) return;
        var original = el.textContent;
        var duration = 700;
        var start = null;
        el.classList.add('is-counting');

        function step(ts) {
          if (!start) start = ts;
          var progress = Math.min((ts - start) / duration, 1);
          var ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          el.textContent = Math.round(target * ease);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = original; // restore exact
            el.classList.remove('is-counting');
          }
        }
        requestAnimationFrame(step);
      });
    }

    // Animate when hero scrolls into view (or immediately if visible)
    var hero = document.querySelector('.home-hero') || document.querySelector('.hero-head');
    if (!hero) { animate(); return; }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { animate(); observer.disconnect(); }
        });
      }, { threshold: 0.3 });
      observer.observe(hero);
    } else {
      animate();
    }
  })();


  // =========================================================================
  // LIFESTYLE QUIZ — "Find Your Airstream" recommendation wizard.
  //     Reads explore-card data-* attributes to score & rank all floorplans
  //     against the user's stated preferences. Pure client-side.
  // =========================================================================
  (function lifestyleQuiz() {
    var overlay = document.getElementById('quiz');
    if (!overlay) return;
    var openBtn = document.getElementById('quiz-open');
    var backBtn = document.getElementById('quiz-back');
    var fillBar = document.getElementById('quiz-fill');
    var stepsEl = document.getElementById('quiz-steps');
    var matchesEl = document.getElementById('quiz-matches');
    var criteriaEl = document.getElementById('quiz-criteria');
    var savedFocus = null;
    var currentStep = 1;
    var answers = {};

    function open() {
      savedFocus = document.activeElement;
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      reset();
      overlay.querySelector('.quiz-close').focus();
    }
    function close() {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (savedFocus) savedFocus.focus();
    }
    function reset() {
      currentStep = 1;
      answers = {};
      showStep(1);
      // Clear selected states
      var opts = overlay.querySelectorAll('.quiz-opt');
      for (var i = 0; i < opts.length; i++) opts[i].classList.remove('is-selected');
    }
    function showStep(n) {
      currentStep = n;
      var steps = stepsEl.querySelectorAll('.quiz-step');
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        var stepVal = s.getAttribute('data-step');
        s.classList.toggle('is-active', stepVal === String(n) || (n === 5 && stepVal === 'results'));
      }
      fillBar.style.width = (n === 5 ? 100 : (n * 25)) + '%';
      backBtn.hidden = (n <= 1);
    }

    function advance(key, val) {
      answers[key] = val;
      if (currentStep < 4) {
        showStep(currentStep + 1);
      } else {
        showResults();
      }
    }

    function scoreTrailers() {
      var cards = document.querySelectorAll('.xcard[data-type="trailer"]');
      var results = [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c.getAttribute('data-year') !== '2026') continue;
        var msrp = parseInt(c.getAttribute('data-msrp'), 10) || 0;
        var weight = parseInt(c.getAttribute('data-weight'), 10) || 0;
        var gvwr = parseInt(c.getAttribute('data-gvwr'), 10) || 0;
        var length = parseFloat(c.getAttribute('data-length')) || 0;
        var sleeps = parseInt(c.getAttribute('data-sleeps'), 10) || 0;
        var offgrid = parseInt(c.getAttribute('data-offgrid'), 10) || 0;
        var ccc = parseInt(c.getAttribute('data-ccc'), 10) || 0;
        var fresh = parseInt(c.getAttribute('data-fresh'), 10) || 0;
        var slug = c.getAttribute('data-slug');
        var model = c.getAttribute('data-model');
        var floorplan = c.getAttribute('data-floorplan') || '';
        var thumb = c.getAttribute('data-thumb') || '';
        var tags = (c.getAttribute('data-tags') || '').split(' ');
        var score = 0;
        var reasons = [];

        // Group size scoring
        var g = answers.group;
        if (g === 'solo') {
          if (sleeps <= 3) { score += 20; reasons.push('Right-sized for 1–2'); }
          else if (sleeps <= 4) score += 10;
          else score -= 5;
        } else if (g === 'small') {
          if (sleeps >= 3 && sleeps <= 5) { score += 20; reasons.push('Sleeps your crew of 3–4'); }
          else if (sleeps >= 2) score += 5;
        } else if (g === 'large') {
          if (sleeps >= 6) { score += 25; reasons.push('Sleeps ' + sleeps + ' — room for everyone'); }
          else if (sleeps >= 5) { score += 10; reasons.push('Sleeps ' + sleeps); }
        }

        // Budget scoring
        var b = parseInt(answers.budget, 10);
        if (b === 80000) {
          if (msrp <= 80000) { score += 20; reasons.push('Under $80k'); }
          else if (msrp <= 100000) score += 5;
          else score -= 15;
        } else if (b === 120000) {
          if (msrp > 80000 && msrp <= 120000) { score += 20; reasons.push('In your $80–120k range'); }
          else if (msrp <= 80000) { score += 10; reasons.push('Under budget'); }
          else if (msrp <= 140000) score += 5;
          else score -= 10;
        } else if (b === 180000) {
          if (msrp > 120000 && msrp <= 180000) { score += 20; reasons.push('In your $120–180k range'); }
          else if (msrp <= 120000) { score += 10; reasons.push('Under budget'); }
          else score -= 10;
        } else {
          if (msrp > 180000) { score += 20; reasons.push('Flagship tier'); }
          else if (msrp > 120000) score += 10;
        }

        // Travel style
        var st = answers.style;
        if (st === 'weekend') {
          if (weight < 5000) { score += 15; reasons.push('Light — easy weekend hookup'); }
          else if (weight < 6500) score += 5;
        } else if (st === 'extended') {
          if (fresh >= 30 && ccc >= 800) { score += 15; reasons.push('Big tanks + cargo for the road'); }
          else if (fresh >= 20) score += 5;
        } else if (st === 'offgrid') {
          if (offgrid >= 60) { score += 20; reasons.push('Off-grid score ' + offgrid + '/100'); }
          else if (offgrid >= 40) { score += 10; reasons.push('Off-grid ' + offgrid + '/100'); }
          if (tags.indexOf('off-grid') >= 0) score += 5;
        } else if (st === 'fulltime') {
          if (length >= 28 && sleeps >= 4) { score += 15; reasons.push('Full-size living space'); }
          else if (length >= 23) score += 5;
          if (ccc >= 1000) { score += 5; reasons.push('Generous cargo capacity'); }
        }

        // Priority
        var p = answers.priority;
        if (p === 'tow') {
          if (weight <= 4000) { score += 20; reasons.push('Under 4,000 lb dry'); }
          else if (weight <= 5500) { score += 10; reasons.push(weight.toLocaleString() + ' lb dry'); }
          score += Math.max(0, 10 - Math.floor(length / 3));
        } else if (p === 'space') {
          if (length >= 30) { score += 20; reasons.push(Math.floor(length) + "' of living space"); }
          else if (length >= 25) { score += 10; reasons.push(Math.floor(length) + "' long"); }
          if (sleeps >= 6) score += 5;
        } else if (p === 'offgrid') {
          if (offgrid >= 65) { score += 20; reasons.push('Top-tier off-grid'); }
          else if (offgrid >= 45) score += 10;
        } else if (p === 'value') {
          // Value = most features per dollar (sleeps * offgrid / msrp proxy)
          var valueScore = (sleeps * (offgrid || 30) * ccc) / (msrp || 100000);
          if (valueScore > 1.5) { score += 20; reasons.push('Outstanding value'); }
          else if (valueScore > 0.8) { score += 10; reasons.push('Strong value'); }
        }

        if (score > 0) {
          results.push({
            slug: slug, model: model, floorplan: floorplan, thumb: thumb,
            msrp: msrp, weight: weight, sleeps: sleeps, offgrid: offgrid,
            length: length, score: score, reasons: reasons,
            type: c.getAttribute('data-type') || 'trailer'
          });
        }
      }
      results.sort(function (a, b) { return b.score - a.score; });
      return results.slice(0, 5);
    }

    function fmtMoney(n) {
      return n > 0 ? '$' + Number(n).toLocaleString('en-US') : '—';
    }

    function showResults() {
      var matches = scoreTrailers();
      var criteriaText = [];
      if (answers.group === 'solo') criteriaText.push('1–2 people');
      else if (answers.group === 'small') criteriaText.push('3–4 people');
      else criteriaText.push('5+ people');
      var bv = parseInt(answers.budget, 10);
      if (bv === 80000) criteriaText.push('under $80k');
      else if (bv === 120000) criteriaText.push('$80–120k');
      else if (bv === 180000) criteriaText.push('$120–180k');
      else criteriaText.push('$180k+');
      criteriaText.push(answers.style === 'offgrid' ? 'off-grid' : answers.style);
      criteriaText.push('priority: ' + answers.priority);
      criteriaEl.textContent = 'Based on: ' + criteriaText.join(' · ');

      if (matches.length === 0) {
        matchesEl.innerHTML = '<p class="quiz-no-match">No perfect matches — try adjusting your answers or <a href="#all" data-view-go="all">explore all floorplans</a>.</p>';
      } else {
        matchesEl.innerHTML = matches.map(function (m, idx) {
          var prefix = m.type === 'motorhome' ? 'mm/' : 'm/';
          var reasons = m.reasons.slice(0, 3).map(function (r) {
            return '<span class="quiz-reason">' + r + '</span>';
          }).join('');
          var wholeFt = Math.floor(m.length);
          var inch = Math.round((m.length - wholeFt) * 12);
          var lenStr = inch ? wholeFt + "\'" + inch + '\"' : wholeFt + "\'";
          return '<a class="quiz-match" href="' + prefix + m.slug + '.html">' +
            '<div class="quiz-match-rank">' + (idx + 1) + '</div>' +
            (m.thumb ? '<img class="quiz-match-img" src="' + m.thumb + '" alt="' + m.model + ' ' + m.floorplan + '" loading="lazy" width="200" height="130">' : '') +
            '<div class="quiz-match-info">' +
            '<h3 class="quiz-match-title">' + m.model + ' ' + m.floorplan + '</h3>' +
            '<p class="quiz-match-specs">' + fmtMoney(m.msrp) + ' \u00B7 ' + lenStr + ' \u00B7 sleeps ' + m.sleeps + ' \u00B7 off-grid ' + m.offgrid + '/100</p>' +
            '<div class="quiz-match-reasons">' + reasons + '</div>' +
            '</div></a>';
        }).join('');
      }
      showStep(5);
    }

    // Event wiring
    if (openBtn) openBtn.addEventListener('click', open);

    // Close buttons
    var closeEls = overlay.querySelectorAll('[data-quiz-close]');
    for (var ci = 0; ci < closeEls.length; ci++) {
      closeEls[ci].addEventListener('click', close);
    }

    // Escape key
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); e.stopPropagation(); }
    });

    // Option selection
    stepsEl.addEventListener('click', function (e) {
      var opt = e.target.closest('.quiz-opt');
      if (!opt) return;
      var step = opt.closest('.quiz-step');
      var siblings = step.querySelectorAll('.quiz-opt');
      for (var si = 0; si < siblings.length; si++) siblings[si].classList.remove('is-selected');
      opt.classList.add('is-selected');
      setTimeout(function () { advance(opt.getAttribute('data-key'), opt.getAttribute('data-val')); }, 250);
    });

    // Back button
    backBtn.addEventListener('click', function () {
      if (currentStep > 1) showStep(currentStep - 1);
    });

    // Restart + explore buttons
    var restartBtn = document.getElementById('quiz-restart');
    var exploreBtn = document.getElementById('quiz-explore');
    if (restartBtn) restartBtn.addEventListener('click', reset);
    if (exploreBtn) exploreBtn.addEventListener('click', function () {
      close();
      var allLink = document.querySelector('[data-view-go="all"]');
      if (allLink) allLink.click();
    });
  })();

  // =========================================================================
  // COST PER NIGHT CALCULATOR — interactive camping vs hotel comparison.
  //     Guarded by #cn-trips (only present on detail pages with MSRP).
  // =========================================================================
  (function costPerNight() {
    var tripsEl = document.getElementById('cn-trips');
    if (!tripsEl) return;
    var nightsEl = document.getElementById('cn-nights');
    var hotelEl = document.getElementById('cn-hotel');
    var campFeeEl = document.getElementById('cn-camp-fee');
    var tripsVal = document.getElementById('cn-trips-val');
    var nightsVal = document.getElementById('cn-nights-val');
    var hotelVal = document.getElementById('cn-hotel-val');
    var campFeeValEl = document.getElementById('cn-camp-fee-val');
    var costEl = document.getElementById('cn-cost');
    var hotelCostEl = document.getElementById('cn-hotel-cost');
    var totalNightsEl = document.getElementById('cn-total-nights');
    var hotelYearEl = document.getElementById('cn-hotel-year');
    var verdictEl = document.getElementById('cn-verdict');
    var section = tripsEl.closest('.cost-night');
    var annualOwn = parseInt(section.getAttribute('data-annual-own'), 10) || 0;
    var feePresets = Array.prototype.slice.call(document.querySelectorAll('.cn-fee-preset'));

    function fmtMoney(n) { return '$' + Number(n).toLocaleString('en-US'); }

    function update() {
      var trips = parseInt(tripsEl.value, 10) || 1;
      var nights = parseInt(nightsEl.value, 10) || 1;
      var hotel = parseInt(hotelEl.value, 10) || 150;
      var campFee = campFeeEl ? parseInt(campFeeEl.value, 10) || 0 : 0;
      var totalNights = trips * nights;
      var campFeeYear = campFee * totalNights;
      var totalAnnual = annualOwn + campFeeYear;
      var costNight = totalNights > 0 ? Math.round(totalAnnual / totalNights) : 0;
      var hotelYear = hotel * totalNights;
      var savings = hotelYear - totalAnnual;

      tripsVal.textContent = trips + ' trip' + (trips > 1 ? 's' : '');
      nightsVal.textContent = nights + ' night' + (nights > 1 ? 's' : '');
      hotelVal.textContent = '$' + hotel + '/night';
      if (campFeeValEl) campFeeValEl.textContent = '$' + campFee + '/night';
      costEl.textContent = '$' + costNight;
      hotelCostEl.textContent = '$' + hotel;
      totalNightsEl.textContent = totalNights + ' nights/year';
      hotelYearEl.textContent = fmtMoney(hotelYear) + '/year';

      // Update preset active states
      feePresets.forEach(function (btn) {
        var val = parseInt(btn.getAttribute('data-fee'), 10);
        if (val === campFee) btn.classList.add('is-active');
        else btn.classList.remove('is-active');
      });

      if (savings > 0) {
        verdictEl.className = 'cn-verdict cn-verdict--saves';
        verdictEl.innerHTML = 'You save about <strong>' + fmtMoney(savings) + '/year</strong> vs hotel stays at this frequency.';
      } else {
        verdictEl.className = 'cn-verdict cn-verdict--over';
        verdictEl.textContent = 'At this frequency, hotel stays cost about the same. Camp more to tip the balance.';
      }
    }

    tripsEl.addEventListener('input', update);
    nightsEl.addEventListener('input', update);
    hotelEl.addEventListener('input', update);
    if (campFeeEl) campFeeEl.addEventListener('input', update);
    // Campground fee preset buttons
    feePresets.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fee = parseInt(btn.getAttribute('data-fee'), 10);
        if (campFeeEl) { campFeeEl.value = fee; }
        update();
      });
    });
  })();

  // =========================================================================
  // RESALE VALUE PROJECTOR — live updates when condition changes.
  // =========================================================================
  (function resaleProjector() {
    var condEl = document.getElementById('resale-cond');
    if (!condEl) return;
    var section = condEl.closest('.resale-projector');
    var msrp = parseInt(section.getAttribute('data-msrp'), 10) || 0;
    if (!msrp) return;
    var chartEl = document.getElementById('resale-chart');
    var yr5El = document.getElementById('resale-5yr');
    var yr10El = document.getElementById('resale-10yr');

    var RATES = {
      excellent: { y1: 0.10, y2_5: 0.055, y6_10: 0.030 },
      good:      { y1: 0.12, y2_5: 0.070, y6_10: 0.040 },
      fair:      { y1: 0.15, y2_5: 0.085, y6_10: 0.055 },
    };
    var INDUSTRY = { y1: 0.22, y2_5: 0.12, y6_10: 0.08 };
    var MILESTONES = [0, 1, 3, 5, 7, 10];

    function fmtMoney(n) { return '$' + Number(n).toLocaleString('en-US'); }

    function project(cond) {
      var rates = RATES[cond] || RATES.good;
      var airstream = [], industry = [];
      for (var mi = 0; mi < MILESTONES.length; mi++) {
        var yr = MILESTONES[mi];
        var asVal = msrp, indVal = msrp;
        for (var y = 1; y <= yr; y++) {
          var asRate = y <= 1 ? rates.y1 : y <= 5 ? rates.y2_5 : rates.y6_10;
          var indRate = y <= 1 ? INDUSTRY.y1 : y <= 5 ? INDUSTRY.y2_5 : INDUSTRY.y6_10;
          asVal *= (1 - asRate);
          indVal *= (1 - indRate);
        }
        airstream.push({ year: yr, value: Math.round(asVal), pct: Math.round((asVal / msrp) * 100) });
        industry.push({ year: yr, value: Math.round(indVal), pct: Math.round((indVal / msrp) * 100) });
      }
      return { airstream: airstream, industry: industry };
    }

    function update() {
      var proj = project(condEl.value);
      // Rebuild the bars
      var html = '';
      for (var i = 0; i < MILESTONES.length; i++) {
        var a = proj.airstream[i], ind = proj.industry[i], yr = a.year;
        var label = yr === 0 ? 'New' : 'Yr ' + yr;
        html += '<div class="resale-col">' +
          '<div class="resale-bars">' +
          '<div class="resale-bar resale-bar--airstream" style="height:' + a.pct + '%"><span class="resale-bar-val">' + a.pct + '%</span></div>' +
          '<div class="resale-bar resale-bar--industry" style="height:' + ind.pct + '%"><span class="resale-bar-val">' + ind.pct + '%</span></div>' +
          '</div>' +
          '<span class="resale-label">' + label + '</span></div>';
      }
      chartEl.innerHTML = html;
      // Update highlights
      var a5 = proj.airstream[3], a10 = proj.airstream[5]; // index 3=year5, 5=year10
      var i5 = proj.industry[3], i10 = proj.industry[5];
      yr5El.textContent = fmtMoney(a5.value);
      yr5El.closest('.resale-hl').querySelector('.resale-hl-note').innerHTML = a5.pct + '% retained <span class="muted">(vs ' + i5.pct + '% typical)</span>';
      yr10El.textContent = fmtMoney(a10.value);
      yr10El.closest('.resale-hl').querySelector('.resale-hl-note').innerHTML = a10.pct + '% retained <span class="muted">(vs ' + i10.pct + '% typical)</span>';
    }

    condEl.addEventListener('change', update);
  })();

  // =========================================================================
  // TRIP COST ESTIMATOR — live updates when inputs change.
  // =========================================================================
  (function tripCostCalc() {
    var dataEl = document.getElementById('trip-cost-data');
    if (!dataEl) return;
    var data = JSON.parse(dataEl.textContent);
    var distEl = document.getElementById('trip-dist');
    var nightsEl = document.getElementById('trip-nights');
    var campEl = document.getElementById('trip-camp');
    var fuelPriceEl = document.getElementById('trip-fuel-price');
    var distVal = document.getElementById('trip-dist-val');
    var nightsVal = document.getElementById('trip-nights-val');
    var fuelPriceVal = document.getElementById('trip-fuel-price-val');
    var totalEl = document.getElementById('trip-total');
    var fuelDd = document.getElementById('trip-fuel-dd');
    var campDd = document.getElementById('trip-camp-dd');
    var propDd = document.getElementById('trip-propane-dd');
    var totDd = document.getElementById('trip-tot-dd');

    function fmtMoney(n) { return '$' + Number(n).toLocaleString('en-US'); }

    function update() {
      var dist = parseInt(distEl.value, 10) || 500;
      var nights = parseInt(nightsEl.value, 10) || 5;
      var campType = campEl.value;
      var fuelPrice = parseFloat(fuelPriceEl.value) || 3.50;

      var mpg = data.estMpg;
      var fuelGal = Math.ceil(dist / mpg);
      var fuelCost = Math.round(fuelGal * fuelPrice);
      var campRate = data.presets[campType] ? data.presets[campType].perNight : 30;
      var campCost = nights * campRate;
      var propaneCost = Math.round(nights * 3);
      var total = fuelCost + campCost + propaneCost;

      distVal.textContent = dist + ' mi';
      nightsVal.textContent = nights + ' night' + (nights > 1 ? 's' : '');
      fuelPriceVal.textContent = '$' + fuelPrice.toFixed(2) + '/gal';
      totalEl.textContent = fmtMoney(total);
      fuelDd.textContent = fmtMoney(fuelCost);
      campDd.textContent = fmtMoney(campCost);
      propDd.textContent = fmtMoney(propaneCost);
      totDd.textContent = fmtMoney(total);

      // Update fuel row label
      fuelDd.closest('.finance-dl-row').querySelector('dt').textContent = 'Fuel (~' + fuelGal + ' gal at $' + fuelPrice.toFixed(2) + ')';
      campDd.closest('.finance-dl-row').querySelector('dt').textContent = 'Campground (' + nights + ' nights)';
    }

    distEl.addEventListener('input', update);
    nightsEl.addEventListener('input', update);
    campEl.addEventListener('change', update);
    fuelPriceEl.addEventListener('input', update);
  })();

  // =========================================================================
  // WEIGHT BAR ANIMATION — scroll-driven fill effect on detail pages.
  //     The weight bar segments animate from 0% to their real width, and
  //     the GVWR label counts up, when the bar scrolls into view.
  // =========================================================================
  (function weightBarAnim() {
    var bar = document.querySelector('.weight-bar');
    if (!bar || !('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var dry = bar.querySelector('.weight-bar-dry');
    var ccc = bar.querySelector('.weight-bar-ccc');
    if (!dry || !ccc) return;
    var dryTarget = dry.style.width;
    var cccTarget = ccc.style.width;
    // Start collapsed
    dry.style.width = '0%';
    ccc.style.width = '0%';
    dry.style.transition = 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
    ccc.style.transition = 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s';

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          dry.style.width = dryTarget;
          ccc.style.width = cccTarget;
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });
    observer.observe(bar);
  })();

  // =========================================================================
  // HERO PARALLAX — subtle depth effect on the detail-page hero image.
  //     As the user scrolls past, the hero image shifts slightly slower,
  //     creating a cinematic editorial feel. Respects prefers-reduced-motion.
  //     Performance: uses requestAnimationFrame, only active while hero is
  //     in viewport, and uses CSS transform (GPU-composited, no reflow).
  // =========================================================================

  // =========================================================================
  // 9f. SCROLL REVEAL — sections on detail pages fade+slide up as they enter
  //     the viewport. CLS-safe: elements keep their natural height, only
  //     opacity and transform change. Respects prefers-reduced-motion via CSS.
  // =========================================================================
  (function scrollReveal() {
    var detail = document.querySelector('.detail');
    if (!detail) return;
    var sections = Array.prototype.slice.call(detail.querySelectorAll(
      ':scope > section, :scope > .weight-bar, :scope > .weight-budget, ' +
      ':scope > .weight-context, :scope > .tow-callout, :scope > .detail-overview, ' +
      ':scope > .proscons, :scope > .cross-family'
    ));
    if (!sections.length) return;
    if (typeof IntersectionObserver === 'undefined') {
      sections.forEach(function (s) { s.classList.add('reveal-section', 'is-revealed'); });
      return;
    }
    sections.forEach(function (s) { s.classList.add('reveal-section'); });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    sections.forEach(function (s) { observer.observe(s); });
  })();

  (function heroParallax() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var hero = document.querySelector('.detail-hero');
    if (!hero) return;
    var img = hero.querySelector('img');
    if (!img) return;
    var ticking = false;
    var isVisible = true;
    var FACTOR = 0.15; // how much the image lags (0 = no effect, 1 = fixed)

    function update() {
      if (!isVisible) { ticking = false; return; }
      var rect = hero.getBoundingClientRect();
      var viewH = window.innerHeight || document.documentElement.clientHeight;
      // progress: 0 = hero at bottom of viewport, 1 = hero at top
      var progress = 1 - (rect.top + rect.height) / (viewH + rect.height);
      progress = Math.max(0, Math.min(1, progress));
      var shift = (progress - 0.5) * rect.height * FACTOR;
      img.style.transform = 'translateY(' + shift.toFixed(1) + 'px) scale(1.06)';
      ticking = false;
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    // Only run parallax while hero is near viewport
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        isVisible = entries[0].isIntersecting;
        if (isVisible) onScroll();
      }, { rootMargin: '100px 0px' });
      obs.observe(hero);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial position
  })();

  // =========================================================================
  // GALLERY HOVER ZOOM — subtle scale-up on gallery images before lightbox.
  //     CSS-driven via class, this just ensures the interaction feels alive.
  // =========================================================================
  (function galleryHoverZoom() {
    var grid = document.querySelector('.gallery-grid');
    if (!grid) return;
    var btns = grid.querySelectorAll('.gallery-img-wrap');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.add('gallery-hoverable');
    }
  })();

  // -----------------------------------------------------------------------
  // Scroll-spy: highlight the current section in the sticky section nav
  // -----------------------------------------------------------------------
  (function scrollSpy() {
    var nav = document.querySelector('[data-secnav]');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('.secnav-link'));
    if (links.length < 2) return;

    // Build id→link map from href="#id"
    var sections = [];
    links.forEach(function (link) {
      var hash = link.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#') return;
      var el = document.getElementById(hash.slice(1));
      if (el) sections.push({ el: el, link: link });
    });
    if (sections.length < 2) return;

    var activeLink = null;
    function setActive(link) {
      if (link === activeLink) return;
      if (activeLink) activeLink.classList.remove('is-active');
      if (link) link.classList.add('is-active');
      activeLink = link;
    }

    // Use IntersectionObserver to track which sections are visible.
    // The topmost visible section wins.
    var visibleSet = new Set();
    var navHeight = nav.offsetHeight || 60;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.id;
        if (entry.isIntersecting) visibleSet.add(id);
        else visibleSet.delete(id);
      });
      // Pick the first section (in DOM order) that's visible
      for (var i = 0; i < sections.length; i++) {
        if (visibleSet.has(sections[i].el.id)) {
          setActive(sections[i].link);
          return;
        }
      }
      // Nothing visible — clear
      setActive(null);
    }, {
      rootMargin: '-' + (navHeight + 20) + 'px 0px -40% 0px',
      threshold: 0
    });

    sections.forEach(function (s) { observer.observe(s.el); });
  })();

  // =========================================================================
  // RECENTLY VIEWED — track detail page visits in localStorage and populate
  //     the "Recently Viewed" section on the Saved page.
  // =========================================================================
  (function recentlyViewed() {
    var MAX = 12;
    var KEY = 'recent';

    function read() {
      try {
        var v = JSON.parse(localStorage.getItem('ae:' + KEY) || '[]');
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    }
    function write(list) {
      try { localStorage.setItem('ae:' + KEY, JSON.stringify(list)); } catch (e) {}
    }

    // On detail pages: record the visit
    var detail = document.querySelector('article.detail');
    if (detail) {
      var canonical = detail.getAttribute('data-canonical') || '';
      // Extract slug from canonical path (m/slug.html)
      var m = canonical.match(/^m\/(.+)\.html$/);
      if (m) {
        var slug = m[1];
        var list = read().filter(function (x) { return x.slug !== slug; });
        list.unshift({ slug: slug, type: 'trailer', at: Date.now() });
        if (list.length > MAX) list = list.slice(0, MAX);
        write(list);
      }
    }

    // On motorhome detail pages
    var mhDetail = document.querySelector('article.mh-detail');
    if (mhDetail) {
      var mhCanonical = mhDetail.getAttribute('data-canonical') || '';
      var mm = mhCanonical.match(/^mm\/(.+)\.html$/);
      if (mm) {
        var mhSlug = mm[1];
        var mhList = read().filter(function (x) { return x.slug !== mhSlug; });
        mhList.unshift({ slug: mhSlug, type: 'motorhome', at: Date.now() });
        if (mhList.length > MAX) mhList = mhList.slice(0, MAX);
        write(mhList);
      }
    }

    // On Saved page: render the recently viewed section
    var recentGrid = document.getElementById('recent-grid');
    var recentSection = document.getElementById('recent-section');
    var recentClear = document.getElementById('recent-clear');
    if (!recentGrid || !recentSection) return;

    var dataEl = document.getElementById('saved-data');
    var catalog = {};
    if (dataEl) { try { catalog = JSON.parse(dataEl.textContent || '{}'); } catch (e) {} }

    function render() {
      var items = read();
      if (items.length === 0) {
        recentSection.setAttribute('hidden', '');
        return;
      }
      recentSection.removeAttribute('hidden');
      var html = '';
      for (var i = 0; i < items.length; i++) {
        var entry = items[i];
        var info = catalog[entry.slug];
        if (!info) continue;
        var dir = info.type === 'motorhome' ? 'mm' : 'm';
        html += '<a class="recent-card" href="' + dir + '/' + entry.slug + '.html">'
          + (info.thumb ? '<img class="recent-card-thumb" src="' + info.thumb + '" alt="" loading="lazy" width="56" height="38">' : '')
          + '<span class="recent-card-info"><span class="recent-card-model">' + info.model + ' ' + info.floorplan + '</span>'
          + '<span class="recent-card-year">' + info.year + '</span></span></a>';
      }
      recentGrid.innerHTML = html;
      if (!html) recentSection.setAttribute('hidden', '');
    }

    if (recentClear) {
      recentClear.addEventListener('click', function () {
        write([]);
        render();
      });
    }

    render();

    // Home page: render a compact horizontal strip of recently viewed trailers.
    // We use the explore card grid's data-* attributes as our catalog source
    // (no additional JSON needed — all pages embed the full card grid).
    var homeRecentGrid = document.getElementById('home-recent-grid');
    var homeRecentSection = document.getElementById('home-recent');
    var homeRecentClear = document.getElementById('home-recent-clear');
    if (homeRecentGrid && homeRecentSection) {
      // Build a mini catalog from all explore cards on the page
      var homeCatalog = {};
      var xcards = document.querySelectorAll('.xcard');
      for (var ci = 0; ci < xcards.length; ci++) {
        var xc = xcards[ci];
        homeCatalog[xc.getAttribute('data-slug')] = {
          model: xc.getAttribute('data-model') || '',
          floorplan: xc.getAttribute('data-floorplan') || '',
          year: xc.getAttribute('data-year') || '',
          type: xc.getAttribute('data-type') || 'trailer',
          thumb: xc.getAttribute('data-thumb') || '',
          msrp: xc.getAttribute('data-msrp') || ''
        };
      }
      function renderHome() {
        var items = read();
        if (items.length === 0) { homeRecentSection.setAttribute('hidden', ''); return; }
        homeRecentSection.removeAttribute('hidden');
        var html = '';
        var shown = 0;
        for (var hi = 0; hi < items.length && shown < 6; hi++) {
          var he = items[hi];
          var hinfo = homeCatalog[he.slug];
          if (!hinfo) continue;
          var hdir = hinfo.type === 'motorhome' ? 'mm' : 'm';
          html += '<a class="home-recent-card" href="' + hdir + '/' + he.slug + '.html">'
            + (hinfo.thumb ? '<img class="home-recent-thumb" src="' + hinfo.thumb + '" alt="" loading="lazy" width="120" height="78">' : '')
            + '<span class="home-recent-info"><span class="home-recent-model">' + hinfo.model + ' ' + hinfo.floorplan + '</span>'
            + '<span class="home-recent-year">' + hinfo.year + '</span></span></a>';
          shown++;
        }
        homeRecentGrid.innerHTML = html;
        if (!html) homeRecentSection.setAttribute('hidden', '');
      }
      if (homeRecentClear) {
        homeRecentClear.addEventListener('click', function () { write([]); renderHome(); });
      }
      renderHome();
    }
  })();

  // =========================================================================
  // EXPLORE: Grid/List layout toggle — switch between card grid and compact
  //     list view. Persists the choice in localStorage.
  // =========================================================================
  (function layoutToggle() {
    var layoutWrap = document.getElementById('x-layout');
    var grid = document.getElementById('xgrid');
    if (!layoutWrap || !grid) return;

    var btns = Array.prototype.slice.call(layoutWrap.querySelectorAll('[data-layout]'));
    if (!btns.length) return;

    function apply(layout) {
      if (layout === 'list') {
        grid.classList.add('is-list');
      } else {
        grid.classList.remove('is-list');
      }
      btns.forEach(function (b) {
        var on = b.getAttribute('data-layout') === layout;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      try { localStorage.setItem('ae:layout', layout); } catch (e) {}
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-layout'));
      });
    });

    // Restore saved preference
    var saved = null;
    try { saved = localStorage.getItem('ae:layout'); } catch (e) {}
    if (saved === 'list' || saved === 'grid') apply(saved);
  })();

  // =========================================================================
  // SCROLL TO TOP — floating button that appears after scrolling down.
  //     Guarded by #scroll-top.
  // =========================================================================
  (function scrollToTop() {
    var btn = document.getElementById('scroll-top');
    if (!btn) return;
    var threshold = 600;
    var visible = false;
    var ticking = false;

    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var shouldShow = y > threshold;
      if (shouldShow !== visible) {
        visible = shouldShow;
        btn.removeAttribute('hidden');
        if (visible) {
          btn.classList.add('is-visible');
        } else {
          btn.classList.remove('is-visible');
        }
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Initial check
    update();
  })();

  // =========================================================================
  // TOUCH SWIPE NAVIGATION — detail pages: swipe left/right to navigate to
  //     the previous/next floorplan. Reads data-prev-href / data-next-href
  //     from the <article.detail> element (baked by the renderer). Shows a
  //     subtle directional hint during the swipe. Respects reduced-motion.
  //     Guarded by .detail[data-prev-href], .detail[data-next-href].
  // =========================================================================
  (function swipeNav() {
    var article = document.querySelector('.detail[data-prev-href], .detail[data-next-href]');
    if (!article) return;
    // Skip on non-touch or reduced-motion
    if (!('ontouchstart' in window)) return;
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var prevHref = article.getAttribute('data-prev-href');
    var nextHref = article.getAttribute('data-next-href');
    if (!prevHref && !nextHref) return;

    var startX = 0, startY = 0, tracking = false;
    var THRESHOLD = 80; // min px to trigger
    var VERTICAL_LOCK = 35; // degrees — beyond this it's a vertical scroll

    // Create hint elements
    var hintPrev = null, hintNext = null;
    if (prevHref) {
      hintPrev = document.createElement('div');
      hintPrev.className = 'swipe-hint swipe-hint--prev';
      hintPrev.textContent = '← Previous';
      hintPrev.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hintPrev);
    }
    if (nextHref) {
      hintNext = document.createElement('div');
      hintNext.className = 'swipe-hint swipe-hint--next';
      hintNext.textContent = 'Next →';
      hintNext.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hintNext);
    }

    function clearHints() {
      if (hintPrev) hintPrev.classList.remove('is-visible');
      if (hintNext) hintNext.classList.remove('is-visible');
    }

    article.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    article.addEventListener('touchmove', function (e) {
      if (!tracking || e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      var angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      // If swiping more vertically, abort
      if (angle > VERTICAL_LOCK && angle < (180 - VERTICAL_LOCK)) {
        tracking = false;
        clearHints();
        return;
      }
      if (Math.abs(dx) > THRESHOLD / 2) {
        if (dx > 0 && prevHref) {
          if (hintPrev) hintPrev.classList.add('is-visible');
          if (hintNext) hintNext.classList.remove('is-visible');
        } else if (dx < 0 && nextHref) {
          if (hintNext) hintNext.classList.add('is-visible');
          if (hintPrev) hintPrev.classList.remove('is-visible');
        }
      } else {
        clearHints();
      }
    }, { passive: true });

    article.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      clearHints();
      var touch = e.changedTouches[0];
      if (!touch) return;
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      var angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      if (angle > VERTICAL_LOCK && angle < (180 - VERTICAL_LOCK)) return;
      if (Math.abs(dx) < THRESHOLD) return;
      if (prefersReduced) return;
      if (dx > 0 && prevHref) {
        window.location.href = prevHref;
      } else if (dx < 0 && nextHref) {
        window.location.href = nextHref;
      }
    }, { passive: true });

    article.addEventListener('touchcancel', function () {
      tracking = false;
      clearHints();
    }, { passive: true });
  })();

  // =========================================================================
  // SECTION DEEP LINKS — detail pages: sync the URL hash with the active
  //     section as the user scrolls (via scroll-spy), and on page load scroll
  //     to the hash target section. Enables shareable deep links like
  //     /m/classic-33fb-2026.html#gallery or #fuel.
  //     Guarded by [data-secnav] (section navigation bar).
  // =========================================================================
  (function sectionDeepLinks() {
    var nav = document.querySelector('[data-secnav]');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('.secnav-link'));
    if (links.length < 2) return;

    // Build section map
    var sections = [];
    links.forEach(function (link) {
      var hash = link.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#') return;
      var el = document.getElementById(hash.slice(1));
      if (el) sections.push({ id: hash.slice(1), el: el });
    });
    if (sections.length < 2) return;

    // 1. On load: scroll to hash target if present
    var initialHash = (location.hash || '').replace('#', '');
    if (initialHash) {
      var target = document.getElementById(initialHash);
      if (target) {
        // Wait for layout to settle, then scroll with offset
        requestAnimationFrame(function () {
          setTimeout(function () {
            var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
            var y = target.getBoundingClientRect().top + window.scrollY - navH - 16;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
          }, 100);
        });
      }
    }

    // 2. Update URL hash on scroll (debounced, replaceState so no history spam)
    var currentHash = initialHash;
    var hashTimer = null;

    // Use MutationObserver on the secnav links to detect is-active changes
    // (the scroll-spy module already manages is-active)
    var observer = new MutationObserver(function () {
      var active = nav.querySelector('.secnav-link.is-active');
      if (!active) return;
      var href = active.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var id = href.slice(1);
      if (id === currentHash) return;
      currentHash = id;
      if (hashTimer) clearTimeout(hashTimer);
      hashTimer = setTimeout(function () {
        try {
          history.replaceState(null, '', '#' + currentHash);
        } catch (e) {}
      }, 300);
    });

    observer.observe(nav, { attributes: true, attributeFilter: ['class'], subtree: true });
  })();

  // =========================================================================
  // PERSONAL NOTES — per-floorplan notes saved to localStorage.
  //     Auto-saves on input with debounce. Shows a "Saved" indicator.
  //     Reads/writes ae:notes:{slug} keys.
  // =========================================================================
  (function personalNotes() {
    var textarea = document.getElementById('notes-input');
    if (!textarea) return;
    var slug = textarea.getAttribute('data-slug');
    if (!slug) return;
    var statusEl = document.getElementById('notes-status');
    var KEY = 'ae:notes:' + slug;
    var timer = null;

    // Load existing note
    try {
      var saved = localStorage.getItem(KEY);
      if (saved) {
        textarea.value = saved;
        if (statusEl) statusEl.textContent = '';
      }
    } catch (e) {}

    function save() {
      try {
        var val = textarea.value.trim();
        if (val) {
          localStorage.setItem(KEY, val);
          if (statusEl) {
            statusEl.textContent = '✓ Saved';
            statusEl.className = 'notes-status notes-status--saved';
          }
        } else {
          localStorage.removeItem(KEY);
          if (statusEl) {
            statusEl.textContent = '';
            statusEl.className = 'notes-status';
          }
        }
      } catch (e) {}
    }

    textarea.addEventListener('input', function () {
      if (statusEl) {
        statusEl.textContent = 'Saving…';
        statusEl.className = 'notes-status notes-status--saving';
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 600);
    });

    // Save on blur immediately
    textarea.addEventListener('blur', function () {
      if (timer) { clearTimeout(timer); timer = null; }
      save();
    });
  })();

// ===========================================================================
  // =========================================================================
  // SECTION ANCHOR LINKS — adds a clickable # icon to detail-page section
  //     headings (any <h2> inside a section[id]). Clicking copies the
  //     permalink to the clipboard and shows a brief "Copied!" tooltip.
  //     Progressive enhancement: invisible without JS, no-op without
  //     clipboard API.
  // =========================================================================
  (function sectionAnchors() {
    var article = document.querySelector('.detail');
    if (!article) return;
    var sections = article.querySelectorAll('section[id] > h2, section[id] > .est-head > h2, section[id] > .collapsible-trigger');
    if (!sections.length) return;

    function showToast(anchor) {
      var tip = anchor.querySelector('.anchor-toast');
      if (!tip) return;
      tip.textContent = 'Copied!';
      tip.classList.add('is-visible');
      setTimeout(function () { tip.classList.remove('is-visible'); tip.textContent = ''; }, 1500);
    }

    Array.prototype.slice.call(sections).forEach(function (heading) {
      var section = heading.closest('section[id]');
      if (!section) return;
      var id = section.id;
      var anchor = document.createElement('a');
      anchor.href = '#' + id;
      anchor.className = 'section-anchor';
      anchor.setAttribute('aria-label', 'Copy link to this section');
      anchor.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg><span class="anchor-toast"></span>';
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        var url = location.origin + location.pathname + '#' + id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { showToast(anchor); });
        } else {
          // Fallback: update URL hash
          try { history.replaceState(null, '', '#' + id); } catch (ex) {}
        }
      });
      heading.appendChild(anchor);
    });
  })();

// ===========================================================================
// CSV CATALOG EXPORT — downloads the currently visible explore cards as a CSV.
// Reads data-* attributes already on each card element, so it reflects whatever
// filters + sort the user has applied. Standalone IIFE, no dependency on the
// main IIFE's scope.
// ===========================================================================
(function csvExport() {
  'use strict';
  var btn = document.getElementById('csv-export');
  if (!btn) return;

  var COLS = [
    { head: 'Model', attr: 'data-model' },
    { head: 'Floorplan', attr: 'data-floorplan' },
    { head: 'Year', attr: 'data-year' },
    { head: 'MSRP ($)', attr: 'data-msrp' },
    { head: 'Dry Weight (lb)', attr: 'data-weight' },
    { head: 'GVWR (lb)', attr: 'data-gvwr' },
    { head: 'Length (ft)', attr: 'data-length' },
    { head: 'Sleeps', attr: 'data-sleeps' },
    { head: 'Hitch Weight (lb)', attr: 'data-hitch' },
    { head: 'CCC (lb)', attr: 'data-ccc' },
    { head: 'Fresh Water (gal)', attr: 'data-fresh' },
    { head: 'Gray Water (gal)', attr: 'data-gray' },
    { head: 'Black Water (gal)', attr: 'data-black' },
    { head: 'Solar (W)', attr: 'data-solar' },
    { head: 'Off-Grid Score', attr: 'data-offgrid' },
    { head: 'Tags', attr: 'data-tags' },
  ];

  function esc(v) {
    if (v == null || v === '') return '';
    var s = String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  btn.addEventListener('click', function () {
    var grid = document.getElementById('xgrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.xcard:not([hidden])'));
    if (!cards.length) return;

    var rows = [COLS.map(function (c) { return c.head; }).join(',')];
    cards.forEach(function (card) {
      rows.push(COLS.map(function (c) {
        return esc(card.getAttribute(c.attr) || '');
      }).join(','));
    });

    var csv = rows.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'airstream-catalog.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  });
})();

  // =========================================================================
  // WATER AUTONOMY CALCULATOR — interactive tank-days estimator.
  //     Reads tank capacities from the section data-* attributes and lets
  //     the visitor adjust people count and usage level. Recalculates days
  //     until fresh runs out or waste fills up.
  //     Guarded by #water-autonomy.
  // =========================================================================
  (function waterAutonomyCalc() {
    var section = document.getElementById('water-autonomy');
    if (!section) return;

    var dataEl = document.getElementById('water-calc-data');
    if (!dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

    var freshGal = data.freshGal || 0;
    var grayGal  = data.grayGal  || 0;
    var blackGal = data.blackGal || 0;
    var combined = data.combined;
    var USAGE    = data.usage;

    var peopleSlider = document.getElementById('wc-people');
    var peopleVal    = document.getElementById('wc-people-val');
    var usageBtns    = Array.prototype.slice.call(section.querySelectorAll('.wc-usage-btn'));
    var totalDaysEl  = document.getElementById('wc-total-days');
    var limitNoteEl  = document.getElementById('wc-limit-note');
    var usageDetailEl = document.getElementById('wc-usage-detail');

    var state = { people: 2, usage: 'moderate' };

    function calcDays(gal, gpd, people) {
      if (!gal || gal <= 0 || gpd <= 0 || people <= 0) return null;
      return Math.round((gal / (gpd * people)) * 10) / 10;
    }

    function update() {
      var u = USAGE[state.usage] || USAGE.moderate;
      var p = state.people;

      var freshDays = calcDays(freshGal, u.freshGpd, p);
      var grayDays  = grayGal ? calcDays(grayGal, u.grayGpd, p) : null;
      var blackDays = blackGal ? calcDays(blackGal, u.blackGpd, p) : null;

      var allDays = [freshDays, grayDays, blackDays].filter(function(d) { return d != null && d > 0; });
      var minDays = allDays.length ? Math.min.apply(null, allDays) : null;
      var maxDays = allDays.length ? Math.max.apply(null, allDays) : 1;
      var limitLabel = minDays === freshDays ? 'fresh water' : minDays === grayDays ? 'gray tank' : 'waste tank';

      if (totalDaysEl) totalDaysEl.textContent = minDays != null ? minDays.toFixed(1) : '—';
      if (limitNoteEl) limitNoteEl.textContent = minDays != null ? 'Limited by ' + limitLabel : '';
      if (peopleVal) peopleVal.textContent = p + (p === 1 ? ' person' : ' people');
      if (usageDetailEl) {
        usageDetailEl.textContent = 'At ' + u.label.toLowerCase() + ' usage: ' +
          u.freshGpd + ' gal fresh / ' + u.grayGpd + ' gal gray / ' + u.blackGpd +
          ' gal black per person per day. ' + u.desc + '.';
      }

      // Update tank bars
      var tanks = [
        { cls: 'wc-fresh', days: freshDays },
        { cls: 'wc-gray',  days: grayDays },
        { cls: 'wc-black', days: blackDays },
      ];
      tanks.forEach(function(tank) {
        var dayEl = document.getElementById(tank.cls + '-days');
        var fillEl = dayEl ? dayEl.parentElement : null;
        if (!dayEl || !fillEl) return;
        dayEl.textContent = tank.days != null ? tank.days.toFixed(1) + ' days' : '—';
        var pct = tank.days && maxDays ? Math.min(100, (tank.days / maxDays) * 100) : 0;
        fillEl.style.width = Math.round(pct) + '%';
        if (tank.days === minDays) {
          fillEl.classList.add('wc-tank-fill--limiting');
        } else {
          fillEl.classList.remove('wc-tank-fill--limiting');
        }
        // Update limiting factor indicator
        var limitEl = fillEl.parentElement.parentElement.querySelector('.wc-tank-limit');
        if (limitEl) {
          if (tank.days === minDays) { limitEl.style.display = ''; }
          else { limitEl.style.display = 'none'; }
        }
      });
    }

    if (peopleSlider) {
      peopleSlider.addEventListener('input', function() {
        state.people = parseInt(peopleSlider.value, 10) || 2;
        update();
      });
    }
    usageBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.usage = btn.getAttribute('data-usage') || 'moderate';
        usageBtns.forEach(function(b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        update();
      });
    });
  })();

  // =========================================================================
  // PROPANE DURATION ESTIMATOR — interactive sliders recalculate how long LP
  //     gas will last based on per-appliance hours/day settings.
  // =========================================================================
  (function propaneEstimator() {
    var section = document.getElementById('propane');
    if (!section) return;
    var dataEl = document.getElementById('propane-data');
    if (!dataEl) return;
    var config;
    try { config = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var propaneLb = config.propaneLb || 40;
    var btuPerLb = config.btuPerLb || 21594;
    var totalBtu = propaneLb * btuPerLb;
    var appliances = config.appliances || {};

    var sliders = Array.prototype.slice.call(section.querySelectorAll('[data-prop-key]'));
    var daysEl = document.getElementById('prop-days');
    var dailyBtuEl = document.getElementById('prop-daily-btu');
    var dailyLbEl = document.getElementById('prop-daily-lb');

    function recalc() {
      var dailyBtu = 0;
      sliders.forEach(function (s) {
        var key = s.getAttribute('data-prop-key');
        var hrs = parseFloat(s.value) || 0;
        var profile = appliances[key];
        if (profile) dailyBtu += profile.btuPerHr * hrs;
        // Update label
        var label = document.getElementById('prop-' + key + '-val');
        if (label) {
          if (key === 'fridge') {
            label.textContent = hrs > 0 ? 'On (24 hr)' : 'Off / electric';
          } else {
            label.textContent = hrs + ' hr/day';
          }
        }
      });
      if (dailyBtu <= 0) {
        if (daysEl) daysEl.textContent = '∞';
        if (dailyBtuEl) dailyBtuEl.textContent = '0';
        if (dailyLbEl) dailyLbEl.textContent = '0.0';
      } else {
        var days = totalBtu / dailyBtu;
        var dailyLb = dailyBtu / btuPerLb;
        if (daysEl) daysEl.textContent = days.toFixed(1);
        if (dailyBtuEl) dailyBtuEl.textContent = Math.round(dailyBtu).toLocaleString('en-US');
        if (dailyLbEl) dailyLbEl.textContent = dailyLb.toFixed(1);
      }
    }

    sliders.forEach(function (s) {
      s.addEventListener('input', recalc);
    });
  })();

  // =========================================================================
  // ELECTRICAL LOAD PLANNER — checkbox toggles recalculate total wattage and
  //     visual breaker budget bar for shore power planning.
  // =========================================================================
  (function electricalPlanner() {
    var section = document.getElementById('electrical');
    if (!section) return;
    var dataEl = document.getElementById('elec-data');
    if (!dataEl) return;
    var config;
    try { config = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var maxWatts = config.maxWatts || 3600;
    var amps = config.amps || 30;

    var checks = Array.prototype.slice.call(section.querySelectorAll('.elec-check'));
    var fillEl = document.getElementById('elec-fill');
    var usedEl = document.getElementById('elec-used');
    var remainEl = document.getElementById('elec-remaining');
    var verdictEl = document.getElementById('elec-verdict');
    var resultEl = document.getElementById('elec-result');

    function recalc() {
      var total = 0;
      checks.forEach(function (c) {
        if (c.checked) total += parseInt(c.getAttribute('data-watts'), 10) || 0;
      });
      var pct = Math.min(100, Math.round((total / maxWatts) * 100));
      var remaining = maxWatts - total;

      if (fillEl) fillEl.style.width = pct + '%';
      if (usedEl) usedEl.textContent = total.toLocaleString() + 'W used';
      if (remainEl) remainEl.textContent = (remaining > 0 ? remaining.toLocaleString() : '0') + 'W available';
      if (resultEl) {
        resultEl.className = 'est-result ' + (pct > 95 ? 'elec-over' : pct > 75 ? 'elec-tight' : 'elec-ok');
      }
      if (verdictEl) {
        if (total > maxWatts) {
          verdictEl.textContent = '⚠ Over capacity by ' + (total - maxWatts).toLocaleString() + 'W — breaker will trip';
        } else if (pct > 95) {
          verdictEl.textContent = '⚠ At capacity — risk of tripped breaker';
        } else if (pct > 75) {
          verdictEl.textContent = '⚡ Getting tight — adding more could trip the breaker';
        } else {
          verdictEl.textContent = '✓ Comfortable headroom';
        }
      }
    }

    checks.forEach(function (c) {
      c.addEventListener('change', recalc);
    });
  })();

  // =========================================================================
  // GRADE CLIMBING CALCULATOR — interactive grade/mountain-pass towing tool.
  //     Slider adjusts grade %, pass buttons jump to real grades. Recalculates
  //     grade resistance, recommended speed, and severity rating. Uses same
  //     physics as the server render (GVWR × sin(arctan(grade/100))).
  // =========================================================================
  (function gradeClimb() {
    var section = document.getElementById('grade-climb');
    if (!section) return;
    var dataEl = document.getElementById('grade-climb-data');
    if (!dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

    var slider = document.getElementById('grade-pct');
    var sliderVal = document.getElementById('grade-pct-val');
    var passGrid = document.getElementById('grade-passes');
    var badgeEl = document.getElementById('grade-badge');
    var speedEl = document.getElementById('grade-speed');
    var forceEl = document.getElementById('grade-force-dd');
    var rollEl = document.getElementById('grade-roll-dd');
    var totalEl = document.getElementById('grade-total-dd');
    var tipEl = document.getElementById('grade-tip');
    if (!slider) return;

    var RATING = {
      moderate:    { label: 'Moderate',                    cls: 'grade-ok' },
      challenging: { label: 'Challenging',                 cls: 'grade-warn' },
      severe:      { label: 'Severe — use low gear',       cls: 'grade-severe' }
    };

    function calc(gradePct) {
      var theta = Math.atan(gradePct / 100);
      var gradeForce = Math.round(data.gvwrLb * Math.sin(theta));
      var rollResist = Math.round(data.gvwrLb * 0.015);
      var totalForce = gradeForce + rollResist;
      var maxSpeed = gradePct <= 3 ? 65 : gradePct <= 5 ? 55 : gradePct <= 7 ? 45 : gradePct <= 9 ? 35 : 25;
      var rating = gradePct <= 4 ? 'moderate' : gradePct <= 7 ? 'challenging' : 'severe';
      return { gradeForce: gradeForce, rollResist: rollResist, totalForce: totalForce, maxSpeed: maxSpeed, rating: rating };
    }

    function update(gradePct, passName) {
      var r = calc(gradePct);
      var rm = RATING[r.rating];
      if (sliderVal) sliderVal.textContent = gradePct + '%';
      if (badgeEl) { badgeEl.textContent = rm.label; badgeEl.className = 'grade-badge grade-badge--' + rm.cls; }
      if (speedEl) speedEl.textContent = 'Recommended max: ' + r.maxSpeed + ' mph';
      if (forceEl) forceEl.textContent = r.gradeForce.toLocaleString() + ' lb';
      if (rollEl) rollEl.textContent = r.rollResist.toLocaleString() + ' lb';
      if (totalEl) totalEl.textContent = r.totalForce.toLocaleString() + ' lb';
      if (tipEl) {
        var nameStr = passName ? ' (' + passName + ')' : '';
        tipEl.innerHTML = '<p class="grade-tip-text">On a ' + gradePct + '% grade' + nameStr + ', your engine must overcome an extra <strong>' + r.gradeForce.toLocaleString() + ' lb</strong> of gravity pulling the trailer back. Use a low gear, keep speed at or below <strong>' + r.maxSpeed + ' mph</strong>, and monitor transmission temperature.</p>';
      }
      // Highlight active pass button
      if (passGrid) {
        var btns = passGrid.querySelectorAll('.grade-pass-btn');
        for (var i = 0; i < btns.length; i++) {
          var pg = parseFloat(btns[i].getAttribute('data-grade'));
          btns[i].classList.toggle('is-active', pg === gradePct);
        }
      }
    }

    slider.addEventListener('input', function () {
      update(parseFloat(this.value), '');
    });

    if (passGrid) {
      passGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('.grade-pass-btn');
        if (!btn) return;
        var grade = parseFloat(btn.getAttribute('data-grade'));
        var name = btn.getAttribute('data-name') || '';
        slider.value = grade;
        update(grade, name);
      });
    }
  })();

  // =========================================================================
  // EXPLORE LIST VIEW — toggles between card grid and compact list view.
  //     Adds a density toggle (grid | list) to the explore controls bar.
  // =========================================================================
  (function exploreListView() {
    var grid = document.getElementById('xgrid');
    if (!grid) return;
    var controls = document.querySelector('.xc-head');
    if (!controls) return;

    // Create toggle button
    var toggleWrap = document.createElement('div');
    toggleWrap.className = 'view-toggle';
    toggleWrap.innerHTML =
      '<button type="button" class="view-btn view-btn--grid is-active" data-view-mode="grid" aria-label="Grid view" title="Grid view">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
      '</button>' +
      '<button type="button" class="view-btn view-btn--list" data-view-mode="list" aria-label="List view" title="List view">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' +
      '</button>';
    controls.appendChild(toggleWrap);

    var btns = Array.prototype.slice.call(toggleWrap.querySelectorAll('.view-btn'));
    var savedMode;
    try { savedMode = localStorage.getItem('ae:viewMode'); } catch (e) {}
    if (savedMode === 'list') {
      grid.classList.add('xgrid--list');
      btns[0].classList.remove('is-active');
      btns[1].classList.add('is-active');
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-view-mode');
        btns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (mode === 'list') {
          grid.classList.add('xgrid--list');
        } else {
          grid.classList.remove('xgrid--list');
        }
        try { localStorage.setItem('ae:viewMode', mode); } catch (e) {}
      });
    });
  })();


  // =========================================================================
  // ANIMATED HERO COUNTERS — cinematic count-up on home page hero stats.
  //     Uses IntersectionObserver to trigger once, eased count-up via rAF.
  // =========================================================================
  (function heroCounters() {
    var stats = document.querySelectorAll('.hero-stat[data-hero-num]');
    if (!stats.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

    function animateCounter(el) {
      var target = parseInt(el.getAttribute('data-hero-num'), 10);
      if (!target || target <= 0) return;
      el.classList.add('is-counting');
      var duration = Math.min(1200, 400 + target * 15);
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var elapsed = ts - start;
        var progress = Math.min(1, elapsed / duration);
        var value = Math.round(easeOutQuart(progress) * target);
        el.textContent = value;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target;
          el.classList.remove('is-counting');
        }
      }
      el.textContent = '0';
      requestAnimationFrame(step);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(function (el) { observer.observe(el); });
  })();

  // =========================================================================
  // SCROLL FADE INDICATORS — adds/removes CSS classes on horizontally
  //     scrollable containers so CSS mask-image gradients show contextual
  //     fade edges indicating more content is available to scroll.
  // =========================================================================
  (function scrollFades() {
    var containers = document.querySelectorAll('.snav-list, .xcard-tags, .home-recent-strip, .cmp-starter, .pick-strip-scroll');
    if (!containers.length) return;

    function update(el) {
      var scrollLeft = el.scrollLeft;
      var scrollRight = el.scrollWidth - el.clientWidth - scrollLeft;
      var atStart = scrollLeft < 4;
      var atEnd = scrollRight < 4;
      el.classList.toggle('scroll-start', atStart && !atEnd);
      el.classList.toggle('scroll-end', !atStart && atEnd);
      el.classList.toggle('scroll-both-end', atStart && atEnd);
    }

    containers.forEach(function (el) {
      update(el);
      el.addEventListener('scroll', function () { update(el); }, { passive: true });
    });
    // Re-check after fonts load (may change widths)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        containers.forEach(update);
      }).catch(function () {});
    }
  })();

  // =========================================================================
  // PAYLOAD PACKING PRESETS — one-click trip profiles that check gear boxes.
  // =========================================================================
  (function payloadPresets() {
    var container = document.getElementById('payload-presets');
    if (!container) return;
    var gearSection = document.getElementById('payload-gear');
    if (!gearSection) return;
    var checks = Array.prototype.slice.call(gearSection.querySelectorAll('.payload-gear-check'));
    if (!checks.length) return;

    var PRESETS = {
      weekend:  ['bedding', 'kitchen', 'outdoor'],
      weeklong: ['bedding', 'kitchen', 'clothing', 'food', 'outdoor', 'electronics'],
      fullload: checks.map(function (c) { return c.getAttribute('data-key'); })
    };

    var buttons = Array.prototype.slice.call(container.querySelectorAll('.payload-preset'));

    function setChecks(keys) {
      var keySet = {};
      keys.forEach(function (k) { keySet[k] = true; });
      checks.forEach(function (c) {
        var shouldCheck = !!keySet[c.getAttribute('data-key')];
        if (c.checked !== shouldCheck) {
          c.checked = shouldCheck;
          c.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

    function updateActiveState(activePreset) {
      buttons.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-preset') === activePreset);
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var preset = btn.getAttribute('data-preset');
        if (preset === 'clear') {
          setChecks([]);
          updateActiveState('clear');
        } else if (PRESETS[preset]) {
          setChecks(PRESETS[preset]);
          updateActiveState(preset);
        }
      });
    });

    // Clear active preset indicator when user manually toggles a checkbox
    checks.forEach(function (c) {
      c.addEventListener('click', function () {
        updateActiveState('');
      });
    });
  })();


  // =========================================================================
  // RIG LENGTH CAMPSITE FIT — interactive slider updates the chart
  // =========================================================================
  (function rigLengthFit() {
    var slider = document.getElementById('rigfit-vehicle');
    var chart = document.getElementById('rigfit-chart');
    if (!slider || !chart) return;

    var trailerFt = parseFloat(chart.getAttribute('data-trailer-ft')) || 0;
    var vlenEls = [document.getElementById('rigfit-vlen'), document.getElementById('rigfit-vlen2')];
    var totalEl = document.getElementById('rigfit-total');
    var SITES = [
      { label: 'Compact back-in', ft: 30, note: 'Tight national park loops' },
      { label: 'Standard back-in', ft: 40, note: 'Most state parks & KOA' },
      { label: 'Large back-in', ft: 50, note: 'Spacious private campgrounds' },
      { label: 'Standard pull-through', ft: 65, note: 'Easy hitch-and-go, no reversing' },
      { label: 'Full-length pull-through', ft: 80, note: 'Big rigs welcome' }
    ];

    function update() {
      var vFt = parseInt(slider.value, 10);
      var total = Math.ceil(trailerFt + vFt);
      vlenEls.forEach(function (el) { if (el) el.textContent = vFt; });
      if (totalEl) totalEl.textContent = total;

      chart.innerHTML = SITES.map(function (site) {
        var fits = total <= site.ft;
        var margin = site.ft - total;
        var barPct = Math.min(Math.round((total / site.ft) * 100), 100);
        var cls = fits ? 'rigfit-row--fits' : 'rigfit-row--over';
        var vcls = fits ? 'rigfit-verdict--yes' : 'rigfit-verdict--no';
        var verdict = fits
          ? '✓ Fits — ' + Math.abs(margin) + '\' to spare'
          : '✗ Over by ' + Math.abs(margin) + '\'';
        return '<div class="rigfit-row ' + cls + '">' +
          '<div class="rigfit-site"><span class="rigfit-site-name">' + site.label + '</span>' +
          '<span class="rigfit-site-len">' + site.ft + '\' site</span></div>' +
          '<div class="rigfit-bar-wrap"><div class="rigfit-bar" style="width:' + barPct + '%">' +
          '<span class="rigfit-rig-label">' + total + '\'</span></div></div>' +
          '<span class="rigfit-verdict ' + vcls + '">' + verdict + '</span></div>';
      }).join('');
    }

    slider.addEventListener('input', update);
  })();

  // =========================================================================
  // TOW VEHICLE MEMORY — persist selection across pages
  // =========================================================================
  (function towVehicleMemory() {
    var TOW_KEY = 'ae:towVehicle';
    // Detail page tow calculator
    var detailSelect = document.getElementById('tow-vehicle');
    // Explore page tow vehicle picker
    var exploreSelect = document.getElementById('tow-vehicle-pick');

    function save(id) {
      if (id && id !== 'custom') {
        try { localStorage.setItem(TOW_KEY, id); } catch (e) {}
      }
    }

    function restore() {
      try { return localStorage.getItem(TOW_KEY) || ''; } catch (e) { return ''; }
    }

    // Detail page: restore + save on change
    if (detailSelect) {
      var saved = restore();
      if (saved) {
        var opts = detailSelect.querySelectorAll('option');
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].value === saved) {
            detailSelect.value = saved;
            // Trigger computation
            detailSelect.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
      detailSelect.addEventListener('change', function () { save(this.value); });
    }

    // Explore page: restore + save on change
    if (exploreSelect) {
      var savedExp = restore();
      if (savedExp) {
        var expOpts = exploreSelect.querySelectorAll('option');
        for (var j = 0; j < expOpts.length; j++) {
          if (expOpts[j].value === savedExp) {
            exploreSelect.value = savedExp;
            exploreSelect.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
      exploreSelect.addEventListener('change', function () { save(this.value); });
    }
  })();
