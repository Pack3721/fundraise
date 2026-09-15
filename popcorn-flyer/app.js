/* Popcorn Flyer Maker — fill in the blanks, keep it in localStorage, print it.
 *
 * Nothing leaves the browser: text and (downscaled) photos live in
 * localStorage, and the only network calls are for the QR styling library and
 * its center icon.
 */

// ── QR library ────────────────────────────────────────────────────────────
// The same generator the pack's cub-qr site uses, so flyer QR codes look like
// the rest of the pack's material. Loaded dynamically: if the CDN is blocked
// the flyer still works, it just prints without a QR code.
let QRCodeStyling = null;
let BorderPlugin = null;

const qrLibReady = (async () => {
  try {
    const base = 'https://cdn.jsdelivr.net/npm/@liquid-js/qr-code-styling@5.5.0/lib/';
    const [core, border] = await Promise.all([
      import(base + 'qr-code-styling.js'),
      import(base + 'border-plugin.js'),
    ]);
    QRCodeStyling = core.QRCodeStyling;
    BorderPlugin = border.default;
    return true;
  } catch (e) {
    return false;
  }
})();

// ── configuration ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'popcornFlyer';
const IMAGE_STORAGE_KEY = 'popcornFlyerImages';
const PRODUCTS_URL = 'products.yml';

// Fallback list, used only when products.yml can't be fetched (opening the
// page straight off disk, say). The file is the real source of truth.
const FALLBACK_PRODUCTS = [
  { name: 'Chocolatey Caramel Crunch', price: '$25' },
  { name: 'Classic Caramel Corn', price: '$20' },
  { name: 'White Cheddar', price: '$20' },
  { name: 'Kettle Corn', price: '$15' },
  { name: 'Butter Microwave 6-Pack', price: '$20' },
  { name: 'Helpers & Heroes Donation', price: '$30' },
];

const QR_SCHEMES = [
  {
    key: 'popcorn', label: 'Popcorn', shape: 'circle',
    dotsColor: '#b2622d', dotsType: 'dots',
    backgroundColor: '#ffffff',
    cornersSquareColor: '#7a8a5e', cornersSquareType: 'extra-rounded',
    cornersDotColor: '#8c491a', cornersDotType: 'dot',
    borderColor: '#8c491a', borderTextColor: '#f5ead8',
    iconColor: '#b2622d',
  },
  {
    // Mirrors cub-qr's navy-gold scheme.
    key: 'navy-gold', label: 'Navy & Gold', shape: 'circle',
    dotsColor: '#003F87', dotsType: 'dots',
    backgroundColor: '#ffffff',
    cornersSquareColor: '#FFC72C', cornersSquareType: 'extra-rounded',
    cornersDotColor: '#003F87', cornersDotType: 'dot',
    borderColor: '#003F87', borderTextColor: '#FFC72C',
    iconColor: '#003F87',
  },
  {
    // Cheapest to photocopy and the most forgiving to scan.
    key: 'black-white', label: 'Black & white', shape: 'square',
    dotsColor: '#000000', dotsType: 'square',
    backgroundColor: '#ffffff',
    cornersSquareColor: '#000000', cornersSquareType: 'square',
    cornersDotColor: '#000000', cornersDotType: 'square',
    borderColor: '#000000', borderTextColor: '#ffffff',
    iconColor: '#000000',
  },
];

// Center mark for the QR code. The pack's own logo, served from this site, so
// a printed flyer never depends on an icon CDN being reachable.
const QR_ICON = 'assets/cub-scouts-logo.png';

// Placeholder copy shown on the flyer for a blank field — the bracketed
// prompts from the original design, so an unfinished flyer reads as a draft.
const PLACEHOLDERS = {
  scoutName: '[Scout Name]',
  packNumber: '3721',
  orderBy: '[Month Day]',
  goal: '[camp, gear, or an adventure]',
  orderUrl: '[your order link]',
};

