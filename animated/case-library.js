(() => {
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-case-library], [data-reverberation]');
    if(!link||parent===window||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    parent.postMessage({type:link.hasAttribute('data-reverberation')?'ljc-reverberation':'ljc-cases',mode:new URL(link.href).searchParams.get('mode')||'digital'},location.origin);
  });
  const input=document.querySelector('[data-case-filter]');
  if(input){const cards=[...document.querySelectorAll('[data-case-search]')];input.addEventListener('input',()=>{const terms=input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);let count=0;cards.forEach(c=>{const visible=terms.every(t=>c.dataset.caseSearch.toLocaleLowerCase().includes(t));c.hidden=!visible;if(visible)count++;});document.querySelector('.case-library-status').textContent=terms.length?(count?`${count} case ${count===1?'study':'studies'}`:'No matches. Try another project, place or program.') :'';});}
})();
