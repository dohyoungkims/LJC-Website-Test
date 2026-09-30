/* A brief entrance using only the 537 measured dots of the original cover.
   The publication remains available when motion, canvas, or source data fail. */
(() => {
  'use strict';
  const html = document.documentElement;
  if (html.dataset.revEntry !== 'cover') return;
  const dialog = document.querySelector('#rev-entrance');
  const canvas = dialog?.querySelector('canvas');
  const skip = dialog?.querySelector('[data-rev-entrance-skip],[data-entrance-skip],button');
  const wordmark = dialog?.querySelector('img');
  const dataNode = document.querySelector('#rev-entrance-data');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => motionQuery.matches || document.body.classList.contains('motion-paused');
  let ended = false, started = false, frame = 0, watchdog = 0, startTime = 0;
  let resizeObserver, bodyObserver, context, size = 0, dpr = 1, dots = [];
  const disposers = [];
  const clamp = value => Math.max(0,Math.min(1,value));
  const smooth = value => {const t=clamp(value);return t*t*(3-2*t);};
  const noise = value => {const n=Math.sin(value*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  const listen = (target,type,handler,options) => {
    target.addEventListener(type,handler,options);
    disposers.push(()=>target.removeEventListener(type,handler,options));
  };

  function finish(reason='complete') {
    if (ended) return;
    ended=true;
    cancelAnimationFrame(frame);clearTimeout(watchdog);
    resizeObserver?.disconnect();bodyObserver?.disconnect();
    disposers.splice(0).forEach(dispose=>dispose());
    document.body.classList.remove('rev-entrance-active');
    delete html.dataset.revEntry;
    if (dialog) {
      dialog.classList.remove('is-playing');
      dialog.style.removeProperty('opacity');
      if (dialog.open) dialog.close();
    }
    if (started && !document.hidden && reason!=='pagehide') {
      const title=document.querySelector('#rev-website-title');
      if (title && !title.closest('[hidden]') && title.getClientRects().length) title.focus({preventScroll:true});
    }
    document.dispatchEvent(new CustomEvent('rev-entrance-complete',{detail:{reason,played:started,duration:started ? Math.round(performance.now()-startTime) : 0}}));
  }

  function resize() {
    if (!canvas || !context || ended) return;
    const rect=canvas.getBoundingClientRect();
    size=Math.min(rect.width,rect.height);
    if (size<1) {finish('unavailable');return;}
    dpr=Math.min(window.devicePixelRatio || 1,2);
    canvas.width=Math.max(1,Math.round(rect.width*dpr));
    canvas.height=Math.max(1,Math.round(rect.height*dpr));
    context.setTransform(dpr,0,0,dpr,0,0);
  }

  function paint(elapsed) {
    context.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
    if (elapsed>=2200) return;
    for (const dot of dots) {
      let alpha=1,x=dot.x*size,y=dot.y*size;
      let shimmer=0;
      if (elapsed<1100) {
        const gather=smooth((elapsed-dot.delay)/(1100-dot.delay));
        alpha=gather;
        const drift=1-gather;
        x+=dot.dx*size*drift;y+=dot.dy*size*drift;
      } else if (elapsed<1600) {
        const sweep=-.2+(elapsed-1100)/500*1.4;
        const distance=Math.abs((dot.x+dot.y)*.5-sweep);
        shimmer=Math.max(0,1-distance/.14)*.22;
      } else {
        const release=smooth((elapsed-1600-dot.releaseDelay)/(600-dot.releaseDelay));
        alpha=1-release;
        x+=dot.dx*size*release*.55;
        y-=size*(.018+dot.drift*.025)*release;
      }
      if (alpha<.006) continue;
      const r=Math.round(199+(255-199)*shimmer);
      const g=Math.round(180+(255-180)*shimmer);
      const b=Math.round(212+(255-212)*shimmer);
      context.globalAlpha=alpha;
      context.fillStyle='rgb('+r+','+g+','+b+')';
      context.beginPath();context.arc(x,y,dot.r*size,0,Math.PI*2);context.fill();
    }
    context.globalAlpha=1;
  }

  function tick(now) {
    frame=0;
    if (ended) return;
    if (paused() || document.hidden) {finish(paused() ? 'reduced-motion' : 'hidden');return;}
    try {
      const elapsed=now-startTime;
      paint(elapsed);
      if (elapsed>=2200) dialog.style.opacity=String(1-smooth((elapsed-2200)/300));
      if (elapsed>=2500) {finish();return;}
      frame=requestAnimationFrame(tick);
    } catch (_) {finish('render-error');}
  }

  // Arm the watchdog before parsing or attempting a modal.
  watchdog=setTimeout(()=>finish('watchdog'),2850);
  if (!dialog || !canvas || !skip || !dataNode || typeof dialog.showModal!=='function' || paused() || document.hidden) {finish('unavailable');return;}
  try {
    const data=JSON.parse(dataNode.textContent);
    const source=data.dots;
    if (!Array.isArray(source) || source.length!==537 || source.some(dot => !Number.isFinite(dot.x) || !Number.isFinite(dot.y) || !Number.isFinite(dot.r) || dot.x<0 || dot.x>1 || dot.y<0 || dot.y>1 || dot.r<=0 || dot.r>.05)) {finish('missing-geometry');return;}
    dots=source.map((dot,index)=>({...dot,
      delay:noise(index+3)*180+dot.y*70,
      dx:(noise(index+17)-.5)*.058,
      dy:(noise(index+29)-.5)*.048,
      releaseDelay:(dot.x+dot.y)*38+noise(index+41)*25,
      drift:noise(index+53)}));
    context=canvas.getContext('2d',{alpha:true});
    if (!context) {finish('unavailable');return;}
    canvas.classList.add('rev-entrance-art');canvas.setAttribute('aria-hidden','true');
    wordmark?.classList.add('rev-entrance-wordmark');
    skip.classList.add('rev-entrance-skip');
    skip.type='button';
    listen(skip,'click',()=>finish('skip'));
    listen(dialog,'cancel',event=>{event.preventDefault();finish('skip');});
    listen(dialog,'keydown',event=>{
      if (event.key==='Escape' || event.key==='Enter') {event.preventDefault();event.stopPropagation();finish('skip');}
    });
    listen(dialog,'close',()=>finish('closed'));
    listen(motionQuery,'change',()=>{if (paused()) finish('reduced-motion');});
    listen(document,'visibilitychange',()=>{if (document.hidden) finish('hidden');});
    listen(window,'pagehide',()=>finish('pagehide'));
    listen(document,'rev-route',event=>{
      const route=event.detail || {};
      if (route.mode==='book' || route.chapter || route.story || route.spread) finish('route');
    });
    bodyObserver=new MutationObserver(()=>{if (paused()) finish('motion-paused');});
    bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    dialog.showModal();
    document.body.classList.add('rev-entrance-active');
    dialog.classList.add('is-playing');
    started=true;startTime=performance.now();
    resize();
    if (ended) return;
    if ('ResizeObserver' in window) {resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);}
    else listen(window,'resize',resize,{passive:true});
    skip.focus({preventScroll:true});
    paint(0);
    frame=requestAnimationFrame(tick);
  } catch (_) {finish('setup-error');}
})();
