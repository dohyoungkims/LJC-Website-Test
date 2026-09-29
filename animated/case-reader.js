/* Shared LJC case-study reader. Used by project pages and the case-study index.
   Public API: LJCCaseReader.open({ title, pages, id? }, index?, trigger?). */
(() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.body.classList.contains('motion-paused');
  let dialog, image, stage, thumbs, transcript, count, scale;
  let study = null, pageIndex = 0, zoom = 1, returnFocus = null;
  let buttons = [];

  function mount() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'case-reader';
    dialog.id = 'case-reader';
    dialog.setAttribute('aria-labelledby', 'case-reader-title');
    dialog.innerHTML = `<div class="case-reader-toolbar"><div><h2 id="case-reader-title"></h2><p id="case-reader-count" aria-live="polite"></p></div><button type="button" class="case-reader-close" aria-label="Close case study reader" autofocus>×</button></div><div class="case-reader-workspace"><nav class="case-reader-thumbnails" aria-label="All case study spreads"></nav><div class="case-reader-stage" tabindex="0" aria-label="Case study artwork. Use plus and minus to zoom; scroll to pan when enlarged."><div class="case-reader-canvas"><img id="case-reader-image" alt=""></div></div></div><div class="case-reader-controls"><button type="button" data-reader-step="-1" aria-label="Previous case study spread">← <span>Previous</span></button><div class="case-reader-zoom" role="group" aria-label="Zoom case study artwork"><button type="button" data-reader-zoom="out" aria-label="Zoom out">−</button><button type="button" data-reader-zoom="fit" aria-label="Fit case study spread">Fit</button><span id="case-reader-scale" aria-live="polite">100%</span><button type="button" data-reader-zoom="in" aria-label="Zoom in">+</button></div><button type="button" data-reader-step="1" aria-label="Next case study spread"><span>Next</span> →</button></div><details class="case-reader-transcript"><summary>Read spread text</summary><div id="case-reader-text"></div></details>`;
    document.body.append(dialog);
    image = dialog.querySelector('#case-reader-image');
    stage = dialog.querySelector('.case-reader-stage');
    thumbs = dialog.querySelector('.case-reader-thumbnails');
    transcript = dialog.querySelector('.case-reader-transcript');
    count = dialog.querySelector('#case-reader-count');
    scale = dialog.querySelector('#case-reader-scale');
    image.addEventListener('load', () => fit(true));
    dialog.querySelector('.case-reader-close').addEventListener('click', () => dialog.close());
    dialog.querySelectorAll('[data-reader-step]').forEach(button => button.addEventListener('click', () => select(pageIndex + Number(button.dataset.readerStep))));
    dialog.querySelectorAll('[data-reader-zoom]').forEach(button => button.addEventListener('click', () => changeZoom(button.dataset.readerZoom)));
    dialog.addEventListener('close', () => {
      document.body.classList.remove('case-reader-active');
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
      document.dispatchEvent(new CustomEvent('ljc-case-reader-close', {detail:{id:study?.id, index:pageIndex}}));
    });
    dialog.addEventListener('keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const thumbnailFocus = thumbs.contains(event.target);
      let next = null;
      if (event.key === 'ArrowLeft') next = pageIndex - 1;
      else if (event.key === 'ArrowRight') next = pageIndex + 1;
      else if (thumbnailFocus && event.key === 'Home') next = 0;
      else if (thumbnailFocus && event.key === 'End') next = study.pages.length - 1;
      else if (thumbnailFocus && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        const columns = matchMedia('(max-width:700px)').matches ? 1 : 2;
        next = pageIndex + (event.key === 'ArrowDown' ? columns : -columns);
      }
      if (next !== null) {
        event.preventDefault();
        select(next);
        if (thumbnailFocus) buttons[pageIndex].focus({preventScroll:true});
      } else if (['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        changeZoom(event.key === '-' ? 'out' : event.key === '0' ? 'fit' : 'in');
      }
    });
    new ResizeObserver(() => fit()).observe(stage);
    media.addEventListener('change', () => {
      if (reduced()) dialog.getAnimations().forEach(animation => { try { animation.finish(); } catch (_) { animation.cancel(); } });
    });
  }

  function fit(reset = false) {
    if (!dialog?.open || !image.naturalWidth || !stage.clientWidth) return;
    const fitted = Math.min((stage.clientWidth - 16) / image.naturalWidth, (stage.clientHeight - 16) / image.naturalHeight);
    image.style.width = `${Math.max(1, Math.round(image.naturalWidth * fitted * zoom))}px`;
    image.style.height = 'auto';
    scale.textContent = `${Math.round(zoom * 100)}%`;
    dialog.querySelector('[data-reader-zoom="out"]').disabled = zoom <= 1;
    dialog.querySelector('[data-reader-zoom="in"]').disabled = zoom >= 4;
    if (reset) stage.scrollTo({left:0, top:0, behavior:'instant'});
  }

  function changeZoom(action) {
    zoom = action === 'fit' ? 1 : Math.max(1, Math.min(4, zoom + (action === 'in' ? .5 : -.5)));
    fit(action === 'fit');
  }

  function select(index) {
    pageIndex = Math.max(0, Math.min(study.pages.length - 1, index));
    const page = study.pages[pageIndex];
    zoom = 1;
    if (page.width && page.height) { image.width = page.width; image.height = page.height; }
    image.alt = page.alt || `${study.title}, spread ${pageIndex + 1}`;
    image.src = page.src;
    count.textContent = `${page.label || `Spread ${pageIndex + 1}`} · ${pageIndex + 1} of ${study.pages.length}`;
    dialog.querySelector('#case-reader-text').textContent = page.text?.trim() || 'This is a photographic spread. Use the zoom controls to explore the artwork.';
    transcript.open = false;
    dialog.querySelector('[data-reader-step="-1"]').disabled = pageIndex === 0;
    dialog.querySelector('[data-reader-step="1"]').disabled = pageIndex === study.pages.length - 1;
    buttons.forEach((button, number) => {
      button.tabIndex = number === pageIndex ? 0 : -1;
      if (number === pageIndex) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    fit(true);
    if (dialog.open) buttons[pageIndex]?.scrollIntoView({block:'nearest', inline:'nearest', behavior:reduced() ? 'instant' : 'smooth'});
  }

  function open(content, index = 0, trigger = null) {
    if (!Array.isArray(content?.pages) || !content.pages.length) return false;
    mount();
    study = content;
    returnFocus = trigger || document.activeElement;
    dialog.querySelector('#case-reader-title').textContent = content.title || 'Case study';
    buttons = study.pages.map((page, number) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'case-reader-thumb';
      button.setAttribute('aria-label', `Read spread ${number + 1} of ${study.pages.length}: ${page.label || `Spread ${number + 1}`}`);
      const thumb = document.createElement('img');
      thumb.src = page.thumbSrc || page.src;
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      if (page.width && page.height) { thumb.width = page.width; thumb.height = page.height; }
      const label = document.createElement('span');
      label.textContent = String(number + 1).padStart(2, '0');
      button.append(thumb, label);
      button.addEventListener('click', () => select(number));
      return button;
    });
    thumbs.replaceChildren(...buttons);
    select(index);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('case-reader-active');
    fit(true);
    buttons[pageIndex]?.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
    dialog.querySelector('.case-reader-close').focus({preventScroll:true});
    if (!reduced()) dialog.animate([{opacity:0},{opacity:1}], {duration:240,easing:'ease-out'});
    return true;
  }

  window.LJCCaseReader = Object.freeze({open, close:() => dialog?.close()});
})();
