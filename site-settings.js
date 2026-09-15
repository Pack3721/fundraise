/* Loads site-settings.yml — the one file every page on this site reads.
 *
 * The file is plain `key: value` lines, so this is a purpose-built reader,
 * not a YAML parser. It resolves the file next to itself, so it works from
 * any page depth. */

const SETTINGS_URL = new URL('site-settings.yml', import.meta.url);

function unquote(value) {
  const v = (value || '').trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseSettings(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (match) out[match[1]] = unquote(match[2]);
  }
  return out;
}

/* Resolves to the settings map, or to `fallback` if the file can't be
 * fetched (opening a page straight off disk, say). */
export async function loadSiteSettings(fallback = {}) {
  try {
    const response = await fetch(SETTINGS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    const parsed = parseSettings(await response.text());
    return Object.keys(parsed).length ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

/* Fills every element carrying data-setting="<key>" with that setting's
 * value, leaving the element's existing text as the fallback. */
export async function applySiteSettings(fallback = {}) {
  const settings = await loadSiteSettings(fallback);
  for (const node of document.querySelectorAll('[data-setting]')) {
    const value = settings[node.dataset.setting];
    if (value !== undefined) node.textContent = value;
  }
  return settings;
}
