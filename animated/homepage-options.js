(() => {
  'use strict';
  const theme = document.body.dataset.theme;
  const data = JSON.parse(document.getElementById('hp-case-data').textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search);
  let paused = query.get('motion') === 'off';
  let dialogTrigger = null;
  const header = document.querySelector('.hp-header');
  const hero = document.querySelector('.hp-hero');
  new IntersectionObserver(([entry]) => header.classList.toggle('is-solid', !entry.isIntersecting), {rootMargin:'-90px 0px 0px 0px'}).observe(hero);
  const notify = message => { if (window.parent !== window) window.parent.postMessage(message, location.origin); };
  function setMotion(value) {
    paused = !!value;
    document.body.classList.toggle('motion-paused', paused || reduced.matches);
    notify({type:'ljc-motion-state', paused, reduced:paused || reduced.matches, system:reduced.matches});
  }
  function jump(id) {
    const aliases = {atlas:'offices', news:'work'};
    const target = document.getElementById(aliases[id] || id);
    if (target) target.scrollIntoView({behavior:paused || reduced.matches ? 'instant' : 'smooth', block:'start'});
  }
  document.addEventListener('click', event => {
    const project = event.target.closest('[data-case-project]');
    if (project && window.parent !== window && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      notify({type:'ljc-project', theme, project:project.dataset.caseProject});
    }
  });
  const menu = document.getElementById('hp-menu');
  const mobileMenu = matchMedia('(max-width: 640px)');
  const menuToggles = [...document.querySelectorAll('[data-menu-column-toggle]')];
  function updateMenuColumns() {
    menuToggles.forEach(button => {
      const open = button.getAttribute('aria-expanded') === 'true';
      document.getElementById(button.getAttribute('aria-controls')).hidden = mobileMenu.matches && !open;
      button.querySelector('span').textContent = open ? '−' : '+';
    });
  }
  menuToggles.forEach(button => button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    menuToggles.forEach(other => other.setAttribute('aria-expanded', String(other === button && open)));
    updateMenuColumns();
  }));
  mobileMenu.addEventListener('change', updateMenuColumns);
  updateMenuColumns();
  const search = document.getElementById('hp-search');
  function openDialog(dialog, trigger) {
    dialogTrigger = trigger;
    dialog.classList.remove('is-closing');
    dialog.showModal();
    dialog.scrollTop = 0;
    if (dialog === search) {
      renderSearch(searchInput.value);
      searchInput.focus({preventScroll:true});
    } else dialog.querySelector('[data-close-dialog].hp-close').focus({preventScroll:true});
  }
  function closeDialog(dialog) {
    if (!dialog?.open || dialog.classList.contains('is-closing')) return;
    const finish = () => {
      dialog.close();
      dialog.classList.remove('is-closing');
      dialogTrigger?.focus({preventScroll:true});
    };
    if (paused || reduced.matches) finish();
    else {
      dialog.classList.add('is-closing');
      setTimeout(finish, dialog === menu ? 260 : 200);
    }
  }
  document.querySelector('.hp-menu-trigger').addEventListener('click', event => openDialog(menu, event.currentTarget));
  document.querySelector('.hp-search-trigger').addEventListener('click', event => openDialog(search, event.currentTarget));
  [menu, search].forEach(dialog => {
    dialog.addEventListener('cancel', event => {event.preventDefault(); closeDialog(dialog);});
    dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(dialog);
      }
    });
  });
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const match = (haystack, needle) => normalize(needle).split(/\s+/).filter(Boolean).every(token => normalize(haystack).includes(token));
  const cards = [...document.querySelectorAll('[data-case-card]')];
  const cardData = cards.map((card, index) => ({card, index, markets:JSON.parse(card.dataset.markets), disciplines:JSON.parse(card.dataset.disciplines)}));
  const market = document.getElementById('hp-market');
  const discipline = document.getElementById('hp-discipline');
  const find = document.getElementById('hp-find');
  const reset = document.getElementById('hp-reset');
  const sort = document.getElementById('hp-sort');
  function filterProjects() {
    let count = 0;
    cardData.forEach(item => {
      const visible = (!market.value || item.markets.includes(market.value)) && (!discipline.value || item.disciplines.includes(discipline.value)) && match(item.card.dataset.search, find.value);
      item.card.hidden = !visible;
      if (visible) count++;
    });
    document.getElementById('hp-result-count').textContent = `${count} ${count === 1 ? 'case study' : 'case studies'}`;
    document.getElementById('hp-empty').hidden = count > 0;
    reset.hidden = !market.value && !discipline.value && !find.value;
  }
  function clearFilters() {
    market.value = ''; discipline.value = ''; find.value = '';
    filterProjects();
  }
  market.addEventListener('change', filterProjects);
  discipline.addEventListener('change', filterProjects);
  find.addEventListener('input', filterProjects);
  reset.addEventListener('click', clearFilters);
  document.querySelector('[data-clear-filters]').addEventListener('click', clearFilters);
  sort.addEventListener('change', () => {
    const order = [...cardData].sort((a,b) => sort.value === 'az' ? a.card.dataset.title.localeCompare(b.card.dataset.title) : a.index - b.index);
    const container = document.getElementById('hp-projects');
    order.forEach(item => container.append(item.card));
  });
  const searchInput = document.getElementById('hp-search-input');
  const searchResults = document.getElementById('hp-search-results');
  function renderSearch(value) {
    const term = value.trim();
    const matches = term ? data.filter(item => match([item.title,item.location,...item.markets,...item.disciplines].join(' '),term)) : [];
    searchResults.replaceChildren();
    document.getElementById('hp-search-count').textContent = term ? `${matches.length} ${matches.length === 1 ? 'project' : 'projects'} for “${term}”` : '';
    matches.forEach(item => {
      const link = document.createElement('a');
      link.href = `project-${theme}.html?project=${encodeURIComponent(item.slug)}`;
      link.dataset.caseProject = item.slug;
      const image = document.createElement('img');
      image.src = /^(?:https?:|\.\.\/)/.test(item.hero.src) ? item.hero.src : `../${item.hero.src}`;
      image.alt = ''; image.loading = 'lazy';
      const content = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = item.title;
      const location = document.createElement('p'); location.textContent = item.location;
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
      content.append(title,location); link.append(image,content,arrow); searchResults.append(link);
    });
    if (term && !matches.length) {
      const empty = document.createElement('div'); empty.className = 'hp-search-empty';
      const copy = document.createElement('p'); copy.textContent = 'No projects found. Try a project, place or discipline.';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Clear search';
      button.addEventListener('click', () => {searchInput.value = ''; renderSearch(''); searchInput.focus();});
      empty.append(copy,button); searchResults.append(empty);
    }
  }
  searchInput.addEventListener('input', () => renderSearch(searchInput.value));
  document.querySelectorAll('[data-search-query]').forEach(button => button.addEventListener('click', () => {
    searchInput.value = button.dataset.searchQuery; renderSearch(searchInput.value); searchInput.focus();
  }));
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (event.data?.type === 'ljc-motion') setMotion(event.data.paused);
    if (event.data?.type === 'ljc-section') jump(event.data.id);
  });
  reduced.addEventListener('change', () => setMotion(paused));
  setMotion(paused);
  notify({type:'ljc-ready', theme});
  if (window.parent === window && query.get('section')) requestAnimationFrame(() => jump(query.get('section')));
})();
