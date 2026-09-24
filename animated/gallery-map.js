/* LJC Gallery office atlas. Exact addresses/phones come from the existing footer.
 * Geography: Natural Earth public-domain 1:110m country/state outlines.
 * https://www.naturalearthdata.com/about/terms-of-use/
 * Representative city points: US Census Bureau 2026 National Places Gazetteer:
 * https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip
 * Office pins represent address cities, not precise building coordinates.
 * Equirectangular projection at 37N matches the local geography SVG.
 */
(() => {
  'use strict';
  const root = document.getElementById('project-atlas');
  if (!root || document.body.dataset.theme !== 'gallery') return;
  const scriptBase = new URL('.', document.currentScript.src);
  const gsap = window.gsap;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const photoData = JSON.parse(document.getElementById('office-photo-data')?.textContent || '{}');
  const POINTS = {
    'Chicago': { id:'chicago', lat:41.837045, lon:-87.684939, offset:[30,-25] },
    'Denver': { id:'denver', lat:39.742483, lon:-105.210561, offset:[-18,-30] },
    'Kansas City': { id:'kansas-city', lat:38.965268, lon:-94.803937, offset:[-40,30] },
    'Los Angeles': { id:'los-angeles', lat:34.005820, lon:-118.396781, offset:[-10,-34] },
    'Phoenix': { id:'phoenix', lat:33.572154, lon:-112.090132, offset:[35,23] },
    'South Carolina': { id:'south-carolina', lat:34.836902, lon:-82.362997, offset:[42,25] },
    'St. Louis': { id:'st-louis', lat:38.635699, lon:-90.244582, offset:[58,28] },
  };
  const offices = Array.from(document.querySelectorAll('.site-footer .office')).map(node => {
    const name = node.querySelector('h3')?.textContent.trim();
    const address = node.querySelector('p');
    const phone = node.querySelector('a[href^="tel:"]');
    if (!POINTS[name] || !address || !phone) return null;
    const addressText = Array.from(address.childNodes).map(child => child.nodeName === 'BR' ? '\n' : child.textContent).join('').trim();
    return { ...POINTS[name], name, address, addressText, phone:phone.textContent.trim(), tel:phone.getAttribute('href') };
  }).filter(Boolean);
  if (!offices.length) return;
  const mapPoint = office => ({ x:50+(office.lon+125)*900/59, y:50+(50.5-office.lat)*900/(59*Math.cos(37*Math.PI/180)) });
  const svgElement = (tag, attrs = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    return node;
  };
  root.innerHTML = `<div class="atlas-layout">
    <div class="atlas-cartography">
      <div class="atlas-map-meta"><span class="atlas-total"></span><span>United States</span></div>
      <div class="atlas-viewport" tabindex="0" role="group" aria-label="Interactive office map" aria-describedby="atlas-help">
        <div class="atlas-world"><img class="atlas-geography" alt="" draggable="false"><svg class="atlas-geometry" viewBox="0 0 1000 610" aria-hidden="true"><g class="atlas-leaders"></g><path class="atlas-route" fill="none"></path><g class="atlas-dots"></g><circle class="atlas-city-halo" r="4"></circle></svg><div class="atlas-pins"></div></div>
        <div class="atlas-map-controls" role="group" aria-label="Map view"><button type="button" data-atlas-zoom="in" aria-label="Zoom in">+</button><button type="button" data-atlas-zoom="out" aria-label="Zoom out">−</button><button type="button" class="atlas-reset" aria-label="Reset map view">Reset</button><span class="atlas-zoom-level" aria-hidden="true">100%</span></div>
        <span class="atlas-map-hint">Select an office.</span>
      </div>
      <p id="atlas-help" class="sr-only">Choose an office on the map or in the list. Zoom with the plus and minus buttons, then drag. With the map focused, arrow keys pan, plus and minus zoom, and zero resets. Browser shortcuts and normal page scrolling remain available.</p>
      <nav class="atlas-city-index" aria-label="Our offices"></nav>
    </div>
    <div class="atlas-office-panel">
      <figure class="atlas-office-figure" hidden><div class="atlas-office-image"></div></figure>
      <h3 class="atlas-place"></h3>
      <address class="atlas-office-address"></address>
      <a class="atlas-office-phone"></a>
      <a class="atlas-office-directions" target="_blank" rel="noopener">Get directions <span aria-hidden="true">↗</span></a>
      <div class="atlas-next-place"><span>Come say hello.</span><button type="button">Next office <span aria-hidden="true">→</span></button></div>
    </div>
  </div><div class="atlas-footnote"><span>Pins show office cities. Select an office for its address.</span><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Made with Natural Earth</a></div><p class="sr-only atlas-announcement" role="status" aria-live="polite"></p>`;
  const viewport = root.querySelector('.atlas-viewport');
  const world = root.querySelector('.atlas-world');
  const leaders = root.querySelector('.atlas-leaders');
  const dots = root.querySelector('.atlas-dots');
  const pins = root.querySelector('.atlas-pins');
  const index = root.querySelector('.atlas-city-index');
  const route = root.querySelector('.atlas-route');
  const halo = root.querySelector('.atlas-city-halo');
  const announcement = root.querySelector('.atlas-announcement');
  const zoomIn = root.querySelector('[data-atlas-zoom="in"]');
  const zoomOut = root.querySelector('[data-atlas-zoom="out"]');
  const photoFigure = root.querySelector('.atlas-office-figure');
  const photoSurface = root.querySelector('.atlas-office-image');
  root.querySelector('.atlas-geography').src = new URL('geography/us-contiguous.svg',scriptBase).href;
  root.querySelector('.atlas-total').textContent = `${offices.length} offices`;
  root.dataset.atlasOffices = String(offices.length);
  const view = { scale: 1, x: 0, y: 0 };
  const limits = { min: 1, max: 3.5 };
  // Nearby Midwest offices share a tight geographic cluster. Leader lines keep
  // the true points fixed while separating their accessible labels on phones.
  const compactLabels = {
    'los-angeles':[145,300], phoenix:[290,440], denver:[350,220],
    'kansas-city':[475,330], chicago:[650,165], 'st-louis':[665,320],
    'south-carolina':[800,390],
  };
  let selected = Math.max(0, offices.findIndex(city => city.id === 'chicago'));
  let previousPoint = null;
  let pointer = null;
  let suppressedClick = false;
  let animations = [];
  let resizeFrame = 0;
  let photoRequest = 0;
  let photoTween = null;
  const animated = () => Boolean(gsap && !media.matches && !document.body.classList.contains('motion-paused') && !document.hidden);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function layoutLabels() {
    const compact = world.clientWidth < 540;
    offices.forEach((city, i) => {
      const point = mapPoint(city);
      const label = compact ? compactLabels[city.id] : [point.x + city.offset[0], point.y + city.offset[1]];
      pins.children[i].style.left = `${label[0] / 10}%`;
      pins.children[i].style.top = `${label[1] / 6.1}%`;
      leaders.children[i].setAttribute('x2', label[0]);
      leaders.children[i].setAttribute('y2', label[1]);
    });
  }

  function bounds(scale = view.scale) {
    return { x: Math.max(0, (world.clientWidth * scale - viewport.clientWidth) / 2), y: Math.max(0, (world.clientHeight * scale - viewport.clientHeight) / 2) };
  }
  function paintView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    world.style.setProperty('--atlas-inverse-scale', String(1 / view.scale));
    viewport.dataset.zoomed = String(view.scale > 1.01);
    root.querySelector('.atlas-zoom-level').textContent = `${Math.round(view.scale * 100)}%`;
    zoomIn.disabled = view.scale >= limits.max - .01;
    zoomOut.disabled = view.scale <= limits.min + .01;
  }
  function moveView(next, animate = true) {
    gsap?.killTweensOf(view);
    const scale = clamp(next.scale ?? view.scale, limits.min, limits.max);
    const limit = bounds(scale);
    const values = { scale, x: clamp(next.x ?? view.x, -limit.x, limit.x), y: clamp(next.y ?? view.y, -limit.y, limit.y) };
    if (animate && animated()) gsap.to(view, { ...values, duration: .55, ease: 'power3.out', onUpdate: paintView });
    else { Object.assign(view, values); paintView(); }
  }
  function zoom(factor) {
    const scale = clamp(view.scale * factor, limits.min, limits.max);
    const ratio = scale / view.scale;
    moveView({ scale, x: view.x * ratio, y: view.y * ratio });
  }
  function routeTo(city) {
    animations.forEach(animation => animation.kill()); animations = [];
    const point = mapPoint(city);
    halo.setAttribute('cx', point.x); halo.setAttribute('cy', point.y);
    halo.style.opacity = '0';
    if (previousPoint && (previousPoint.x !== point.x || previousPoint.y !== point.y)) {
      const bend = Math.min(100, Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) * .2);
      route.setAttribute('d', `M${previousPoint.x},${previousPoint.y} Q${(previousPoint.x + point.x) / 2},${(previousPoint.y + point.y) / 2 - bend} ${point.x},${point.y}`);
      const length = route.getTotalLength();
      route.style.strokeDasharray = String(length);
      route.style.strokeDashoffset = '0';
      if (animated()) animations.push(gsap.fromTo(route, { strokeDashoffset: length }, { strokeDashoffset: 0, duration: .85, ease: 'power2.inOut' }));
    }
    if (animated()) animations.push(gsap.fromTo(halo, { attr: { r: 4 }, opacity: .5 }, { attr: { r: 21 }, opacity: 0, duration: .95, ease: 'power2.out' }));
    previousPoint = point;
  }
  async function showOfficePhoto(office) {
    const request = ++photoRequest;
    photoTween?.kill(); photoTween = null;
    photoSurface.replaceChildren();
    const photo = photoData[office.id];
    photoFigure.hidden = !photo;
    photoFigure.setAttribute('aria-busy', String(Boolean(photo)));
    photoFigure.dataset.office = office.id;
    root.querySelector('.atlas-office-panel').dataset.hasPhoto = String(Boolean(photo));
    root.dataset.officePhoto = photo ? 'loading' : 'not-supplied';
    if (!photo) return;
    const image = new Image(photo.width, photo.height);
    image.alt = photo.alt;
    image.decoding = 'async';
    image.style.visibility = 'hidden';
    image.src = new URL(photo.src, scriptBase).href;
    photoSurface.append(image);
    try {
      await image.decode();
      // A slower photo must never replace the office chosen more recently.
      if (request !== photoRequest) return;
      photoFigure.setAttribute('aria-busy', 'false');
      image.style.visibility = 'visible';
      root.dataset.officePhoto = 'ready';
      if (animated()) {
        photoTween = gsap.fromTo(image, { autoAlpha: 0, scale: 1.025 }, {
          autoAlpha: 1, scale: 1, duration: .55, ease: 'power2.out',
          onComplete: () => { root.dataset.officePhoto = 'settled'; photoTween = null; },
        });
      } else root.dataset.officePhoto = 'settled';
    } catch {
      if (request !== photoRequest) return;
      photoFigure.hidden = true;
      photoFigure.setAttribute('aria-busy', 'false');
      photoSurface.replaceChildren();
      root.querySelector('.atlas-office-panel').dataset.hasPhoto = 'false';
      root.dataset.officePhoto = 'unavailable';
    }
  }
  function chooseOffice(officeIndex, announce = true) {
    selected = (officeIndex + offices.length) % offices.length;
    const office = offices[selected];
    root.dataset.selectedOffice = office.id;
    showOfficePhoto(office);
    root.querySelector('.atlas-place').textContent = office.name;
    root.querySelector('.atlas-office-address').replaceChildren(...Array.from(office.address.childNodes).map(node=>node.cloneNode(true)));
    const phone = root.querySelector('.atlas-office-phone');
    phone.textContent = office.phone; phone.href = office.tel;
    const directions = root.querySelector('.atlas-office-directions');
    directions.href = 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(office.addressText.replace(/\n/g,', '));
    directions.setAttribute('aria-label',`Get directions to the ${office.name} office`);
    root.querySelectorAll('[data-atlas-city]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.atlasCity)===selected)));
    dots.querySelectorAll('circle').forEach((dot,i)=>{dot.classList.toggle('is-selected',i===selected);dot.setAttribute('r',i===selected?4.5:2.5);});
    leaders.querySelectorAll('line').forEach((line,i)=>line.classList.toggle('is-selected',i===selected));
    if(announce) routeTo(office); else previousPoint=mapPoint(office);
    if(view.scale>1.05){const point=mapPoint(office);moveView({x:-(point.x/1000-.5)*world.clientWidth*view.scale,y:-(point.y/610-.5)*world.clientHeight*view.scale});}
    if(announce) announcement.textContent=`${office.name} office. ${office.addressText.replace(/\n/g,', ')}. ${office.phone}.`;
  }
  offices.forEach((city, i) => {
    const point = mapPoint(city);
    const label = { x: point.x + city.offset[0], y: point.y + city.offset[1] };
    leaders.append(svgElement('line', { x1: point.x, y1: point.y, x2: label.x, y2: label.y }));
    dots.append(svgElement('circle', { cx: point.x, cy: point.y, r: 2.5 }));
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'atlas-city-pin'; pin.dataset.atlasCity = i;
    pin.style.left = `${label.x / 10}%`; pin.style.top = `${label.y / 6.1}%`;
    pin.textContent = city.name;
    pin.setAttribute('aria-label', `${city.name} office`);
    pin.addEventListener('click', () => { if (!suppressedClick) chooseOffice(i); });
    pins.append(pin);
    const place = document.createElement('button');
    place.type = 'button'; place.dataset.atlasCity = i;
    place.append(document.createTextNode(city.name));
    place.setAttribute('aria-label', `${city.name} office`);
    place.addEventListener('click', () => chooseOffice(i));
    index.append(place);
  });
  zoomIn.addEventListener('click', () => zoom(1.35));
  zoomOut.addEventListener('click', () => zoom(1 / 1.35));
  root.querySelector('.atlas-reset').addEventListener('click', () => moveView({ scale: 1, x: 0, y: 0 }));
  root.querySelector('.atlas-next-place button').addEventListener('click', () => chooseOffice(selected + 1));
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || event.ctrlKey || event.metaKey || event.altKey) return;
    const pans = { ArrowLeft: [70, 0], ArrowRight: [-70, 0], ArrowUp: [0, 70], ArrowDown: [0, -70] };
    if (pans[event.key]) { event.preventDefault(); moveView({ x: view.x + pans[event.key][0], y: view.y + pans[event.key][1] }); }
    else if (['+', '=', '-', '_', '0', 'Home'].includes(event.key)) {
      event.preventDefault();
      if (event.key === '0' || event.key === 'Home') moveView({ scale: 1, x: 0, y: 0 });
      else zoom(event.key === '-' || event.key === '_' ? 1 / 1.35 : 1.35);
    }
  });
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button') || view.scale <= 1) return;
    // Vertical touch gestures keep scrolling the page; pointercancel ends a drag.
    gsap?.killTweensOf(view);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: view.x, startY: view.y, touch: event.pointerType === 'touch' };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) suppressedClick = true;
    moveView({ x: pointer.startX + dx, y: pointer.startY + (pointer.touch ? 0 : dy) }, false);
  });
  function endDrag(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    pointer = null; viewport.classList.remove('is-dragging');
    requestAnimationFrame(() => { suppressedClick = false; });
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  function settle() {
    if (animated()) return;
    gsap?.killTweensOf(view); paintView();
    animations.forEach(animation => animation.progress(1));
    photoTween?.progress(1);
  }
  media.addEventListener('change', settle);
  document.addEventListener('visibilitychange', settle);
  const preferenceObserver = new MutationObserver(settle);
  preferenceObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const resizeObserver = new ResizeObserver(() => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; layoutLabels(); moveView({}, false); });
  });
  resizeObserver.observe(viewport);
  chooseOffice(selected, false); layoutLabels(); paintView();
  root.dataset.atlasReady = 'true';
  // The working map replaces the repeated office directory; keep it as a no-script fallback.
  const directory = document.querySelector('.site-footer .office-grid');
  if (directory) directory.hidden = true;
  window.LJCOfficeAtlas = Object.freeze({
    getState:()=>({office:offices[selected].id,offices:offices.length,scale:view.scale}),
  });
})();
