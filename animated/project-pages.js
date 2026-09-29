(() => {
  'use strict';
  const theme = document.body.dataset.projectTheme;
  const query = new URLSearchParams(location.search);
  const library = JSON.parse(document.getElementById('project-library').textContent).projects;
  const requestedProject = query.get('project');
  const project = library.find(item => item.id === requestedProject) || library.find(item => item.id === document.body.dataset.projectId) || library[0];
  if (project.id !== document.body.dataset.projectId) {
    const template = document.getElementById(`project-template-${project.id}`);
    if (template) document.getElementById('project-page').replaceChildren(template.content.cloneNode(true));
  }
  document.body.dataset.projectId = project.id;
  document.documentElement.classList.remove('project-selecting');
  document.title = `${project.title} — LJC ${theme.charAt(0).toUpperCase() + theme.slice(1)} project study`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', project.summary);
  if (requestedProject && !library.some(item => item.id === requestedProject)) {
    const note = document.createElement('p');
    note.className = 'project-route-notice';
    note.setAttribute('role', 'status');
    note.textContent = `That project is not in this collection. Showing ${project.title}.`;
    document.querySelector('main').prepend(note);
  }
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = query.get('motion') === 'off';
  const dialogFocus = new WeakMap();
  const photos = project.images;
  const viewer = document.getElementById('photo-viewer');
  const info = document.getElementById('project-information');
  let photoIndex = 0;
  const reduced = () => paused || media.matches;

  document.querySelectorAll('[data-home-section]').forEach(link => link.addEventListener('click', event => {
    if (parent === window || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    parent.postMessage({type:'ljc-home',section:link.dataset.homeSection},location.origin);
  }));

  function setMotion(value, notify = true) {
    paused = Boolean(value);
    document.body.classList.toggle('motion-paused', reduced());
    document.documentElement.style.scrollBehavior = reduced() ? 'auto' : 'smooth';
    if (reduced()) document.getAnimations().forEach(animation => { try { animation.finish(); } catch (_) { animation.cancel(); } });
    if (notify && parent !== window) parent.postMessage({type:'ljc-motion-state', paused, reduced:reduced(), system:media.matches}, location.origin);
  }

  function showDialog(dialog, trigger) {
    if (!dialog || dialog.open) return;
    dialogFocus.set(dialog, trigger || document.activeElement);
    dialog.showModal();
    if (!reduced()) dialog.animate(
      dialog === info ? [{transform:'translateX(35px)',opacity:0},{transform:'none',opacity:1}] : [{opacity:0},{opacity:1}],
      {duration:320,easing:'cubic-bezier(.22,.7,.2,1)'}
    );
  }

  document.querySelector('.project-info-trigger')?.addEventListener('click', event => showDialog(info, event.currentTarget));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => dialogFocus.get(dialog)?.focus({preventScroll:true}));
  });

  function selectPhoto(index) {
    photoIndex = Math.max(0, Math.min(photos.length - 1, index));
    const photo = photos[photoIndex];
    const image = document.getElementById('viewer-image');
    image.width = photo.width;
    image.height = photo.height;
    image.src = photo.src;
    image.alt = photo.alt;
    document.getElementById('viewer-count').textContent = `${String(photoIndex + 1).padStart(2,'0')} / ${String(photos.length).padStart(2,'0')}`;
    document.getElementById('viewer-caption').textContent = [photo.caption || photo.alt, photo.credit].filter(Boolean).join(' — ');
    document.getElementById('previous-photo').disabled = photoIndex === 0;
    document.getElementById('next-photo').disabled = photoIndex === photos.length - 1;
  }
  document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', event => {
    selectPhoto(Number(button.dataset.photo));
    showDialog(viewer, event.currentTarget);
  }));
  document.getElementById('previous-photo').addEventListener('click', () => selectPhoto(photoIndex - 1));
  document.getElementById('next-photo').addEventListener('click', () => selectPhoto(photoIndex + 1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });

  const casePages = project.caseStudy?.pages || [];
  const reader = document.getElementById('case-reader');
  const track = document.querySelector('.case-pages-track');
  const caseCards = Array.from(document.querySelectorAll('.case-page'));
  let caseIndex = 0;
  let caseZoom = 1;
  let caseScrollFrame = 0;
  const readerImage = document.getElementById('case-reader-image');
  const readerStage = document.querySelector('.case-reader-stage');

  function fitCaseImage(resetPosition = false) {
    if (!reader?.open || !readerImage.naturalWidth || !readerStage.clientWidth) return;
    const fit = Math.min((readerStage.clientWidth - 16) / readerImage.naturalWidth, (readerStage.clientHeight - 16) / readerImage.naturalHeight);
    readerImage.style.width = `${Math.max(1, Math.round(readerImage.naturalWidth * fit * caseZoom))}px`;
    readerImage.style.height = 'auto';
    document.getElementById('case-reader-scale').textContent = `${Math.round(caseZoom * 100)}%`;
    reader.querySelector('[data-reader-zoom="out"]').disabled = caseZoom <= 1;
    reader.querySelector('[data-reader-zoom="in"]').disabled = caseZoom >= 4;
    if (resetPosition) readerStage.scrollTo({left:0,top:0,behavior:'instant'});
  }
  function syncCaseControls() {
    document.querySelector('.case-strip-count').textContent = `${String(caseIndex + 1).padStart(2,'0')} / ${String(casePages.length).padStart(2,'0')}`;
    document.querySelectorAll('[data-case-step], [data-reader-step]').forEach(button => {
      const direction = Number(button.dataset.caseStep || button.dataset.readerStep);
      button.disabled = direction < 0 ? caseIndex === 0 : caseIndex === casePages.length - 1;
    });
  }
  function showCasePage(index, scrollStrip = false) {
    caseIndex = Math.max(0, Math.min(casePages.length - 1, index));
    const page = casePages[caseIndex];
    caseZoom = 1;
    readerImage.width = page.width;
    readerImage.height = page.height;
    readerImage.src = page.src;
    readerImage.alt = page.alt;
    document.getElementById('case-reader-count').textContent = `${page.label} · ${caseIndex + 1} of ${casePages.length}`;
    document.getElementById('case-reader-text').textContent = page.text?.trim() || 'This page is a photographic spread. Use the zoom controls to explore the artwork.';
    reader.querySelector('.case-reader-transcript').open = false;
    syncCaseControls();
    fitCaseImage(true);
    if (scrollStrip && track) track.scrollTo({left:caseCards[caseIndex].offsetLeft - track.offsetLeft,behavior:reduced() ? 'instant' : 'smooth'});
  }
  if (reader && casePages.length) {
    readerImage.addEventListener('load', () => fitCaseImage(true));
    document.querySelectorAll('[data-case-page]').forEach(button => button.addEventListener('click', event => {
      showCasePage(Number(button.dataset.casePage));
      showDialog(reader, event.currentTarget);
      fitCaseImage(true);
    }));
    document.querySelector('[data-read-case]').addEventListener('click', event => {
      showCasePage(caseIndex);
      showDialog(reader, event.currentTarget);
      fitCaseImage(true);
    });
    document.querySelectorAll('[data-case-step]').forEach(button => button.addEventListener('click', () => showCasePage(caseIndex + Number(button.dataset.caseStep), true)));
    document.querySelectorAll('[data-reader-step]').forEach(button => button.addEventListener('click', () => showCasePage(caseIndex + Number(button.dataset.readerStep))));
    function zoomCase(action) {
      caseZoom = action === 'fit' ? 1 : Math.max(1, Math.min(4, caseZoom + (action === 'in' ? .5 : -.5)));
      fitCaseImage(action === 'fit');
    }
    reader.querySelectorAll('[data-reader-zoom]').forEach(button => button.addEventListener('click', () => zoomCase(button.dataset.readerZoom)));
    reader.addEventListener('keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showCasePage(caseIndex + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        zoomCase(event.key === '-' ? 'out' : event.key === '0' ? 'fit' : 'in');
      }
    });
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(caseScrollFrame);
      caseScrollFrame = requestAnimationFrame(() => {
        caseIndex = caseCards.reduce((nearest, card, index) => Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(caseCards[nearest].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : nearest, 0);
        syncCaseControls();
      });
    }, {passive:true});
    track.addEventListener('keydown', event => {
      if (event.target !== track || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      showCasePage(caseIndex + (event.key === 'ArrowRight' ? 1 : -1), true);
    });
    new ResizeObserver(() => fitCaseImage()).observe(readerStage);
    syncCaseControls();
  }

  if (theme === 'refresh') {
    const hero = document.querySelector('.refresh-project-hero');
    new IntersectionObserver(entries => document.body.classList.toggle('project-past-hero', !entries[0].isIntersecting), {rootMargin:'-80px 0px 0px'}).observe(hero);
  }

  // Motion never gates access to an image or text. Reveal once, then disconnect.
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!reduced()) entry.target.animate([{opacity:.5,transform:'translateY(14px)'},{opacity:1,transform:'none'}], {duration:650,easing:'cubic-bezier(.22,.7,.2,1)'});
      revealObserver.unobserve(entry.target);
    });
  }, {threshold:.12});
  document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element));

  const indexLinks = Array.from(document.querySelectorAll('.colophon-index nav a'));
  if (indexLinks.length) {
    const indexObserver = new IntersectionObserver(entries => {
      const current = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!current) return;
      indexLinks.forEach(link => {
        if (link.hash === `#${current.target.id}`) link.setAttribute('aria-current','true');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin:'-15% 0px -30% 0px',threshold:[0,.3,.6]});
    document.querySelectorAll('.colophon-photo-entry figure').forEach(figure => indexObserver.observe(figure));
  }

  const sectionAliases = {home:'overview',intro:'overview',work:'photographs',about:'story',news:'facts',contact:'facts',case:'case-study'};
  function section(id) {
    const destination = document.getElementById(sectionAliases[id] || id);
    if (destination) destination.scrollIntoView({behavior:'instant'});
  }
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (event.data?.type === 'ljc-motion') setMotion(event.data.paused);
    if (event.data?.type === 'ljc-section') section(event.data.id);
  });
  media.addEventListener('change', () => setMotion(paused));
  setMotion(paused, false);
  if (query.get('section')) section(query.get('section'));
  document.dispatchEvent(new CustomEvent('ljc-project-rendered', {detail:{theme,project:project.id}}));
  if (parent !== window) parent.postMessage({type:'ljc-ready',theme,view:'project',project:project.id},location.origin);
})();
