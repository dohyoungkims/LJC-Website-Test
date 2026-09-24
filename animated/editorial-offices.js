/* Editorial office selector. Original contact details remain the no-script
 * directory; photographs and descriptive alt text come from office-photo-data.
 * Each office owns one preloaded image, so selection never swaps image URLs or
 * waits for a transition. An unfinished load cannot restore a previous office. */
(() => {
  'use strict';
  if (document.body.dataset.theme !== 'editorial') return;
  const directory = document.querySelector('.site-footer .office-grid');
  if (!directory || directory.dataset.editorialOffices === 'ready') return;
  const sourceNodes = Array.from(directory.querySelectorAll(':scope > address.office'));
  const offices = sourceNodes.map(source => {
    const name = source.querySelector('h3')?.textContent.trim();
    const address = source.querySelector('p');
    const phone = source.querySelector('a[href^="tel:"]');
    if (!name || !address || !phone) return null;
    return {
      name, address, phone,
      id: name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-'),
      addressText: Array.from(address.childNodes).map(node => node.nodeName === 'BR' ? ', ' : node.textContent).join('').trim(),
      image: null, imageState: 'missing',
    };
  }).filter(Boolean);
  if (!offices.length || offices.length !== sourceNodes.length) return;
  let photos = {};
  try { photos = JSON.parse(document.getElementById('office-photo-data')?.textContent || '{}'); }
  catch (_) { /* Contact selection remains useful without photo metadata. */ }
  const scriptBase = new URL('.', document.currentScript?.src || location.href);
  const widget = document.createElement('div');
  widget.className = 'editorial-offices';
  widget.innerHTML = `<div class="editorial-office-index" role="group" aria-label="Choose an office"></div>
    <section class="editorial-office-card" id="editorial-office-details" aria-labelledby="editorial-office-name">
      <div class="editorial-office-photo" aria-busy="false"></div>
      <div class="editorial-office-details">
        <h3 id="editorial-office-name" class="editorial-office-name"></h3>
        <address class="editorial-office-address"></address>
        <div class="editorial-office-actions"><a class="editorial-office-phone"></a><a class="editorial-office-directions" target="_blank" rel="noopener">Get directions <span aria-hidden="true">↗</span></a></div>
      </div>
    </section>`;
  const index = widget.querySelector('.editorial-office-index');
  const card = widget.querySelector('.editorial-office-card');
  const stage = widget.querySelector('.editorial-office-photo');
  const title = widget.querySelector('.editorial-office-name');
  const address = widget.querySelector('.editorial-office-address');
  const phone = widget.querySelector('.editorial-office-phone');
  const directions = widget.querySelector('.editorial-office-directions');
  const buttons = [];
  let selected = -1;

  function paintPhoto() {
    const office = offices[selected];
    if (!office) return;
    offices.forEach(item => { if (item.image) item.image.hidden = item !== office || item.imageState !== 'ready'; });
    card.dataset.photo = office.imageState;
    stage.setAttribute('aria-busy', String(office.imageState === 'loading'));
    stage.hidden = office.imageState === 'missing' || office.imageState === 'error';
    widget.dataset.photoState = office.imageState;
  }
  function selectOffice(officeIndex) {
    if (officeIndex === selected || !offices[officeIndex]) return;
    selected = officeIndex;
    const office = offices[selected];
    widget.dataset.selectedOffice = office.id;
    title.textContent = office.name;
    address.replaceChildren(...Array.from(office.address.childNodes).map(node => node.cloneNode(true)));
    phone.textContent = office.phone.textContent;
    phone.href = office.phone.getAttribute('href');
    directions.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(office.addressText);
    directions.setAttribute('aria-label', `Get directions to the ${office.name} office`);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
    paintPhoto();
  }

  offices.forEach((office, officeIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editorial-office-button';
    button.dataset.office = office.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', card.id);
    const label = document.createElement('span');
    label.textContent = office.name;
    const arrow = document.createElement('span');
    arrow.className = 'editorial-office-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(label, arrow);
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') selectOffice(officeIndex); });
    button.addEventListener('focus', () => selectOffice(officeIndex));
    button.addEventListener('click', () => selectOffice(officeIndex));
    button.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (officeIndex + 1) % offices.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (officeIndex - 1 + offices.length) % offices.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = offices.length - 1;
      if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
    });
    buttons.push(button);
    index.append(button);

    const photo = photos[office.id];
    if (!photo?.src) return;
    const image = new Image(photo.width, photo.height);
    office.image = image;
    office.imageState = 'loading';
    image.alt = photo.alt || office.name + ' office';
    image.decoding = 'async';
    image.loading = 'eager';
    image.hidden = true;
    stage.append(image);
    const finish = success => {
      office.imageState = success ? 'ready' : 'error';
      // Paint only the current selection; late loads cannot change its details.
      if (offices[selected] === office) paintPhoto();
    };
    image.addEventListener('load', () => {
      if (image.decode) image.decode().then(() => finish(true), () => finish(image.naturalWidth > 0));
      else finish(image.naturalWidth > 0);
    }, { once: true });
    image.addEventListener('error', () => finish(false), { once: true });
    try { image.src = new URL(photo.src, scriptBase).href; }
    catch (_) { finish(false); }
  });

  directory.append(widget);
  selectOffice(Math.max(0, offices.findIndex(office => office.id === 'chicago')));
  directory.dataset.editorialOffices = 'ready';
  sourceNodes.forEach(source => { source.hidden = true; });
})();
