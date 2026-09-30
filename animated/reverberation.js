/* Reverberation digital issue, article routes, and original book reader. */
(() => {
  'use strict';
  const data = JSON.parse(document.querySelector('#rev-data').textContent);
  const themes = ['gallery', 'editorial', 'colophon', 'refresh', 'studio'];
  const params = new URLSearchParams(location.search);
  const theme = themes.includes(params.get('theme')) ? params.get('theme') : 'gallery';
  const embedded = window.parent !== window;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width:700px)');
  const reduced = () => media.matches || document.body.classList.contains('motion-paused');
  const stories = new Map(data.stories.map(story => [story.id, story]));
  const chapters = new Map(data.chapters.map(chapter => [chapter.id, chapter]));
  const book = {id:'reverberation-2026', kind:'book', title:'Reverberation 2026', pages:data.pages,
    chapters:data.chapters, pdf:data.pdf,
    stories:data.stories.map(story => ({...story,href:''})),
    returnTarget(index) {
      if (state.story) return document.getElementById(`story-${state.story}`)?.querySelector(`[data-read-spread="${index}"]`);
      return document.querySelector('.rev-mode-switch [data-mode="book"]');
    }
  };
  const scrollPositions = new Map();
  let suppressReaderEvents = false;
  let modalEntryPushed = false;
  let bookEntryPushed = false;
  let state = readState();
  let websiteRoute = {mode:'digital', chapter:state.chapter, story:state.story, spread:''};
  let lastBookIndex = 0;
  try { lastBookIndex = Math.max(0, Math.min(data.pages.length - 1, Number(sessionStorage.getItem('ljc-reverberation-page')) || 0)); } catch (_) { /* Reading works without browser storage. */ }
  let bookFormat = 'spreads';

  function normalize(value) {
    const story = stories.has(value.story) ? value.story : '';
    const chapter = story ? stories.get(story).chapterId : chapters.has(value.chapter) ? value.chapter : '';
    const number = Number(value.spread);
    const mode = value.mode === 'book' ? 'book' : 'digital';
    return {mode, chapter:mode === 'digital' ? chapter : '', story:mode === 'digital' ? story : '',
      spread:Number.isInteger(number) && number >= 1 && number <= data.pages.length ? number : ''};
  }
  function readState() {
    const query = new URLSearchParams(location.search);
    return normalize({mode:query.get('mode'),chapter:query.get('chapter'),story:query.get('story'),spread:query.get('spread')});
  }

  const key = value => `${value.mode}:${value.chapter}:${value.story}`;
  const motion = () => document.body.classList.contains('motion-paused') ? 'off' : 'on';
  const post = value => { if (embedded) window.parent.postMessage(value, location.origin); };
  function routeURL(route = {}) {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('theme', theme);
    url.searchParams.set('mode', route.mode || 'digital');
    url.searchParams.set('motion', motion());
    if (route.chapter) url.searchParams.set('chapter', route.chapter);
    if (route.story) url.searchParams.set('story', route.story);
    if (route.spread) url.searchParams.set('spread', route.spread);
    return url;
  }

  function syncURL(replace = false, historyAction = '') {
    const url = routeURL(state);
    if (url.href !== location.href) history[embedded || replace ? 'replaceState' : 'pushState'](null, '', url);
    post({type:'ljc-reverberation-state', ...state, ...(historyAction ? {historyAction} : {})});
    updateLinks();
  }

  function updateLinks() {
    book.stories.forEach(story => { story.href = routeURL({story:story.id,chapter:story.chapterId}).href; });
    document.querySelectorAll('a[data-story]').forEach(link => {
      link.href = routeURL({story:link.dataset.story,chapter:stories.get(link.dataset.story)?.chapterId}).href;
    });
    document.querySelectorAll('a[data-section]').forEach(link => { link.href = routeURL({chapter:link.dataset.section}).href; });
    document.querySelectorAll('a[data-home]').forEach(link => { link.href = `${theme}.html?section=intro&motion=${motion()}`; });
    document.querySelectorAll('a[data-project]').forEach(link => { link.href = `project-${theme}.html?project=${encodeURIComponent(link.dataset.project)}&motion=${motion()}`; });
    document.querySelectorAll('a[data-issue]').forEach(link => { link.href = routeURL({chapter:state.story ? state.chapter : ''}).href; });
    document.querySelectorAll('a[data-issue-root]').forEach(link => { link.href = routeURL().href; });
    document.querySelectorAll('a[data-mode]').forEach(link => { link.href = routeURL({mode:link.dataset.mode}).href; });
  }

  function currentPane() {
    if (state.mode === 'book') return document.querySelector('#rev-book');
    if (state.story) return document.getElementById(`story-${state.story}`);
    if (state.chapter) return document.querySelector(`[data-section-page="${state.chapter}"]`);
    return document.querySelector('#rev-issue');
  }

  function renderView({focus = true, restore = false, changed = true, immediate = false} = {}) {
    const digital = state.mode === 'digital';
    const activeStory = digital ? state.story : '';
    const activeSection = digital && !activeStory ? state.chapter : '';
    document.querySelector('#rev-digital').hidden = !digital;
    document.querySelector('#rev-book').hidden = digital;
    document.querySelector('#rev-issue').hidden = Boolean(activeStory || activeSection);
    const sectionHost = document.querySelector('#rev-sections');
    if (sectionHost) sectionHost.hidden = !activeSection;
    document.querySelectorAll('[data-section-page]').forEach(page => { page.hidden = page.dataset.sectionPage !== activeSection; });
    document.querySelectorAll('[data-article]').forEach(article => { article.hidden = article.dataset.article !== activeStory; });
    const back = document.querySelector('#rev-back-issue');
    if (back) {
      back.hidden = !digital || !(activeStory || activeSection);
      back.textContent = activeStory ? `← ${chapters.get(state.chapter)?.title || 'All sections'}` : '← All sections';
      back.setAttribute('aria-label', activeStory ? `Back to ${chapters.get(state.chapter)?.title || 'all sections'}` : 'Back to all sections');
    }
    const headerContents = document.querySelector('.rev-header-contents');
    if (headerContents) headerContents.hidden = !digital || !(activeStory || activeSection);
    const sectionNav = document.querySelector('#rev-section-nav');
    if (sectionNav) sectionNav.hidden = !digital;
    document.querySelectorAll('#rev-section-nav [data-section]').forEach(link => {
      if (link.dataset.section === state.chapter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('.rev-mode-switch [data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    document.body.dataset.mode = state.mode;
    document.body.dataset.story = activeStory || '';
    document.body.dataset.chapter = state.chapter || '';
    document.dispatchEvent(new CustomEvent('rev-route',{detail:{...state}}));
    document.title = activeStory ? `${stories.get(activeStory).title} — Reverberation 2026`
      : activeSection ? `${chapters.get(activeSection).title} — Reverberation 2026`
      : state.mode === 'book' ? 'The book — Reverberation 2026' : 'Reverberation 2026 — LJC';
    if (changed) {
      const target = currentPane()?.querySelector('h1') || currentPane();
      const place = () => {
        window.scrollTo({top:restore ? scrollPositions.get(key(state)) || 0 : 0, behavior:'instant'});
        if (focus && !state.spread) target?.focus({preventScroll:true});
      };
      if (immediate) place(); else requestAnimationFrame(place);
    }
  }

  function showReader(trigger = null) {
    if (!state.spread || !window.LJCCaseReader) return;
    suppressReaderEvents = true;
    window.LJCCaseReader.open({...book, editionReader:state.mode === 'book'}, Number(state.spread)-1, trigger);
    suppressReaderEvents = false;
  }

  function navigate(next, options = {}) {
    const oldKey = key(state);
    scrollPositions.set(oldKey, window.scrollY);
    if (state.mode === 'digital') websiteRoute = {...state, spread:''};
    if (state.mode === 'digital' && next.mode === 'book' && !options.replace && !options.noHistory && !embedded) bookEntryPushed = true;
    state = normalize({...state, ...next});
    if (state.mode === 'book' && !state.spread) state.spread = lastBookIndex + 1;
    if (state.mode === 'digital' && !state.spread) modalEntryPushed = false;
    const changed = oldKey !== key(state);
    if (!state.spread && document.querySelector('#case-reader')?.open) window.LJCCaseReader.close();
    renderView({changed, focus:options.focus !== false, restore:options.restore === true, immediate:options.immediate});
    if (!options.noHistory) syncURL(options.replace, options.historyAction || '');
    if (state.spread) showReader(options.trigger);
  }

  function navigateWithTransition(next, trigger = null, options = {}) {
    // Route and focus commit before animation: the next control works immediately.
    navigate(next, {...options, trigger, immediate:true});
    const pane = currentPane();
    if (reduced() || state.mode === 'book' || !pane) return;
    pane.getAnimations().forEach(animation => animation.cancel());
    pane.animate([{opacity:.65,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)'});
  }

  function openSpread(index, trigger = null, {replace = false} = {}) {
    const safeIndex = Math.max(0, Math.min(data.pages.length - 1, Number(index) || 0));
    // Every explicit book link shares the same reader and returns to its
    // originating website page. Older digital spread URLs remain readable.
    navigateWithTransition({mode:'book', chapter:'', story:'', spread:safeIndex + 1}, trigger, {replace});
  }

  function setBookFormat(format) {
    bookFormat = format === 'pdf' && !narrow.matches ? 'pdf' : 'spreads';
    document.querySelector('#rev-book-spreads').hidden = bookFormat !== 'spreads';
    document.querySelector('#rev-pdf').hidden = bookFormat !== 'pdf';
    document.querySelector('.rev-chapter-select').hidden = bookFormat !== 'spreads';
    document.querySelectorAll('[data-book-format]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bookFormat === bookFormat)));
    if (bookFormat === 'pdf') {
      const host = document.querySelector('#rev-pdf-host');
      if (!host.querySelector('iframe')) {
        const frame = document.createElement('iframe');
        frame.title = 'Reverberation 2026 original PDF';
        frame.src = host.dataset.pdfSrc;
        frame.loading = 'lazy';
        host.append(frame);
      }
    }
  }

  function filterChapter() {
    const selected = document.querySelector('#rev-book-chapter').value;
    const chapter = data.chapters.find(item => item.id === selected);
    const chapterIndex = chapter ? data.chapters.indexOf(chapter) : -1;
    const start = chapter ? Number(chapter.startIndex) : 0;
    const end = chapter && data.chapters[chapterIndex+1] ? Number(data.chapters[chapterIndex+1].startIndex) : data.pages.length;
    let visible = 0;
    const query = document.querySelector('#rev-book-search').value.trim().toLocaleLowerCase();
    document.querySelectorAll('[data-spread-index]').forEach(button => {
      const index = Number(button.dataset.spreadIndex);
      const text = `${data.pages[index].text || ''} ${data.pages[index].label || ''}`.toLocaleLowerCase();
      button.hidden = index < start || index >= end || Boolean(query && !text.includes(query));
      if (!button.hidden) visible++;
    });
    document.querySelectorAll('[data-book-chapter]').forEach(group => { group.hidden = !group.querySelector('[data-spread-index]:not([hidden])'); });
    document.querySelector('#rev-book-status').textContent = visible ? `${visible} spreads and pages${chapter ? ` · ${chapter.title}` : ''}${query ? ` matching “${document.querySelector('#rev-book-search').value.trim()}”` : ''}` : 'No pages match. Try another name or idea, or choose all chapters.';
  }

  function ordinaryClick(event) { return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey; }

  document.addEventListener('click', event => {
    const target = event.target.closest('a,button');
    if (!target || !ordinaryClick(event)) return;
    if (target.matches('[data-story]')) {
      event.preventDefault();
      navigateWithTransition({mode:'digital', chapter:stories.get(target.dataset.story)?.chapterId || '', story:target.dataset.story, spread:''}, target);
    } else if (target.matches('[data-section]')) {
      event.preventDefault();
      navigateWithTransition({mode:'digital', chapter:target.dataset.section, story:'', spread:''}, target);
    } else if (target.matches('[data-mode]')) {
      event.preventDefault();
      if (target.dataset.mode === state.mode) return;
      navigateWithTransition(target.dataset.mode === 'book' ? {mode:'book', chapter:'', story:'', spread:''} : {...websiteRoute,spread:''}, target, {restore:target.dataset.mode !== 'book'});
    } else if (target.matches('[data-issue-root]')) {
      event.preventDefault();
      navigateWithTransition({mode:'digital', chapter:'', story:'', spread:''}, target, {restore:true});
    } else if (target.matches('[data-issue]')) {
      event.preventDefault();
      navigateWithTransition({mode:'digital', chapter:state.story ? state.chapter : '', story:'', spread:''}, target, {restore:true});
    } else if (target.matches('[data-read-spread]')) {
      event.preventDefault();
      openSpread(Number(target.dataset.readSpread), target);
    } else if (target.matches('[data-book-format]')) {
      setBookFormat(target.dataset.bookFormat);
    } else if (target.matches('a[href^="#"]')) {
      const anchor = document.getElementById(target.getAttribute('href').slice(1));
      if (anchor) {
        event.preventDefault();
        anchor.scrollIntoView({block:'start', behavior:reduced() ? 'instant' : 'smooth'});
        if (target.matches('.rev-skip')) anchor.focus({preventScroll:true});
      }
    } else if (target.matches('[data-home]') && embedded) {
      event.preventDefault();
      post({type:'ljc-home', section:'intro', theme});
    } else if (target.matches('[data-project]') && embedded) {
      event.preventDefault();
      post({type:'ljc-project', theme, project:target.dataset.project});
    } else if (target.matches('[data-top]')) {
      window.scrollTo({top:0, behavior:reduced() ? 'instant' : 'smooth'});
    }
  });

  document.querySelector('#rev-book-chapter')?.addEventListener('change', filterChapter);
  document.querySelector('#rev-book-search')?.addEventListener('input', filterChapter);
  document.addEventListener('ljc-case-reader-story', event => {
    if (event.detail.id !== book.id || !stories.has(event.detail.storyId)) return;
    navigate({mode:'digital',chapter:stories.get(event.detail.storyId).chapterId,story:event.detail.storyId,spread:''}, {replace:true});
  });
  document.addEventListener('ljc-case-reader-selection', event => {
    if (event.detail.id !== book.id || suppressReaderEvents) return;
    lastBookIndex = event.detail.index;
    try { sessionStorage.setItem('ljc-reverberation-page', String(lastBookIndex)); } catch (_) { /* Storage is optional. */ }
    state.spread = lastBookIndex + 1;
    syncURL(true);
  });
  document.addEventListener('ljc-case-reader-close', event => {
    if (event.detail.id !== book.id || suppressReaderEvents || !state.spread) return;
    if (state.mode === 'book') {
      if (!embedded && bookEntryPushed) { bookEntryPushed = false; history.back(); return; }
      navigateWithTransition({...websiteRoute, spread:''}, null, {replace:true, restore:true, historyAction:'close-book'});
      return;
    }
    if (!embedded && modalEntryPushed) {
      modalEntryPushed = false;
      history.back();
      return;
    }
    state.spread = '';
    syncURL(true, 'close-reader');
    modalEntryPushed = false;
  });
  window.addEventListener('popstate', () => {
    modalEntryPushed = false;
    bookEntryPushed = false;
    navigate(readState(), {noHistory:true, restore:true});
    post({type:'ljc-reverberation-state', ...state, historyAction:'sync'});
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type === 'ljc-reverberation-navigate') {
      modalEntryPushed = false;
      navigate(normalize(event.data), {replace:true, restore:true, historyAction:'sync'});
    }
    if (event.data?.type === 'ljc-motion') {
      const paused = event.data.motion === 'off' || event.data.paused === true;
      document.body.classList.toggle('motion-paused', paused);
      updateLinks();
      reportMotion();
    }
  });

  document.addEventListener('rev-motion-change',()=>{updateLinks();reportMotion();});

  function reportMotion() {
    post({type:'ljc-motion-state',paused:document.body.classList.contains('motion-paused'), reduced:reduced(),system:media.matches});
  }
  media.addEventListener('change', reportMotion);
  narrow.addEventListener('change', () => { if (narrow.matches && bookFormat === 'pdf') setBookFormat('spreads'); });

  document.body.dataset.theme = theme;
  document.body.classList.toggle('motion-paused', params.get('motion') === 'off');
  updateLinks();
  renderView({focus:false, changed:false});
  post({type:'ljc-ready', theme, view:'reverberation'});
  reportMotion();
  if (state.mode === 'book' && !state.spread) state.spread = lastBookIndex + 1;
  syncURL(true, 'sync');
  if (state.spread) requestAnimationFrame(() => showReader());
})();
