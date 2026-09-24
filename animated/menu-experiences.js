/* LJC menus share Editorial's image transitions and staggered reveal. Gallery
 * uses a white spread; Colophon retains its left-hand hamburger-to-panel opening.
 * Built with local GSAP and native HTML dialog;
 * no third-party premium menu source is copied or embedded in this file. */
(() => {
  'use strict';
  const theme = document.body.dataset.theme;
  if (!['gallery', 'editorial', 'colophon'].includes(theme)) return;
  const dialog = document.getElementById('navigation');
  if (!dialog) return;
  const gsap = window.gsap;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const header = dialog.querySelector('.dialog-header');
  const logo = header.querySelector('img');
  const nav = dialog.querySelector('.menu-links');
  const links = Array.from(nav.querySelectorAll('a'));
  const contact = dialog.querySelector('.menu-contact');
  let phase = 'closed', timeline = null, imageTimeline = null, activeImage = 0;
  let previewRequest = 0, hasPreview = false;
  const readyImages = new WeakMap();
  let closingDone = null;
  let preview = null, imageBox = null, caption = null, counter = null;
  let images = [], projects = [];
  let morphSurface = null, morphBars = [];
  const menuLines = document.querySelector('.menu-trigger .menu-lines');

  dialog.dataset.menuExperience = theme;
  const body = document.createElement('div');
  body.className = 'menu-experience-body';
  const column = document.createElement('div');
  column.className = 'menu-links-column';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'menu-eyebrow';
  eyebrow.textContent = theme === 'colophon' ? 'LJC / Index' : 'Explore LJC';
  nav.before(body);
  column.append(eyebrow, nav);
  body.append(column);
  links.forEach((link) => link.querySelector('span')?.setAttribute('aria-hidden', 'true'));

  if (theme === 'colophon') {
    logo.src = '../assets/logo-white.png';
    morphSurface = document.createElement('div');
    morphSurface.className = 'colophon-morph-surface';
    morphSurface.setAttribute('aria-hidden', 'true');
    morphBars = Array.from({ length: 3 }, () => {
      const bar = document.createElement('span');
      bar.className = 'colophon-morph-bar';
      morphSurface.append(bar);
      return bar;
    });
    dialog.prepend(morphSurface);
  }
  {
    let data = {};
    try { data = JSON.parse(document.getElementById('project-data').textContent); } catch (_) { /* The links remain usable without preview data. */ }
    const fallback = Object.values(data).filter(project => project.image);
    projects = ['obama', 'wacker', 'harris-stowe', 'jaffe'].map((key, i) => data[key] || fallback[i % Math.max(1, fallback.length)]).filter(Boolean);
    if (projects.length) {
      preview = document.createElement('figure');
      preview.className = 'menu-project-preview';
      preview.setAttribute('aria-hidden', 'true');
      imageBox = document.createElement('div');
      imageBox.className = 'menu-preview-images';
      images = projects.map((project, index) => {
        const image = document.createElement('img');
        image.src = '../' + project.image;
        image.alt = '';
        image.decoding = 'async';
        image.loading = 'eager';
        image.dataset.preview = String(index);
        imageBox.append(image);
        return image;
      });
      const figcaption = document.createElement('figcaption');
      figcaption.className = 'menu-preview-caption';
      caption = document.createElement('span');
      caption.className = 'menu-preview-name';
      counter = document.createElement('span');
      counter.className = 'menu-preview-number';
      figcaption.append(caption, counter);
      preview.append(imageBox, figcaption);
      body.append(preview);
    }
  }

  function animated() { return Boolean(gsap && !media.matches && !document.body.classList.contains('motion-paused')); }
  function mark(next) { phase = next; dialog.dataset.menuPhase = next; }
  function hamburgerFrames() {
    const panel = dialog.getBoundingClientRect();
    const rect = menuLines?.getBoundingClientRect() || { left: panel.left + 24, top: panel.top + 24, width: 42, height: 23 };
    const thickness = rect.height > 21 ? 3 : 2;
    return morphBars.map((_, i) => ({ x: rect.left - panel.left, y: rect.top - panel.top + i * (rect.height - thickness) / 2, width: rect.width, height: thickness }));
  }
  function panelFrames() {
    const height = dialog.clientHeight / 3;
    return morphBars.map((_, i) => ({ x: 0, y: i * height, width: dialog.clientWidth, height: height + .5 }));
  }
  function setMorphFrames(frames) {
    morphBars.forEach((bar, i) => {
      if (gsap) gsap.set(bar, frames[i]);
      else Object.assign(bar.style, { transform: `translate(${frames[i].x}px,${frames[i].y}px)`, width: `${frames[i].width}px`, height: `${frames[i].height}px` });
    });
  }
  function resetMorph() {
    if (theme !== 'colophon') return;
    document.body.classList.remove('colophon-menu-morphing');
    dialog.style.setProperty('--menu-backdrop-opacity', '0');
  }
  function imageReady(image) {
    if (readyImages.has(image)) return readyImages.get(image);
    const ready = new Promise(resolve => {
      const decode = () => {
        if (!image.naturalWidth) { resolve(false); return; }
        if (!image.decode) { resolve(true); return; }
        image.decode().then(() => resolve(true), () => resolve(image.complete && image.naturalWidth > 0));
      };
      if (image.complete) { decode(); return; }
      const cleanup = () => {
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
      };
      const loaded = () => { cleanup(); decode(); };
      const failed = () => { cleanup(); resolve(false); };
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', failed, { once: true });
    });
    readyImages.set(image, ready);
    return ready;
  }
  async function setPreview(index, animate = true) {
    if (!images.length) return;
    index %= images.length;
    const request = ++previewRequest;
    if (!await imageReady(images[index])) {
      // Keep the last usable photo. On first open, try another original asset.
      if (hasPreview) return;
      index = (await Promise.all(images.map(imageReady))).findIndex(Boolean);
    }
    if (request !== previewRequest || !['opening', 'open'].includes(phase) || index < 0) return;
    const previous = hasPreview ? activeImage : index;
    activeImage = index;
    hasPreview = true;
    caption.textContent = projects[index].title;
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
    links.forEach((link, i) => link.toggleAttribute('data-preview-active', i === index));
    imageTimeline?.kill();
    imageTimeline = null;
    if (!animated() || !animate || previous === index) {
      images.forEach((image, i) => {
        if (gsap) gsap.set(image, { autoAlpha: i === index ? 1 : 0, scale: 1 });
        else {
          image.style.opacity = i === index ? '1' : '0';
          image.style.visibility = i === index ? 'visible' : 'hidden';
          image.style.transform = '';
        }
        image.style.zIndex = i === index ? '1' : '0';
      });
      return;
    }
    images.forEach((image, i) => {
      image.style.zIndex = i === index ? '1' : '0';
      if (i !== index && i !== previous) gsap.set(image, { autoAlpha: 0, scale: 1 });
    });
    // A fast hover may interrupt the incoming photo before it is opaque.
    gsap.set(images[previous], { autoAlpha: 1, scale: 1 });
    imageTimeline = gsap.timeline({ onComplete() { imageTimeline = null; } })
      .to(images[previous], { autoAlpha: 0, duration: .35, ease: 'power2.out' }, 0)
      .fromTo(images[index], { autoAlpha: 0, scale: 1.045 }, { autoAlpha: 1, scale: 1, duration: .65, ease: 'power3.out' }, 0);
  }
  links.forEach((link, index) => {
    const select = () => { if (phase === 'open' || phase === 'opening') setPreview(index); };
    link.addEventListener('pointerenter', select);
    link.addEventListener('focus', select);
  });

  function clearPresentation() {
    if (!gsap) return;
    gsap.set([dialog, header, logo, body, eyebrow, contact, ...links, ...(preview ? [preview, imageBox] : [])], {
      clearProps: 'clipPath,transform,opacity,visibility',
    });
  }
  function finishOpen() {
    timeline = null;
    clearPresentation();
    if (theme === 'colophon') {
      setMorphFrames(panelFrames());
      dialog.style.setProperty('--menu-backdrop-opacity', '1');
    }
    mark('open');
  }
  function finishClose() {
    timeline = null;
    mark('closed');
    resetMorph();
    const done = closingDone;
    closingDone = null;
    done?.();
    clearPresentation();
  }
  function open(target) {
    if (target !== dialog) return false;
    timeline?.kill(); imageTimeline?.kill();
    timeline = imageTimeline = null;
    closingDone = null;
    clearPresentation();
    mark('opening');
    if (theme === 'colophon') {
      dialog.scrollTop = 0;
      setMorphFrames(hamburgerFrames());
      document.body.classList.add('colophon-menu-morphing');
      dialog.style.setProperty('--menu-backdrop-opacity', '0');
    }
    setPreview(0, false);
    if (!animated()) { finishOpen(); return true; }

    timeline = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: finishOpen });
    if (theme !== 'colophon') {
      timeline.fromTo(dialog, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .7, ease: 'power3.inOut' }, 0)
        .fromTo(logo, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: .42 }, .2)
        .fromTo(eyebrow, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45 }, .28)
        .fromTo(links, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: .62, stagger: .065 }, .32)
        .fromTo(contact, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45 }, .62);
      if (preview) timeline.fromTo(preview, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .68 }, .32)
        .fromTo(imageBox, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .78, ease: 'power3.inOut' }, .28);
    } else {
      const frames = panelFrames();
      morphBars.forEach((bar, i) => timeline.to(bar, { ...frames[i], duration: .68, ease: 'power3.inOut' }, i * .03));
      timeline.fromTo(logo, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: .42 }, .24)
        .fromTo(eyebrow, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45 }, .3)
        .fromTo(links, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: .62, stagger: .065 }, .34)
        .fromTo(contact, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45 }, .64)
        .to(dialog, { '--menu-backdrop-opacity': 1, duration: .45, ease: 'power2.out' }, .05);
      if (preview) timeline.fromTo(preview, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .68 }, .38)
        .fromTo(imageBox, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .72, ease: 'power3.inOut' }, .34);
    }
    return true;
  }
  function close(target, done) {
    if (target !== dialog) { done?.(); return; }
    if (phase === 'closing') return;
    previewRequest += 1;
    timeline?.kill(); imageTimeline?.kill();
    timeline = imageTimeline = null;
    closingDone = done;
    if (theme === 'colophon') dialog.scrollTop = 0;
    mark('closing');
    if (!animated()) { finishClose(); return; }
    timeline = gsap.timeline({ onComplete: finishClose });
    if (theme !== 'colophon') {
      timeline.to([eyebrow, ...links, contact, ...(preview ? [preview] : [])], { autoAlpha: 0, y: -12, duration: .22, ease: 'power2.in' }, 0)
        .to(dialog, { clipPath: 'inset(0% 0% 100% 0%)', duration: .5, ease: 'power3.inOut' }, .1);
    } else {
      const frames = hamburgerFrames();
      timeline.to([eyebrow, ...links, contact, ...(preview ? [preview] : [])], { autoAlpha: 0, y: -12, duration: .22, ease: 'power2.in' }, 0)
        .to(header, { autoAlpha: 0, y: -5, duration: .18, ease: 'power2.in' }, .02);
      morphBars.forEach((bar, i) => timeline.to(bar, { ...frames[i], duration: .5, ease: 'power3.inOut' }, .1 + (2 - i) * .025));
      timeline.to(dialog, { '--menu-backdrop-opacity': 0, duration: .4, ease: 'power2.inOut' }, .14);
    }
  }
  function settle(target) {
    if (target && target !== dialog) return;
    if (animated()) return;
    timeline?.progress(1);
    imageTimeline?.progress(1);
  }
  dialog.addEventListener('close', () => {
    previewRequest += 1;
    timeline?.kill(); imageTimeline?.kill();
    timeline = imageTimeline = null;
    closingDone = null;
    resetMorph();
    clearPresentation();
    mark('closed');
  });
  media.addEventListener('change', () => settle(dialog));
  const preferenceObserver = new MutationObserver(() => settle(dialog));
  preferenceObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (theme === 'colophon') addEventListener('resize', () => {
    // Complete a morph measured at the old size before applying fresh geometry.
    if (phase === 'opening' || phase === 'closing') timeline?.progress(1);
    if (phase === 'open') setMorphFrames(panelFrames());
  }, { passive: true });
  window.LJCMenuExperience = Object.freeze({ handles: target => target === dialog, open, close, settle });
})();
