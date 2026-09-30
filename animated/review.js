(() => {
  const themes=['gallery','editorial','colophon','refresh','studio'];
  const sections=['home','intro','work','case-studies','about','news','atlas','contact'];
  const q=new URLSearchParams(location.search);
  const build=document.querySelector('meta[name=review-build]')?.content;
  let theme=themes.includes(q.get('theme'))?q.get('theme'):'gallery';
  let view=['home','project','cases','reverberation'].includes(q.get('view'))?q.get('view'):'home';
  let section=sections.includes(q.get('section'))?q.get('section'):'intro';
  let project=q.get('project')||'191-n-wacker';
  let caseProject=q.get('case')||'';
  let editionMode=q.get('mode')==='book'?'book':'digital';
  let editionStory=q.get('story')||'';
  let editionChapter=q.get('chapter')||'';
  let editionSpread=/^[1-9]\d{0,3}$/.test(q.get('spread')||'')?q.get('spread'):'';
  let paused=q.get('motion')==='off';
  let ready=false;
  let displayedView=null, navigationTransition=null, resolveFrame=null, frameTimer=0;
  const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const frame=document.getElementById('preview');
  let readerExpanded=false, readerReturn=null;
  function setReaderExpanded(expanded,{restore=true}={}){
    const next=expanded===true;
    if(next!==readerExpanded){
      if(next)readerReturn={x:window.scrollX,y:window.scrollY,focus:document.activeElement,document:frame.contentDocument};
      readerExpanded=next;
      document.body.classList.toggle('reader-expanded',readerExpanded);
      if(!next){
        const previous=readerReturn;readerReturn=null;
        if(restore&&previous){
          window.scrollTo({left:previous.x,top:previous.y,behavior:'instant'});
          // The reader owns focus inside its iframe. Only recover a parent
          // control if hiding the chrome had left the parent itself unfocused.
          if(document.activeElement===document.body&&previous.focus!==frame&&previous.focus?.isConnected&&previous.focus.getClientRects().length)previous.focus.focus({preventScroll:true});
        }
      }
    }
    frame.contentWindow.postMessage({type:'ljc-reader-fullscreen-state',expanded:readerExpanded},location.origin);
  }
  frame.addEventListener('load',()=>{if(readerExpanded&&frame.contentDocument!==readerReturn?.document)setReaderExpanded(false,{restore:false});});
  const select=document.getElementById('section-select');
  const projectSelect=document.getElementById('project-select');
  const viewSelect=document.getElementById('view-select');
  const motion=document.getElementById('motion-button');
  const projects=JSON.parse(document.getElementById('review-projects').textContent);
  if(!projects.some(p=>p.id===project))project=projects[0]?.id||'191-n-wacker';
  if(!projects.some(p=>p.id===caseProject))caseProject='';
  projects.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.title;projectSelect.append(o);});
  const descriptions={gallery:'A wide photographic sequence and an interactive office map.',editorial:'Warm paper, suggested searches, and image-led navigation.',colophon:'Large photographs and an expanding charcoal menu.',refresh:'Your homepage concept, developed into an integrated project and case-study library.',studio:'A quieter studio index: expressive type, generous images, and direct discovery.'};
  const projectDescriptions={gallery:'An immersive photo sequence with project details on demand.',editorial:'A project story in warm paper, generous photographs, and clear facts.',colophon:'A precise project dossier with a dark masthead and image index.',refresh:'A composed photographic journal, a clear story, and an embedded case study.',studio:'A visual project journal with a complete case-study reader.'};
  function editionParams(p){p.set('mode',editionMode);if(editionChapter)p.set('chapter',editionChapter);if(editionStory)p.set('story',editionStory);if(editionSpread)p.set('spread',editionSpread);}
  function pageURL(){const p=new URLSearchParams({section:view==='project'?'home':section,motion:paused?'off':'on'});if(build)p.set('v',build);if(view==='reverberation'){p.set('theme',theme);editionParams(p);return `reverberation.html?${p}`;}if(view==='cases'){p.set('theme',theme);if(caseProject)p.set('case',caseProject);return `case-studies.html?${p}`;}if(view==='project')p.set('project',project);return `${view==='project'?'project-':''}${theme}.html?${p}`;}
  function updateURL(push=false,statePatch={}){const p=new URLSearchParams({theme,view,section,motion:paused?'off':'on'});if(view==='project')p.set('project',project);if(view==='cases'&&caseProject)p.set('case',caseProject);if(view==='reverberation')editionParams(p);const url=`?${p}`;if(push&&location.search!==url)history.pushState({ljcReview:true,...statePatch},'',url);else history.replaceState({...history.state,...statePatch},'',url);document.getElementById('standalone').href=pageURL();}
  function load(push=false,coverEntryRequest=false){
    if(readerExpanded)setReaderExpanded(false,{restore:false});
    const changesPublication=displayedView!==null && (displayedView==='reverberation')!==(view==='reverberation');
    const coverEntry=coverEntryRequest&&push&&displayedView!==null&&displayedView!=='reverberation'&&view==='reverberation'&&editionMode==='digital'&&!editionChapter&&!editionStory&&!editionSpread;
    navigationTransition?.skipTransition();
    const apply=()=>{displayedView=view;loadFrame(push,coverEntry);};
    // The cover owns its entrance; a wrapper snapshot would hide its first beat.
    if(coverEntry || !changesPublication || paused || systemMotion.matches || !document.startViewTransition){apply();return;}
    const bounds=frame.getBoundingClientRect();
    let origin={left:bounds.left+32,top:bounds.top+40,width:200,height:50};
    try {
      const focused=frame.contentDocument.activeElement;
      if(focused && focused!==frame.contentDocument.body){
        const r=focused.getBoundingClientRect();
        if(r.width&&r.height)origin={left:bounds.left+r.left,top:bounds.top+r.top,width:r.width,height:r.height};
      }
    } catch (_) { /* An unknown frame still gets the centered entrance. */ }
    const clamp=(n,max)=>Math.min(max,Math.max(0,n));
    const w=innerWidth,h=innerHeight;
    document.documentElement.style.setProperty('--edition-entry-inset',`${clamp(origin.top,h)}px ${clamp(w-origin.left-origin.width,w)}px ${clamp(h-origin.top-origin.height,h)}px ${clamp(origin.left,w)}px`);
    document.documentElement.dataset.editionTransition=view==='reverberation'?'enter':'leave';
    const transition=document.startViewTransition(()=>new Promise(resolve=>{
      clearTimeout(frameTimer);resolveFrame=resolve;
      frameTimer=setTimeout(()=>{resolveFrame?.();resolveFrame=null;},1800);
      apply();
    }));
    navigationTransition=transition;
    // Skipping a superseded transition rejects ready even when finished resolves.
    transition.ready.catch(()=>{});
    transition.updateCallbackDone.catch(()=>{});
    transition.finished.catch(()=>{}).finally(()=>{if(navigationTransition===transition){navigationTransition=null;delete document.documentElement.dataset.editionTransition;}});
  }
  function loadFrame(push=false,coverEntry=false){
    ready=false;
    document.body.dataset.view=view;
    document.body.dataset.motion=paused?'off':'on';
    document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));
    if(section==='atlas'&&theme!=='gallery')section='contact';
    if((theme==='refresh'||theme==='studio')&&section==='news')section='work';
    select.querySelector('[value=atlas]').hidden=theme!=='gallery';
    select.querySelector('[value=home]').textContent=['refresh','studio'].includes(theme)?'Overview':'Film';
    select.querySelector('[value=news]').hidden=['refresh','studio'].includes(theme);
    frame.title=view==='reverberation'?'Reverberation 2026 digital edition':view==='cases'?'LJC case-study library':`LJC ${theme[0].toUpperCase()+theme.slice(1)} ${view==='project'?'project page':'home page'} preview`;
    // The review owns navigation history; iframe transitions must not add a
    // second history entry for the same user action.
    const destination=new URL(pageURL(),location.href);
    if(coverEntry&&view==='reverberation'&&editionMode==='digital'&&!editionChapter&&!editionStory&&!editionSpread)destination.searchParams.set('entry','cover');
    frame.contentWindow.location.replace(destination.href);
    document.getElementById('direction-copy').textContent=view==='reverberation'?'Reverberation 2026 · Explore the website or read the complete book.':view==='cases'?'Explore every case study. Open a cover, then choose any spread to read in detail.':(view==='project'?projectDescriptions:descriptions)[theme];
    viewSelect.value=view;select.hidden=view!=='home';projectSelect.hidden=view!=='project';projectSelect.value=project;
    select.value=section;updateURL(push);
  }
  document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{if(theme!==b.dataset.theme){theme=b.dataset.theme;load(true);}}));
  viewSelect.addEventListener('change',()=>{view=viewSelect.value;load(true,true);});
  projectSelect.addEventListener('change',()=>{project=projectSelect.value;load(true);});
  select.addEventListener('change',()=>{section=select.value;if(section==='case-studies'){view='cases';load(true);return;}updateURL(true);if(ready)frame.contentWindow.postMessage({type:'ljc-section',id:section},location.origin);else load();});
  motion.addEventListener('click',()=>{paused=!paused;motion.textContent=paused?'Play motion':'Pause motion';motion.setAttribute('aria-pressed',String(paused));if(ready)frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);updateURL();});
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='ljc-reader-fullscreen'){
      if(typeof event.data.expanded==='boolean')setReaderExpanded(event.data.expanded);
      return;
    }
    if(event.data?.type==='ljc-ready'&&event.data.theme===theme){ready=true;
      if(resolveFrame){
        const finish=resolveFrame;resolveFrame=null;clearTimeout(frameTimer);
        const lead=frame.contentDocument?.querySelector('img[fetchpriority="high"]');
        if(lead?.decode)Promise.race([lead.decode().catch(()=>{}),new Promise(r=>setTimeout(r,700))]).then(finish);else finish();
      }frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);if(view==='home')frame.contentWindow.postMessage({type:'ljc-section',id:section},location.origin);}
    if(event.data?.type==='ljc-motion-state'&&ready){paused=event.data.paused;motion.textContent=event.data.system?'Reduced motion on':paused?'Play motion':'Pause motion';motion.setAttribute('aria-pressed',String(event.data.reduced));motion.disabled=event.data.system;updateURL();}
    if(event.data?.type==='ljc-project'){if(projects.some(p=>p.id===event.data.project))project=event.data.project;view='project';load(true);}
    if(event.data?.type==='ljc-cases'){caseProject='';view='cases';load(true);}
    if(event.data?.type==='ljc-reverberation'){view='reverberation';editionMode=event.data.mode==='book'?'book':'digital';editionStory='';editionChapter='';editionSpread='';load(true,true);}
    if(event.data?.type==='ljc-reverberation-state'&&view==='reverberation'){
      if(readerExpanded&&!event.data.spread)setReaderExpanded(false,{restore:false});
      if(event.data.historyAction==='close-reader'&&editionMode==='digital'&&editionSpread&&history.state?.reverbReaderEntry){history.back();return;}
      if(event.data.historyAction==='close-book'&&editionMode==='book'&&history.state?.reverbBookEntry){history.back();return;}
      const oldMode=editionMode;
      const wasReaderOpen=Boolean(editionSpread);
      const oldRoute=`${editionMode}/${editionChapter}/${editionStory}/${editionMode==='digital'&&wasReaderOpen}`;
      editionMode=event.data.mode==='book'?'book':'digital';editionStory=typeof event.data.story==='string'?event.data.story:'';editionChapter=typeof event.data.chapter==='string'?event.data.chapter:'';
      editionSpread=/^[1-9]\d{0,3}$/.test(String(event.data.spread||''))?String(event.data.spread):'';
      const routeChanged=oldRoute!==`${editionMode}/${editionChapter}/${editionStory}/${editionMode==='digital'&&Boolean(editionSpread)}`;
      const push=routeChanged&&!['close-reader','close-book','sync'].includes(event.data.historyAction);
      updateURL(push,push?{reverbReaderEntry:editionMode==='digital'&&!wasReaderOpen&&Boolean(editionSpread),reverbBookEntry:oldMode!=='book'&&editionMode==='book'}:['close-reader','close-book'].includes(event.data.historyAction)?{reverbReaderEntry:false,reverbBookEntry:false}:{});
    }
    if(event.data?.type==='ljc-case-selection'&&view==='cases'){caseProject=projects.some(p=>p.id===event.data.project)?event.data.project:'';updateURL();}
    if(event.data?.type==='ljc-home'){view='home';section=sections.includes(event.data.section)?event.data.section:'work';load(true);}
  });
  addEventListener('popstate',()=>{
    if(readerExpanded)setReaderExpanded(false,{restore:false});
    const previousView=view, previousTheme=theme;
    const p=new URLSearchParams(location.search);
    theme=themes.includes(p.get('theme'))?p.get('theme'):'gallery';
    view=['home','project','cases','reverberation'].includes(p.get('view'))?p.get('view'):'home';
    section=sections.includes(p.get('section'))?p.get('section'):'intro';
    project=projects.some(item=>item.id===p.get('project'))?p.get('project'):projects[0]?.id;
    caseProject=projects.some(item=>item.id===p.get('case'))?p.get('case'):'';
    editionMode=p.get('mode')==='book'?'book':'digital';editionStory=p.get('story')||'';editionChapter=p.get('chapter')||'';
    editionSpread=/^[1-9]\d{0,3}$/.test(p.get('spread')||'')?p.get('spread'):'';
    paused=p.get('motion')==='off';
    if(previousView==='reverberation'&&view==='reverberation'&&previousTheme===theme&&ready){
      frame.contentWindow.postMessage({type:'ljc-reverberation-navigate',mode:editionMode,chapter:editionChapter,story:editionStory,spread:editionSpread},location.origin);
      frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);
      updateURL();
    }else load();
  });
  load();
})();
