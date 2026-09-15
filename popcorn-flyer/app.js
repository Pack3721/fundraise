/* Popcorn Flyer Maker — fill in the blanks, keep it in localStorage, print it.
 *
 * Nothing leaves the browser: text and (downscaled) photos live in
 * localStorage, and the only network call is for the QR styling library.
 */

// ── QR library ────────────────────────────────────────────────────────────
// The same generator the pack's cub-qr site uses, so flyer QR codes look like
// the rest of the pack's material. Loaded dynamically: if the CDN is blocked
// the flyer still works, it just prints without a QR code.
let QRCodeStyling = null;

const qrLibReady = (async () => {
  try {
    const core = await import('https://cdn.jsdelivr.net/npm/@liquid-js/qr-code-styling@5.5.0/lib/qr-code-styling.js');
    QRCodeStyling = core.QRCodeStyling;
    return true;
  } catch (e) {
    return false;
  }
})();

// ── configuration ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'popcornFlyer';
const IMAGE_STORAGE_KEY = 'popcornFlyerImages';
const SEEDED_STORAGE_KEY = 'popcornFlyerSeeded';
const PRODUCTS_URL = 'products.yml';
const DEFAULTS_URL = 'defaults.yml';

// Used only when defaults.yml can't be fetched.
const FALLBACK_DEFAULTS = { packNumber: '721' };

// Used only when products.yml can't be fetched (opening the page straight off
// disk, say). The file is the real source of truth.
const FALLBACK_PRESETS = {
  updated: '',
  orderBy: 'October 31st',
  products: [
    { name: 'Salted Caramel Corn', price: '$20' },
    { name: 'White Cheddar', price: '$20' },
    { name: 'Sweet & Salty Kettle Corn', price: '$20' },
    { name: 'Microwave Butter Popcorn', price: '$27' },
    { name: 'Dark Chocolatey Salted Caramels', price: '$37' },
    { name: 'Helpers & Heroes Donation', price: '$5 and up' },
  ],
};

const QR_SCHEMES = [
  {
    key: 'popcorn', label: 'Popcorn', shape: 'square',
    dotsColor: '#b2622d', dotsType: 'dots',
    backgroundColor: '#ffffff',
    cornersSquareColor: '#7a8a5e', cornersSquareType: 'extra-rounded',
    cornersDotColor: '#8c491a', cornersDotType: 'dot',
  },
  {
    // Mirrors cub-qr's navy-gold scheme.
    key: 'navy-gold', label: 'Navy & Gold', shape: 'square',
    dotsColor: '#003F87', dotsType: 'dots',
    backgroundColor: '#ffffff',
    cornersSquareColor: '#FFC72C', cornersSquareType: 'extra-rounded',
    cornersDotColor: '#003F87', cornersDotType: 'dot',
  },
  {
    // Cheapest to photocopy and the most forgiving to scan.
    key: 'black-white', label: 'Black & white', shape: 'square',
    dotsColor: '#000000', dotsType: 'square',
    backgroundColor: '#ffffff',
    cornersSquareColor: '#000000', cornersSquareType: 'square',
    cornersDotColor: '#000000', cornersDotType: 'square',
  },
];

// Placeholder copy shown on the flyer for a blank field — the bracketed
// prompts from the original design, so an unfinished flyer reads as a draft.
const PLACEHOLDERS = {
  scoutName: '[Scout Name]',
  packNumber: '721',
  orderBy: '[Month Day]',
  goal: '[camp, gear, or an adventure]',
  orderUrl: '[your order link]',
};

const DEFAULTS = {
  scoutName: '',
  packNumber: '',   // seeded once from defaults.yml
  orderBy: '',
  goal: '',
  orderUrl: '',
  qrScheme: 'popcorn',
  photoCount: '3',
  ground: 'white',
  products: [],
  // The products.yml `updated` value in force the last time presets were
  // applied here. Presets overwrite the saved order-by date and product list
  // only when the file's date is newer than this.
  presetDate: '',
};

const PHOTO_SLOTS = [
  { key: 'header', label: 'Scout photo' },
  { key: 'photo0', label: 'Photo 1' },
  { key: 'photo1', label: 'Photo 2' },
  { key: 'photo2', label: 'Photo 3' },
];

