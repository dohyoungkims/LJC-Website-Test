/* Native-dialog glass search, inspired by the user's Apple glass reference.
   This is a web material approximation, not Apple's platform implementation. */
(() => {
  'use strict';
  const theme = document.body.dataset.theme;
  if (!['gallery', 'editorial'].includes(theme)) return;
  const dialog = document.getElementById('search');
  const input = dialog?.querySelector('#project-search');
  if (!dialog || !input) return;
  const gsap = window.gsap;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let timeline = null, closeDone = null;
  const reduce = () => media.matches || document.body.classList.contains('motion-paused');
  input.placeholder = 'Project or city';
  const starter = document.createElement('div');
  starter.className = 'search-start';
  const hint = document.createElement('span');
  hint.textContent = 'Try a city';
  starter.append(hint);
  ['Chicago', 'Phoenix', 'St. Louis'].forEach(city => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = city;
    button.addEventListener('click', () => {
      input.value = city;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus({ preventScroll: true });
    });
    starter.append(button);
  });
  dialog.querySelector('.search-form').after(starter);
  const clear = () => {
    timeline?.kill(); timeline = null;
    if (gsap) gsap.set(dialog, { clearProps: 'transform,opacity,filter,clipPath' });
  };
  function settle() {
    clear();
    dialog.style.setProperty('--search-backdrop-opacity', '1');
    if (closeDone) { const done = closeDone; closeDone = null; done(); }
  }
  window.LJCSearchExperience = {
    handles: node => node === dialog,
    open() {
      clear(); closeDone = null;
      if (!gsap || reduce()) { settle(); return; }
      timeline = gsap.timeline({ onComplete() { timeline = null; } });
      const sheet = theme === 'editorial';
      gsap.set(dialog, { '--search-backdrop-opacity': 0 });
      timeline.fromTo(dialog, { opacity: 0, y: sheet ? -38 : 18, scale: sheet ? .99 : .94, filter: 'blur(7px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: .56, ease: 'power3.out', clearProps: 'transform,opacity,filter' }, 0)
        .to(dialog, { '--search-backdrop-opacity': 1, duration: .4, ease: 'power2.out' }, 0);
    },
    close(node, done) {
      clear(); closeDone = done;
      if (!gsap || reduce()) { settle(); return; }
      timeline = gsap.timeline({ onComplete: settle });
      timeline.to(dialog, { opacity: 0, y: theme === 'editorial' ? -20 : 8, scale: theme === 'editorial' ? .995 : .97, duration: .26, ease: 'power2.in' }, 0)
        .to(dialog, { '--search-backdrop-opacity': 0, duration: .26 }, 0);
    },
    settle,
  };
  const onPreference = () => { if (media.matches) settle(); };
  media.addEventListener('change', onPreference);
  addEventListener('pagehide', event => {
    if (event.persisted) return;
    clear(); media.removeEventListener('change', onPreference);
  });
})();
