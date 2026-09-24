(() => {
  const themes=['gallery','editorial','colophon'];
  const sections=['home','intro','work','about','news','atlas','contact'];
  const q=new URLSearchParams(location.search);
  let theme=themes.includes(q.get('theme'))?q.get('theme'):'gallery';
  let section=sections.includes(q.get('section'))?q.get('section'):'intro';
  let paused=q.get('motion')==='off';
  let ready=false;
  const frame=document.getElementById('preview');
  const select=document.getElementById('section-select');
  const motion=document.getElementById('motion-button');
  const descriptions={gallery:'A wide photographic sequence, shifting scale, and an interactive office map.',editorial:'Warm paper, image-led navigation, and a glass search field.',colophon:'Large photographs, precise captions, and a charcoal menu unfolding from the left.'};
  function updateURL(){history.replaceState(null,'',`?theme=${theme}&section=${section}&motion=${paused?'off':'on'}`);document.getElementById('standalone').href=`${theme}.html?section=${section}&motion=${paused?'off':'on'}`;}
  function load(){
    ready=false;
    document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));
    if(section==='atlas'&&theme!=='gallery')section='contact';
    select.querySelector('[value=atlas]').hidden=theme!=='gallery';
    frame.title=`LJC ${theme[0].toUpperCase()+theme.slice(1)} design preview`;
    frame.src=`${theme}.html?section=${section}&motion=${paused?'off':'on'}`;
    document.getElementById('direction-copy').textContent=descriptions[theme];
    select.value=section;updateURL();
  }
  document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{if(theme!==b.dataset.theme){theme=b.dataset.theme;load();}}));
  select.addEventListener('change',()=>{section=select.value;if(ready)frame.contentWindow.postMessage({type:'ljc-section',id:section},location.origin);updateURL();});
  motion.addEventListener('click',()=>{paused=!paused;motion.textContent=paused?'Play motion':'Pause motion';motion.setAttribute('aria-pressed',String(paused));if(ready)frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);updateURL();});
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='ljc-ready'&&event.data.theme===theme){
      ready=true;
      frame.contentWindow.postMessage({type:'ljc-motion',paused},location.origin);
      frame.contentWindow.postMessage({type:'ljc-section',id:section},location.origin);
    }
    if(event.data?.type==='ljc-motion-state'&&ready){
      paused=event.data.paused;motion.textContent=event.data.system?'Reduced motion on':paused?'Play motion':'Pause motion';
      motion.setAttribute('aria-pressed',String(event.data.reduced));motion.disabled=event.data.system;updateURL();
    }
  });
  load();
})();