const SHEET_W = 816;  // 8.5in at 96 CSS px/in

// ── storage helpers ───────────────────────────────────────────────────────

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* unavailable or corrupt storage — fall through */ }
  return fallback;
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// ── products.yml ──────────────────────────────────────────────────────────

/* Parses the narrow shape of products.yml only — the scalars `updated` and
 * `order_by`, plus a `products:` list of `- name:` / `price:` pairs. Not a
 * general YAML parser; it exists so the presets can stay a hand-editable file
 * without pulling in a parser library or a build step. */
function parseProductsYaml(text) {
  const out = { updated: '', orderBy: '', products: [] };
  let inProducts = false;
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '');        // trailing comment
    if (!line.trim() || /^\s*#/.test(line)) continue;   // blank / comment

    const top = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (top) {
      const [, key, value] = top;
      if (key === 'products') {
        inProducts = true;
        current = null;
      } else {
        inProducts = false;
        if (key === 'updated') out.updated = unquote(value);
        if (key === 'order_by') out.orderBy = unquote(value);
      }
      continue;
    }

    if (!inProducts) continue;

    const item = /^\s*-\s*(\w+):\s*(.*)$/.exec(line);
    if (item) {
      current = { name: '', price: '' };
      out.products.push(current);
      current[item[1]] = unquote(item[2]);
      continue;
    }

    const field = /^\s+(\w+):\s*(.*)$/.exec(line);
    if (field && current) current[field[1]] = unquote(field[2]);
  }

  out.products = out.products.filter((p) => p.name);
  return out;
}

/* Parses defaults.yml: top-level `key: value` scalars only, with snake_case
 * keys mapped to the flyer's own camelCase field names. */
function parseDefaultsYaml(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].replace(/_(\w)/g, (_, c) => c.toUpperCase());
    out[key] = unquote(match[2]);
  }
  return out;
}

function unquote(value) {
  const v = (value || '').trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

// Dates are `YYYY-MM-DD` in the file; fall back to string order if one of
// them isn't parseable so a malformed date can't silently stop rollouts.
function isNewer(a, b) {
  if (!a) return false;
  if (!b) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a > b;
  return ta > tb;
}

// ── state ─────────────────────────────────────────────────────────────────

let state = Object.assign({}, DEFAULTS, readJson(STORAGE_KEY, {}));
let images = readJson(IMAGE_STORAGE_KEY, {});
let presets = FALLBACK_PRESETS;

if (!Array.isArray(state.products)) state.products = [];

function save() {
  writeJson(STORAGE_KEY, state);
}

function saveImages() {
  if (!writeJson(IMAGE_STORAGE_KEY, images)) {
    show(el.storageNotice, "This browser wouldn't save the photos — there may be too many, or too large. The flyer still prints, but the photos won't be here next visit.");
  }
}

function show(node, message) {
  node.textContent = message;
  node.hidden = false;
}

// ── element lookup ────────────────────────────────────────────────────────

const el = {
  stage: document.getElementById('stage'),
  scaler: document.getElementById('scaler'),
  sheet: document.getElementById('sheet'),
  pickers: document.getElementById('pickers'),
  photoStrip: document.getElementById('photoStrip'),
  productGrid: document.getElementById('productGrid'),
  productsText: document.getElementById('products'),
  presetHint: document.getElementById('presetHint'),
  presetNotice: document.getElementById('presetNotice'),
  storageNotice: document.getElementById('storageNotice'),
  qrSlot: document.getElementById('qrSlot'),
  qrScheme: document.getElementById('qrScheme'),
};

const TEXT_FIELDS = ['scoutName', 'packNumber', 'orderBy', 'goal', 'orderUrl'];
const SELECT_FIELDS = ['qrScheme', 'photoCount', 'ground'];

// ── products text <-> list ────────────────────────────────────────────────

function productsToText(list) {
  return list.map((p) => `${p.name} | ${p.price}`).join('\n');
}

function textToProducts(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.lastIndexOf('|');
      if (i === -1) return { name: line, price: '' };
      return { name: line.slice(0, i).trim(), price: line.slice(i + 1).trim() };
    })
    .filter((p) => p.name);
}

// ── rendering ─────────────────────────────────────────────────────────────

