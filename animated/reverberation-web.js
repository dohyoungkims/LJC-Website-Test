/* Small website interactions; content and links remain native HTML. */
(() => {
  const menu = document.querySelector('#rev-contents-menu');
  if (!menu) return;
  let opener;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('motion-paused');
  const close = (restore = true) => {
    menu.close();
    document.body.classList.remove('rev-menu-active');
    if (restore) opener?.focus({preventScroll:true});
  };
  document.querySelector('[data-contents-open]').addEventListener('click', event => {
    opener = event.currentTarget;
    menu.showModal();
    document.body.classList.add('rev-menu-active');
    if (!reduced()) menu.animate([{opacity:0,transform:'translateY(-18px)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});
    menu.querySelector('[data-contents-close]').focus({preventScroll:true});
  });
  menu.querySelector('[data-contents-close]').addEventListener('click', () => close());
  menu.addEventListener('cancel', event => {event.preventDefault();close();});
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) close(false);
    if (event.target === menu) {
      const b = menu.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) close();
    }
  });
  document.addEventListener('rev-route', () => {if (menu.open) close(false);});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (!reduced()) entry.target.animate([{opacity:.5,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
    }), {threshold:.12});
    document.querySelectorAll('.rev-story-card').forEach(card => observer.observe(card));
  }
})();
