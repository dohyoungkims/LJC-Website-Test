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
  const book = {id:'reverberation-2026', kind:'book', title:'Reverberation 2026', pages:data.pages,
    chapters:data.chapters,
    stories:data.stories.map(story => ({...story,href:`reverberation.html?theme=${theme}&mode=digital&story=${encodeURIComponent(story.id)}`})),
    returnTarget(index) {
      if (state.mode === 'book') {
        document.querySelector('#rev-book-chapter').value = 'all';
        document.querySelector('#rev-book-search').value = '';
        filterChapter();
        return document.querySelector(`[data-spread-index="${index}"]`);
      }
      return state.story ? document.getElementById(`story-${state.story}`)?.querySelector(`[data-read-spread="${index}"]`) : null;
    }
  };
  const scrollPositions = new Map();
  const storyOrigins = new Map();
  let suppressReaderEvents = false;
  let ignoreNextReaderClose = false;
  let modalEntryPushed = false;
  let state = readState();
  let bookFormat = 'spreads';
  let viewTransition = null;

  function readState() {
    const query = new URLSearchParams(location.search);
    const selected = query.get('story') || '';
    const number = Number(query.get('spread'));
    return {
      mode:query.get('mode') === 'book' ? 'book' : 'digital',
      story:stories.has(selected) ? selected : '',
      spread:Number.isInteger(number) && number >= 1 && number <= data.pages.length ? number : ''
    };
  }

  const key = value => `${value.mode}:${value.mode === 'digital' ? value.story : ''}`;
  const motion = () => document.body.classList.contains('motion-paused') ? 'off' : 'on';
  const post = value => { if (embedded) window.parent.postMessage(value, location.origin); };

  function syncURL(replace = false, historyAction = '') {
    const url = new URL(location.href);
    url.searchParams.set('theme', theme);
    url.searchParams.set('mode', state.mode);
    url.searchParams.set('motion', motion());
    if (state.story && state.mode === 'digital') url.searchParams.set('story', state.story);
    else url.searchParams.delete('story');
    if (state.spread) url.searchParams.set('spread', state.spread);
    else url.searchParams.delete('spread');
    url.hash = '';
    if (url.href !== location.href) history[embedded || replace ? 'replaceState' : 'pushState'](null, '', url);
    post({type:'ljc-reverberation-state', ...state, ...(historyAction ? {historyAction} : {})});
    updateLinks();
  }

  function updateLinks() {
    book.stories.forEach(story => { story.href = `reverberation.html?theme=${theme}&mode=digital&story=${encodeURIComponent(story.id)}&motion=${motion()}`; });
    document.querySelectorAll('a[data-story]').forEach(link => {
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set('theme', theme);
      url.searchParams.set('mode', 'digital');
      url.searchParams.set('story', link.dataset.story);
      url.searchParams.set('motion', motion());
      link.href = url.href;
    });
    document.querySelectorAll('a[data-home]').forEach(link => {
      link.href = `${theme}.html?section=intro&motion=${motion()}`;
    });
    document.querySelectorAll('a[data-project]').forEach(link => {
      link.href = `project-${theme}.html?project=${encodeURIComponent(link.dataset.project)}&motion=${motion()}`;
    });
    document.querySelectorAll('a[data-issue]').forEach(link => {
      link.href = `reverberation.html?theme=${theme}&mode=digital&motion=${motion()}`;
    });
  }

  function renderView({focus = true, restore = false, changed = true, immediate = false} = {}) {
    const digital = state.mode === 'digital';
    const activeStory = digital && state.story;
    document.querySelector('#rev-digital').hidden = !digital;
    document.querySelector('#rev-book').hidden = digital;
    document.querySelector('#rev-issue').hidden = Boolean(activeStory);
    document.querySelector('.rev-header-contents').hidden = !activeStory;
    document.querySelector('.rev-publication-name').hidden = Boolean(activeStory);
    document.querySelectorAll('[data-article]').forEach(article => { article.hidden = article.dataset.article !== activeStory; });
    document.querySelectorAll('.rev-mode-switch [data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    document.body.dataset.mode = state.mode;
    document.body.dataset.story = activeStory || '';
    document.title = activeStory ? `${stories.get(activeStory).title} — Reverberation 2026` : state.mode === 'book' ? 'The book — Reverberation 2026' : 'Reverberation 2026 — LJC';
    if (changed) {
      const target = activeStory ? document.getElementById(`story-${activeStory}`).querySelector('h1') : digital ? document.querySelector('#edition-main') : document.querySelector('#rev-book-title');
      const place = () => {
        window.scrollTo({top:restore ? scrollPositions.get(key(state)) || 0 : 0, behavior:'instant'});
        if (focus && !state.spread) target?.focus({preventScroll:true});
      };
      if (immediate) place(); else requestAnimationFrame(place);
    }
  }

  function navigate(next, options = {}) {
    const oldKey = key(state);
    scrollPositions.set(oldKey, window.scrollY);
    state = {...state, ...next};
    if (state.mode === 'book') state.story = '';
    const changed = oldKey !== key(state);
    if (!state.spread && document.querySelector('#case-reader')?.open) {
      ignoreNextReaderClose = true;
      window.LJCCaseReader.close();
    }
    renderView({changed, focus:options.focus !== false, restore:options.restore || (!state.story && state.mode === 'digital'), immediate:options.immediate});
    if (!options.noHistory) syncURL(options.replace);
  }

  function navigateWithTransition(next, trigger = null, options = {}) {
    if (!document.startViewTransition || reduced()) { navigate(next, options); return; }
    viewTransition?.skipTransition();
    const priorStory = state.story;
    let before = null, after = null;
    if (next.story && next.story !== priorStory) {
      before = trigger?.querySelector('img') || null;
      if (before) storyOrigins.set(next.story, trigger);
      after = document.getElementById(`story-${next.story}`)?.querySelector('.rev-article-hero img');
      if (after) after.loading = 'eager';
    } else if (priorStory && !next.story && next.mode === 'digital') {
      before = document.getElementById(`story-${priorStory}`)?.querySelector('.rev-article-hero img');
      after = storyOrigins.get(priorStory)?.querySelector('img');
    }
    if (before && (before.getBoundingClientRect().bottom < 0 || before.getBoundingClientRect().top > innerHeight)) before = null;
    if (before && after) before.style.viewTransitionName = 'rev-story-hero';
    viewTransition = document.startViewTransition(() => {
      if (before) before.style.viewTransitionName = '';
      navigate(next, {...options, immediate:true});
      if (before && after) after.style.viewTransitionName = 'rev-story-hero';
    });
    viewTransition.finished.catch(() => {}).finally(() => {
      if (before) before.style.viewTransitionName = '';
      if (after) after.style.viewTransitionName = '';
      viewTransition = null;
    });
  }

  function openSpread(index, trigger = null, {replace = false} = {}) {
    const safeIndex = Math.max(0, Math.min(data.pages.length - 1, Number(index) || 0));
    if (!state.spread && !replace) modalEntryPushed = true;
    state.spread = safeIndex + 1;
    syncURL(replace);
    if (window.LJCCaseReader) window.LJCCaseReader.open(book, safeIndex, trigger);
  }

  function setBookFormat(format) {
    bookFormat = format === 'pdf' && !narrow.matches ? 'pdf' : 'spreads';
    document.querySelector('#rev-book-spreads').hidden = bookFormat !== 'spreads';
    document.querySelector('#rev-pdf').hidden = bookFormat !== 'pdf';
    document.querySelector('.rev-chapter-select').hidden = bookFormat !== 'spreads';
    document.querySelectorAll('[data-book-format]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bookFormat === bookFormat)));
    if (bookFormat === 'pdf') {
      const frame = document.querySelector('[data-pdf-src]');
      if (!frame.src) frame.src = frame.dataset.pdfSrc;
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
    document.querySelector('#rev-book-status').textContent = visible ? `${visible} reading views${chapter ? ` · ${chapter.title}` : ''}${query ? ` matching “${document.querySelector('#rev-book-search').value.trim()}”` : ''} · Select a spread to read and zoom` : 'No pages match. Try another name or idea, or choose all chapters.';
  }

  function ordinaryClick(event) { return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey; }

  document.addEventListener('click', event => {
    const target = event.target.closest('a,button');
    if (!target || !ordinaryClick(event)) return;
    if (target.matches('[data-story]')) {
      event.preventDefault();
      navigateWithTransition({mode:'digital', story:target.dataset.story, spread:''}, target);
    } else if (target.matches('[data-mode]')) {
      event.preventDefault();
      navigateWithTransition({mode:target.dataset.mode, story:'', spread:''}, target);
    } else if (target.matches('[data-issue]')) {
      event.preventDefault();
      navigateWithTransition({mode:'digital', story:'', spread:''}, target, {restore:true});
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

  document.querySelector('#rev-book-chapter').addEventListener('change', filterChapter);
  document.querySelector('#rev-book-search').addEventListener('input', filterChapter);
  document.querySelector('#rev-spine').addEventListener('input', event => {
    const index = Number(event.target.value);
    const page = data.pages[index];
    const chapter = [...data.chapters].reverse().find(item => Number(item.startIndex) <= index);
    const label = page.label.replace(/^Book /,'');
    document.querySelector('#rev-spine-label').textContent = label.toLocaleLowerCase();
    document.querySelector('#rev-spine-open').dataset.readSpread = index;
    event.target.setAttribute('aria-valuetext', `${label}, ${chapter?.title || ''}`);
    const preview = document.querySelector('#rev-spine-preview img');
    if (preview) preview.src = page.thumbSrc || page.src;
  });
  document.addEventListener('ljc-case-reader-story', event => {
    if (event.detail.id !== book.id || !stories.has(event.detail.storyId)) return;
    navigate({mode:'digital',story:event.detail.storyId,spread:''}, {replace:true});
  });
  document.addEventListener('ljc-case-reader-selection', event => {
    if (event.detail.id !== book.id || suppressReaderEvents) return;
    state.spread = event.detail.index + 1;
    syncURL(true);
  });
  document.addEventListener('ljc-case-reader-close', event => {
    if (event.detail.id !== book.id) return;
    if (ignoreNextReaderClose) { ignoreNextReaderClose = false; return; }
    if (suppressReaderEvents) return;
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
    const next = readState();
    navigate(next, {noHistory:true, restore:true});
    if (state.spread) {
      suppressReaderEvents = true;
      window.LJCCaseReader.open(book, Number(state.spread)-1);
      suppressReaderEvents = false;
    }
    post({type:'ljc-reverberation-state', ...state});
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type === 'ljc-reverberation-navigate') {
      const number = Number(event.data.spread);
      const next = {
        mode:event.data.mode === 'book' ? 'book' : 'digital',
        story:stories.has(event.data.story) ? event.data.story : '',
        spread:Number.isInteger(number) && number > 0 && number <= data.pages.length ? number : ''
      };
      modalEntryPushed = false;
      navigate(next, {replace:true, restore:true});
      if (state.spread) {
        suppressReaderEvents = true;
        window.LJCCaseReader.open(book, Number(state.spread)-1);
        suppressReaderEvents = false;
      }
    }
    if (event.data?.type === 'ljc-motion') {
      const paused = event.data.motion === 'off' || event.data.paused === true;
      document.body.classList.toggle('motion-paused', paused);
      updateLinks();
      reportMotion();
    }
  });

  function reportMotion() {
    post({type:'ljc-motion-state',paused:document.body.classList.contains('motion-paused'), reduced:reduced(),system:media.matches});
    if (reduced()) viewTransition?.skipTransition();
  }
  media.addEventListener('change', reportMotion);
  narrow.addEventListener('change', () => { if (narrow.matches && bookFormat === 'pdf') setBookFormat('spreads'); });

  document.body.dataset.theme = theme;
  document.body.classList.toggle('motion-paused', params.get('motion') === 'off');
  updateLinks();
  document.querySelector('#rev-spine').setAttribute('aria-valuetext', `${data.pages[0].label}, ${data.chapters[0].title}`);
  renderView({focus:false, changed:false});
  post({type:'ljc-ready', theme, view:'reverberation'});
  reportMotion();
  if (state.spread) requestAnimationFrame(() => openSpread(Number(state.spread)-1, null, {replace:true}));
})();