function textFor(key) {
  const value = (state[key] || '').trim();
  return value || PLACEHOLDERS[key] || '';
}

/* The order link as something a browser (or a QR scanner) can actually open:
 * a bare "trails-end.com/…" gets https:// in front, and anything that isn't
 * http(s) is refused rather than turned into a link. */
function orderHref() {
  let url = (state.orderUrl || '').trim();
  if (!url) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  return /^https?:\/\//i.test(url) ? url : '';
}

function renderText() {
  const href = orderHref();
  for (const node of document.querySelectorAll('[data-out]')) {
    const key = node.dataset.out;
    if (key === 'orderUrlText') {
      node.textContent = href ? href.replace(/^https?:\/\//, '').replace(/\/$/, '') : PLACEHOLDERS.orderUrl;
    } else {
      node.textContent = textFor(key);
    }
  }
  // Both the printed URL and the QR are live links on screen; with nothing to
  // point at they're inert, so the print design isn't a dead click target.
  for (const link of [document.getElementById('orderLink'), el.qrSlot]) {
    if (href) link.href = href; else link.removeAttribute('href');
  }
  el.sheet.classList.toggle('ground-cream', state.ground === 'cream');
}

function slotMarkup(key, hint) {
  const src = images[key];
  return src
    ? `<img src="${src}" alt="">`
    : `<span class="slot-hint">${hint}</span>`;
}

function renderPhotoStrip() {
  const count = state.photoCount === '2' ? 2 : 3;
  el.photoStrip.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'snap washed';
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = `photo${i}`;
    slot.innerHTML = slotMarkup(`photo${i}`, 'Add a photo');
    wrap.appendChild(slot);
    el.photoStrip.appendChild(wrap);
  }
  const header = el.sheet.querySelector('[data-slot="header"]');
  header.innerHTML = slotMarkup('header', 'Scout photo');
}

function renderProducts() {
  el.productGrid.innerHTML = '';
  for (const product of state.products) {
    const row = document.createElement('div');
    row.className = 'product';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = product.name;
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = product.price;
    row.append(name, price);
    el.productGrid.appendChild(row);
  }
  const more = document.createElement('div');
  more.className = 'product-more';
  more.textContent = '…plus lots more to choose from online!';
  el.productGrid.appendChild(more);
}

function renderPickers() {
  const count = state.photoCount === '2' ? 2 : 3;
  const slots = PHOTO_SLOTS.filter((s) => s.key === 'header' || Number(s.key.slice(-1)) < count);

  el.pickers.innerHTML = '';
  for (const slot of slots) {
    const label = document.createElement('label');
    label.className = 'picker' + (images[slot.key] ? ' filled' : '');
    label.title = slot.label;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    label.append(input);
    if (images[slot.key]) {
      const img = document.createElement('img');
      img.src = images[slot.key];
      img.alt = '';
      label.append(img);
    } else {
      label.append(document.createTextNode(slot.label));
    }

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'clear';
    clear.textContent = '✕';
    clear.title = 'Remove this photo';
    clear.addEventListener('click', (event) => {
      event.preventDefault();
      delete images[slot.key];
      saveImages();
      renderPickers();
      renderPhotoStrip();
    });
    label.append(clear);

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) acceptImage(slot.key, input.files[0]);
    });

    label.addEventListener('dragover', (event) => {
      event.preventDefault();
      label.classList.add('dragover');
    });
    label.addEventListener('dragleave', () => label.classList.remove('dragover'));
    label.addEventListener('drop', (event) => {
      event.preventDefault();
      label.classList.remove('dragover');
      const file = event.dataTransfer && event.dataTransfer.files[0];
      if (file) acceptImage(slot.key, file);
    });

    el.pickers.appendChild(label);
  }
}

// ── images ────────────────────────────────────────────────────────────────

/* Photos come off a phone at 4000px and 5MB; localStorage holds about 5MB
 * total. 1100px on the long edge is still ~300dpi at the size these print. */
function downscale(file, maxEdge = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('could not decode image'));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        // JPEG has no alpha; paint white so transparent PNGs don't go black.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function acceptImage(key, file) {
  if (!file.type.startsWith('image/')) return;
  try {
    images[key] = await downscale(file);
    el.storageNotice.hidden = true;
    saveImages();
    renderPickers();
    renderPhotoStrip();
  } catch (e) {
    show(el.storageNotice, "That file couldn't be read as an image.");
  }
}

