/* Shared reader. History belongs to the caller.
   open({title,pages,id?,kind?,chapters?,stories?,returnTarget(index)?}, index?, trigger?)
   Selection is emitted after artwork has decoded; story actions emit
   ljc-case-reader-story {id,storyId,index}. close() is immediate for routing. */
(() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.body.classList.contains('motion-paused');
  const ease = 'cubic-bezier(.2,.7,.2,1)';
  const cache = new Map(), animations = new Set(), pointers = new Map();
  let dialog, image, stage, canvas, thumbs, transcript, count, scale, status, position;
  let study = null, pageIndex = -1, requestedIndex = 0, zoom = 1, maxZoom = 1;
  let returnFocus = null, buttons = [], request = 0, loadingTimer, closing = false;
  let gesture = null, lastTap = null, doubleTapAt = 0;

  function motion(node, frames, options, cleanup = () => {}) {
    const animation = node.animate(frames, options);
    const item = {animation, cleanup};
    animations.add(item);
    const done = () => { if (animations.delete(item)) cleanup(); };
    animation.finished.then(done, done);
    return animation;
  }
  function stopMotion() {
    for (const item of [...animations]) { animations.delete(item); item.animation.cancel(); item.cleanup(); }
  }
  function stopGesture() {
    gesture = null; pointers.clear();
    stage?.classList.remove('is-dragging');
    if (image) image.style.transform = '';
  }
  function visible(element) { return element?.isConnected && element.getClientRects().length > 0; }
  function imageRect(element) {
    const picture = element?.matches?.('img') ? element : element?.querySelector?.('img');
    if (!visible(picture)) return null;
    const rect = picture.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }
  function clearLoading() {
    clearTimeout(loadingTimer);
    dialog?.classList.remove('is-loading');
    stage?.setAttribute('aria-busy', 'false');
  }
  function prepare(page) {
    if (cache.has(page.src)) return cache.get(page.src);
    const promise = new Promise((resolve, reject) => {
      const artwork = new Image();
      artwork.decoding = 'async';
      artwork.onload = async () => {
        try { await artwork.decode(); } catch (_) { /* A complete image can still be displayed when decode is unavailable. */ }
        if (artwork.naturalWidth) resolve(artwork);
        else reject(new Error('Image could not be decoded'));
      };
      artwork.onerror = () => reject(new Error('Image could not be loaded'));
      artwork.src = page.src;
    });
    cache.set(page.src, promise);
    promise.catch(() => { if (cache.get(page.src) === promise) cache.delete(page.src); });
    while (cache.size > 8) cache.delete(cache.keys().next().value);
    return promise;
  }
  function preloadNeighbors(index) {
    for (const next of [index - 1, index + 1]) {
      if (study.pages[next]) prepare(study.pages[next]).catch(() => {});
    }
  }

  function mount() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'case-reader'; dialog.id = 'case-reader';
    dialog.setAttribute('aria-labelledby', 'case-reader-title');
    dialog.innerHTML = `<div class="case-reader-toolbar"><div><h2 id="case-reader-title"></h2><p id="case-reader-count" aria-live="polite"></p><a class="case-reader-story" hidden></a><button type="button" class="case-reader-story" hidden></button></div><button type="button" class="case-reader-close" aria-label="Close case study reader" autofocus>×</button></div><div class="case-reader-workspace"><nav class="case-reader-thumbnails" aria-label="All case study spreads"></nav><div class="case-reader-stage" tabindex="0"><div class="case-reader-canvas"><img id="case-reader-image" alt="" hidden></div><div class="case-reader-status" role="status"></div></div></div><div class="case-reader-controls"><button type="button" data-reader-step="-1" aria-label="Previous case study spread">← <span>Previous</span></button><div class="case-reader-zoom" role="group" aria-label="Zoom case study artwork"><button type="button" data-reader-zoom="out" aria-label="Zoom out">−</button><button type="button" data-reader-zoom="fit" aria-label="Fit case study spread">Fit</button><span id="case-reader-scale" aria-live="polite" title="Zoom relative to fit">100%</span><button type="button" data-reader-zoom="in" aria-label="Zoom in">+</button></div><button type="button" data-reader-step="1" aria-label="Next case study spread"><span>Next</span> →</button></div><label class="case-reader-position" hidden><span>Book position</span><input type="range" min="0" step="1" value="0" aria-label="Book position"><output></output></label><details class="case-reader-transcript"><summary>Read spread text</summary><div id="case-reader-text"></div></details>`;
    document.body.append(dialog);
    image = dialog.querySelector('#case-reader-image');
    stage = dialog.querySelector('.case-reader-stage'); canvas = dialog.querySelector('.case-reader-canvas');
    thumbs = dialog.querySelector('.case-reader-thumbnails'); transcript = dialog.querySelector('.case-reader-transcript');
    count = dialog.querySelector('#case-reader-count'); scale = dialog.querySelector('#case-reader-scale');
    status = dialog.querySelector('.case-reader-status'); position = dialog.querySelector('.case-reader-position');
    dialog.querySelector('.case-reader-close').addEventListener('click', () => closeReader(true));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeReader(true); });
    dialog.querySelectorAll('[data-reader-step]').forEach(button => button.addEventListener('click', () => select(requestedIndex + Number(button.dataset.readerStep))));
    dialog.querySelectorAll('[data-reader-zoom]').forEach(button => button.addEventListener('click', () => changeZoom(button.dataset.readerZoom)));
    dialog.querySelectorAll('.case-reader-story').forEach(link => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('ljc-case-reader-story', {detail:{id:study.id,storyId:link.dataset.storyId,index:pageIndex}}));
    }));
    position.querySelector('input').addEventListener('input', event => updatePosition(Number(event.target.value)));
    position.querySelector('input').addEventListener('change', event => select(Number(event.target.value)));
    dialog.addEventListener('close', () => {
      if (dialog.open) return; // A queued close from an earlier opening must not tear down a new reader.
      ++request; clearLoading(); stopMotion(); stopGesture(); closing = false;
      document.body.classList.remove('case-reader-active');
      if (visible(returnFocus)) returnFocus.focus({preventScroll:true});
      document.dispatchEvent(new CustomEvent('ljc-case-reader-close', {detail:{id:study?.id,index:Math.max(0,pageIndex)}}));
    });
    dialog.addEventListener('keydown', onKey);
    stage.addEventListener('pointerdown', pointerDown);
    stage.addEventListener('pointermove', pointerMove);
    stage.addEventListener('pointerup', pointerUp);
    stage.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); stopGesture(); });
    stage.addEventListener('dblclick', event => {
      if (performance.now() - doubleTapAt < 450) return;
      event.preventDefault(); toggleZoom(event.clientX, event.clientY);
    });
    stage.addEventListener('dragstart', event => event.preventDefault());
    new ResizeObserver(() => fit(false)).observe(stage);
    const motionChanged = () => {
      if (!reduced()) return;
      if (closing) closeReader(false); else stopMotion();
    };
    media.addEventListener('change', motionChanged);
    new MutationObserver(motionChanged).observe(document.body, {attributes:true,attributeFilter:['class']});
  }

  function fit(reset = false, anchor = null) {
    if (!dialog?.open || image.hidden || !image.naturalWidth || !stage.clientWidth) return;
    const before = image.getBoundingClientRect(), box = stage.getBoundingClientRect();
    const point = anchor || {x:box.left + stage.clientWidth / 2,y:box.top + stage.clientHeight / 2};
    const fraction = {x:before.width ? (point.x - before.left) / before.width : .5,y:before.height ? (point.y - before.top) / before.height : .5};
    const fitted = Math.min(1, Math.max(1,stage.clientWidth - 16) / image.naturalWidth, Math.max(1,stage.clientHeight - 16) / image.naturalHeight);
    // At the limit, one source pixel occupies at most one CSS pixel. This avoids
    // enlarging small source artwork into an arbitrary, blurry 400% view.
    maxZoom = Math.max(1, Math.min(8, 1 / fitted));
    zoom = Math.min(zoom, maxZoom);
    const width = Math.round(image.naturalWidth * fitted * zoom), height = Math.round(image.naturalHeight * fitted * zoom);
    image.style.width = `${width}px`; image.style.height = `${height}px`;
    canvas.style.width = `${Math.max(stage.clientWidth,width + 16)}px`;
    canvas.style.height = `${Math.max(stage.clientHeight,height + 16)}px`;
    scale.textContent = `${Math.round(zoom * 100)}%`;
    dialog.querySelector('[data-reader-zoom="out"]').disabled = zoom <= 1.001;
    dialog.querySelector('[data-reader-zoom="in"]').disabled = zoom >= maxZoom - .001;
    stage.classList.toggle('is-zoomed', zoom > 1.001);
    if (reset) stage.scrollTo({left:0,top:0,behavior:'instant'});
    else {
      const after = image.getBoundingClientRect();
      stage.scrollBy({left:after.left + fraction.x * after.width - point.x,top:after.top + fraction.y * after.height - point.y,behavior:'instant'});
    }
  }
  function changeZoom(action, anchor = null) {
    if (pageIndex < 0 || closing) return;
    stopMotion();
    zoom = action === 'fit' ? 1 : Math.max(1, Math.min(maxZoom, zoom + (action === 'in' ? .5 : -.5)));
    fit(action === 'fit', anchor);
  }
  function toggleZoom(x, y) {
    if (pageIndex < 0 || closing) return;
    stopMotion(); zoom = zoom > 1.001 ? 1 : Math.min(2,maxZoom);
    fit(zoom === 1,{x,y});
  }
  function onKey(event) {
    if (closing) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches('input,textarea,select,[contenteditable=true]')) return;
    const thumbnailFocus = thumbs.contains(event.target), artworkFocus = stage.contains(event.target);
    if (artworkFocus && zoom > 1.001 && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      stage.scrollBy({left:event.key === 'ArrowLeft' ? -80 : event.key === 'ArrowRight' ? 80 : 0,top:event.key === 'ArrowUp' ? -80 : event.key === 'ArrowDown' ? 80 : 0,behavior:'instant'});
      return;
    }
    let next = null;
    if (event.key === 'ArrowLeft') next = requestedIndex - 1;
    else if (event.key === 'ArrowRight') next = requestedIndex + 1;
    else if (thumbnailFocus && event.key === 'Home') next = 0;
    else if (thumbnailFocus && event.key === 'End') next = study.pages.length - 1;
    else if (thumbnailFocus && ['ArrowUp','ArrowDown'].includes(event.key)) next = requestedIndex + (event.key === 'ArrowDown' ? 1 : -1) * (matchMedia('(max-width:700px)').matches ? 1 : 2);
    if (next !== null) {
      event.preventDefault(); select(next);
      if (thumbnailFocus) buttons[requestedIndex]?.focus({preventScroll:true});
    } else if (['+','=','-','0'].includes(event.key)) {
      event.preventDefault(); changeZoom(event.key === '-' ? 'out' : event.key === '0' ? 'fit' : 'in');
    }
  }

  function pointerDown(event) {
    if (event.button !== 0 || pageIndex < 0 || closing || event.target.closest('button,a,input,select,textarea')) return;
    stopMotion(); stage.focus({preventScroll:true});
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    try { stage.setPointerCapture(event.pointerId); } catch (_) {}
    if (pointers.size === 2) {
      const [a,b] = [...pointers.values()];
      gesture = {kind:'pinch',distance:Math.hypot(b.x-a.x,b.y-a.y),zoom};
      for (const id of pointers.keys()) { try { stage.setPointerCapture(id); } catch (_) {} }
    } else if (pointers.size === 1) {
      gesture = {kind:zoom > 1.001 ? 'pan' : 'swipe',id:event.pointerId,x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop,time:performance.now(),touch:event.pointerType !== 'mouse',dragged:false};
      if (gesture.kind === 'pan') { stage.setPointerCapture(event.pointerId); stage.classList.add('is-dragging'); }
    }
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (gesture.kind === 'pinch' && pointers.size === 2) {
      const [a,b] = [...pointers.values()];
      zoom = Math.max(1,Math.min(maxZoom,gesture.zoom * Math.hypot(b.x-a.x,b.y-a.y) / Math.max(1,gesture.distance)));
      fit(false,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}); event.preventDefault(); return;
    }
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (gesture.kind === 'pan') {
      if (Math.hypot(dx,dy) > 4) gesture.dragged = true;
      stage.scrollTo({left:gesture.left-dx,top:gesture.top-dy,behavior:'instant'}); event.preventDefault();
    } else if (gesture.touch && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      gesture.dragged = true;
      try { stage.setPointerCapture(event.pointerId); } catch (_) {}
      image.style.transform = reduced() ? '' : `translateX(${dx * .7}px)`;
      event.preventDefault();
    }
  }
  function pointerUp(event) {
    const previous = gesture;
    pointers.delete(event.pointerId);
    if (!previous) return;
    if (previous.kind === 'pinch') {
      const remaining = [...pointers.entries()][0];
      gesture = remaining ? {kind:'pan',id:remaining[0],x:remaining[1].x,y:remaining[1].y,left:stage.scrollLeft,top:stage.scrollTop,time:performance.now(),touch:true,dragged:true} : null;
      if (!remaining) stage.classList.remove('is-dragging');
      return;
    }
    const dx = event.clientX-previous.x, dy = event.clientY-previous.y;
    image.style.transform = ''; stage.classList.remove('is-dragging'); gesture = null;
    if (previous.kind === 'swipe' && previous.touch && previous.dragged && Math.abs(dx) > Math.abs(dy)*1.4 && (Math.abs(dx) > stage.clientWidth*.18 || (Math.abs(dx) > 35 && Math.abs(dx)/Math.max(1,performance.now()-previous.time) > .35))) {
      select(requestedIndex + (dx < 0 ? 1 : -1));
    } else if (previous.touch && !previous.dragged && Math.hypot(dx,dy) < 8) {
      if (lastTap && performance.now()-lastTap.time < 300 && Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y) < 30) {
        event.preventDefault(); doubleTapAt = performance.now(); toggleZoom(event.clientX,event.clientY); lastTap = null;
      } else lastTap = {time:performance.now(),x:event.clientX,y:event.clientY};
    }
  }

  function chapterAt(index) {
    return study.chapters?.find((chapter,i,list) => index >= chapter.startIndex && index <= (chapter.endIndex ?? ((list[i+1]?.startIndex ?? study.pages.length)-1)));
  }
  function updatePosition(index) {
    const page = study.pages[index], input = position.querySelector('input');
    input.value = index;
    input.setAttribute('aria-valuetext', `${chapterAt(index)?.title || study.title}, ${page.label || `Spread ${index+1}`}, ${index+1} of ${study.pages.length}`);
    position.querySelector('output').textContent = `${index+1} / ${study.pages.length}`;
  }
  function updateContext() {
    const page = study.pages[pageIndex], chapter = chapterAt(pageIndex);
    count.textContent = [chapter?.title,page.label || `Spread ${pageIndex+1}`,`${pageIndex+1} of ${study.pages.length}`].filter(Boolean).join(' · ');
    const story = study.stories?.find(item => pageIndex >= item.startIndex && pageIndex <= item.endIndex);
    dialog.querySelectorAll('.case-reader-story').forEach(link => {
      link.hidden = !story || (link.tagName === 'A') !== Boolean(story?.href);
      if (!story) return;
      link.textContent = 'Read this story online ↗'; link.dataset.storyId = story.id;
      link.setAttribute('aria-label', `Read ${story.title} online`);
      if (link.tagName === 'A') link.href = story.href;
    });
    dialog.querySelector('#case-reader-text').textContent = page.text?.trim() || 'No transcript is available for this spread. Use the zoom controls to explore the artwork.';
    buttons.forEach((button,index) => {
      button.tabIndex = index === pageIndex ? 0 : -1;
      if (index === pageIndex) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    updatePosition(pageIndex);
  }
  function updateSteps() {
    dialog.querySelector('[data-reader-step="-1"]').disabled = requestedIndex <= 0;
    dialog.querySelector('[data-reader-step="1"]').disabled = requestedIndex >= study.pages.length-1;
  }
  function fly(from, to, entering, targetImage) {
    if (!from || !to || reduced()) return false;
    const clone = targetImage.cloneNode();
    clone.removeAttribute('id'); clone.alt = ''; clone.setAttribute('aria-hidden','true');
    clone.className = 'case-reader-flight';
    Object.assign(clone.style,{left:`${to.left}px`,top:`${to.top}px`,width:`${to.width}px`,height:`${to.height}px`});
    dialog.append(clone); targetImage.style.visibility = 'hidden';
    const displacement = `translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`;
    motion(clone, entering ? [{transform:displacement},{transform:'none'}] : [{transform:'none'},{transform:displacement}], {duration:entering ? 420 : 360,easing:entering ? ease : 'cubic-bezier(.4,0,.2,1)'}, () => { clone.remove(); targetImage.style.visibility = ''; });
    return true;
  }

  async function select(index, {openingRect = null, opening = false} = {}) {
    if (!study || closing) return;
    const target = Math.max(0,Math.min(study.pages.length-1,Math.trunc(Number(index)) || 0));
    requestedIndex = target; updateSteps();
    const token = ++request, content = study;
    clearLoading(); stage.setAttribute('aria-busy','true'); status.textContent = '';
    loadingTimer = setTimeout(() => { if (request === token) { dialog.classList.add('is-loading'); status.textContent = pageIndex < 0 ? 'Loading artwork…' : ''; } },150);
    try {
      const decoded = await prepare(content.pages[target]);
      if (request !== token || !dialog.open || closing || study !== content) return;
      clearLoading(); stopMotion(); stopGesture();
      const direction = Math.sign(target-pageIndex), hadImage = pageIndex >= 0;
      const page = content.pages[target];
      const nextImage = decoded.cloneNode();
      // The decoded source is cached; decoding the clone guarantees the DOM
      // image itself is ready before its label and artwork are committed.
      if (nextImage.decode) await nextImage.decode().catch(() => {});
      if (request !== token || !dialog.open || closing || study !== content) return;
      nextImage.id = 'case-reader-image'; nextImage.alt = page.alt || `${study.title}, spread ${target+1}`;
      nextImage.width = decoded.naturalWidth; nextImage.height = decoded.naturalHeight;
      image.replaceWith(nextImage); image = nextImage;
      pageIndex = target; zoom = 1; transcript.open = false; status.textContent = '';
      updateContext(); fit(true);
      buttons[pageIndex]?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      const didFly = opening && fly(openingRect,image.getBoundingClientRect(),true,image);
      if (!didFly) motion(image,reduced() ? [{opacity:.35},{opacity:1}] : [{opacity:.15,transform:`translateX(${hadImage ? direction*18 : 0}px)`},{opacity:1,transform:'none'}],{duration:reduced() ? 90 : 240,easing:ease});
      document.dispatchEvent(new CustomEvent('ljc-case-reader-selection',{detail:{id:study.id,index:pageIndex}}));
      preloadNeighbors(pageIndex);
    } catch (_) {
      if (request !== token || !dialog.open || closing) return;
      clearLoading(); requestedIndex = pageIndex < 0 ? target : pageIndex; updateSteps();
      status.replaceChildren(document.createTextNode('Artwork could not load. '));
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again';
      retry.addEventListener('click',() => select(target,{openingRect,opening})); status.append(retry);
    }
  }

  function closeReader(animate = false) {
    if (!dialog?.open || (closing && animate)) return;
    ++request; clearLoading(); stopMotion(); stopGesture();
    if (closing) { closing = false; dialog.close(); return; }
    closing = true;
    let target = returnFocus;
    if (animate && typeof study.returnTarget === 'function') {
      try { target = study.returnTarget(Math.max(0,pageIndex)) || target; } catch (_) {}
    }
    if (visible(target)) {
      returnFocus = target;
      if (animate) target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    }
    if (!animate || reduced() || pageIndex < 0) { dialog.close(); return; }
    const token = request, rect = imageRect(target), current = image.getBoundingClientRect();
    const didFly = fly(rect,current,false,image);
    const duration = didFly ? 360 : 120;
    const parts = [...dialog.children].filter(child => !child.classList.contains('case-reader-flight'));
    parts.forEach(part => motion(part,[{opacity:1,offset:0},{opacity:0,offset:.45},{opacity:0,offset:1}],{duration,easing:'ease-out'}));
    const done = motion(dialog,[{backgroundColor:'#242523'},{backgroundColor:'rgba(36,37,35,0)'}],{duration,easing:'ease-out'});
    done.finished.then(() => { if (request === token && closing) dialog.close(); },() => {});
  }

  function open(content, index = 0, trigger = null) {
    if (!Array.isArray(content?.pages) || !content.pages.length) return false;
    mount(); ++request; clearLoading(); stopMotion(); stopGesture(); closing = false;
    const wasOpen = dialog.open, sameContent = study?.id === content.id && study?.pages === content.pages;
    const openingRect = imageRect(trigger);
    if (!wasOpen || !sameContent) {
      pageIndex = -1; image.hidden = true; count.textContent = ''; status.textContent = '';
      dialog.querySelectorAll('.case-reader-story').forEach(link => { link.hidden = true; });
    }
    study = content; const book = content.kind === 'book';
    dialog.dataset.readerKind = book ? 'book' : 'case';
    dialog.querySelector('#case-reader-title').textContent = content.title || 'Case study';
    dialog.querySelector('.case-reader-close').setAttribute('aria-label',book ? 'Close book reader' : 'Close case study reader');
    thumbs.setAttribute('aria-label',book ? 'All book spreads' : 'All case study spreads');
    stage.setAttribute('aria-label',`${book ? 'Book' : 'Case study'} artwork. Plus and minus zoom; double-click or double-tap toggles zoom. Drag or use arrow keys to pan when enlarged.`);
    for (const step of [-1,1]) dialog.querySelector(`[data-reader-step="${step}"]`).setAttribute('aria-label',`${step < 0 ? 'Previous' : 'Next'} ${book ? 'book' : 'case study'} spread`);
    dialog.querySelector('.case-reader-zoom').setAttribute('aria-label',`Zoom ${book ? 'book' : 'case study'} artwork`);
    dialog.querySelector('[data-reader-zoom="fit"]').setAttribute('aria-label',`Fit ${book ? 'book' : 'case study'} spread`);
    returnFocus = trigger || (!wasOpen ? document.activeElement : returnFocus);
    position.hidden = !book; position.querySelector('input').max = content.pages.length-1;
    position.style.setProperty('--reader-stops',Math.max(1,content.pages.length-1));
    const ticks = (content.chapters || []).map(chapter => {
      const at = Math.min(100,Math.max(0,chapter.startIndex / Math.max(1,content.pages.length-1) * 100));
      return `transparent ${at}%, #ede9dc88 ${at}%, #ede9dc88 calc(${at}% + 1px), transparent calc(${at}% + 1px)`;
    });
    position.style.setProperty('--reader-chapter-ticks',ticks.length ? `linear-gradient(to right,${ticks.join(',')})` : 'linear-gradient(transparent,transparent)');
    if (!sameContent || !buttons.length) {
      buttons = study.pages.map((page,number) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'case-reader-thumb';
        button.setAttribute('aria-label',`Read ${page.label || `spread ${number+1}`}, ${number+1} of ${study.pages.length}`);
        button.tabIndex = -1;
        const thumb = document.createElement('img'); thumb.src = page.thumbSrc || page.src; thumb.alt = ''; thumb.loading = 'lazy'; thumb.decoding = 'async';
        if (page.width && page.height) { thumb.width = page.width; thumb.height = page.height; }
        const label = document.createElement('span'); label.textContent = String(number+1).padStart(2,'0'); button.append(thumb,label);
        button.addEventListener('click',() => select(number)); return button;
      });
      thumbs.replaceChildren(...buttons);
    }
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('case-reader-active');
    dialog.querySelector('.case-reader-close').focus({preventScroll:true});
    if (!wasOpen) motion(dialog,[{opacity:0},{opacity:1}],{duration:reduced() ? 90 : 200,easing:'ease-out'});
    select(index,{openingRect,opening:!wasOpen});
    return true;
  }

  window.LJCCaseReader = Object.freeze({open,close:() => closeReader(false)});
})();
