/* Loads site-settings.yml in the browser, for pages that need a setting at
 * runtime (the flyer seeds its pack number from it). Static pages get the
 * same file filled in at build time instead — see build.py.
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
