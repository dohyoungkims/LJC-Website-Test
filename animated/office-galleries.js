/* Shared office photography and contact directory. Selection is immediate;
   photographs are never relabeled as a different workplace. */
(() => {
  const data=JSON.parse(document.getElementById('office-gallery-data')?.textContent||'{}');
  const offices=data.offices||[];
  const base=new URL('../',document.currentScript.src);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  function photos(stage,key){
    stage.replaceChildren();stage.classList.add('office-photo-gallery');
    const items=data.photos?.[key]||[];
    stage.dataset.photoCount=items.length;
    if(!items.length){const empty=el('div','office-photo-empty');empty.append(el('span','','LJC'),el('p','','Connected by design.'));stage.append(empty);return;}
    let selected=0;
    const picture=el('div','office-photo-stage');
    const images=items.map((p,i)=>{const img=new Image();img.src=new URL(p.src,base).href;img.alt=p.alt;img.decoding='async';img.hidden=i!==0;picture.append(img);return img;});
    const bar=el('div','office-photo-toolbar');
    const caption=el('span','office-photo-caption',items[0].caption||'');
    const controls=el('div','office-photo-controls');
    const previous=el('button','','←'),count=el('span','',`1 / ${items.length}`),next=el('button','','→');
    previous.type=next.type='button';previous.setAttribute('aria-label','Previous office photo');next.setAttribute('aria-label','Next office photo');count.setAttribute('aria-live','polite');
    function show(i){selected=(i+items.length)%items.length;images.forEach((img,n)=>img.hidden=n!==selected);count.textContent=`${selected+1} / ${items.length}`;caption.textContent=items[selected].caption||'';}
    previous.onclick=()=>show(selected-1);next.onclick=()=>show(selected+1);
    controls.append(previous,count,next);controls.hidden=items.length<2;bar.append(caption,controls);stage.append(picture,bar);
  }
  window.LJCOfficePhotos={render:photos};
  document.querySelectorAll('[data-office-gallery-slot]').forEach((slot,instance)=>{
    if(!offices.length)return;
    const widget=el('section','office-gallery-directory');widget.setAttribute('aria-label','LJC offices');
    const heading=el('div','office-gallery-heading');heading.append(el('p','office-gallery-kicker','One practice. Seven offices.'),el('h2','','Connected by design. Wherever you are.'));
    const body=el('div','office-gallery-body');const index=el('div','office-gallery-index');index.setAttribute('role','group');index.setAttribute('aria-label','Choose an office');
    const card=el('section','office-gallery-card');card.id=`office-gallery-${instance}`;
    const stage=el('div','');const details=el('div','office-gallery-details');const title=el('h3');const address=el('address');const actions=el('div','office-gallery-actions');const phone=el('a');const directions=el('a','','Get directions ↗');directions.target='_blank';directions.rel='noopener';actions.append(phone,directions);details.append(title,address,actions);card.append(stage,details);
    let current=-1;const buttons=[];
    function choose(i){if(i===current)return;current=i;const o=offices[i];widget.dataset.office=o.id;title.textContent=o.name;address.replaceChildren();o.address.forEach((line,j)=>{if(j)address.append(document.createElement('br'));address.append(document.createTextNode(line));});phone.textContent=o.phone;phone.href=o.tel;directions.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.address.join(', '));directions.setAttribute('aria-label',`Get directions to the ${o.name} office`);buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));photos(stage,o.id);}
    offices.forEach((o,i)=>{const b=el('button','',o.name);b.type='button';b.setAttribute('aria-controls',card.id);b.setAttribute('aria-pressed','false');b.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')choose(i);});b.addEventListener('focus',()=>choose(i));b.onclick=()=>choose(i);b.onkeydown=e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;let n;if(['ArrowDown','ArrowRight'].includes(e.key))n=(i+1)%offices.length;if(['ArrowUp','ArrowLeft'].includes(e.key))n=(i+offices.length-1)%offices.length;if(e.key==='Home')n=0;if(e.key==='End')n=offices.length-1;if(n!==undefined){e.preventDefault();buttons[n].focus();}};buttons.push(b);index.append(b);});
    body.append(index,card);widget.append(heading,body);slot.replaceChildren(widget);choose(0);
  });
})();