const DEFAULTS = {
  scoutName: '',
  packNumber: '3721',
  orderBy: '',
  goal: '',
  orderUrl: '',
  qrScheme: 'popcorn',
  qrBottomText: 'SCAN TO ORDER',
  photoCount: '3',
  ground: 'white',
  products: [],
  // The products.yml `updated` value in force the last time presets were
  // applied here. Presets overwrite the saved list only when the file's date
  // is newer than this.
  productsPresetDate: '',
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

/* Parses the narrow shape of products.yml only — `updated: <date>` plus a
 * `products:` list of `- name:` / `price:` pairs. Not a general YAML parser;
 * it exists so the presets can stay a hand-editable file without pulling in a
 * parser library or a build step. */
function parseProductsYaml(text) {
  const out = { updated: '', products: [] };
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
let presets = { updated: '', products: FALLBACK_PRODUCTS };

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
  editor: document.getElementById('editor'),
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

const TEXT_FIELDS = ['scoutName', 'packNumber', 'orderBy', 'goal', 'orderUrl', 'qrBottomText'];
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

function renderText() {
  for (const node of document.querySelectorAll('[data-out]')) {
    const key = node.dataset.out;
    if (key === 'orderUrlText') {
      const url = (state.orderUrl || '').trim();
      node.textContent = url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : PLACEHOLDERS.orderUrl;
    } else {
      node.textContent = textFor(key);
    }
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
  const url = (state.orderUrl || '').trim();
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
  const bottom = (state.qrBottomText || '').trim();

  const border = new BorderPlugin({
    proportional: true,
    size: 0.12,
    round: 1,
    margin: 0,
    color: scheme.borderColor,
    text: bottom
      ? { font: 'sans-serif', color: scheme.borderTextColor, size: 0.075, fontWeight: 'bold', bottom: { content: bottom } }
      : undefined,
  });

  const qr = new QRCodeStyling({
    type: 'svg',
    width: 400,
    height: 400,
    data: url,
    shape: scheme.shape,
    image: QR_ICON,
    imageOptions: { margin: 1, imageSize: 0.3 },
    dotsOptions: { color: scheme.dotsColor, type: scheme.dotsType },
    backgroundOptions: { color: scheme.backgroundColor, round: 1, margin: 3 },
    cornersSquareOptions: { type: scheme.cornersSquareType, color: scheme.cornersSquareColor },
    cornersDotOptions: { type: scheme.cornersDotType, color: scheme.cornersDotColor },
    // H tolerates the center icon, and a creased paper flyer.
    qrOptions: { errorCorrectionLevel: 'H' },
    plugins: [border],
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

function applyPresets(reason) {
  state.products = presets.products.map((p) => Object.assign({}, p));
  state.productsPresetDate = presets.updated;
  el.productsText.value = productsToText(state.products);
  save();
  renderProducts();
  fitContent();
  if (reason) show(el.presetNotice, reason);
}

async function loadPresets() {
  try {
    const response = await fetch(PRODUCTS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    presets = parseProductsYaml(await response.text());
    if (!presets.products.length) presets.products = FALLBACK_PRODUCTS;
  } catch (e) {
    presets = { updated: '', products: FALLBACK_PRODUCTS };
  }

  el.presetHint.textContent = presets.updated
    ? `Preset list last updated ${presets.updated}.`
    : 'Using the built-in list — products.yml could not be loaded.';

  if (!state.products.length) {
    applyPresets('');
  } else if (isNewer(presets.updated, state.productsPresetDate)) {
    applyPresets(`The pack published an updated product list (${presets.updated}), so the products below were refreshed.`);
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
      if (key === 'orderUrl' || key === 'qrBottomText') scheduleQr();
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
    applyPresets('Products reset to the pack presets.');
  });

  document.getElementById('print').addEventListener('click', () => window.print());

  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Clear everything on this flyer, including photos?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(IMAGE_STORAGE_KEY);
    } catch (e) { /* nothing saved to clear */ }
    state = Object.assign({}, DEFAULTS, { products: [] });
    images = {};
    hydrateControls();
    applyPresets('');
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
loadPresets();

// Caprasimo and Figtree are wider than the fallbacks, so the first measure
// can be taken against the wrong metrics; redo it once they're in.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { fitContent(); fitPreview(); });
}
