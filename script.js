(function () {
  'use strict';

  var nav = document.querySelector('.rt-nav');
  if (!nav) return;

  var collapseEl = document.getElementById('rtNav');
  var linksWrap = nav.querySelector('.rt-nav__links');
  var pill = nav.querySelector('.rt-nav__pill');
  var links = nav.querySelectorAll('.navbar-nav .nav-link');

  /* 2. Sliding outlined pill + glow spot on the bottom line (desktop only) */
  function activeLink() {
    return nav.querySelector('.navbar-nav .nav-link.active');
  }

  function moveTo(el, instant) {
    if (!pill) return;
    if (!el || window.innerWidth < 992) {
      pill.style.opacity = '0';
      return;
    }
    if (instant) {
      pill.classList.add('no-anim');
      nav.classList.add('no-anim');
    }

    pill.style.width = el.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + el.offsetLeft + 'px)';
    pill.style.opacity = '1';

    var navRect = nav.getBoundingClientRect();
    var rect = el.getBoundingClientRect();
    nav.style.setProperty('--rt-glow-x', (rect.left - navRect.left + rect.width / 2) + 'px');

    if (instant) {
      void pill.offsetWidth; // flush so the jump isn't animated
      pill.classList.remove('no-anim');
      nav.classList.remove('no-anim');
    }
  }

  if (pill && linksWrap) {
    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () { moveTo(link); });
      link.addEventListener('focus', function () { moveTo(link); });
    });
    linksWrap.addEventListener('mouseleave', function () { moveTo(activeLink()); });
    linksWrap.addEventListener('focusout', function () { moveTo(activeLink()); });

    window.addEventListener('resize', function () { moveTo(activeLink(), true); });
    window.addEventListener('load', function () { moveTo(activeLink(), true); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { moveTo(activeLink(), true); });
    }
    moveTo(activeLink(), true);
  }

  /* 3. Mobile: close the menu after a link is tapped */
  nav.querySelectorAll('.nav-link, .rt-btn-contact').forEach(function (item) {
    item.addEventListener('click', function () {
      if (collapseEl && collapseEl.classList.contains('show')) {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
      }
    });
  });

  /* 4. Sticky hero: how much has the next section covered it? (0 -> 1) */
  var hero = document.querySelector('.rt-hero');
  var cover = hero ? hero.nextElementSibling : null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hero && cover && !reduceMotion) {
    var ticking = false;

    var updateCover = function () {
      var h = hero.offsetHeight || 1;
      var p = 1 - cover.getBoundingClientRect().top / h;
      p = Math.min(1, Math.max(0, p));
      hero.style.setProperty('--rt-p', p.toFixed(3));
      ticking = false;
    };

    var requestUpdate = function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateCover);
      }
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    updateCover();
  }
})();
(function () {
  'use strict';

  var fleet = document.querySelector('.rt-fleet');
  if (!fleet) return;

  var stage = fleet.querySelector('.rt-fleet__stage');
  var track = fleet.querySelector('.rt-fleet__track');
  var cards = Array.prototype.slice.call(track.querySelectorAll('.rt-car'));
  var filters = Array.prototype.slice.call(fleet.querySelectorAll('.rt-fleet__filter'));
  var prev = fleet.querySelector('.rt-fleet__arrow--prev');
  var next = fleet.querySelector('.rt-fleet__arrow--next');
  var empty = fleet.querySelector('.rt-fleet__empty');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var currentFilter = 'all';
  var looping = false;   // true when there are more cards than fit on screen
  var setW = 0;          // pixel width of ONE full set of cards
  var settleTimer = null;
  var resizeTimer = null;
  var touching = false;
  var lastWidth = window.innerWidth;
  var EPS = 2;

  cards.forEach(function (card, i) { card.setAttribute('data-key', i); });

  /* ---------- helpers ---------- */
  function gapSize() {
    return parseFloat(window.getComputedStyle(track).columnGap) || 0;
  }

  function visibleCards() {
    return cards.filter(function (c) { return !c.hidden; });
  }

  function stepSize() {
    var first = visibleCards()[0];
    if (!first) return track.clientWidth;
    return first.getBoundingClientRect().width + gapSize();
  }

  function makeClone(card) {
    var clone = card.cloneNode(true);
    clone.setAttribute('data-clone', '');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.remove('rt-car--enter');
    // keyboard users use the real cards, not the copies
    clone.querySelectorAll('a, button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
    return clone;
  }

  function replay(node, i) {
    node.classList.remove('rt-car--enter');
    void node.offsetWidth; // restart the entrance animation
    node.style.setProperty('--i', i);
    node.classList.add('rt-car--enter');
  }

  /* ---------- build the track (filter + infinite loop) ---------- */
  function render(type, animate) {
    currentFilter = type;

    track.querySelectorAll('.rt-car[data-clone]').forEach(function (c) { c.remove(); });

    var visible = [];
    cards.forEach(function (card) {
      var match = type === 'all' || card.getAttribute('data-category') === type;
      card.hidden = !match;
      if (match) visible.push(card);
    });
    empty.hidden = visible.length > 0;

    track.scrollLeft = 0;
    looping = false;
    setW = 0;

    if (visible.length) {
      var cs = window.getComputedStyle(track);
      var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      var gap = gapSize();
      var step = visible[0].getBoundingClientRect().width + gap;
      var perView = Math.max(1, Math.floor((track.clientWidth - pad + gap) / step + 0.05));
      looping = visible.length > perView;
    }
    stage.classList.toggle('is-static', !looping);

    if (looping) {
      // 3 sets: [copies] [real cards] [copies] -> no visible start or end
      var first = visible[0];
      visible.forEach(function (card) { track.insertBefore(makeClone(card), first); });
      visible.forEach(function (card) { track.appendChild(makeClone(card)); });

      var firstCopy = track.querySelector('.rt-car[data-clone]');
      setW = first.getBoundingClientRect().left - firstCopy.getBoundingClientRect().left;
      track.scrollLeft = setW; // start on the first real card
    }

    if (animate) {
      visible.forEach(function (card, i) {
        var key = card.getAttribute('data-key');
        track.querySelectorAll('.rt-car[data-key="' + key + '"]').forEach(function (node) { replay(node, i); });
      });
    }
  }

  /* ---------- infinite loop: silently jump back into the middle set ---------- */
  function recenter() {
    if (!looping) return;
    var pos = track.scrollLeft;
    if (pos < setW - EPS) track.scrollLeft = pos + setW;
    else if (pos >= setW * 2 - EPS) track.scrollLeft = pos - setW;
  }

  function scheduleSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      if (!touching) recenter();
    }, 140);
  }

  track.addEventListener('scroll', function () {
    if (!looping) return;
    scheduleSettle();
    // safety: never let the user hit a hard edge
    var max = track.scrollWidth - track.clientWidth;
    if (!touching && (track.scrollLeft <= 1 || track.scrollLeft >= max - 1)) recenter();
  }, { passive: true });

  track.addEventListener('touchstart', function () { touching = true; }, { passive: true });
  track.addEventListener('touchend', function () { touching = false; scheduleSettle(); }, { passive: true });
  track.addEventListener('touchcancel', function () { touching = false; scheduleSettle(); }, { passive: true });

  /* ---------- arrows ---------- */
  function slide(dir) {
    track.scrollBy({ left: dir * stepSize(), behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  prev.addEventListener('click', function () { slide(-1); });
  next.addEventListener('click', function () { slide(1); });

  /* ---------- filter tabs ---------- */
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      render(btn.getAttribute('data-filter'), true);
    });
  });

  /* ---------- like (heart) buttons - kept in sync across the copies ---------- */
  track.addEventListener('click', function (e) {
    var btn = e.target.closest('.rt-car__like');
    if (!btn) return;
    var key = btn.closest('.rt-car').getAttribute('data-key');
    var on = btn.getAttribute('aria-pressed') !== 'true';
    track.querySelectorAll('.rt-car[data-key="' + key + '"] .rt-car__like').forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });

  /* ---------- hide broken images (missing files) instead of showing alt text ---------- */
  fleet.addEventListener('error', function (e) {
    var el = e.target;
    if (el && el.tagName === 'IMG' && el.closest('.rt-car')) el.classList.add('is-broken');
  }, true);
  cards.forEach(function (card) {
    card.querySelectorAll('img').forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) img.classList.add('is-broken');
    });
  });

  /* ---------- rebuild when the screen width changes (cards per view changes) ---------- */
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        render(currentFilter, false);
      }
    }, 160);
  });

  render('all', false);
})();

    /* =========================================================
   WHY CHOOSE US - scroll animation trigger
   - cards slide in from their own side, the car rises from the bottom
   - plays EVERY time the elements come on screen (resets when they leave)
   ========================================================= */
(function () {
  'use strict';

  var section = document.querySelector('.wcu');
  if (!section) return;

  // no animation for people who asked for reduced motion, or very old browsers
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  var targets = Array.prototype.slice.call(section.querySelectorAll('.wcu-card, .wcu__car'));
  if (!targets.length) return;

  // hide the animated parts (CSS only hides them while JS is running)
  section.classList.add('wcu--armed');
  void section.offsetWidth; // make sure the hidden state is applied before we start

  /* ENTER: play when ~20% of the element is visible.
     The 200px side margins stop the sideways offset from confusing the observer. */
  var enterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('is-inview');
    });
  }, { threshold: 0.2, rootMargin: '0px 200px -8% 200px' });

  /* LEAVE: reset only when the element is completely off screen,
     so it can play again on the next visit (and never flickers at the edge). */
  var leaveObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) entry.target.classList.remove('is-inview');
    });
  }, { threshold: 0, rootMargin: '0px 200px 0px 200px' });

  targets.forEach(function (el) {
    enterObserver.observe(el);
    leaveObserver.observe(el);
  });
})();
