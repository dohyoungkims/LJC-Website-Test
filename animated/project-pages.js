(() => {
  'use strict';
  const theme = document.body.dataset.projectTheme;
  const query = new URLSearchParams(location.search);
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = query.get('motion') === 'off';
  let lastFocus = null;
  const photos = JSON.parse(document.getElementById('project-photos').textContent);
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
    if (reduced()) document.getAnimations().forEach(animation => animation.finish());
    if (notify && parent !== window) parent.postMessage({type:'ljc-motion-state', paused, reduced:reduced(), system:media.matches}, location.origin);
  }

  function showDialog(dialog, trigger) {
    if (!dialog || dialog.open) return;
    lastFocus = trigger || document.activeElement;
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
    dialog.addEventListener('close', () => lastFocus?.focus({preventScroll:true}));
  });

  function selectPhoto(index) {
    photoIndex = Math.max(0, Math.min(photos.length - 1, index));
    const photo = photos[photoIndex];
    const image = document.getElementById('viewer-image');
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

  const sectionAliases = {home:'overview',intro:'overview',work:'photographs',about:'story',news:'facts',contact:'facts'};
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
  if (parent !== window) parent.postMessage({type:'ljc-ready',theme,view:'project'},location.origin);
})();