// ── QR code ───────────────────────────────────────────────────────────────

let qrTimer = null;

function scheduleQr() {
  clearTimeout(qrTimer);
  qrTimer = setTimeout(renderQr, 250);
}

async function renderQr() {
  const url = orderHref();
  const slot = el.qrSlot;

  if (!url) {
    slot.classList.add('empty');
    slot.innerHTML = '<span class="qr-hint">Add an order link</span>';
    return;
  }

  const ready = await qrLibReady;
  if (!ready) {
    slot.classList.add('empty');
    slot.innerHTML = '<span class="qr-hint">QR generator unavailable offline</span>';
    return;
  }

  const scheme = QR_SCHEMES.find((s) => s.key === state.qrScheme) || QR_SCHEMES[0];

  const qr = new QRCodeStyling({
    type: 'svg',
    width: 400,
    height: 400,
    data: url,
    shape: scheme.shape,
    dotsOptions: { color: scheme.dotsColor, type: scheme.dotsType },
    // 4 modules is the quiet zone the QR spec asks for; without the border
    // plugin the code's own background is the only margin a camera gets.
    backgroundOptions: { color: scheme.backgroundColor, round: 1, margin: 4 },
    cornersSquareOptions: { type: scheme.cornersSquareType, color: scheme.cornersSquareColor },
    cornersDotOptions: { type: scheme.cornersDotType, color: scheme.cornersDotColor },
    // H tolerates the center icon, and a creased paper flyer.
    qrOptions: { errorCorrectionLevel: 'H' },
  });

  slot.classList.remove('empty');
  slot.innerHTML = '';
  qr.append(slot);
}

// ── fitting the sheet ─────────────────────────────────────────────────────

/* The sheet is a fixed sheet of paper, so content that runs long has to give.
 * The type scale is tuned so ordinary entries fit with room to spare; this
 * steps `--fit` down only when something unusually long (a big product list,
 * a wordy goal) would otherwise be clipped. */
function fitContent() {
  const sheet = el.sheet;
  let fit = 1;
  sheet.style.setProperty('--fit', '1');
  while (sheet.scrollHeight > sheet.clientHeight && fit > 0.7) {
    fit = Math.round((fit - 0.02) * 100) / 100;
    sheet.style.setProperty('--fit', String(fit));
  }
}

// ── preview scaling ───────────────────────────────────────────────────────

function fitPreview() {
  const available = el.stage.clientWidth - 56;
  const scale = Math.max(0.2, Math.min(1, available / SHEET_W));
  el.scaler.style.transform = `scale(${scale})`;
  // The transform doesn't affect layout, so give the scaler the scaled box.
  el.scaler.style.width = `${el.sheet.offsetWidth * scale}px`;
  el.scaler.style.height = `${el.sheet.offsetHeight * scale}px`;
}

// ── presets ───────────────────────────────────────────────────────────────

/* Pulls the whole preset bundle — order-by date and products — into the saved
 * flyer. Both come from the same file under the same rollout date, so they
 * refresh together. */
function applyPresets(reason) {
  state.orderBy = presets.orderBy;
  state.products = presets.products.map((p) => Object.assign({}, p));
  state.presetDate = presets.updated;
  document.getElementById('orderBy').value = state.orderBy;
  el.productsText.value = productsToText(state.products);
  save();
  renderText();
  renderProducts();
  fitContent();
  if (reason) show(el.presetNotice, reason);
}

/* Seeds starting values from defaults.yml. Each key lands exactly once, ever,
 * tracked separately from the flyer itself — so editing a value there never
 * disturbs a saved flyer, while a key added later still reaches everyone once
 * on their next visit. */
