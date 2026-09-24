(() => {
  'use strict';
  const theme = document.body.dataset.theme;
  const query = new URLSearchParams(location.search);
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  document.querySelectorAll('a.text-link,.partner-links a,.footer-social a').forEach(link=>link.setAttribute('data-ljc-underline',''));
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  let paused = query.get('motion') === 'off';
  let reduced = paused || media.matches;
  let revealContext, revealObserver;
  let rotator, textPaused = false;
  const film = document.querySelector('video');
  const filmButton = document.querySelector('.film-toggle');
  let filmVisible = false, filmPaused = false;
  let modalOpen = false;

  function updateFilm() {
    const shouldPlay = !reduced && !filmPaused && filmVisible && !document.hidden && !modalOpen;
    if (shouldPlay) film.play().catch(() => updateFilmLabel()); else film.pause();
    updateFilmLabel();
  }
  function updateFilmLabel() {
    filmButton.innerHTML = film.paused ? 'Play film <span aria-hidden="true">▷</span>' : 'Pause film <span aria-hidden="true">Ⅱ</span>';
    filmButton.setAttribute('aria-label', film.paused ? 'Play project film' : 'Pause project film');
    filmButton.disabled = reduced;
  }
  film.addEventListener('play',updateFilmLabel);
  film.addEventListener('pause',updateFilmLabel);
  filmButton.addEventListener('click', () => { filmPaused = !film.paused; updateFilm(); });
  const filmObserver = new IntersectionObserver(([entry]) => {
    filmVisible = entry.isIntersecting; updateFilm();
  }, {threshold:0.05,rootMargin:'-128px 0px 0px 0px'});
  filmObserver.observe(film);
  document.addEventListener('visibilitychange', updateFilm);

  function setupReveals() {
    revealObserver?.disconnect();
    revealContext?.revert();
    if (!gsap || !ScrollTrigger || reduced) return;
    // Only start a reveal when the element is in view. Static content is never hidden.
    revealContext = gsap.context(() => {
      document.querySelectorAll('.project,.about-card,.news-card,.section-heading,.contact-invitation').forEach(el => {
        if(el.dataset.revealed) return;
        ScrollTrigger.create({trigger:el,start:'top 96%',once:true,onEnter: () => {
          if(reduced || el.dataset.revealed) return;
          el.dataset.revealed='true';
          if(theme === 'colophon' && el.matches('.project')) {
            gsap.fromTo(el.querySelector('.project-photo img'),{scale:1.035},{scale:1,duration:1.2,ease:'power2.out',clearProps:'transform'});
          } else {
            gsap.fromTo(el,{y:theme==='editorial'?8:16,opacity:0.45},{y:0,opacity:1,duration:0.65,ease:'power2.out',clearProps:'transform,opacity'});
          }
        }});
      });
    });
  }

  function updateHeadlineLabel() {
    const button = document.querySelector('#headline-motion-toggle');
    if(!button) return;
    const unavailable=rotator&&!rotator.getState().available;
    button.textContent = unavailable ? 'Static text' : reduced ? 'Motion paused' : textPaused ? 'Play text ▷' : 'Pause text Ⅱ';
    button.setAttribute('aria-pressed', String(reduced || textPaused));
    button.disabled = reduced||unavailable;
  }
  const pill = document.querySelector('.by-design-pill');
  if(pill && window.LJCByDesignRotator) {
    rotator=window.LJCByDesignRotator.mount(pill,{enabled:!reduced});
    document.querySelector('#headline-motion-toggle').addEventListener('click',()=>{
      textPaused=!textPaused;
      rotator.setEnabled(!reduced && !textPaused && !modalOpen);
      updateHeadlineLabel();
    });
  }
  function setMotion(off, notify=true) {
    paused=off; reduced=paused||media.matches;
    document.body.classList.toggle('motion-paused',reduced);
    document.documentElement.classList.toggle('motion-paused',reduced);
    document.querySelectorAll('.page-motion-toggle').forEach(button=>{
      button.textContent=media.matches?'Reduced motion on':paused?'Play motion':'Pause motion';
      button.setAttribute('aria-pressed',String(reduced));
      button.disabled=media.matches;
    });
    rotator?.setEnabled(!reduced&&!textPaused&&!modalOpen);
    if(reduced) document.querySelectorAll('dialog[open]').forEach(dialog=>getDialogExperience(dialog)?.settle?.(dialog));
    updateHeadlineLabel(); updateFilm(); setupReveals();
    if(notify && parent!==window) parent.postMessage({type:'ljc-motion-state',paused,reduced,system:media.matches},location.origin);
  }
  document.querySelectorAll('.page-motion-toggle').forEach(button=>button.addEventListener('click',()=>setMotion(!paused)));
  media.addEventListener('change',()=>setMotion(paused));

  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const headerObserver=new IntersectionObserver(()=>{
    header.classList.toggle('is-scrolled',hero.getBoundingClientRect().bottom <= 128);
  },{rootMargin:'-128px 0px 0px 0px',threshold:0});
  headerObserver.observe(hero);
  let scrollQueued=false;
  addEventListener('scroll',()=>{
    if(scrollQueued)return; scrollQueued=true;
    requestAnimationFrame(()=>{header.classList.toggle('is-scrolled',hero.getBoundingClientRect().bottom<=128);scrollQueued=false;});
  },{passive:true});

  function getDialogExperience(dialog) {
    return [window.LJCSearchExperience,window.LJCMenuExperience].find(experience=>experience?.handles?.(dialog));
  }
  for(const [trigger,id] of [['.menu-trigger','navigation'],['.search-trigger','search']]) {
    const opener=document.querySelector(trigger), dialog=document.getElementById(id);
    let closing=false, destination=null;
    function requestClose(nextDestination=null) {
      if(!dialog.open||closing)return;
      closing=true;destination=nextDestination;
      const finish=()=>{if(dialog.open)dialog.close();};
      const experience=getDialogExperience(dialog);
      if(experience) experience.close(dialog,finish); else finish();
    }
    opener.addEventListener('click',()=>{
      if(dialog.open)return;
      closing=false;destination=null;
      dialog.showModal();document.body.classList.add('dialog-open');modalOpen=true;
      updateFilm();rotator?.setEnabled(false);
      opener.setAttribute('aria-expanded','true');
      if(id==='search') {renderSearch(searchInput.value);searchInput.focus();}
      const experience=getDialogExperience(dialog);
      if(experience) experience.open(dialog);
      else if(gsap&&!reduced) gsap.fromTo(dialog,{opacity:0,y:12},{opacity:1,y:0,duration:0.38,ease:'power2.out',clearProps:'transform,opacity'});
    });
    dialog.querySelector('.close-dialog').addEventListener('click',()=>requestClose());
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();requestClose();}});
    dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
    dialog.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',event=>{
      const target=document.getElementById(a.hash.slice(1));
      if(target){event.preventDefault();requestClose({target,hash:a.hash});}else requestClose();
    }));
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)requestClose();}});
    dialog.addEventListener('close',()=>{
      closing=false;modalOpen=Boolean(document.querySelector('dialog[open]'));
      document.body.classList.toggle('dialog-open',modalOpen);
      opener.setAttribute('aria-expanded','false');
      if(destination){
        const {target,hash}=destination;destination=null;
        if(!target.hasAttribute('tabindex')){target.setAttribute('tabindex','-1');target.addEventListener('blur',()=>target.removeAttribute('tabindex'),{once:true});}
        target.focus({preventScroll:true});
        if(location.hash!==hash)history.pushState(null,'',hash);
        target.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
      }else opener.focus({preventScroll:true});
      updateFilm();rotator?.setEnabled(!reduced&&!textPaused&&!modalOpen);
    });
  }

  const projectData=Object.entries(JSON.parse(document.getElementById('project-data').textContent));
  const searchInput=document.getElementById('project-search');
  const resultBox=document.querySelector('.search-results');
  function renderSearch(term) {
    const normalized=term.trim().toLowerCase();
    const seen=new Set();
    const results=projectData.filter(([,p])=>{
      if(seen.has(p.url)|| !(p.title+' '+p.location).toLowerCase().includes(normalized))return false;
      seen.add(p.url);return true;
    });
    resultBox.replaceChildren(...results.map(([,p])=>{
      const a=document.createElement('a');a.className='search-result';a.href=p.url;a.target='_blank';a.rel='noopener';
      const image=document.createElement('img');image.src='../'+p.image;image.alt='';image.loading='lazy';
      const copy=document.createElement('div');const title=document.createElement('h3');title.textContent=p.title;const city=document.createElement('p');city.textContent=p.location;copy.append(title,city);a.append(image,copy);return a;
    }));
    document.querySelector('.search-count').textContent=results.length?`${results.length} project${results.length===1?'':'s'}`:'No projects found. Try another project or city.';
  }
  searchInput.addEventListener('input',()=>renderSearch(searchInput.value));
  document.querySelector('.search-form').addEventListener('submit',event=>event.preventDefault());

  document.querySelectorAll('.project-tabs button[data-category]').forEach(button=>button.addEventListener('click',()=>{
    if(button.getAttribute('aria-pressed')==='true')return;
    revealContext?.revert();
    const category=button.dataset.category;
    document.getElementById('project-grid').replaceChildren(document.getElementById(`projects-${category}`).content.cloneNode(true));
    document.querySelectorAll('.project-tabs button[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.getElementById('project-status').textContent=`Showing ${button.textContent} projects`;
    setupReveals();ScrollTrigger?.refresh();
  }));

  const validSections=['home','intro','work','about','news','atlas','contact'];
  function section(id) {if(validSections.includes(id)&&document.getElementById(id))document.getElementById(id).scrollIntoView({behavior:'instant'});}
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent)return;
    if(event.data?.type==='ljc-motion')setMotion(event.data.paused);
    if(event.data?.type==='ljc-section')section(event.data.id);
  });
  document.fonts.ready.then(()=>{
    setMotion(paused);
    const destination=query.get('section');
    requestAnimationFrame(()=>{
      if(destination)section(destination);
      ScrollTrigger?.refresh();
      if(parent!==window)parent.postMessage({type:'ljc-ready',theme},location.origin);
    });
  });
  setMotion(paused,false);
  addEventListener('pagehide',event=>{
    film.pause();
    if(event.persisted) return;
    rotator?.destroy();revealContext?.revert();filmObserver.disconnect();headerObserver.disconnect();
  });
  addEventListener('pageshow',event=>{if(event.persisted){setMotion(paused);rotator?.refresh();}});
})();
