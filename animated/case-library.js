(() => {
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-case-library], [data-reverberation]');
    if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    const destination=new URL(link.href,location.href);
    if(destination.origin!==location.origin)return;
    const reverberation=link.hasAttribute('data-reverberation');
    if(parent!==window){
      event.preventDefault();
      parent.postMessage({type:reverberation?'ljc-reverberation':'ljc-cases',mode:destination.searchParams.get('mode')||'digital'},location.origin);
    }else if(reverberation&&destination.searchParams.get('mode')!=='book'&&!destination.searchParams.get('chapter')&&!destination.searchParams.get('story')&&!destination.searchParams.get('spread')){
      // A menu click gets the cover entrance; copied URLs and new tabs stay direct.
      event.preventDefault();
      destination.searchParams.set('entry','cover');
      location.assign(destination.href);
    }
  });
  const input=document.querySelector('[data-case-filter]');
  if(input){const cards=[...document.querySelectorAll('[data-case-search]')];input.addEventListener('input',()=>{const terms=input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);let count=0;cards.forEach(c=>{const visible=terms.every(t=>c.dataset.caseSearch.toLocaleLowerCase().includes(t));c.hidden=!visible;if(visible)count++;});document.querySelector('.case-library-status').textContent=terms.length?(count?`${count} case ${count===1?'study':'studies'}`:'No matches. Try another project, place or program.') :'';});}
})();
