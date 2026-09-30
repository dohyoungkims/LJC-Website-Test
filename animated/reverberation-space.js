/* Spatial book scene. Source artwork and routing stay with the publication.
   CSS owns the opening/closing transitions; this module never writes history. */
(() => {
  'use strict';
  const scene = document.querySelector('#rev-space');
  const source = document.querySelector('#rev-data');
  if (!scene || !source) return;
  let data;
  try { data = JSON.parse(source.textContent); } catch (_) { return; }
  if (!data.chapters?.length || !data.pages?.length) return;

  const object = document.querySelector('#space-object');
  const spread = document.querySelector('#space-spread');
  let image = document.querySelector('#space-spread-image');
  const title = document.querySelector('#space-chapter-title');
  const label = document.querySelector('#space-page-label');
  const storyLinks = document.querySelector('#space-story-links');
  const chapterCount = document.querySelector('#space-chapter-count');
  if (!spread || !image || !title || !label || !storyLinks || !chapterCount) return;

  const chapters = [...document.querySelectorAll('[data-space-chapter]')];
  const openButtons = [...document.querySelectorAll('[data-space-open]')];
  const closeButtons = [...document.querySelectorAll('[data-space-close]')];
  const readButtons = [...document.querySelectorAll('[data-space-read]')];
  const previousButtons = [...document.querySelectorAll('[data-space-prev]')];
  const nextButtons = [...document.querySelectorAll('[data-space-next]')];
  const pauseButtons = [...document.querySelectorAll('[data-space-pause]')];
  const motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerMedia = matchMedia('(hover: hover) and (pointer: fine)');
  const cache = new Map();
  const warmupQueue = [...new Set(data.chapters.map(chapter => Number(chapter.startIndex)))];
  let coverPainted = false, idleHandle = null, idleRunning = false;
  let selectedChapter = 0, committedChapter = -1, currentIndex = -1, requestedIndex = 0;
  let request = 0, loading = false, routeActive = true, resumeOpen = false, lastTrigger = null;
  let pointerFrame = 0, pointerBox = null, pointerPosition = null;
  let swipe = null, suppressClickUntil = 0;
  const reduced = () => motionMedia.matches || document.body.classList.contains('motion-paused');
  const isOpen = () => scene.dataset.spaceState === 'open';
  const available = () => routeActive && !scene.closest('[hidden]');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function bounds(number) {
    const chapter = data.chapters[number];
    const start = clamp(Number(chapter.startIndex) || 0, 0, data.pages.length - 1);
    const following = data.chapters[number + 1]?.startIndex ?? data.pages.length;
    const end = clamp(Number(chapter.endIndex ?? (Number(following) - 1)), start, data.pages.length - 1);
    return {start, end};
  }

  const sceneSource = page => page.sceneSrc || page.src;

  function prepare(page, priority = 'auto') {
    const src = sceneSource(page);
    if (cache.has(src)) {
      const ready = cache.get(src);
      if (priority === 'high') ready.picture.fetchPriority = 'high';
      cache.delete(src); cache.set(src, ready);
      return ready;
    }
    const picture = new Image();
    picture.fetchPriority = priority;
    const ready = new Promise((resolve, reject) => {
      picture.decoding = 'async';
      picture.onload = async () => {
        try { await picture.decode(); } catch (_) { /* A loaded image can survive a decode API failure. */ }
        if (picture.naturalWidth) resolve(picture); else reject(new Error('Artwork unavailable'));
      };
      picture.onerror = () => reject(new Error('Artwork unavailable'));
      picture.src = src;
    });
    ready.picture = picture;
    cache.set(src, ready);
    ready.catch(() => { if (cache.get(src) === ready) cache.delete(src); });
    while (cache.size > 4) cache.delete(cache.keys().next().value);
    return ready;
  }

  function setLoading(value) {
    loading = value;
    scene.setAttribute('aria-busy', String(value));
    if (value) scene.dataset.spaceLoading = 'true'; else delete scene.dataset.spaceLoading;
  }

  function updateControls() {
    const range = bounds(selectedChapter), open = isOpen();
    previousButtons.forEach(button => { button.disabled = !open || requestedIndex <= range.start; });
    nextButtons.forEach(button => { button.disabled = !open || requestedIndex >= range.end; });
    readButtons.forEach(button => { button.disabled = !open || currentIndex < 0; });
    spread.disabled = !open || currentIndex < 0;
    closeButtons.forEach(button => { button.disabled = !open && !loading; });
    openButtons.forEach(button => button.setAttribute('aria-expanded', String(open)));
    scene.querySelectorAll('.space-cover,.space-cover-caption').forEach(element => { element.inert = open; });
    scene.querySelectorAll('.space-heading,.space-spread-controls,.space-story-links').forEach(element => { element.inert = !open; });
    chapters.forEach(button => {
      const number = Number(button.dataset.spaceChapter);
      const pending = loading && number === selectedChapter;
      button.setAttribute('aria-pressed', String((loading || open) && number === (loading ? selectedChapter : committedChapter)));
      button.setAttribute('aria-busy', String(pending));
      if (pending) button.dataset.spaceLoading = 'true'; else delete button.dataset.spaceLoading;
    });
  }

  function cancelWarmup() {
    if (idleHandle === null) return;
    if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle); else clearTimeout(idleHandle);
    idleHandle = null;
  }
  function allowWarmup() {
    const connection = navigator.connection;
    return coverPainted && available() && !document.hidden && !loading && !connection?.saveData && !['slow-2g','2g'].includes(connection?.effectiveType);
  }
  function scheduleWarmup() {
    if (idleHandle !== null || idleRunning || !warmupQueue.length || !allowWarmup()) return;
    const next = () => {
      idleHandle = null;
      if (!allowWarmup()) return;
      while (warmupQueue.length && cache.has(sceneSource(data.pages[warmupQueue[0]]))) warmupQueue.shift();
      if (!warmupQueue.length) return;
      const index = warmupQueue.shift(); idleRunning = true;
      prepare(data.pages[index], 'low').catch(() => {}).finally(() => {
        idleRunning = false; scheduleWarmup();
      });
    };
    idleHandle = window.requestIdleCallback ? window.requestIdleCallback(next, {timeout:2000}) : setTimeout(next, 250);
  }

  function storyURL(id) {
    const url = new URL('reverberation.html', location.href);
    const params = new URLSearchParams(location.search);
    url.searchParams.set('theme', document.body.dataset.theme || params.get('theme') || 'gallery');
    url.searchParams.set('mode', 'digital');
    url.searchParams.set('story', id);
    url.searchParams.set('motion', document.body.classList.contains('motion-paused') ? 'off' : 'on');
    return url.href;
  }

  function populateStories(number) {
    const range = bounds(number);
    const items = (data.stories || []).filter(story => Number(story.startIndex) >= range.start && Number(story.startIndex) <= range.end).slice(0, 4);
    const links = items.map(story => {
      const link = document.createElement('a');
      link.className = 'space-story'; link.dataset.story = story.id;
      link.href = storyURL(story.id);
      const picture = story.image;
      if (picture?.src) {
        const thumbnail = document.createElement('img');
        thumbnail.src = picture.thumbSrc || picture.src; thumbnail.alt = '';
        thumbnail.loading = 'lazy'; thumbnail.decoding = 'async';
        if (picture.width && picture.height) { thumbnail.width = picture.width; thumbnail.height = picture.height; }
        link.append(thumbnail);
      }
      const caption = document.createElement('span');
      caption.textContent = story.shortTitle || story.title;
      link.append(caption);
      return link;
    });
    storyLinks.replaceChildren(...links);
    storyLinks.hidden = !links.length;
  }

  async function show(number, index, trigger = null) {
    if (!available()) return;
    const chapterNumber = clamp(Math.trunc(Number(number)) || 0, 0, data.chapters.length - 1);
    const range = bounds(chapterNumber);
    const target = clamp(Math.trunc(Number(index)) || 0, range.start, range.end);
    const sameTarget = currentIndex === target && committedChapter === chapterNumber;
    if (isOpen() && sameTarget && !scene.dataset.spaceError) return;
    cancelWarmup();
    selectedChapter = chapterNumber; requestedIndex = target;
    if (trigger) lastTrigger = trigger;
    const token = ++request, page = data.pages[target], chapter = data.chapters[chapterNumber];
    const focusBook = !isOpen() && openButtons.includes(document.activeElement);
    const alt = page.alt || `${chapter.title}, ${page.label || `spread ${target + 1}`}`;

    // A tap opens the actual target immediately. Keep this light preview visible
    // while the larger scene image decodes; the separate reader can open now.
    if (!sameTarget) {
      const preview = image.cloneNode(false);
      preview.removeAttribute('srcset');
      preview.src = page.thumbSrc || sceneSource(page);
      preview.alt = alt; preview.loading = 'eager'; preview.decoding = 'async';
      preview.fetchPriority = 'high'; preview.hidden = false;
      if (page.width && page.height) { preview.width = page.width; preview.height = page.height; }
      image.replaceWith(preview); image = preview;
    }
    currentIndex = target;
    title.textContent = chapter.title;
    label.textContent = page.label || `Spread ${target + 1}`;
    chapterCount.textContent = `${String(chapterNumber + 1).padStart(2, '0')} / ${String(data.chapters.length).padStart(2, '0')}`;
    spread.dataset.readSpread = String(target);
    spread.dataset.single = String(page.width < page.height);
    spread.setAttribute('aria-label', `Read and zoom ${page.label || `spread ${target + 1}`} from ${chapter.title}`);
    readButtons.forEach(button => { button.dataset.readSpread = String(target); });
    if (committedChapter !== chapterNumber) populateStories(chapterNumber);
    committedChapter = chapterNumber;
    setLoading(true); delete scene.dataset.spaceError;
    scene.dataset.spaceState = 'open'; resetPointer(); updateControls();
    if (focusBook) spread.focus({preventScroll:true});

    try {
      const decoded = await prepare(page, 'high');
      if (token !== request || !available()) return;
      const nextImage = image.cloneNode(false);
      nextImage.src = decoded.src;
      nextImage.removeAttribute('srcset');
      nextImage.loading = 'eager'; nextImage.decoding = 'async';
      if (nextImage.decode) await nextImage.decode().catch(() => {});
      if (token !== request || !available()) return;
      nextImage.alt = alt;
      nextImage.width = decoded.naturalWidth; nextImage.height = decoded.naturalHeight;
      image.replaceWith(nextImage); image = nextImage;
      setLoading(false); updateControls();
      for (const neighbor of [target - 1, target + 1]) {
        if (neighbor >= range.start && neighbor <= range.end) prepare(data.pages[neighbor], 'low').catch(() => {});
      }
      scheduleWarmup();
    } catch (_) {
      if (token !== request || !available()) return;
      // Keep the correct target and its preview. Retrying the selected chapter
      // is allowed; full-resolution reading remains available independently.
      setLoading(false); scene.dataset.spaceError = 'true';
      label.textContent = `${page.label || `Spread ${target + 1}`} · Preview shown. Select the chapter again to retry.`;
      updateControls(); scheduleWarmup();
    }
  }

  function resetPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0; pointerBox = null; pointerPosition = null;
    object?.style.setProperty('--pointer-x', '0deg');
    object?.style.setProperty('--pointer-y', '0deg');
  }

  function close(focus = false) {
    resumeOpen = false;
    ++request; setLoading(false); delete scene.dataset.spaceError;
    scene.dataset.spaceState = 'cover'; swipe = null; suppressClickUntil = 0; resetPointer(); updateControls();
    scheduleWarmup();
    if (focus) {
      const target = lastTrigger?.isConnected ? lastTrigger : openButtons[0] || chapters[selectedChapter];
      if (target && !target.disabled && target.getClientRects().length) target.focus({preventScroll:true});
    }
  }

  chapters.forEach(button => button.addEventListener('click', () => {
    const number = Number(button.dataset.spaceChapter);
    if (!Number.isInteger(number) || !data.chapters[number]) return;
    show(number, bounds(number).start, button);
  }));
  openButtons.forEach(button => button.addEventListener('click', () => show(selectedChapter, requestedIndex, button)));
  closeButtons.forEach(button => button.addEventListener('click', () => close(true)));
  previousButtons.forEach(button => button.addEventListener('click', () => show(selectedChapter, requestedIndex - 1)));
  nextButtons.forEach(button => button.addEventListener('click', () => show(selectedChapter, requestedIndex + 1)));

  scene.addEventListener('keydown', event => {
    if (!available() || !isOpen() || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (document.querySelector('dialog.case-reader[open]')) return;
    if (event.target.closest('input,textarea,select,[contenteditable]')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(true); return;
    }
    if (!object?.contains(event.target) && !event.target.closest('.space-spread-controls')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const range = bounds(selectedChapter), next = requestedIndex + direction;
    if (next >= range.start && next <= range.end) show(selectedChapter, next);
  });

  // Touch pages within the chapter; vertical gestures remain native scrolling.
  spread.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (event.isPrimary === false) { swipe = null; return; }
    suppressClickUntil = 0;
    if (!available() || !isOpen() || document.querySelector('dialog.case-reader[open]')) return;
    swipe = {id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};
  });
  spread.addEventListener('pointermove', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (!swipe.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipe.horizontal = true;
      event.preventDefault();
    }
  }, {passive:false});
  spread.addEventListener('pointerup', event => {
    const gesture = swipe; swipe = null;
    if (!gesture || gesture.id !== event.pointerId || !available() || !isOpen()) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Math.abs(dx) <= 60 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    event.preventDefault(); suppressClickUntil = performance.now() + 500;
    const range = bounds(selectedChapter), next = requestedIndex + (dx < 0 ? 1 : -1);
    if (next >= range.start && next <= range.end) show(selectedChapter, next);
  });
  spread.addEventListener('pointercancel', () => { swipe = null; });
  spread.addEventListener('click', event => {
    if (event.detail === 0 || performance.now() >= suppressClickUntil) return;
    suppressClickUntil = 0;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);

  document.addEventListener('ljc-case-reader-close', event => {
    if (event.detail?.id !== 'reverberation-2026' || !available() || document.body.dataset.mode !== 'digital' || document.body.dataset.story) return;
    const index = Number(event.detail.index);
    if (!Number.isInteger(index) || index < 0 || index >= data.pages.length) return;
    const chapter = data.chapters.findIndex((_, number) => {
      const range = bounds(number); return index >= range.start && index <= range.end;
    });
    if (chapter >= 0) show(chapter, index);
  }, true);

  function syncMotion() {
    const paused = document.body.classList.contains('motion-paused');
    pauseButtons.forEach(button => {
      const text = paused ? 'Resume motion' : 'Pause motion';
      button.setAttribute('aria-pressed', String(paused)); button.setAttribute('aria-label', text);
      const caption = button.querySelector('[data-space-pause-label]');
      if (caption) caption.textContent = text; else if (!button.childElementCount) button.textContent = text;
    });
    storyLinks.querySelectorAll('a[data-story]').forEach(link => { link.href = storyURL(link.dataset.story); });
    if (reduced() || !pointerMedia.matches || isOpen()) resetPointer();
  }
  pauseButtons.forEach(button => button.addEventListener('click', () => {
    const paused = document.body.classList.toggle('motion-paused');
    syncMotion();
    document.dispatchEvent(new CustomEvent('rev-motion-change', {detail:{paused, motion:paused ? 'off' : 'on'}}));
  }));
  motionMedia.addEventListener('change', syncMotion);
  pointerMedia.addEventListener('change', syncMotion);
  if (document.body) new MutationObserver(syncMotion).observe(document.body, {attributes:true, attributeFilter:['class']});
  document.addEventListener('rev-motion-change', syncMotion);

  function onRoute(event) {
    // The same scene may live on the issue cover or move into Book view.
    const story = event.detail?.story ?? document.body.dataset.story;
    routeActive = !story;
    if (!available()) {
      const remember = resumeOpen || isOpen();
      cancelWarmup(); close(false);
      resumeOpen = remember;
    } else {
      resetPointer(); scheduleWarmup();
      if (resumeOpen) {
        resumeOpen = false;
        show(selectedChapter, currentIndex >= 0 ? currentIndex : requestedIndex);
      }
    }
  }
  document.addEventListener('rev-route', onRoute);
  window.addEventListener('rev-route', event => { if (event.target === window) onRoute(event); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { swipe = null; cancelWarmup(); resetPointer(); } else scheduleWarmup();
  });
  window.addEventListener('blur', resetPointer);

  if (object) {
    object.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && pointerMedia.matches && !reduced() && available() && !isOpen()) pointerBox = object.getBoundingClientRect();
    });
    object.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || !pointerMedia.matches || reduced() || !available() || isOpen()) return;
      pointerBox ||= object.getBoundingClientRect();
      pointerPosition = {x:event.clientX, y:event.clientY};
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointerPosition || !pointerBox || reduced() || !available() || isOpen()) return;
        const x = clamp((pointerPosition.x - pointerBox.left) / Math.max(1, pointerBox.width) * 2 - 1, -1, 1) * 3;
        const y = clamp((pointerPosition.y - pointerBox.top) / Math.max(1, pointerBox.height) * 2 - 1, -1, 1) * -3;
        object.style.setProperty('--pointer-x', `${x.toFixed(2)}deg`);
        object.style.setProperty('--pointer-y', `${y.toFixed(2)}deg`);
      });
    });
    object.addEventListener('pointerleave', resetPointer);
    object.addEventListener('pointercancel', resetPointer);
  }

  label.setAttribute('aria-live', 'polite'); label.setAttribute('aria-atomic', 'true');
  scene.dataset.spaceState = 'cover';
  routeActive = !document.body.dataset.story;
  updateControls(); syncMotion();
  // Do not compete with the physical cover or the first paint. Warm chapter
  // openings one at a time only after the cover has been displayed.
  const coverImage = scene.querySelector('.space-cover img');
  const afterCover = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    coverPainted = true; scheduleWarmup();
  }));
  if (!coverImage || (coverImage.complete && coverImage.naturalWidth)) afterCover();
  else {
    coverImage.addEventListener('load', afterCover, {once:true});
    coverImage.addEventListener('error', afterCover, {once:true});
  }
})();
