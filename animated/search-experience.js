/* Editorial starts with useful suggestions; Gallery also exposes content types.
   Native dialog and site.js own focus, dismissal, scroll locking and motion state. */
(() => {
  'use strict';
  const theme = document.body.dataset.theme;
  if (!['gallery', 'editorial'].includes(theme)) return;
  const dialog = document.getElementById('search');
  const input = dialog?.querySelector('#project-search');
  if (!dialog || !input) return;
  const gsap = window.gsap, media = matchMedia('(prefers-reduced-motion: reduce)');
  const resultBox = dialog.querySelector('.search-results'), count = dialog.querySelector('.search-count');
  const form = dialog.querySelector('.search-form'), gallery = theme === 'gallery';
  const readData = id => { try { return JSON.parse(document.getElementById(id)?.textContent || '{}'); } catch { return {}; } };
  const projectData = readData('project-data'), exploreData = readData('explore-data');
  const types = [['all','All'],['people','People'],['projects','Projects'],['locations','Locations'],['markets','Markets'],['disciplines','Disciplines']];
  const singular = {people:'Person',projects:'Project',locations:'Office',markets:'Market',disciplines:'Discipline'};
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  const text = (tag,value,className) => { const node=document.createElement(tag); node.textContent=value; if(className)node.className=className; return node; };
  const safeURL = value => { if(typeof value!=='string'||!value.trim())return false; try { return /^https?:$/.test(new URL(value,location.href).protocol); } catch { return false; } };
  const records=[], seen=new Set();
  function addRecord(type,record,key='') {
    if(!record?.title || !record.url || !safeURL(record.url))return;
    const identity=`${type}:${record.url}`;
    if(seen.has(identity))return;
    seen.add(identity);
    const metadata=exploreData.projectMetadata?.[key] || {};
    const subtitle=record.subtitle || record.location || record.group || '';
    const keywords=[record.title,subtitle,record.group,record.keywords,record.markets,record.disciplines,metadata.markets,metadata.disciplines].flat(Infinity).filter(Boolean).join(' ');
    records.push({...record,key,type,subtitle,normalized:normalize(keywords),normalizedTitle:normalize(record.title)});
  }
  Object.entries(projectData).forEach(([key,record])=>addRecord('projects',record,key));
  ['people','locations','markets','disciplines'].forEach(type=>(exploreData[type]||[]).forEach(record=>addRecord(type,record)));
  let activeType='all', timeline=null, closeDone=null;
  const reduce=()=>media.matches || document.body.classList.contains('motion-paused');
  dialog.classList.add('search-enhanced');
  dialog.setAttribute('aria-label','Search LJC');
  document.querySelector('.search-trigger')?.setAttribute('aria-label','Search LJC');
  form.querySelector('label').textContent=gallery?'Explore LJC':'What are you looking for?';
  input.placeholder='Search LJC';
  input.setAttribute('aria-controls','search-results');
  resultBox.id='search-results'; resultBox.setAttribute('aria-label','Search results');
  count.setAttribute('aria-live','polite'); count.setAttribute('aria-atomic','true');
  const starter=text('div','','search-start');
  starter.append(text('p','Suggested searches','search-start-label'));
  const suggested=text('div','','search-suggestions');
  ['Chicago','Healthcare','Interior Design','191 N Wacker'].forEach((query,index)=>{
    const button=text('button','','search-suggestion'); button.type='button';
    button.append(text('span',`0${index+1}`,'search-suggestion-index'),text('span',query),text('span','↗','search-suggestion-arrow'));
    button.firstElementChild.setAttribute('aria-hidden','true'); button.lastElementChild.setAttribute('aria-hidden','true');
    button.addEventListener('click',()=>{activeType='all';input.value=query;renderSearch(query);input.focus({preventScroll:true});});
    suggested.append(button);
  });
  starter.append(suggested); form.after(starter);
  const filterButtons=[];
  if(gallery){
    const filters=text('div','','search-filters'); filters.setAttribute('role','group'); filters.setAttribute('aria-label','Filter search by type');
    types.forEach(([type,title])=>{
      const button=text('button',title,'search-filter');button.type='button';button.dataset.searchType=type;
      button.setAttribute('aria-pressed',String(type===activeType));button.setAttribute('aria-controls','search-results');
      button.addEventListener('click',()=>{activeType=type;renderSearch(input.value);});
      filters.append(button);filterButtons.push(button);
    });form.after(filters);
  }
  const toolbar=text('div','','search-result-toolbar');count.before(toolbar);toolbar.append(count);
  const reset=text('button','Reset search','search-reset');reset.type='button';reset.hidden=true;
  reset.addEventListener('click',()=>{activeType='all';input.value='';renderSearch('');input.focus({preventScroll:true});});toolbar.append(reset);
  function renderResult(record){
    const link=text('a','','search-result');link.href=safeURL(record.previewUrl)?record.previewUrl:record.url;
    if(record.studyId||record.key==='wacker'){const id=record.studyId||'191-n-wacker';link.href=`project-${theme}.html?project=${id}`;link.dataset.projectStudy='';link.dataset.projectId=id;link.removeAttribute('target');}
    if(new URL(link.href,location.href).origin!==location.origin){link.target='_blank';link.rel='noopener';}
    if(record.type==='projects'&&record.image){
      const image=document.createElement('img');image.src=/^(https?:|\.\.\/)/.test(record.image)?record.image:`../${record.image}`;
      image.alt='';image.loading='lazy';image.width=100;image.height=74;link.append(image);
    }else{link.classList.add('search-result-text');}
    const copy=text('div','','search-result-copy');copy.append(text('span',singular[record.type],'search-result-type'),text('h3',record.title));
    if(record.subtitle&&record.subtitle!==record.title)copy.append(text('p',record.subtitle));
    const arrow=text('span','↗','search-result-arrow');arrow.setAttribute('aria-hidden','true');link.append(copy,arrow);return link;
  }
  function renderSearch(term){
    const normalized=normalize(term),tokens=normalized.split(' ').filter(Boolean);
    const started=Boolean(normalized)||(gallery&&activeType!=='all');
    starter.hidden=started;toolbar.hidden=!started;resultBox.hidden=!started;reset.hidden=!started;
    dialog.classList.toggle('has-search-results',started);
    filterButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.searchType===activeType)));
    if(!started){count.textContent='';resultBox.replaceChildren();return true;}
    const results=records.filter(record=>(activeType==='all'||record.type===activeType)&&tokens.every(token=>record.normalized.includes(token)));
    if(normalized)results.sort((a,b)=>Number(b.normalizedTitle.startsWith(normalized))-Number(a.normalizedTitle.startsWith(normalized)));
    const label=activeType==='all'?'result':activeType==='people'?'person':singular[activeType].toLowerCase();
    const plural=activeType==='people'?'people':`${label}s`;
    count.textContent=`${results.length} ${results.length===1?label:plural}${normalized?` for “${term.trim()}”`:''}`;
    resultBox.replaceChildren(...results.map(renderResult));resultBox.scrollTop=0;
    if(!results.length){
      const empty=text('div','','search-empty');empty.append(text('h3','Let’s try another way.'),text('p',activeType==='all'?'Try a project name, city, market or discipline.':'Try another term, or choose All to search across LJC.'));
      const button=text('button',activeType==='all'?'Show suggested searches':'Search all categories');button.type='button';
      button.addEventListener('click',()=>{if(activeType==='all')input.value='';activeType='all';renderSearch(input.value);input.focus({preventScroll:true});});empty.append(button);resultBox.append(empty);
    }return true;
  }
  const clear=()=>{timeline?.kill();timeline=null;if(gsap)gsap.set(dialog,{clearProps:'transform,opacity,filter,clipPath'});};
  function settle(){clear();dialog.style.setProperty('--search-backdrop-opacity','1');if(closeDone){const done=closeDone;closeDone=null;done();}}
  window.LJCSearchExperience={
    handles:node=>node===dialog,renderSearch,
    open(){
      clear();closeDone=null;renderSearch(input.value);
      if(!gsap||reduce()){settle();return;}
      timeline=gsap.timeline({onComplete(){timeline=null;}});gsap.set(dialog,{'--search-backdrop-opacity':0});
      timeline.fromTo(dialog,{opacity:0,y:gallery?18:-28,scale:gallery?.97:.99,filter:'blur(5px)'},{opacity:1,y:0,scale:1,filter:'blur(0px)',duration:.46,ease:'power3.out',clearProps:'transform,opacity,filter'},0).to(dialog,{'--search-backdrop-opacity':1,duration:.35,ease:'power2.out'},0);
    },
    close(node,done){clear();closeDone=done;if(!gsap||reduce()){settle();return;}timeline=gsap.timeline({onComplete:settle});timeline.to(dialog,{opacity:0,y:gallery?8:-16,scale:gallery?.98:.995,duration:.22,ease:'power2.in'},0).to(dialog,{'--search-backdrop-opacity':0,duration:.22},0);},settle,
  };
  renderSearch('');
  const onPreference=()=>{if(media.matches)settle();};media.addEventListener('change',onPreference);
  addEventListener('pagehide',event=>{if(event.persisted)return;clear();media.removeEventListener('change',onPreference);});
})();
