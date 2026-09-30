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
      if (entry.target.closest('[data-section-page="featured-projects"]')) return;
      if (!reduced()) entry.target.animate([{opacity:.5,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
    }), {threshold:.12});
    document.querySelectorAll('.rev-story-card').forEach(card => observer.observe(card));
  }

  // Animate the original dots, rather than replacing the publication's numeral.
  // Only the visible section paints; the SVG stays as the no-motion fallback.
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const numerals = [...document.querySelectorAll('[data-mist-dots]')].map(host => ({host, visible:false, ready:false, loading:false, elapsed:4500}));
  const smooth = value => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  const noise = seed => {const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  let frame=0, previous=0;
  const permitted = item => item.visible && !item.host.closest('[hidden]') && !document.hidden && !reduced() && !document.body.matches('.rev-menu-active,.case-reader-active');

  function sizeNumeral(item) {
    if (!item.ready || !item.host.offsetWidth) return;
    const box=item.host.getBoundingClientRect(), dpr=Math.min(devicePixelRatio || 1,2);
    const width=box.width+48, height=box.height+48;
    item.canvas.width=Math.round(width*dpr);item.canvas.height=Math.round(height*dpr);
    item.scale=Math.min(box.width/item.art.width,box.height/item.art.height);
    item.x=24+(box.width-item.art.width*item.scale)/2;
    item.y=24+(box.height-item.art.height*item.scale)/2;
    item.width=width;item.height=height;item.dpr=dpr;
  }

  function paint(item) {
    const {ctx,art,scale,elapsed}=item;
    if (!scale) return;
    const time=(elapsed%10800)/1000;
    ctx.setTransform(item.dpr,0,0,item.dpr,0,0);ctx.clearRect(0,0,item.width,item.height);
    item.particles.forEach(dot => {
      const [x,y,w,h]=dot.box;
      const gather=smooth((time-dot.delay)/2.5);
      const release=smooth((time-6.2-dot.delay*.55)/2.5);
      const formed=gather*(1-release);
      const alpha=Math.min(1,gather*1.5)*(1-release);
      if (alpha<.006) return;
      const drift=1-formed, direction=release>0 ? 1 : -1;
      const dx=dot.dx*drift + Math.sin(time*1.1+dot.seed)*9*drift;
      const dy=direction*dot.dy*drift;
      const expansion=1+drift*.65;
      ctx.globalAlpha=alpha*(1-drift*.38);
      ctx.drawImage(item.sprite,x,y,w,h,
        item.x+(x+dx-w*(expansion-1)/2)*scale,
        item.y+(y+dy-h*(expansion-1)/2)*scale,w*scale*expansion,h*scale*expansion);
    });
    ctx.globalAlpha=1;
    item.host.classList.add('is-misting');
  }

  function tick(now) {
    const delta=previous ? Math.min(now-previous,80) : 0;
    if (previous && delta<32) {frame=requestAnimationFrame(tick);return;}
    previous=now;
    let active=false;
    numerals.forEach(item => {
      if (!item.ready || !permitted(item)) return;
      active=true;item.elapsed+=delta;paint(item);
    });
    frame=active ? requestAnimationFrame(tick) : 0;
    if (!active) previous=0;
  }

  async function loadNumeral(item) {
    if (item.loading || item.ready) return;
    item.loading=true;
    try {
      const art=JSON.parse(item.host.dataset.mistDots), source=new Image();
      source.src=item.host.dataset.src;await source.decode();
      const sprite=document.createElement('canvas');sprite.width=art.width;sprite.height=art.height;
      const context=sprite.getContext('2d');if (!context) return;
      context.drawImage(source,0,0);context.globalCompositeOperation='source-in';
      context.fillStyle='#c7b4d4';context.fillRect(0,0,art.width,art.height);
      const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');if (!ctx) return;
      canvas.className='rev-mist-canvas';canvas.setAttribute('aria-hidden','true');
      item.host.append(canvas);
      Object.assign(item,{art,sprite,canvas,ctx,ready:true,particles:art.dots.map((box,i)=>({box,
        seed:noise(i+1)*6.283,delay:noise(i+5)*.8+(1-box[1]/art.height)*1.05,
        dx:(noise(i+13)-.5)*155,dy:32+noise(i+37)*80}))});
      sizeNumeral(item);syncMist();
    } catch (_) { /* Keep the original SVG when canvas/image decoding is unavailable. */ }
  }

  function syncMist() {
    numerals.forEach(item => {
      if (!permitted(item)) {
        item.host.classList.remove('is-misting');
        if (reduced()) item.elapsed=4500;
      } else if (!item.ready) loadNumeral(item);
    });
    const active=numerals.some(item=>item.ready && permitted(item));
    if (active && !frame) {previous=0;frame=requestAnimationFrame(tick);}
    if (!active && frame) {cancelAnimationFrame(frame);frame=0;previous=0;}
  }

  if (numerals.length && 'IntersectionObserver' in window && 'ResizeObserver' in window) {
    const visibility=new IntersectionObserver(entries => {
      entries.forEach(entry => {const item=numerals.find(n=>n.host===entry.target);item.visible=entry.isIntersecting;});
      syncMist();
    },{threshold:.05});
    const resize=new ResizeObserver(entries=>entries.forEach(entry=>sizeNumeral(numerals.find(n=>n.host===entry.target))));
    numerals.forEach(item=>{visibility.observe(item.host);resize.observe(item.host);});
    new MutationObserver(syncMist).observe(document.body,{attributes:true,attributeFilter:['class']});
    motionQuery.addEventListener('change',syncMist);
    document.addEventListener('visibilitychange',syncMist);
    document.addEventListener('rev-route',syncMist);
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;previous=0;});
    window.addEventListener('pageshow',syncMist);
  }
})();
