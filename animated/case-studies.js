(() => {
  'use strict';
  const query=new URLSearchParams(location.search);
  const themes=['gallery','editorial','colophon','refresh','studio'];
  const theme=themes.includes(query.get('theme'))?query.get('theme'):'gallery';
  document.body.dataset.theme=theme;
  document.querySelector('[data-reverberation]').href=`reverberation.html?theme=${theme}`;
  const projects=JSON.parse(document.getElementById('case-library-data').textContent).projects;
  const cards=[...document.querySelectorAll('.case-study-card')];
  const input=document.getElementById('case-library-search');
  const status=document.getElementById('case-library-status');
  const empty=document.getElementById('case-library-empty');
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=query.get('motion')==='off';

  function setMotion(value,notify=true){
    paused=Boolean(value);
    document.body.classList.toggle('motion-paused',paused||media.matches);
    if(notify&&parent!==window)parent.postMessage({type:'ljc-motion-state',paused,reduced:paused||media.matches,system:media.matches},location.origin);
  }
  function updateSelection(id){
    const params=new URLSearchParams(location.search);
    if(id)params.set('case',id);else params.delete('case');
    history.replaceState(null,'',`?${params}`);
    if(parent!==window)parent.postMessage({type:'ljc-case-selection',project:id||null},location.origin);
  }
  function openCase(id,trigger){
    const project=projects.find(item=>item.id===id);
    if(!project||!project.caseStudy?.pages?.length)return;
    window.LJCCaseReader.open({title:project.title,pages:project.caseStudy.pages},0,trigger);
    updateSelection(id);
  }
  document.querySelectorAll('[data-open-case]').forEach(button=>{
    button.addEventListener('click',()=>openCase(button.dataset.openCase,button));
  });
  document.addEventListener('ljc-case-reader-close',()=>updateSelection(null));
  input.addEventListener('input',()=>{
    const terms=input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count=0;
    cards.forEach(card=>{
      const matches=terms.every(term=>card.dataset.caseSearch.toLocaleLowerCase().includes(term));
      card.hidden=!matches;
      if(matches)count++;
    });
    status.textContent=`${count} case ${count===1?'study':'studies'}`;
    empty.hidden=count!==0;
  });
  document.querySelectorAll('[data-home-section]').forEach(link=>{
    const params=new URLSearchParams({section:link.dataset.homeSection,motion:paused?'off':'on'});
    link.href=`${theme}.html?${params}`;
    link.addEventListener('click',event=>{
      if(parent===window||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      parent.postMessage({type:'ljc-home',section:link.dataset.homeSection},location.origin);
    });
  });
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent)return;
    if(event.data?.type==='ljc-motion')setMotion(event.data.paused);
  });
  media.addEventListener('change',()=>setMotion(paused));
  setMotion(paused,false);
  if(parent!==window)parent.postMessage({type:'ljc-ready',theme,view:'cases'},location.origin);
  const initial=projects.find(project=>project.id===query.get('case'));
  if(initial)openCase(initial.id,document.querySelector(`[data-open-case="${initial.id}"]`));
})();