async function loadDefaults() {
  let defaults = FALLBACK_DEFAULTS;
  try {
    const response = await fetch(DEFAULTS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    const parsed = parseDefaultsYaml(await response.text());
    if (Object.keys(parsed).length) defaults = parsed;
  } catch (e) { /* keep the built-ins */ }

  const seeded = readJson(SEEDED_STORAGE_KEY, []);
  const seenSet = Array.isArray(seeded) ? seeded : [];
  let changed = false;

  for (const [key, value] of Object.entries(defaults)) {
    // Only recognized text/select fields, so a typo'd key can't write junk.
    if (!TEXT_FIELDS.includes(key) && !SELECT_FIELDS.includes(key)) continue;
    if (seenSet.includes(key)) continue;
    seenSet.push(key);
    changed = true;
    state[key] = value;
    const input = document.getElementById(key);
    if (input) input.value = value;
  }

  if (changed) {
    writeJson(SEEDED_STORAGE_KEY, seenSet);
    save();
    renderText();
    fitContent();
  }
}

async function loadPresets() {
  try {
    const response = await fetch(PRODUCTS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    presets = parseProductsYaml(await response.text());
    if (!presets.products.length) presets.products = FALLBACK_PRESETS.products;
    if (!presets.orderBy) presets.orderBy = FALLBACK_PRESETS.orderBy;
  } catch (e) {
    presets = FALLBACK_PRESETS;
  }

  el.presetHint.textContent = presets.updated
    ? `Pack presets last updated ${presets.updated}.`
    : 'Using the built-in presets — products.yml could not be loaded.';

  // `presetDate` records that presets have ever landed here, so a scout who
  // clears the list back to empty doesn't get it silently refilled.
  if (!state.presetDate) {
    applyPresets('');
  } else if (isNewer(presets.updated, state.presetDate)) {
    applyPresets(`The pack published updated details (${presets.updated}), so the order-by date and products below were refreshed.`);
  }
}

// ── wiring ────────────────────────────────────────────────────────────────

function hydrateControls() {
  el.qrScheme.innerHTML = '';
  for (const scheme of QR_SCHEMES) {
    const option = document.createElement('option');
    option.value = scheme.key;
    option.textContent = scheme.label;
    el.qrScheme.appendChild(option);
  }

  for (const key of TEXT_FIELDS.concat(SELECT_FIELDS)) {
    const input = document.getElementById(key);
    if (input) input.value = state[key];
  }
  el.productsText.value = productsToText(state.products);
}

function wire() {
  for (const key of TEXT_FIELDS) {
    const input = document.getElementById(key);
    input.addEventListener('input', () => {
      state[key] = input.value;
      save();
      renderText();
      fitContent();
      if (key === 'orderUrl') scheduleQr();
    });
  }

  for (const key of SELECT_FIELDS) {
    const input = document.getElementById(key);
    input.addEventListener('change', () => {
      state[key] = input.value;
      save();
      renderText();
      if (key === 'photoCount') {
        renderPickers();
        renderPhotoStrip();
      }
      fitContent();
      if (key === 'qrScheme') scheduleQr();
    });
  }

  el.productsText.addEventListener('input', () => {
    state.products = textToProducts(el.productsText.value);
    save();
    renderProducts();
    fitContent();
  });

  document.getElementById('resetProducts').addEventListener('click', () => {
    applyPresets('Order-by date and products reset to the pack presets.');
  });

  document.getElementById('print').addEventListener('click', () => window.print());

  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Clear everything on this flyer, including photos?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(IMAGE_STORAGE_KEY);
      // Clear the seed log too, so a fresh flyer gets the defaults again.
      localStorage.removeItem(SEEDED_STORAGE_KEY);
    } catch (e) { /* nothing saved to clear */ }
    state = Object.assign({}, DEFAULTS, { products: [] });
    images = {};
    hydrateControls();
    applyPresets('');
    loadDefaults();
    renderText();
    renderPickers();
    renderPhotoStrip();
    renderQr();
    fitContent();
  });

  window.addEventListener('resize', fitPreview);
  // Print at 1:1, then put the preview back the way it was.
  window.addEventListener('beforeprint', () => { el.scaler.style.transform = 'none'; });
  window.addEventListener('afterprint', fitPreview);
}

// ── start ─────────────────────────────────────────────────────────────────

hydrateControls();
wire();
renderText();
renderPickers();
renderPhotoStrip();
renderProducts();
renderQr();
fitContent();
fitPreview();
loadDefaults();
loadPresets();

// Caprasimo and Figtree are wider than the fallbacks, so the first measure
// can be taken against the wrong metrics; redo it once they're in.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { fitContent(); fitPreview(); });
}
