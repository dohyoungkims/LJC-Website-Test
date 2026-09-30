/* Featured Projects: a DOM gallery inspired by Jesper Landberg's dome grid.
   One native link per project. No WebGL, cloned links, or idle animation loop. */
(() => {
  'use strict';
  const section = document.querySelector('[data-section-page="featured-projects"]');
  const grid = section?.querySelector('.rev-section-projects');
  const cards = grid ? [...grid.querySelectorAll(':scope > .rev-story-card')] : [];
  if (!grid || cards.length < 2 || !('ResizeObserver' in window) || !('IntersectionObserver' in window)) return;

  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const hoverQuery = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => reduceQuery.matches || document.body.classList.contains('motion-paused');
  const root = document.createElement('div');
  root.className = 'rev-dome'; root.dataset.view = 'list';
  root.innerHTML = `<div class="rev-dome-toolbar"><p>${cards.length} projects</p><div role="group" aria-label="Project view"><button type="button" data-dome-view="dome" aria-pressed="false">Dome</button><button type="button" data-dome-view="list" aria-pressed="true">List</button><button type="button" class="rev-dome-reset" aria-label="Reset project gallery position" hidden>Reset <span aria-hidden="true">↺</span></button></div></div><div class="rev-dome-viewport" role="region" aria-label="Featured project gallery" tabindex="0" aria-describedby="rev-dome-help"></div><div class="rev-dome-legend" hidden><p id="rev-dome-help">Drag to explore. Select a project to read its story.</p><span aria-hidden="true">↔</span></div><p class="rev-dome-status rev-visually-hidden" role="status"></p>`;
  grid.before(root);
  const viewport = root.querySelector('.rev-dome-viewport');
  viewport.append(grid);
  const legend = root.querySelector('.rev-dome-legend');
  const resetButton = root.querySelector('.rev-dome-reset');
  const status = root.querySelector('.rev-dome-status');
  const viewButtons = [...root.querySelectorAll('[data-dome-view]')];
  const items = cards.map((card,index) => {
    const link = card.querySelector('a'), picture = card.querySelector('.rev-story-image img');
    card.dataset.domeCard = String(index);
    return {card,link,picture,visible:true,slot:null};
  });
  const columns = 7, rows = Math.ceil(items.length / columns);
  const slots = Array.from({length:rows},(_,row) => Array.from({length:columns},(_,col) => ({x:col-(columns-1)/2,y:row-(rows-1)/2}))).flat()
    .sort((a,b) => (a.x*a.x+a.y*a.y*1.2)-(b.x*b.x+b.y*b.y*1.2) || a.y-b.y || a.x-b.x);
  items.forEach((item,index) => {item.slot=slots[index];});

  let preferredView = 'dome', mode = 'list', frame = 0, lastFrame = 0;
  let visible = false, routeActive = false, size = null, drag = null, suppressClick = false;
  let panX = 0, panY = 0, velocityX = 0, velocityY = 0;
  let lensX = 0, lensY = 0, lensStrength = 0, lensTarget = 0;
  let dead = false, initialized = false;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const wrap = (value,period) => ((value+period/2)%period+period)%period-period/2;
  const permitted = () => !dead && mode === 'dome' && routeActive && visible && !document.hidden && !document.body.matches('.rev-menu-active,.case-reader-active');

  function stop() {
    cancelAnimationFrame(frame); frame=0; lastFrame=0;
    velocityX=velocityY=0; lensStrength=lensTarget=0;
    if (drag) {try {if (viewport.hasPointerCapture(drag.id)) viewport.releasePointerCapture(drag.id);} catch (_) {}}
    drag=null; root.classList.remove('is-dragging');
  }
  function wake() { if (permitted() && !frame) frame=requestAnimationFrame(render); }
  function measure() {
    if (mode !== 'dome' || !routeActive) return;
    const box = viewport.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const width=box.width, height=box.height;
    const tileWidth=clamp(width/(width<700 ? 2.05 : 4.0),170,340);
    const tileHeight=Math.max(tileWidth/1.38,height/3.4);
    const gap=width<700 ? 22 : 38;
    size={box,width,height,tileWidth,tileHeight,stepX:tileWidth+gap,stepY:tileHeight+gap};
    size.worldWidth=size.stepX*columns; size.worldHeight=size.stepY*rows;
    grid.style.setProperty('--dome-card-width',`${tileWidth}px`);
    grid.style.setProperty('--dome-card-height',`${tileHeight}px`);
    wake();
  }
  function render(now) {
    frame=0;
    if (!permitted() || !size) {lastFrame=0;return;}
    const dt=lastFrame ? Math.min(40,now-lastFrame) : 16.67; lastFrame=now;
    if (!drag) {
      panX+=velocityX*dt; panY+=velocityY*dt;
      const damping=Math.pow(.84,dt/16.67);
      velocityX*=damping;velocityY*=damping;
      if (Math.abs(velocityX)<.007) velocityX=0;
      if (Math.abs(velocityY)<.007) velocityY=0;
    }
    panX=wrap(panX,size.worldWidth);panY=wrap(panY,size.worldHeight);
    lensStrength+=(lensTarget-lensStrength)*Math.min(1,dt/75);
    if (Math.abs(lensTarget-lensStrength)<.002) lensStrength=lensTarget;
    const {width,height,tileWidth,tileHeight}=size;
    for (const item of items) {
      const x=wrap(item.slot.x*size.stepX+panX,size.worldWidth);
      const y=wrap(item.slot.y*size.stepY+panY,size.worldHeight);
      const seam=Math.min(clamp((size.worldWidth/2-Math.abs(x))/(tileWidth*.8),0,1),clamp((size.worldHeight/2-Math.abs(y))/(tileHeight*.8),0,1));
      const inView=seam>.025 && Math.abs(x)<width/2+tileWidth*.75 && Math.abs(y)<height/2+tileHeight*.75;
      if (item.visible !== inView) {
        item.visible=inView; item.card.hidden=!inView;
        item.link.tabIndex=inView ? 0 : -1;
      }
      if (!inView) continue;
      item.card.style.opacity=String(seam.toFixed(3));
      const nx=x/(width*.67), ny=y/(height*.85);
      const distance=Math.hypot(x-lensX,y-lensY);
      const lens=Math.max(0,1-distance/(tileWidth*1.65))*lensStrength;
      const depth=-Math.min(1.6,nx*nx+ny*ny)*155 + lens*34;
      const rotateX=clamp(ny*23,-25,25), rotateY=clamp(-nx*28,-32,32);
      item.card.style.transform=`translate3d(${(x-tileWidth/2).toFixed(2)}px,${(y-tileHeight/2).toFixed(2)}px,${depth.toFixed(2)}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
      if (item.picture) {
        const photoX=clamp((lensX-x)/tileWidth,-1,1)*lens*7;
        const photoY=clamp((lensY-y)/tileHeight,-1,1)*lens*5;
        item.picture.style.transform=`translate3d(${photoX.toFixed(2)}px,${photoY.toFixed(2)}px,0) scale(1.045)`;
      }
    }
    root.dataset.ready='true';
    if (velocityX || velocityY || lensStrength!==lensTarget) frame=requestAnimationFrame(render);
    else lastFrame=0;
  }
  function setView(next,{announce=true,remember=true}={}) {
    if (remember) preferredView=next;
    if (reduced()) next='list';
    const changing=mode!==next;
    mode=next; root.dataset.view=next;
    if (changing && next==='dome') root.removeAttribute('data-ready');
    viewport.tabIndex=next==='dome' ? 0 : -1;
    viewport.setAttribute('aria-label',next==='dome' ? 'Draggable featured project gallery. Arrow keys pan; Home resets. Use List to browse all projects.' : 'All featured projects');
    if (next==='dome') viewport.setAttribute('aria-describedby','rev-dome-help');
    else viewport.removeAttribute('aria-describedby');
    legend.hidden=resetButton.hidden=next!=='dome';
    viewButtons.forEach(button => {
      button.setAttribute('aria-pressed',String(button.dataset.domeView===next));
      button.disabled=button.dataset.domeView==='dome' && reduced();
      button.title=button.disabled ? (reduceQuery.matches ? 'Dome view is off to respect your reduced-motion preference' : 'Resume motion to explore the dome gallery') : '';
    });
    stop();
    if (next==='list') items.forEach(item => {
      item.card.hidden=false;item.visible=true;item.link.removeAttribute('tabindex');
      item.card.style.removeProperty('transform');item.card.style.removeProperty('opacity');item.picture?.style.removeProperty('transform');
    });
    else {measure();wake();}
    if (announce && changing) status.textContent=next==='dome' ? 'Dome view. Drag to explore or choose List for all projects.' : `List view. All ${items.length} projects are available.`;
  }
  function sync() {
    routeActive=!section.hidden && !section.closest('#rev-sections[hidden],#rev-digital[hidden]');
    const desired=reduced() ? 'list' : preferredView;
    if (!initialized || mode!==desired) {initialized=true;setView(desired,{announce:false,remember:false});}
    else if (mode==='dome') {
      if (!permitted()) stop();
      else {measure();wake();}
    }
  }

  viewButtons.forEach(button => button.addEventListener('click',() => setView(button.dataset.domeView)));
  resetButton.addEventListener('click',() => {
    stop();panX=panY=0;measure();wake();status.textContent='Project gallery reset.';
  });
  viewport.addEventListener('pointerdown',event => {
    if (!permitted() || event.button!==0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    suppressClick=false;velocityX=velocityY=0;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,startX:panX,startY:panY,moved:false,touch:event.pointerType==='touch'};
  });
  viewport.addEventListener('pointermove',event => {
    if (!permitted() || !size) return;
    if (!drag && hoverQuery.matches && event.pointerType!=='touch') {
      lensX=event.clientX-size.box.left-size.width/2;lensY=event.clientY-size.box.top-size.height/2;lensTarget=1;wake();return;
    }
    if (!drag || event.pointerId!==drag.id) return;
    if (!drag.touch && event.buttons===0) {endDrag(event,true);return;}
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy)<7) return;
    // Keep ordinary vertical page scrolling available on phones.
    if (!drag.moved && drag.touch && Math.abs(dy)>Math.abs(dx)*1.2) {drag=null;return;}
    if (!drag.moved) {
      drag.moved=true;root.classList.add('is-dragging');lensTarget=0;
      try {viewport.setPointerCapture(event.pointerId);} catch (_) {}
    }
    const elapsed=Math.max(8,event.timeStamp-drag.time);
    velocityX=clamp((event.clientX-drag.lastX)/elapsed,-1.3,1.3)*.7;
    velocityY=drag.touch ? 0 : clamp((event.clientY-drag.lastY)/elapsed,-1.3,1.3)*.7;
    panX=drag.startX+dx;panY=drag.startY+(drag.touch ? 0 : dy);
    drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;
    event.preventDefault();wake();
  });
  function endDrag(event,cancelled=false) {
    if (!drag || event.pointerId!==drag.id) return;
    const moved=drag.moved;
    if (moved) suppressClick=true;
    if (cancelled || event.timeStamp-drag.time>100) velocityX=velocityY=0;
    drag=null;root.classList.remove('is-dragging');
    try {if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);} catch (_) {}
    if (moved) wake();
  }
  window.addEventListener('pointerup',event=>endDrag(event));
  window.addEventListener('pointercancel',event=>endDrag(event,true));
  viewport.addEventListener('lostpointercapture',event=>endDrag(event,true));
  window.addEventListener('blur',stop);
  viewport.addEventListener('pointerleave',()=>{lensTarget=0;wake();});
  viewport.addEventListener('click',event => {
    if (suppressClick && event.detail!==0) {suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}
  },true);
  viewport.addEventListener('dragstart',event=>{if (mode==='dome') event.preventDefault();});
  viewport.addEventListener('keydown',event => {
    if (mode!=='dome' || event.target!==viewport || event.metaKey || event.ctrlKey || event.altKey || !size) return;
    const amount=size.stepX*.7;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();stop();
    if (event.key==='Home') panX=panY=0;
    if (event.key==='ArrowLeft') panX+=amount;
    if (event.key==='ArrowRight') panX-=amount;
    if (event.key==='ArrowUp') panY+=size.stepY*.7;
    if (event.key==='ArrowDown') panY-=size.stepY*.7;
    wake();
  });
  viewport.addEventListener('focusin',event=>{
    velocityX=velocityY=0;lensTarget=0;
    const link=event.target.closest('a');
    if (mode==='dome' && size && link?.matches(':focus-visible')) {
      const item=items.find(candidate=>candidate.link===link);
      if (item) {
        panX=-item.slot.x*size.stepX;panY=-item.slot.y*size.stepY;
        viewport.scrollTo({left:0,top:0,behavior:'instant'});
      }
    }
    wake();
  });
  const observer = new IntersectionObserver(entries => {
    visible=entries[0].isIntersecting;
    if (visible) {measure();wake();} else stop();
  },{threshold:.02});
  observer.observe(viewport);
  const resize = new ResizeObserver(measure);resize.observe(viewport);
  const bodyObserver = new MutationObserver(sync);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  reduceQuery.addEventListener('change',sync);
  document.addEventListener('rev-route',sync);
  document.addEventListener('visibilitychange',sync);
  const scroll = () => {if (permitted() && size) size.box=viewport.getBoundingClientRect();};
  window.addEventListener('scroll',scroll,{passive:true});
  window.addEventListener('pagehide',()=>{dead=true;stop();});
  window.addEventListener('pageshow',()=>{dead=false;sync();});
  sync();
})();
