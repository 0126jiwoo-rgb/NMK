/* NMK mobile web. Vanilla JS, no build step.
   Routes: #/  #/search  #/tickets  #/buy  #/confirmed  #/history */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMotion.matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));
  const won = (n) => '₩' + n.toLocaleString('en-US');
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  };
  const header = $('#site-header');
  const headerHeight = () => header.offsetHeight;

  const buzz = (ms = 8) => { if (!reduced() && navigator.vibrate) navigator.vibrate(ms); };

  // :active needs a touch listener on iOS Safari to show pressed states
  document.addEventListener('touchstart', () => {}, { passive: true });

  /* ------------------------------------------------------------------ Seoul time */
  const DAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  // Jan 1, Lunar New Year's Day and Chuseok. Verify lunar dates each year.
  const CLOSED_DAYS = ['01-01', '2026-02-17', '2026-09-25', '2027-09-15'];

  function seoulNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric',
      weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const monthNum = new Date(`${get('month')} 1, 2000`).getMonth() + 1;
    return {
      year: +get('year'), month: monthNum, monthName: get('month'), day: +get('day'),
      weekday: get('weekday'), dayIndex: DAY_INDEX[get('weekday')],
      minutes: (+get('hour') % 24) * 60 + +get('minute'),
    };
  }
  const isLateDay = (dayIndex) => dayIndex === 2 || dayIndex === 5;
  const pad = (n) => String(n).padStart(2, '0');
  const isClosedDay = (y, m, d) => CLOSED_DAYS.includes(`${pad(m)}-${pad(d)}`) || CLOSED_DAYS.includes(`${y}-${pad(m)}-${pad(d)}`);

  /* ------------------------------------------------------------------ today card + hours chart */
  function renderToday() {
    const now = seoulNow();
    const late = isLateDay(now.dayIndex);
    const open = 9 * 60 + 30;
    const close = late ? 21 * 60 : 17 * 60 + 30;
    const closedDay = isClosedDay(now.year, now.month, now.day);
    const isOpen = !closedDay && now.minutes >= open && now.minutes < close;

    $('[data-today-date]').textContent = `${now.weekday}, ${now.monthName} ${now.day}`;
    $('[data-today-status]').textContent = isOpen ? 'Open' : 'Closed';
    $('[data-live-dot]').classList.toggle('is-closed', !isOpen);
    $('[data-today-hours]').textContent = closedDay ? 'Closed today' : (late ? '9:30 AM to 9:00 PM' : '9:30 AM to 5:30 PM');
    $('[data-today-last]').textContent = closedDay ? 'Last entry 30 minutes before closing' : (late ? 'Last entry 8:30 PM' : 'Last entry 5:00 PM');
    $('[data-today-last]').hidden = closedDay;
    return now;
  }

  function renderHoursChart(todayIndex) {
    const chart = $('.hours__chart');
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    chart.innerHTML = letters.map((l, i) => {
      const late = isLateDay(i);
      const today = i === todayIndex;
      const barH = late ? 110 : 76;
      const cls = ['hours__bar', late ? 'hours__bar--late' : '', today ? 'hours__bar--today' : ''].join(' ');
      return `<div class="hours__day${today ? ' is-today' : ''}">
        ${today ? `<span class="hours__today" style="top:${110 - barH - 22}px">Today</span>` : ''}
        <div class="hours__barbox"><span class="${cls}" style="--i:${i}"></span></div>
        <span class="hours__letter">${l}</span>
      </div>`;
    }).join('');
  }

  const now0 = renderToday();
  renderHoursChart(now0.dayIndex);
  setInterval(renderToday, 60 * 1000);

  /* ------------------------------------------------------------------ layout helpers */
  function setBleed() {
    const w = $('.view.is-active .wrap') || $('.wrap');
    const left = Math.max(30, Math.round(w.getBoundingClientRect().left + 30));
    document.documentElement.style.setProperty('--bleed', `${left}px`);
  }
  window.addEventListener('resize', setBleed);

  /* Soft snap: after a scroll the visitor started comes to rest, ease to the nearest
     section start or sub-heading, but only if it is within SNAP_RANGE px.
     Any touch, wheel or key input cancels the ease immediately. */
  // Layout position in the document, ignoring transforms (reveal animations translate headings by 18px)
  function docTop(el) { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; }

  const softSnap = (() => {
    const SNAP_RANGE = 80;
    const SETTLE_MS = 140;
    let userIntent = false;   // only snap after scrolls the visitor started
    let moved = false;        // ...and that actually moved the page (a tap shouldn't)
    let touching = false;
    let settleTimer = 0;
    let anim = 0;

    const points = () => {
      const h = headerHeight();
      return [
        ...$$('.view--home > .section').map((el) => docTop(el) - h),
        ...$$('.view--home .h-sub--spaced, .view--home #search-title').map((el) => docTop(el) - h - 24),
      ].map(Math.round);
    };

    function cancel() { if (anim) { cancelAnimationFrame(anim); anim = 0; } }

    function ease(to) {
      cancel();
      const from = window.scrollY;
      const dist = to - from;
      const dur = 260 + Math.abs(dist) * 2.2; // 260 to ~440ms
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 4); // ease-out quart: quick start, gentle landing
        window.scrollTo(0, from + dist * e);
        anim = k < 1 ? requestAnimationFrame(step) : 0;
      };
      anim = requestAnimationFrame(step);
    }

    function settle() {
      clearTimeout(settleTimer);
      if (!userIntent || !moved || touching || anim) return;
      userIntent = false;
      moved = false;
      if (reduced() || router.page !== 'home' || document.body.classList.contains('is-locked')) return;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      let best = null;
      for (const p of points()) {
        const d = p - y;
        if (Math.abs(d) <= SNAP_RANGE && Math.abs(d) > 1 && p <= max && (best === null || Math.abs(d) < Math.abs(best - y))) best = p;
      }
      if (best !== null) ease(best);
    }
    const scheduleSettle = () => { clearTimeout(settleTimer); settleTimer = setTimeout(settle, SETTLE_MS); };

    const intent = () => { cancel(); userIntent = true; moved = false; };
    window.addEventListener('touchstart', () => { intent(); touching = true; }, { passive: true });
    window.addEventListener('touchend', () => { touching = false; scheduleSettle(); }, { passive: true });
    window.addEventListener('touchcancel', () => { touching = false; scheduleSettle(); }, { passive: true });
    window.addEventListener('wheel', intent, { passive: true });
    window.addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) intent(); });
    window.addEventListener('scroll', () => { if (anim) return; if (userIntent) moved = true; scheduleSettle(); }, { passive: true });
    if ('onscrollend' in window) window.addEventListener('scrollend', () => { if (!anim) settle(); });

    // Programmatic jumps (menu, anchors, restoring scroll) must not be re-snapped
    return { cancel, forget() { userIntent = false; clearTimeout(settleTimer); } };
  })();

  function jumpTo(top, smooth = false) {
    softSnap.cancel();
    softSnap.forget();
    window.scrollTo({ top, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }

  function scrollToAnchor(name, { instant = false } = {}) {
    const el = $(`[data-anchor="${name}"]`);
    if (!el) return;
    const isBlock = el.matches('section, footer');
    const y = docTop(el) - headerHeight() - (isBlock ? 0 : 24);
    jumpTo(Math.max(0, y), !instant);
  }

  /* ------------------------------------------------------------------ scroll reveal */
  const revealObserver = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting);
    entering.forEach((entry, i) => {
      const el = entry.target;
      el.style.setProperty('--reveal-delay', `${Math.min(i, 4) * 70}ms`);
      el.classList.add('is-in');
      revealObserver.unobserve(el);
      // Hand control back to the element's own transitions once revealed
      setTimeout(() => { el.removeAttribute('data-reveal'); el.style.removeProperty('--reveal-delay'); }, 1400 + Math.min(i, 4) * 70);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach((el) => revealObserver.observe(el));

  // Popular searches: once the cascade has played, drop the animations so they
  // don't replay when the home view is shown again (display:none restarts CSS animations)
  const popular = $('.popular');
  popular.addEventListener('animationend', (e) => {
    if (e.target === popular.querySelector('.popular__list li:last-child')) popular.classList.add('is-done');
  });
  if (reduced()) $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));

  /* ------------------------------------------------------------------ header + parallax */
  const heroMedia = $('[data-hero-media]');
  const shopImg = $('.shop__feature-img');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 4);
      if (reduced() || router.page !== 'home') return;
      if (y < 900) heroMedia.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
      const r = shopImg.parentElement.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top < vh && r.bottom > 0) {
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        shopImg.style.transform = `translate3d(0, ${(0.5 - p) * 40}px, 0) scale(${1.12 - 0.1 * p})`;
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ------------------------------------------------------------------ notice */
  // Dismiss lasts for this page view only; a refresh brings the notice back
  const notice = $('#notice');
  $('.notice__close').addEventListener('click', () => {
    notice.style.height = `${notice.offsetHeight}px`;
    notice.offsetHeight; // reflow
    notice.style.height = '0px';
    notice.style.opacity = '0';
    setTimeout(() => { notice.hidden = true; }, reduced() ? 0 : 450);
  });

  /* ------------------------------------------------------------------ hero slideshow */
  const hero = (() => {
    const root = $('.hero');
    const slides = $$('.hero__slide', root);
    const n = slides.length;
    const progress = $('[data-hero-progress]');
    const countEl = $('[data-hero-count]');
    const captionEl = $('[data-hero-caption]');
    let cur = 0;
    let busy = false;
    const pausers = new Set();

    progress.innerHTML = slides.map((s, i) =>
      `<button class="hero__bar" type="button" role="tab" aria-label="Photo ${i + 1} of ${n}: ${s.dataset.caption}"><i></i></button>`).join('');
    const bars = $$('.hero__bar', progress);
    $$('.hero__vertical span', root).forEach((s, i) => s.style.setProperty('--i', i));

    const offsetOf = (i, c = cur) => { let o = ((i - c) % n + n) % n; if (o > 2) o -= n; return o; };
    function place(slide, off, dx = 0) {
      slide.dataset.pos = off;
      slide.style.transform = `translate3d(calc(${off * 100}% + ${dx}px), 0, 0)`;
    }
    function layout(dx = 0) { slides.forEach((s, i) => place(s, offsetOf(i), Math.abs(offsetOf(i)) <= 1 ? dx : 0)); }

    function setActiveUI() {
      bars.forEach((b, i) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', String(i === cur));
      });
      const bar = bars[cur];
      bar.offsetWidth; // restart the fill animation
      bar.classList.add('is-active');
      countEl.textContent = `${pad(cur + 1)} / ${pad(n)}`;
      captionEl.classList.add('is-swapping');
      setTimeout(() => { captionEl.textContent = slides[cur].dataset.caption; captionEl.classList.remove('is-swapping'); }, reduced() ? 0 : 180);
    }

    function goTo(target, dir, { fromDrag = false } = {}) {
      target = (target + n) % n;
      if (target === cur || busy) { if (fromDrag) snapBack(); return; }
      busy = true;
      const prev = cur;
      const adjacent = offsetOf(target, prev) === dir;
      if (!adjacent || !fromDrag) {
        root.classList.remove('is-animating');
        slides.forEach((s, i) => {
          if (i === target) place(s, dir);
          else if (i !== prev) place(s, 2);
        });
        root.offsetWidth;
      }
      root.classList.add('is-animating');
      place(slides[prev], -dir);
      place(slides[target], 0);
      cur = target;
      setActiveUI();
      setTimeout(() => { root.classList.remove('is-animating'); layout(); busy = false; }, reduced() ? 0 : 840);
    }
    const next = () => goTo(cur + 1, 1);
    const prev = () => goTo(cur - 1, -1);

    function snapBack() {
      root.classList.add('is-animating');
      layout();
      setTimeout(() => root.classList.remove('is-animating'), 840);
    }

    function pause(reason, on) {
      on ? pausers.add(reason) : pausers.delete(reason);
      root.classList.toggle('is-paused', pausers.size > 0);
    }

    // Advance when the active bar finishes filling: the bar is the timer
    progress.addEventListener('animationend', (e) => { if (e.target.parentElement === bars[cur]) next(); });
    bars.forEach((b, i) => b.addEventListener('click', () => goTo(i, i > cur ? 1 : -1)));

    // Swipe: horizontal drag moves the slides; vertical scroll still works (touch-action: pan-y)
    let start = null;
    root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.hero__bar') || busy) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dragging: false, id: e.pointerId };
      pause('press', true);
    });
    root.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        start.dragging = true;
        try { root.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
        root.classList.remove('is-animating');
      }
      if (start.dragging) { start.dx = dx; layout(dx); }
    });
    const end = (e) => {
      if (!start || (e && e.pointerId !== start.id)) return;
      const { dx, dragging, t } = start;
      start = null;
      pause('press', false);
      if (!dragging) return;
      const v = Math.abs(dx) / (performance.now() - t);
      if (dx < -60 || (dx < -15 && v > 0.45)) goTo(cur + 1, 1, { fromDrag: true });
      else if (dx > 60 || (dx > 15 && v > 0.45)) goTo(cur - 1, -1, { fromDrag: true });
      else snapBack();
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    new IntersectionObserver(([en]) => pause('offscreen', !en.isIntersecting), { threshold: 0.2 }).observe(root);
    document.addEventListener('visibilitychange', () => pause('hidden', document.hidden));
    const applyMotionPref = () => root.classList.toggle('is-static', reduced());
    reduceMotion.addEventListener('change', applyMotionPref);
    applyMotionPref();

    layout();
    setActiveUI();
    return { pause };
  })();

  /* ------------------------------------------------------------------ exhibition carousel */
  (() => {
    const track = $('[data-carousel-track]');
    const bar = $('[data-carousel-bar]');
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const p = max > 0 ? track.scrollLeft / max : 0;
      bar.style.transform = `translate3d(${p * 100}%, 0, 0)`;
    };
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update);

    // Mouse drag for desktop; touch uses native scrolling with snap
    let drag = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; track.classList.add('is-dragging'); }
      if (drag.moved) track.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const moved = drag.moved;
      const dx = e.clientX - drag.x;
      drag = null;
      if (!moved) return;
      track.classList.remove('is-dragging');
      const max = track.scrollWidth - track.clientWidth;
      track.scrollTo({ left: dx < 0 ? max : 0, behavior: reduced() ? 'auto' : 'smooth' });
      const block = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      track.addEventListener('click', block, { capture: true, once: true });
      setTimeout(() => track.removeEventListener('click', block, { capture: true }), 50);
    });
    update();
  })();

  /* ------------------------------------------------------------------ count-up (history facts) */
  const countObserver = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach(({ target: el }) => {
      countObserver.unobserve(el);
      const to = parseFloat(el.dataset.countTo);
      const decimals = +(el.dataset.decimals || 0);
      const suffix = el.dataset.suffix || '';
      const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (reduced()) { el.textContent = fmt(to); return; }
      const t0 = performance.now();
      const dur = 1400;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(decimals ? Math.round(to * eased * 10) / 10 : Math.round(to * eased));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$('[data-count-to]').forEach((el) => countObserver.observe(el));

  /* ------------------------------------------------------------------ layers: shared helpers */
  let lastFocus = null;
  function lockScroll(on) { document.body.classList.toggle('is-locked', on); }
  function openLayer(el) {
    el.inert = false;
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('is-open');
  }
  function closeLayer(el, delay) {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!el.classList.contains('is-open')) el.inert = true; }, reduced() ? 0 : delay);
  }
  $$('.layer').forEach((el) => { el.inert = true; });

  /* ------------------------------------------------------------------ menu */
  const menu = $('#menu');
  const menuBtn = $('[data-open-menu]');
  $$('.menu__list li', menu).forEach((li, i) => li.style.setProperty('--i', i));
  // Scroll-spy: mark the section the visitor is currently reading
  function markCurrentSection() {
    const links = $$('[data-menu-scroll]', menu);
    links.forEach((a) => a.removeAttribute('aria-current'));
    if (router.page !== 'home') return;
    const line = headerHeight() + 120;
    let current = null;
    let best = -Infinity;
    links.forEach((a) => {
      const el = $(`[data-anchor="${a.dataset.menuScroll}"]`);
      const top = el ? el.getBoundingClientRect().top : Infinity;
      if (top <= line && top > best) { best = top; current = a; }
    });
    if (current) current.setAttribute('aria-current', 'true');
  }
  function openMenu() {
    lastFocus = document.activeElement;
    markCurrentSection();
    openLayer(menu);
    menuBtn.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    $('.menu__close', menu).focus({ preventScroll: true });
  }
  function closeMenu({ restoreFocus = true } = {}) {
    if (!menu.classList.contains('is-open')) return;
    closeLayer(menu, 300);
    menuBtn.setAttribute('aria-expanded', 'false');
    lockScroll(false);
    if (restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
  }
  menu.addEventListener('click', (e) => {
    const scrollLink = e.target.closest('[data-menu-scroll]');
    const routeLink = e.target.closest('[data-menu-route]');
    if (scrollLink) {
      e.preventDefault();
      const target = scrollLink.dataset.menuScroll;
      closeMenu({ restoreFocus: false });
      if (router.page === 'home') setTimeout(() => scrollToAnchor(target), 60);
      else router.navigate('home', { scrollTo: target });
    } else if (routeLink) {
      e.preventDefault();
      closeMenu({ restoreFocus: false });
      router.navigate(routeLink.dataset.menuRoute);
    }
  });

  /* ------------------------------------------------------------------ language sheet */
  const sheet = $('#lang');
  const panel = $('[data-sheet-panel]', sheet);
  function openLang() {
    if (!menu.classList.contains('is-open')) lastFocus = document.activeElement;
    sheet.style.removeProperty('--drag');
    sheet.style.removeProperty('--scrim');
    openLayer(sheet);
    lockScroll(true);
    setTimeout(() => $('.lang.is-current', sheet).focus({ preventScroll: true }), 50);
  }
  function closeLang() {
    if (!sheet.classList.contains('is-open')) return;
    sheet.style.removeProperty('--drag');
    sheet.style.removeProperty('--scrim');
    closeLayer(sheet, 440);
    if (!menu.classList.contains('is-open')) lockScroll(false);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $$('.lang', sheet).forEach((btn) => btn.addEventListener('click', () => setTimeout(closeLang, reduced() ? 0 : 120)));

  // Drag down to dismiss, from anywhere on the panel except the option list
  (() => {
    let d = null;
    panel.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sheet__options, button')) return;
      d = { y: e.clientY, t: performance.now(), dy: 0 };
      try { panel.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
      sheet.classList.add('is-dragging');
    });
    panel.addEventListener('pointermove', (e) => {
      if (!d) return;
      const raw = e.clientY - d.y;
      d.dy = raw > 0 ? raw : raw / 4; // resist upward pull
      sheet.style.setProperty('--drag', `${d.dy}px`);
      sheet.style.setProperty('--scrim', String(Math.max(0, 1 - d.dy / panel.offsetHeight)));
    });
    const up = () => {
      if (!d) return;
      const v = d.dy / (performance.now() - d.t);
      const dy = d.dy;
      d = null;
      sheet.classList.remove('is-dragging');
      if (dy > 110 || (dy > 20 && v > 0.5)) closeLang();
      else { sheet.style.removeProperty('--drag'); sheet.style.removeProperty('--scrim'); }
    };
    panel.addEventListener('pointerup', up);
    panel.addEventListener('pointercancel', up);
  })();

  /* ------------------------------------------------------------------ search */
  const SUGGESTIONS = [
    { text: 'wheelchair & stroller rental', term: 'wheelchair' },
    { text: 'wheelchair access', term: 'wheelchair' },
    { text: 'wheelchair-friendly route', term: 'wheelchair' },
    { text: 'opening hours', term: 'hours' },
    { text: 'open late on Wednesday and Saturday', term: 'hours' },
    { text: 'is it free?', term: 'free' },
    { text: 'special exhibition tickets', term: 'tickets' },
    { text: "children's museum", term: "children's museum" },
    { text: 'the korean table', term: 'korean table' },
    { text: 'pensive bodhisattva', term: 'pensive bodhisattva' },
    { text: 'silla gold crown', term: 'silla gold crown' },
    { text: 'ichon station', term: 'ichon station' },
    { text: 'directions', term: 'directions' },
    { text: 'guided tours', term: 'tours' },
    { text: 'coat storage', term: 'coat storage' },
    { text: 'app & audio guide', term: 'audio guide' },
    { text: 'MU:DS shop', term: 'shop' },
    { text: 'history of the museum', term: 'history' },
  ];

  // Content index. Snippets reuse copy that appears on the site.
  const INDEX = [
    { type: 'Visitor info', jump: 'Accessibility', jumpSub: 'At the Museum', title: 'Accessibility at the museum', snippet: 'Wheelchair and stroller loans, accessible routes, and on-site services.', crumb: 'Plan your visit  ›  At the museum', kw: ['wheelchair', 'wheelchairs', 'stroller', 'strollers', 'accessibility', 'accessible', 'disability', 'disabilities'], go: { scroll: 'at-museum' } },
    { type: 'Guide', jumpSub: 'Guide · PDF', title: 'Accessibility guide', snippet: 'Download the guide for wheelchair users and visitors with disabilities.', crumb: 'PDF download', kw: ['wheelchair', 'accessibility', 'guide', 'disabilities', 'disability'], go: { scroll: 'at-museum' } },
    { type: 'Directions', title: 'Getting here', snippet: 'Ichon Station, Line 4 and Gyeongui-Jungang Line. Plan a wheelchair-friendly route.', crumb: 'Plan your visit  ›  Getting here', kw: ['wheelchair', 'directions', 'ichon', 'station', 'subway', 'route', 'address', 'getting', 'map', 'line'], go: { scroll: 'directions' } },
    { type: 'Visitor info', title: 'Opening hours', snippet: 'Open 9:30 to 17:30. Open late until 21:00 on Wednesday and Saturday. Last entry 30 minutes before closing.', crumb: 'Plan your visit  ›  Hours & admission', kw: ['hours', 'open', 'opening', 'late', 'closing', 'closed', 'time', 'wednesday', 'saturday', 'today'], go: { scroll: 'plan' } },
    { type: 'Tickets', title: 'What needs a ticket?', snippet: 'Permanent galleries are free. Paid special exhibitions need a ticket.', crumb: 'Plan your visit  ›  Admission', kw: ['free', 'ticket', 'tickets', 'admission', 'price', 'prices', 'cost', 'fee'], go: { scroll: 'tickets' } },
    { type: 'Tickets', title: "Children's Museum", snippet: 'Free, timed sessions. Book online before you go.', crumb: 'Tickets & reservations', kw: ['children', "children's", 'kids', 'family', 'families', 'reservation', 'reservations', 'book', 'booking'], go: { route: 'tickets' } },
    { type: 'Exhibitions', title: 'The Korean Table: Food, Nature, and Life', snippet: 'Special exhibition. Jul 1 to Oct 25, 2026.', crumb: "What's on  ›  On view now", kw: ['korean', 'table', 'food', 'special', 'exhibition', 'exhibitions', 'tickets'], go: { route: 'tickets' } },
    { type: 'Exhibitions', title: 'Evergreen Bamboo Through the Four Seasons', snippet: 'Thematic exhibition, 3F. Jun 23, 2026 to Jan 31, 2027.', crumb: "What's on  ›  On view now", kw: ['evergreen', 'bamboo', 'seasons', 'exhibition', 'exhibitions', 'thematic'], go: { scroll: 'exhibitions' } },
    { type: 'Highlights', title: 'Room of Quiet Contemplation', snippet: 'Two Pensive Bodhisattvas, both National Treasures.', crumb: "What's on  ›  Don't miss", kw: ['pensive', 'bodhisattva', 'bodhisattvas', 'quiet', 'contemplation', 'treasure', 'treasures', 'highlights'], go: { scroll: 'highlights' } },
    { type: 'Highlights', title: 'Silla Gold Crown', snippet: 'Gold crown and belt from Hwangnamdaechong Tomb.', crumb: "What's on  ›  Don't miss", kw: ['silla', 'gold', 'crown', 'treasure', 'treasures', 'highlights', 'hwangnamdaechong'], go: { scroll: 'highlights' } },
    { type: 'Shop', title: 'MU:DS museum shop', snippet: 'From the gallery to your shelf. Pensive Bodhisattva miniature, dancheong keycap keyring and more.', crumb: 'Museum shop', kw: ['shop', 'mu:ds', 'muds', 'goods', 'souvenir', 'souvenirs', 'gift', 'gifts', 'store', 'miniature'], go: { scroll: 'shop' } },
    { type: 'Programs', title: 'Guided tours', snippet: 'Two tours every weekday at 10:30 and 13:00 in English, Japanese and Chinese. No reservation needed.', crumb: 'Programs & events', kw: ['tour', 'tours', 'guided', 'docent', 'english', 'japanese', 'chinese', 'programs', 'program'], go: { scroll: 'programs' } },
    { type: 'Visitor info', title: 'Coat storage', snippet: 'Free, west side of the main gate.', crumb: 'Plan your visit  ›  At the museum', kw: ['coat', 'coats', 'storage', 'locker', 'lockers', 'luggage', 'bag', 'bags'], go: { scroll: 'at-museum' } },
    { type: 'Visitor info', title: 'App & audio guide', snippet: 'Exhibition app for your phone.', crumb: 'Plan your visit  ›  At the museum', kw: ['app', 'audio', 'guide', 'phone'], go: { scroll: 'at-museum' } },
    { type: 'About', title: 'History & significance', snippet: "The National Museum of Korea tells the country's story in one place, from prehistory to the Korean Empire.", crumb: 'About the museum', kw: ['history', 'about', 'significance', '1945', 'yongsan'], go: { route: 'history' } },
  ];

  const QUICK = [
    { match: ['wheelchair', 'wheelchairs', 'stroller', 'strollers'], type: 'Visitor info', title: 'Wheelchairs and strollers', body: 'Free wheelchairs and strollers in the Great Hall.', meta: ['Visitor info', 'Great Hall', 'Free'], link: 'See all accessibility services', go: { scroll: 'at-museum' } },
    { match: ['hours', 'opening', 'open', 'late', 'closing'], type: 'Visitor info', title: 'Opening hours', body: 'Open 9:30 to 17:30. Open late until 21:00 on Wednesday and Saturday.', meta: ['Visitor info', 'Last entry 30 minutes before closing'], link: 'See hours & admission', go: { scroll: 'plan' } },
  ];

  const FILTER_LABEL = { Guide: 'Guides' };
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'where', 'when', 'can', 'you', 'with', 'are', 'there', 'does', 'any', 'into', 'your']);
  const tokenize = (q) => q.toLowerCase().split(/[^a-z0-9:'’]+/).map((t) => t.replace(/[’']s$/, '').replace(/[’']/g, "'"))
    .filter((t) => (t.length >= 3 || /^\d+$/.test(t)) && !STOP.has(t));
  const tokenHits = (tokens, kw) => tokens.filter((t) => kw.some((k) => k.startsWith(t) || (k.length >= 4 && t.startsWith(k))));

  function search(q, term) {
    const tokens = tokenize(term || q);
    if (!tokens.length) return { results: [], quick: null, tokens };
    const results = INDEX
      .map((entry, i) => ({ entry, i, score: tokenHits(tokens, entry.kw).length }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map((r) => r.entry);
    const quick = QUICK.find((qa) => tokenHits(tokens, qa.match).length > 0) || null;
    return { results, quick, tokens };
  }

  function highlight(text, tokens) {
    // Bold whole words that start with a query token
    return escapeHtml(text).replace(/[A-Za-z][A-Za-z'’]*/g, (word) => {
      const w = word.toLowerCase();
      return tokens.some((t) => w.startsWith(t)) ? `<b>${word}</b>` : word;
    });
  }

  const searchLayer = $('#search');
  const searchInput = $('[data-search-input]');
  const searchBody = $('[data-search-body]');
  const clearBtn = $('[data-search-clear]');
  let recent = store.get('nmk.recent', ['bring my dog', 'parking']);
  let searchState = { mode: 'idle', q: '', term: '', filter: 'All' };

  function addRecent(q) {
    const v = q.trim();
    if (!v) return;
    recent = [v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, 5);
    store.set('nmk.recent', recent);
  }

  const rowArrow = '<span class="s-row__go" aria-hidden="true">→</span>';
  const recentHTML = () => recent.length ? `
    <div class="s-group">
      <p class="s-label">Recent searches</p>
      ${recent.map((r, i) => `<div class="s-row" style="--i:${i}" role="button" tabindex="0" data-recent="${escapeHtml(r)}">
        <span class="s-row__recent" aria-hidden="true">↺</span><span class="s-row__main">${escapeHtml(r)}</span>
        <button class="s-row__del" type="button" data-recent-del="${escapeHtml(r)}" aria-label="Remove ${escapeHtml(r)} from recent searches">✕</button></div>`).join('')}
    </div>` : '';

  function renderIdle() {
    const popular = [['Is it free?', 'free'], ["Children's Museum", "children's museum"], ['Pensive Bodhisattva', 'pensive bodhisattva'], ['Directions', 'directions'], ['MU:DS shop', 'shop'], ['Accessibility', 'wheelchair']];
    searchBody.innerHTML = `${recentHTML()}
      <div class="s-group">
        <p class="s-label">Popular searches</p>
        <ol class="s-popular popular__list">${popular.map(([label, term], i) =>
          `<li><button type="button" data-suggest="${escapeHtml(label)}" data-term="${escapeHtml(term)}"><span class="rank${i < 3 ? ' rank--hot' : ''}">${i + 1}</span>${escapeHtml(label)}</button></li>`).join('')}</ol>
      </div>`;
  }

  function renderSuggest(q) {
    const ql = q.trim().toLowerCase();
    const sugg = SUGGESTIONS.filter((s) => s.text.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(ql)) || s.text.toLowerCase().startsWith(ql)).slice(0, 3);
    const { results } = search(q);
    const jumps = results.slice(0, 2);
    const suggRow = (s, i) => {
      const lower = s.text.toLowerCase();
      const at = lower.indexOf(ql);
      const main = at >= 0
        ? `${escapeHtml(s.text.slice(0, at))}<mark>${escapeHtml(s.text.slice(at, at + ql.length))}</mark>${escapeHtml(s.text.slice(at + ql.length))}`
        : escapeHtml(s.text);
      return `<div class="s-row" style="--i:${i}" role="button" tabindex="0" data-suggest="${escapeHtml(s.text)}" data-term="${escapeHtml(s.term)}">
        <span class="s-row__icon" aria-hidden="true"></span><span class="s-row__main">${main}</span>
        <button class="s-row__fill" type="button" data-fill="${escapeHtml(s.text)}" aria-label="Fill in ${escapeHtml(s.text)}">↖</button></div>`;
    };
    const suggList = sugg.length ? sugg.map(suggRow).join('')
      : `<div class="s-row" role="button" tabindex="0" data-suggest="${escapeHtml(q.trim())}" data-term=""><span class="s-row__icon" aria-hidden="true"></span><span class="s-row__main">${escapeHtml(q.trim())}</span></div>`;
    searchBody.innerHTML = `
      <div class="s-group"><p class="s-label">Suggestions</p>${suggList}</div>
      ${jumps.length ? `<div class="s-group"><p class="s-label">Jump to</p>${jumps.map((r, i) => `
        <button class="s-row" type="button" style="--i:${i + 3}" data-result="${INDEX.indexOf(r)}">
          <span class="s-row__text"><span class="s-row__title">${escapeHtml(r.jump || r.title)}</span><span class="s-row__sub">${escapeHtml(r.jumpSub || r.crumb.split('  ›  ').pop())}</span></span>${rowArrow}</button>`).join('')}</div>` : ''}
      ${recentHTML()}`;
  }

  function renderResults() {
    const { q, term, filter } = searchState;
    const { results, quick, tokens } = search(q, term);
    if (!results.length && !quick) {
      searchBody.innerHTML = `
        <div class="noresults"><h2>No results for “${escapeHtml(q)}”</h2><p>We may use different words.<br>Try one of these instead.</p></div>
        <div class="try">
          <button class="s-row" type="button" style="--i:0" data-scroll-to="at-museum"><span class="s-row__text"><span class="s-row__title">Visitor rules</span><span class="s-row__sub">What you can bring into the galleries</span></span>${rowArrow}</button>
          <button class="s-row" type="button" style="--i:1" data-run="wheelchair"><span class="s-row__text"><span class="s-row__title">Accessibility</span><span class="s-row__sub">Wheelchairs, strollers and accessible routes</span></span>${rowArrow}</button>
          <a class="s-row" style="--i:2" href="tel:+82220779046"><span class="s-row__text"><span class="s-row__title">Contact visitor services</span><span class="s-row__sub">Ask us directly</span></span>${rowArrow}</a>
        </div>
        <div class="tip"><strong>Search tip</strong><p>Try a shorter keyword, like “pets” or “rules”.</p></div>`;
      return;
    }
    const all = [...(quick ? [quick.type] : []), ...results.map((r) => r.type)];
    const types = [...new Set(all)];
    const counts = Object.fromEntries(types.map((t) => [t, all.filter((x) => x === t).length]));
    const show = (type) => filter === 'All' || filter === type;
    const label = term || q.trim();
    searchBody.innerHTML = `
      <div class="filters" role="toolbar" aria-label="Filter by content type">
        <button class="filter" type="button" aria-pressed="${filter === 'All'}" data-filter="All">All <b>${all.length}</b></button>
        ${types.map((t) => `<button class="filter" type="button" aria-pressed="${filter === t}" data-filter="${escapeHtml(t)}">${escapeHtml(FILTER_LABEL[t] || t)} <b>${counts[t]}</b></button>`).join('')}
      </div>
      <p class="s-count">${all.length} result${all.length === 1 ? '' : 's'} for “${escapeHtml(label)}”</p>
      <div class="quick" ${quick && show(quick.type) ? '' : 'hidden'}>
        ${quick ? `<p class="quick__label">Quick answer</p>
        <p class="quick__title">${escapeHtml(quick.title)}</p>
        <p class="quick__body">${highlight(quick.body, tokens)}</p>
        <div class="quick__meta">${quick.meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</div>
        <button class="quick__link" type="button" data-quick><span>${escapeHtml(quick.link)}</span><span aria-hidden="true">→</span></button>` : ''}
      </div>
      <div class="results">${results.filter((r) => show(r.type)).map((r, i) => `
        <button class="result" type="button" style="--i:${i}" data-result="${INDEX.indexOf(r)}">
          <span class="result__type">${escapeHtml(r.type)}</span>
          <span class="result__title">${escapeHtml(r.title)}</span>
          <span class="result__snippet">${highlight(r.snippet, tokens)}</span>
          <span class="result__crumb">${escapeHtml(r.crumb)}</span>
        </button>`).join('')}</div>
      <a class="s-contact" href="tel:+82220779046">Can’t find it? Contact visitor services</a>`;
  }

  function renderSearch() {
    clearBtn.hidden = !searchInput.value;
    if (searchState.mode === 'results') renderResults();
    else if (searchInput.value.trim()) renderSuggest(searchInput.value);
    else renderIdle();
  }

  function runSearch(q, term = '') {
    searchInput.value = q;
    searchState = { mode: 'results', q, term, filter: 'All' };
    addRecent(q);
    searchInput.blur();
    renderSearch();
    searchLayer.scrollTop = 0;
    history.replaceState(history.state, '', `#/search?q=${encodeURIComponent(term || q)}`);
  }

  function openSearch({ q = '', term = '', focus = true, push = true } = {}) {
    if (!searchLayer.classList.contains('is-open')) lastFocus = document.activeElement;
    // Synchronous so iOS shows the keyboard (focus must happen inside the tap handler)
    openLayer(searchLayer);
    lockScroll(true);
    hero.pause('search', true);
    if (push && router.route !== 'search') router.push('search');
    if (q) runSearch(q, term);
    else {
      searchInput.value = '';
      searchState = { mode: 'idle', q: '', term: '', filter: 'All' };
      renderSearch();
      if (focus) searchInput.focus({ preventScroll: true });
    }
  }
  function closeSearch() {
    if (!searchLayer.classList.contains('is-open')) return;
    searchInput.blur();
    closeLayer(searchLayer, 260);
    lockScroll(false);
    hero.pause('search', false);
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  // Leave search and then run an action against the page underneath
  function leaveSearch(after) {
    router.afterPop = after;
    if (router.canGoBackTo('search')) history.back();
    else { router.replace('home'); }
  }
  function act(go) {
    leaveSearch(() => {
      if (go.route) router.navigate(go.route);
      else if (router.page === 'home') scrollToAnchor(go.scroll);
      else router.navigate('home', { scrollTo: go.scroll });
    });
  }

  $('[data-search-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) runSearch(q);
  });
  searchInput.addEventListener('input', () => {
    searchState.mode = searchInput.value.trim() ? 'suggest' : 'idle';
    renderSearch();
  });
  searchInput.addEventListener('focus', () => {
    if (searchState.mode === 'results') { searchState.mode = searchInput.value.trim() ? 'suggest' : 'idle'; renderSearch(); }
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchState = { mode: 'idle', q: '', term: '', filter: 'All' };
    renderSearch();
    searchInput.focus();
  });
  $('[data-search-cancel]').addEventListener('click', () => leaveSearch(null));

  searchBody.addEventListener('click', (e) => {
    const t = e.target;
    const del = t.closest('[data-recent-del]');
    if (del) {
      e.stopPropagation();
      recent = recent.filter((r) => r !== del.dataset.recentDel);
      store.set('nmk.recent', recent);
      renderSearch();
      return;
    }
    const fill = t.closest('[data-fill]');
    if (fill) {
      e.stopPropagation();
      searchInput.value = fill.dataset.fill;
      searchState.mode = 'suggest';
      renderSearch();
      searchInput.focus();
      return;
    }
    const sug = t.closest('[data-suggest]');
    if (sug) return runSearch(sug.dataset.suggest, sug.dataset.term);
    const rec = t.closest('[data-recent]');
    if (rec) return runSearch(rec.dataset.recent);
    const run = t.closest('[data-run]');
    if (run) return runSearch(run.dataset.run);
    const filter = t.closest('[data-filter]');
    if (filter) { searchState.filter = filter.dataset.filter; renderResults(); return; }
    const res = t.closest('[data-result]');
    if (res) return act(INDEX[+res.dataset.result].go);
    if (t.closest('[data-quick]')) {
      const { quick } = search(searchState.q, searchState.term);
      if (quick) act(quick.go);
      return;
    }
    const to = t.closest('[data-scroll-to]');
    if (to) act({ scroll: to.dataset.scrollTo });
  });
  searchBody.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
  });

  /* ------------------------------------------------------------------ buy tickets */
  const buy = (() => {
    const EXHIBITION_END = Date.UTC(2026, 9, 25);
    const state = { dateIndex: 0, qty: { adult: 2, youth: 1 }, dates: [] };
    const datesEl = $('[data-dates]');
    const fmtDow = (d) => d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

    function buildDates() {
      const now = seoulNow();
      let start = Date.UTC(now.year, now.month - 1, now.day);
      if (start > EXHIBITION_END) start = Date.UTC(2026, 9, 13); // sample dates once the run has ended
      const list = [];
      for (let k = 0; list.length < 6 && k < 14; k++) {
        const t = start + k * 864e5;
        if (t > EXHIBITION_END) break;
        const d = new Date(t);
        if (isClosedDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())) continue;
        list.push(d);
      }
      state.dates = list;
      datesEl.innerHTML = list.map((d, i) => `<button class="date-chip" type="button" role="radio" aria-checked="${i === state.dateIndex}" tabindex="${i === state.dateIndex ? 0 : -1}"
        aria-label="${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}" data-i="${i}">
        <span class="date-chip__dow">${fmtDow(d)}</span><span class="date-chip__day">${d.getUTCDate()}</span></button>`).join('');
    }
    function selectDate(i, focus) {
      state.dateIndex = Math.max(0, Math.min(state.dates.length - 1, i));
      $$('.date-chip', datesEl).forEach((b, j) => {
        b.setAttribute('aria-checked', String(j === state.dateIndex));
        b.tabIndex = j === state.dateIndex ? 0 : -1;
        if (j === state.dateIndex && focus) b.focus();
      });
    }
    datesEl.addEventListener('click', (e) => { const b = e.target.closest('.date-chip'); if (b) { selectDate(+b.dataset.i); buzz(); } });
    datesEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); selectDate(state.dateIndex + 1, true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); selectDate(state.dateIndex - 1, true); }
    });

    const tick = (el, dir) => { el.classList.remove('tick-up', 'tick-down'); el.offsetWidth; el.classList.add(dir > 0 ? 'tick-up' : 'tick-down'); };
    const totals = () => {
      const count = state.qty.adult + state.qty.youth;
      const sum = state.qty.adult * 5000 + state.qty.youth * 3000;
      return { count, sum };
    };
    function render(changed, dir) {
      $$('[data-qty]').forEach((row) => {
        const key = row.dataset.qty;
        const out = $('[data-count]', row);
        out.textContent = state.qty[key];
        $('[data-step="-1"]', row).disabled = state.qty[key] === 0;
        $('[data-step="1"]', row).disabled = state.qty[key] === 10;
        if (key === changed) tick(out, dir);
      });
      const { count, sum } = totals();
      $('[data-total-label]').textContent = `Total  ·  ${count} ticket${count === 1 ? '' : 's'}`;
      const totalEl = $('[data-total]');
      if (totalEl.textContent !== won(sum)) { totalEl.textContent = won(sum); if (changed) tick(totalEl, dir); }
      $('[data-pay-label]').textContent = `Pay ${won(sum)}`;
      $('[data-pay]').disabled = count === 0;
    }
    $$('[data-qty]').forEach((row) => row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (!b || b.disabled) return;
      const dir = +b.dataset.step;
      const key = row.dataset.qty;
      state.qty[key] = Math.max(0, Math.min(10, state.qty[key] + dir));
      render(key, dir);
      buzz();
    }));

    $('[data-pay]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled || btn.classList.contains('is-loading')) return;
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      await wait(900);
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      fillConfirmation();
      buzz([10, 60, 18]);
      router.navigate('confirmed', { replace: true });
    });

    function fillConfirmation() {
      const d = state.dates[state.dateIndex];
      const { adult, youth } = state.qty;
      const parts = [];
      if (adult) parts.push(`${adult} adult${adult === 1 ? '' : 's'}`);
      if (youth) parts.push(`${youth} ${youth === 1 ? 'youth or child' : 'youth or children'}`);
      $('[data-conf-date]').textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      $('[data-conf-tickets]').textContent = parts.join(', ');
      $('[data-conf-total]').textContent = won(totals().sum);
    }

    buildDates();
    render();
    return { reset() { state.dateIndex = 0; state.qty = { adult: 2, youth: 1 }; buildDates(); render(); } };
  })();

  /* ------------------------------------------------------------------ router */
  const PAGES = ['home', 'tickets', 'buy', 'confirmed', 'history'];
  const WITH_HEADER = ['home', 'tickets', 'history'];
  const TITLES = {
    home: 'National Museum of Korea',
    tickets: 'Tickets & reservations · National Museum of Korea',
    buy: 'Buy tickets · National Museum of Korea',
    confirmed: 'Ticket confirmed · National Museum of Korea',
    history: 'History & significance · National Museum of Korea',
    search: 'Search · National Museum of Korea',
  };

  const router = {
    route: null, page: null, idx: 0, afterPop: null,
    stack: [], scrollMem: {},

    parse(hash) {
      const m = (hash || '').replace(/^#\/?/, '').split('?');
      const name = m[0] || 'home';
      const params = new URLSearchParams(m[1] || '');
      if (name === 'search') return { route: 'search', q: params.get('q') || '' };
      return { route: PAGES.includes(name) ? name : 'home' };
    },
    href(route) { return route === 'home' ? '#/' : `#/${route}`; },

    push(route) {
      this.scrollMem[this.idx] = window.scrollY;
      this.idx += 1;
      this.stack[this.idx] = route;
      this.stack.length = this.idx + 1;
      history.pushState({ idx: this.idx, route }, '', this.href(route));
      this.route = route;
      document.title = TITLES[route];
    },
    replace(route, opts = {}) {
      this.stack[this.idx] = route;
      history.replaceState({ idx: this.idx, route }, '', this.href(route));
      this.apply(route, opts);
    },
    navigate(route, opts = {}) {
      if (opts.replace) return this.replace(route, opts);
      this.push(route);
      this.apply(route, opts);
    },
    canGoBackTo(fromRoute) { return this.route === fromRoute && this.idx > 0; },
    backTo(route) {
      if (this.idx > 0 && this.stack[this.idx - 1] === route) history.back();
      else this.navigate(route);
    },

    apply(route, { scrollTo = null, restore = null, q = '' } = {}) {
      this.route = route;
      document.title = TITLES[route];
      if (route === 'search') {
        openSearch({ q, focus: false, push: false });
        return;
      }
      closeSearch();
      const swapping = route !== this.page;
      if (swapping) this.swap(route, { scrollTo, restore });
      else if (scrollTo) scrollToAnchor(scrollTo);
      else if (restore != null) jumpTo(restore);
      const after = this.afterPop;
      this.afterPop = null;
      if (after) setTimeout(after, swapping ? 360 : 30);
    },

    swap(page, { scrollTo, restore }) {
      const from = this.page ? $(`.view[data-view="${this.page}"]`) : null;
      const to = $(`.view[data-view="${page}"]`);
      this.page = page;
      const show = () => {
        $$('.view').forEach((v) => { v.classList.remove('is-active', 'is-leaving'); if (v !== to) v.hidden = true; });
        to.hidden = false;
        to.classList.add('is-active');
        header.classList.toggle('is-hidden', !WITH_HEADER.includes(page));
        if (page === 'home') startIntro();
        if (page === 'buy') setTimeout(setBleed, 0);
        if (scrollTo) scrollToAnchor(scrollTo, { instant: true });
        else jumpTo(restore != null ? restore : 0);
        onScroll();
        if (from) {
          to.classList.add('is-entering');
          setTimeout(() => to.classList.remove('is-entering'), 1800);
          const h = $('h1, h2', to);
          if (h && page !== 'home') { h.tabIndex = -1; h.focus({ preventScroll: true }); }
        }
      };
      if (from && !reduced()) {
        from.classList.add('is-leaving');
        setTimeout(show, 150);
      } else show();
    },
  };

  window.addEventListener('popstate', (e) => {
    const st = e.state || { idx: router.idx + 1, ...router.parse(location.hash) };
    const back = st.idx < router.idx;
    router.scrollMem[router.idx] = window.scrollY;
    router.idx = st.idx;
    router.stack[st.idx] = st.route;
    const parsed = router.parse(location.hash);
    router.apply(st.route, { restore: back ? router.scrollMem[st.idx] : null, q: parsed.q });
  });

  /* ------------------------------------------------------------------ intro */
  let introRan = false;
  function startIntro() {
    if (introRan) return;
    introRan = true;
    if (reduced()) { document.body.classList.add('intro-done'); return; }
    requestAnimationFrame(() => {
      document.body.classList.add('is-intro');
      setTimeout(() => { document.body.classList.add('intro-done'); document.body.classList.remove('is-intro'); }, 2200);
    });
  }

  /* ------------------------------------------------------------------ global clicks + keys */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-open-search]')) { e.preventDefault(); closeMenu({ restoreFocus: false }); openSearch(); return; }
    const termBtn = t.closest('[data-search-term]');
    if (termBtn) { e.preventDefault(); openSearch({ q: termBtn.dataset.searchTerm }); return; }
    if (t.closest('[data-open-menu]')) { openMenu(); return; }
    if (t.closest('[data-close-menu]') && !t.closest('[data-nav]')) { closeMenu(); return; }
    if (t.closest('[data-open-lang]')) { openLang(); return; }
    if (t.closest('[data-close-lang]')) { closeLang(); return; }

    const a = t.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    if (a.matches('[data-back]')) {
      const target = router.parse(a.getAttribute('href')).route;
      router.backTo(target);
    } else if (a.dataset.nav) {
      if (a.closest('#menu')) closeMenu({ restoreFocus: false });
      if (a.matches('[data-reset]')) buy.reset();
      const scrollTo = a.dataset.scrollTarget;
      if (a.dataset.nav === router.page && !scrollTo) jumpTo(0, true);
      else router.navigate(a.dataset.nav, { scrollTo });
    } else if (a.dataset.scroll) {
      scrollToAnchor(a.dataset.scroll);
    }
    // other "#..." links have no destination screen yet; they only show the pressed state
  });
  $$('[data-jump]').forEach((b) => b.addEventListener('click', () => scrollToAnchor(b.dataset.jump)));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (sheet.classList.contains('is-open')) closeLang();
    else if (menu.classList.contains('is-open')) closeMenu();
    else if (searchLayer.classList.contains('is-open')) leaveSearch(null);
  });

  /* ------------------------------------------------------------------ boot */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const initial = router.parse(location.hash);
  if (initial.route === 'search') {
    // Deep link into search: put home underneath so Cancel has somewhere to go
    router.stack[0] = 'home';
    history.replaceState({ idx: 0, route: 'home' }, '', '#/');
    router.apply('home');
    router.push('search');
    history.replaceState({ idx: 1, route: 'search' }, '', initial.q ? `#/search?q=${encodeURIComponent(initial.q)}` : '#/search');
    openSearch({ q: initial.q, focus: false, push: false });
  } else {
    router.stack[0] = initial.route;
    history.replaceState({ idx: 0, route: initial.route }, '', router.href(initial.route));
    router.apply(initial.route);
  }
  setBleed();
})();
