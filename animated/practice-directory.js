/* Source-backed, progressively disclosed navigation. No hover is required. */
(() => {
  const dialog = document.getElementById('navigation');
  const column = dialog?.querySelector('.menu-links-column');
  if (!column) return;
  let data;
  try { data = JSON.parse(document.getElementById('explore-data').textContent); } catch { return; }
  const sections = [
    {key:'markets', label:'Markets', intro:'Explore the places and industries we design for.'},
    {key:'disciplines', label:'Disciplines', intro:'Explore our design and engineering services.'},
    {key:'businessUnits', label:'Building solutions', intro:'Discover our connected family of businesses.'},
  ];
  const body = dialog.querySelector('.menu-experience-body');
  const controls = document.createElement('nav');
  controls.className = 'practice-controls';
  controls.setAttribute('aria-label', 'Explore our practice');
  const eyebrow = document.createElement('p');
  eyebrow.textContent = 'Explore our practice';
  controls.append(eyebrow);
  const panel = document.createElement('section');
  panel.className = 'practice-panel';
  panel.id = 'practice-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'practice-title');
  const buttons = sections.map(section => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = section.label;
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => select(section, button));
    controls.append(button);
    return button;
  });
  if (dialog.dataset.menuExperience === 'gallery') {
    // Keep the directory controls next to the content they reveal, in DOM order.
    const practiceColumn = document.createElement('div');
    practiceColumn.className = 'practice-column';
    const preview = body.querySelector('.menu-project-preview');
    practiceColumn.append(controls);
    if (preview) practiceColumn.append(preview);
    practiceColumn.append(panel);
    body.append(practiceColumn);
  } else {
    column.append(controls);
    body.append(panel);
  }
  let activeButton = null;
  function closePanel(restore = false) {
    panel.getAnimations().forEach(animation => animation.cancel());
    panel.hidden = true;
    dialog.classList.remove('practice-open');
    buttons.forEach(button => button.setAttribute('aria-expanded','false'));
    dialog.dispatchEvent(new CustomEvent('ljc-practice-change', {detail:{section:null}}));
    if (restore) activeButton?.focus();
    activeButton = null;
  }
  function link(item) {
    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.textContent = item.title;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    return anchor;
  }
  function select(section, button) {
    if (activeButton === button) { closePanel(); return; }
    activeButton = button;
    panel.getAnimations().forEach(animation => animation.cancel());
    const header = document.createElement('div');
    header.className = 'practice-panel-heading';
    const heading = document.createElement('h2');
    heading.id = 'practice-title';
    heading.textContent = section.label;
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Back to overview';
    back.addEventListener('click', () => closePanel(true));
    header.append(heading, back);
    const intro = document.createElement('p');
    intro.className = 'practice-intro';
    intro.textContent = section.intro;
    const list = document.createElement('div');
    list.className = 'practice-list';
    const items = [...(data[section.key] || [])];
    if (section.key === 'businessUnits' && data.relationships) items.unshift(data.relationships);
    if (section.key === 'markets') {
      const groups = new Map();
      for (const item of items) {
        const key = item.group || item.title;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      }
      for (const [name, items] of groups) {
        const group = document.createElement('div');
        group.className = 'practice-group';
        if (items.length === 1 && items[0].title === name) group.append(link(items[0]));
        else {
          const title = document.createElement('h3');
          title.textContent = name;
          group.append(title, ...items.map(link));
        }
        list.append(group);
      }
    } else {
      list.classList.add('practice-list--single');
      list.append(...items.map(link));
    }
    panel.replaceChildren(header, intro, list);
    panel.dataset.section = section.key;
    panel.hidden = false;
    panel.scrollTop = 0;
    dialog.classList.add('practice-open');
    dialog.scrollTop = 0;
    body.scrollTop = 0;
    buttons.forEach(b => b.setAttribute('aria-expanded', String(b === button)));
    dialog.dispatchEvent(new CustomEvent('ljc-practice-change', {detail:{section:section.key}}));
    // Put keyboard users at the newly disclosed content, with an immediate way back.
    back.focus({preventScroll:true});
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('motion-paused')) {
      const expanding = dialog.dataset.menuExperience === 'colophon';
      panel.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}], {duration:expanding ? 350 : 220,delay:expanding ? 120 : 0,fill:'backwards',easing:'ease-out'});
    }
  }
  dialog.addEventListener('close', () => closePanel());
})();
