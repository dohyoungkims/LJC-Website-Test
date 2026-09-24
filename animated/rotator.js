/*
 * LJC “by design” headline. Adapted from the HTML supplied by the user on
 * 2026-09-24 (attachment 68c46b3b-3348-47fc-9e3d-bb5b4e5db8e4/Pasted text.txt).
 * Preserves the supplied vertical transition and timing. The page supplies copy.
 * Headline mode rotates the main word above a permanently visible fixed suffix;
 * legacy pill mode also supports the supplied animated gradient border.
 * GSAP must be loaded locally before this script. No remote requests are made.
 *
 * const rotator = window.LJCByDesignRotator.mount(element, { enabled: true });
 * rotator.setEnabled(false); // A clean, readable paused headline.
 * rotator.destroy();         // Reverts inline styles and removes every listener.
 */
(function (global) {
  'use strict';

  const instances = new WeakMap();
  const INITIAL_HOLD = 0;
  const CADENCE = 1.75;
  const MOBILE_QUERY = '(max-width: 680px)';

  function mount(pill, options = {}) {
    if (!pill || !pill.querySelector) throw new TypeError('A rotator element is required.');
    if (instances.has(pill)) return instances.get(pill);

    const wordWindow = pill.querySelector('.word-window');
    const words = Array.from(pill.querySelectorAll('.rotating-word'));
    const suffix = pill.querySelector('.suffix');
    const headlineMode = pill.classList.contains('by-design-headline');
    const dynamicWidth = pill.hasAttribute('data-dynamic-width');
    const fixedWidth = !dynamicWidth && (headlineMode || pill.hasAttribute('data-fixed-width'));
    const wordAlignment = headlineMode
      ? { x: 0, xPercent: pill.dataset.wordAlign === 'end' ? -100 : -50 }
      : {};
    if (!wordWindow || !words.length) throw new Error('The rotator needs a word-window and words.');

    const gsap = global.gsap;
    const reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = global.matchMedia(MOBILE_QUERY);
    const snapshots = [pill, wordWindow, suffix, ...words].filter(Boolean).map((node) => ({
      node,
      style: node.getAttribute('style'),
      label: node.getAttribute('aria-label'),
      hidden: node.getAttribute('aria-hidden'),
    }));

    let enabled = options.enabled !== false;
    let destroyed = false;
    let ready = false;
    let currentIndex = 0;
    let widths = [];
    let maxWidth = 0;
    let measuredMobile = null;
    let transition = null;
    let scheduledRotation = null;
    let entrance = null;
    let resizeFrame = 0;
    let intersectionObserver = null;
    let resizeObserver = null;
    let lastRunning = null;
    const initialRect = pill.getBoundingClientRect();
    let inView = initialRect.bottom > 0 && initialRect.top < global.innerHeight
      && initialRect.right > 0 && initialRect.left < global.innerWidth;

    // One stable accessible heading; cycling words are visual decoration.
    // Deliberately no live region and no repeated accessible-name changes.
    if (!pill.hasAttribute('aria-label')) {
      pill.setAttribute('aria-label', words.map((word) => word.textContent.trim()).join(', '));
    }
    wordWindow.setAttribute('aria-hidden', 'true');
    if (suffix) suffix.setAttribute('aria-hidden', 'true');

    function canRun() {
      return Boolean(gsap && ready && !destroyed && enabled && !reducedMotion.matches
        && !document.hidden && inView);
    }

    function state() {
      return {
        enabled,
        running: canRun(),
        reducedMotion: reducedMotion.matches,
        currentWord: words[currentIndex].textContent.trim(),
        available: Boolean(gsap),
        destroyed,
      };
    }

    function announceState(force = false) {
      const running = canRun();
      pill.dataset.motionState = running ? 'running' : 'paused';
      pill.dataset.motionReason = !enabled ? 'control' : reducedMotion.matches ? 'preference' : document.hidden ? 'hidden' : !inView ? 'offscreen' : !ready ? 'loading' : !gsap ? 'unavailable' : 'active';
      if (force || running !== lastRunning) {
        lastRunning = running;
        pill.dispatchEvent(new CustomEvent('ljc:rotatorstatechange', { detail: state() }));
      }
    }

    function colors(word) {
      return {
        '--border-a': word.dataset.start || '#685478',
        '--border-b': word.dataset.end || '#35644c',
      };
    }

    function targetWidth(index) {
      // Headlines reserve the longest word unless explicitly opted into the
      // expanding pill. Its width follows the current word at every breakpoint.
      return fixedWidth || (mobile.matches && !dynamicWidth) ? maxWidth : widths[index];
    }

    function measure() {
      if (destroyed) return;
      // Batch all geometry reads before writes; no reads occur during a tween.
      const nextWidths = words.map((word) => Math.ceil(word.getBoundingClientRect().width) + 2);
      const changed = measuredMobile !== mobile.matches
        || nextWidths.some((width, index) => width !== widths[index]);
      // A fit-content parent's ResizeObserver may fire while the pill expands.
      // Ignore unchanged word metrics rather than interrupting our own tween.
      if (!changed) return;
      // Font/viewport changes settle the active flip before applying new metrics,
      // so a newly sized aperture never strands either word partially clipped.
      if (transition) transition.progress(1);
      widths = nextWidths;
      maxWidth = Math.max(...widths);
      measuredMobile = mobile.matches;
      if (gsap) {
        gsap.killTweensOf(wordWindow, 'width');
        gsap.set(wordWindow, { width: targetWidth(currentIndex) });
        if (headlineMode) gsap.set(words, wordAlignment);
      } else {
        wordWindow.style.width = `${targetWidth(currentIndex)}px`;
      }
    }

    function requestMeasure() {
      if (destroyed || resizeFrame) return;
      resizeFrame = global.requestAnimationFrame(() => {
        resizeFrame = 0;
        measure();
      });
    }

    function synchronize() {
      const active = canRun();
      [transition, scheduledRotation, entrance].forEach((animation) => {
        if (animation) animation.paused(!active);
      });
      pill.classList.toggle('is-rotating', active);
      announceState();
    }

    function stopAnimations() {
      [transition, scheduledRotation, entrance].forEach((animation) => animation?.kill());
      transition = null;
      scheduledRotation = null;
      entrance = null;
    }

    function showFirstWord() {
      currentIndex = 0;
      if (!gsap) return;
      gsap.set(words, {
        autoAlpha: 0,
        yPercent: 0,
        // Headline CSS supplies left:50%, or left:100% for end alignment. Keep
        // positioning percentage based when GSAP takes over transforms;
        // a computed pixel translation would become stale after font resizing.
        ...wordAlignment,
      });
      gsap.set(words[0], { autoAlpha: 1, yPercent: 0, ...wordAlignment });
      gsap.set(wordWindow, { width: targetWidth(0) });
      if (!headlineMode) gsap.set(pill, { autoAlpha: 1, ...colors(words[0]) });
    }

    function schedule(delay) {
      scheduledRotation = gsap.delayedCall(delay, rotateWord);
      scheduledRotation.paused(!canRun());
    }

    function rotateWord() {
      scheduledRotation = null;
      if (destroyed || reducedMotion.matches) return;

      const outgoing = words[currentIndex];
      currentIndex = (currentIndex + 1) % words.length;
      const incoming = words[currentIndex];

      transition = gsap.timeline({
        paused: !canRun(),
        defaults: { overwrite: 'auto' },
        onComplete() { transition = null; },
      });

      transition
        .set(incoming, { autoAlpha: 0, yPercent: 105, ...wordAlignment }, 0)
        .to(outgoing, { autoAlpha: 0, yPercent: -105, duration: 0.52, ease: 'power3.in' }, 0)
        .to(incoming, { autoAlpha: 1, yPercent: 0, duration: 0.64, ease: 'power3.out' }, 0.34);

      if (!headlineMode) {
        transition.to(pill, { ...colors(incoming), duration: 0.62, ease: 'power2.inOut' }, 0.1);
      }

      // Dynamic-width headlines expand the whole fit-content phrase, including
      // on mobile; other headline modes keep their longest-word aperture.
      if (dynamicWidth || (!fixedWidth && !mobile.matches)) {
        transition.to(wordWindow, {
          width: targetWidth(currentIndex), duration: 0.68, ease: 'power3.inOut',
        }, 0.2);
      }

      schedule(CADENCE);
    }

    function resetMotion(withEntrance = false) {
      if (!ready || !gsap || destroyed) return;
      stopAnimations();
      showFirstWord();
      if (!reducedMotion.matches && words.length > 1) {
        if (withEntrance && !headlineMode && canRun()) {
          entrance = gsap.fromTo(pill, { autoAlpha: 0 }, {
            autoAlpha: 1, duration: 0.64, ease: 'power2.out',
            onComplete() { entrance = null; },
          });
        }
        schedule(INITIAL_HOLD);
      }
      synchronize();
    }

    function onMotionPreferenceChange() {
      // An OS preference change returns to a complete first word immediately.
      resetMotion();
      announceState(true);
    }

    function listenMedia(query, handler) {
      if (query.addEventListener) query.addEventListener('change', handler);
      else query.addListener(handler);
    }

    function unlistenMedia(query, handler) {
      if (query.removeEventListener) query.removeEventListener('change', handler);
      else query.removeListener(handler);
    }

    const api = {
      setEnabled(value) {
        if (destroyed) return;
        enabled = Boolean(value);
        // A deliberate pause must not strand either word halfway through a mask.
        if (!enabled) {
          if (transition) transition.progress(1);
          if (entrance) entrance.progress(1);
        }
        synchronize();
        announceState(true);
      },
      getState: state,
      refresh: requestMeasure,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        stopAnimations();
        if (resizeFrame) global.cancelAnimationFrame(resizeFrame);
        intersectionObserver?.disconnect();
        resizeObserver?.disconnect();
        global.removeEventListener('resize', requestMeasure);
        document.removeEventListener('visibilitychange', synchronize);
        document.fonts?.removeEventListener?.('loadingdone', requestMeasure);
        unlistenMedia(reducedMotion, onMotionPreferenceChange);
        unlistenMedia(mobile, requestMeasure);
        snapshots.forEach(({ node, style, label, hidden }) => {
          [['style', style], ['aria-label', label], ['aria-hidden', hidden]].forEach(([name, value]) => {
            if (value === null) node.removeAttribute(name);
            else node.setAttribute(name, value);
          });
        });
        pill.classList.remove('is-rotating');
        instances.delete(pill);
        announceState(true);
      },
    };

    instances.set(pill, api);
    listenMedia(reducedMotion, onMotionPreferenceChange);
    listenMedia(mobile, requestMeasure);
    global.addEventListener('resize', requestMeasure, { passive: true });
    document.addEventListener('visibilitychange', synchronize);
    document.fonts?.addEventListener?.('loadingdone', requestMeasure);

    if ('IntersectionObserver' in global) {
      intersectionObserver = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting && entries[0].intersectionRatio > 0;
        synchronize();
      }, { threshold: [0, 0.01] });
      intersectionObserver.observe(pill);
    }

    if ('ResizeObserver' in global && pill.parentElement) {
      resizeObserver = new ResizeObserver(requestMeasure);
      resizeObserver.observe(pill.parentElement);
    }

    // Keep the CSS first-word fallback visible while fonts load, including when
    // GSAP is unavailable. The destroyed guard prevents a late async restart.
    Promise.resolve(document.fonts?.ready).then(() => {
      if (destroyed) return;
      measure();
      ready = true;
      if (gsap) resetMotion(true);
      else announceState(true);
    });

    return api;
  }

  global.LJCByDesignRotator = Object.freeze({ mount });
})(window);
