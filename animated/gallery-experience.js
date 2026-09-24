/* Gallery: original project links in a wide, naturally scrolling photo sequence. */
(() => {
  'use strict';
  if (document.body.dataset.theme !== 'gallery') return;

  const grid = document.getElementById('project-grid');
  const work = grid?.closest('.work');
  const status = document.getElementById('project-status');
  const total = work?.querySelector('.gallery-project-total');
  const filters = Array.from(work?.querySelectorAll('[data-archive-filter]') || []);
  const items = Array.from(grid?.querySelectorAll(':scope > .gallery-project') || []).map(element => ({
    element,
    media: element.querySelector('.gallery-project-media'),
    image: element.querySelector('.gallery-project-media img'),
    category: element.dataset.category
  }));
  if (!grid || !work || !items.length) return;

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const options = {signal: controller.signal};
  const layouts = ['hero', 'left', 'right'];
  let category = null;
  let motionContext = null;
  let motionEnabled = false;
  let rebuildQueued = false;
  let frame = 0;
  let suspended = false;
  let destroyed = false;

  function canAnimate() {
    return Boolean(gsap && ScrollTrigger && !suspended && !media.matches && !document.hidden &&
      !document.body.classList.contains('motion-paused') &&
      !document.body.classList.contains('dialog-open') && !document.querySelector('dialog[open]'));
  }

  function clearMotion() {
    motionContext?.revert();
    motionContext = null;
  }

  function queueLayout(rebuild = false) {
    rebuildQueued = rebuildQueued || rebuild;
    if (frame || destroyed || suspended) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (destroyed || suspended) return;
      if (rebuildQueued) {
        rebuildQueued = false;
        clearMotion();
        motionEnabled = canAnimate();
        if (motionEnabled) {
          motionContext = gsap.context(() => {
            items.filter(item => !item.element.hidden && item.media && item.image).forEach(item => {
              gsap.fromTo(item.image,
                {scale: 1.08, yPercent: -3},
                {
                  // A 1.02 scale gives 1% overscan per edge; .75% keeps the frame covered.
                  scale: 1.02, yPercent: .75, ease: 'none',
                  scrollTrigger: {
                    trigger: item.media,
                    start: 'clamp(top bottom)',
                    end: 'clamp(bottom top)',
                    scrub: .6,
                    invalidateOnRefresh: true
                  }
                });
            });
          }, grid);
        }
      }
      ScrollTrigger?.refresh();
    });
  }

  function updateMotion() {
    const enabled = canAnimate();
    if (enabled === motionEnabled) return;
    motionEnabled = enabled;
    clearMotion();
    queueLayout(enabled);
  }

  function filterProjects(nextCategory, button = null, announce = true) {
    if (!['all', 'featured', 'current', 'awards'].includes(nextCategory) || category === nextCategory) return;
    category = nextCategory;
    clearMotion();
    const visibleItems = items.filter(item => category === 'all' || item.category === category);
    const visible = visibleItems.length;
    items.forEach(item => {
      const shown = category === 'all' || item.category === category;
      if (!shown && item.element.contains(document.activeElement)) button?.focus({preventScroll: true});
      item.element.hidden = !shown;
      delete item.element.dataset.layout;
      delete item.element.dataset.pair;
    });
    visibleItems.forEach((item, index) => {
      const group = Math.floor(index / layouts.length);
      const position = index % layouts.length;
      const remaining = visible - group * layouts.length;
      const layout = remaining === 2 ? (position === 0 ? 'left' : 'right') : layouts[position];
      item.element.dataset.layout = layout;
      if (layout !== 'hero') item.element.dataset.pair = group % 2 ? 'reverse' : 'normal';
    });
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter.dataset.archiveFilter === category)));
    if (total) total.textContent = `/ ${visible}`;
    if (announce && status) {
      const label = category === 'all' ? '' : `${button?.textContent.trim().toLowerCase() || category} `;
      status.textContent = `Showing ${visible} ${label}project${visible === 1 ? '' : 's'}.`;
    }
    queueLayout(true);
  }

  filters.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => filterProjects(button.dataset.archiveFilter, button), options);
  });
  items.forEach(item => item.image?.addEventListener('load', () => queueLayout(), options));
  media.addEventListener('change', updateMotion, options);
  document.addEventListener('visibilitychange', updateMotion, options);
  const observer = new MutationObserver(updateMotion);
  observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
  document.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog, {attributes: true, attributeFilter: ['open']}));

  window.addEventListener('pagehide', event => {
    suspended = true;
    clearMotion();
    motionEnabled = false;
    cancelAnimationFrame(frame);
    frame = 0;
    rebuildQueued = false;
    if (event.persisted) return;
    destroyed = true;
    controller.abort();
    observer.disconnect();
  }, options);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      suspended = false;
      queueLayout(true);
    }
  }, options);
  document.fonts?.ready.then(() => { if (!destroyed) queueLayout(); });

  filterProjects('all', null, false);
  grid.classList.add('gallery-sequence-ready');
  document.body.classList.add('gallery-ready');
})();
