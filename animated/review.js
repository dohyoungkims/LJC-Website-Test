(() => {
  const themes=['gallery','editorial','colophon','refresh','studio'];
  const sections=['home','intro','work','case-studies','about','news','atlas','contact'];
  const q=new URLSearchParams(location.search);
  let theme=themes.includes(q.get('theme'))?q.get('theme'):'gallery';
  let view=q.get('view')==='project'?'project':'home';
  let section=sections.includes(q.get('section'))?q.get('section'):'intro';
  let project=q.get('project')||'191-n-wacker';
  let paused=q.get('motion')==='off';
  let ready=false;
  const frame=document.getElementById('preview');
  const select=document.getElementById('section-select');
  const projectSelect=document.getElementById('project-select');
  const viewSelect=document.getElementById('view-select');
  const motion=document.getElementById('motion-button');
  const projects=JSON.parse(document.getElementById('review-projects').textContent);
  if(!projects.some(p=>p.id===project))project=projects[0]?.id||'191-n-wacker';
  projects.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.title;projectSelect.append(o);});
  const descriptions={gallery:'A wide photographic sequence and an interactive office map.',editorial:'Warm paper, suggested searches, and image-led navigation.',colophon:'Large photographs and an expanding charcoal menu.',refresh:'Your homepage concept, developed into an integrated project and case-study library.',studio:'A quieter studio index: expressive type, generous images, and direct discovery.'};
  const projectDescriptions={gallery:'An immersive photo sequence with project details on demand.',editorial:'A project story in warm paper, generous photographs, and clear facts.',colophon:'A precise project dossier with a dark masthead and image index.',refresh:'Your project-page layout: panoramic imagery, a clear story, and an embedded case study.',studio:'A visual project journal with a complete case-study reader.'};
  function pageURL(){const p=new URLSearchParams({section:view==='project'?'home':section,motion:paused?'off':'on'});if(view==='project')p.set('project',project);return `${view==='project'?'project-':''}${theme}.html?${p}`;}
  function updateURL(){const p=new URLSearchParams({theme,view,section,motion:paused?'off':'on'});if(view==='project')p.set('project',project);history.replaceState(null,'',`?${p}`);document.getElementById('standalone').href=pageURL();}
  function load(){
    ready=false;
    document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));
    if(section==='atlas'&&theme!=='gallery')section='contact';
    if((theme==='refresh'||theme==='studio')&&section==='news')section='work';
    select.querySelector('[value=atlas]').hidden=theme!=='gallery';
    select.querySelector('[value=news]').hidden=['refresh','studio'].includes(theme);
    frame.title=`LJC ${theme[0].toUpperCase()+theme.slice(1)} ${view==='project'?'project page':'home page'} preview`;
    frame.src=pageURL();
    document.getElementById('direction-copy').textContent=(view==='project'?projectDescriptions:descriptions)[theme];
    viewSelect.value=view;select.hidden=view==='project';projectSelect.hidden=view!=='project';projectSelect.value=project;
    select.value=section;updateURL();
  }
  document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{if(theme!==b.dataset.theme){theme=b.dataset.theme;load();}}));
  viewSelect.addEventListener('change',()=>{view=viewSelect.value;load();});
  projectSelect.addEventListener('change',()=>{project=projectSelect.value;load();});
  select.addEventListener('change',()=>{section=select.value;if(ready)frame.contentWindow.postMessage({type:'ljc-section',id:section},location.origin);else load();updateURL();});
  motion.addEventListener('click',()=>{paused=!paused;motion.textContent=paused?'Play motion':'Pause motion';motion.setAttribute('aria-pressed',String(paused));if(ready)frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);updateURL();});
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='ljc-ready'&&event.data.theme===theme){ready=true;frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);if(view==='home')frame.contentWindow.postMessage({type:'ljc-section',id:section},location.origin);}
    if(event.data?.type==='ljc-motion-state'&&ready){paused=event.data.paused;motion.textContent=event.data.system?'Reduced motion on':paused?'Play motion':'Pause motion';motion.setAttribute('aria-pressed',String(event.data.reduced));motion.disabled=event.data.system;updateURL();}
    if(event.data?.type==='ljc-project'){if(projects.some(p=>p.id===event.data.project))project=event.data.project;view='project';load();}
    if(event.data?.type==='ljc-home'){view='home';section=sections.includes(event.data.section)?event.data.section:'work';load();}
  });
  load();
})();
