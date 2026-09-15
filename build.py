#!/usr/bin/env python3
"""Assemble the deployable site into _site/.

Copies every deployable file, then fills `{{ key }}` tokens in HTML pages
from site-settings.yml — so a page like the landing page can carry the pack
number without any JavaScript. The build also supplies `build_sha` and
`build_hash` (full and short commit id: GITHUB_SHA on Actions, `git
rev-parse` locally, "dev" otherwise). Any token with no matching key fails
the build, so a typo can't ship as literal braces.

Run locally before previewing:  python3 build.py && python3 -m http.server -d _site
GitHub Actions runs the same script; see .github/workflows/deploy.yml.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "_site"
SETTINGS = ROOT / "site-settings.yml"

# Not part of the site: tooling, archived code, and the output itself.
EXCLUDE = {".git", ".github", "_site", "2025-archive", "build.py", ".gitignore", ".DS_Store"}

TOKEN = re.compile(r"\{\{\s*([\w-]+)\s*\}\}")


def read_settings(path):
    """site-settings.yml is plain `key: value` lines — the same narrow reader
    the flyer's app.js uses in the browser."""
    settings = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = re.sub(r"\s+#.*$", "", raw)
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([\w-]+):\s*(.*)$", line)
        if m:
            value = m.group(2).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            settings[m.group(1)] = value
    return settings


def build_sha():
    sha = os.environ.get("GITHUB_SHA", "").strip()
    if not sha:
        try:
            sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True,
                                 text=True, check=True).stdout.strip()
        except (OSError, subprocess.CalledProcessError):
            sha = ""
    return sha or "dev"


def main():
    settings = read_settings(SETTINGS)
    sha = build_sha()
    settings["build_sha"] = sha
    settings["build_hash"] = sha[:7]

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for entry in ROOT.iterdir():
        if entry.name in EXCLUDE:
            continue
        target = OUT / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target, ignore=shutil.ignore_patterns(".DS_Store"))
        else:
            shutil.copy2(entry, target)

    missing = []
    for page in OUT.rglob("*.html"):
        text = page.read_text(encoding="utf-8")

        def fill(m):
            key = m.group(1)
            if key not in settings:
                missing.append(f"{page.relative_to(OUT)}: {{{{ {key} }}}}")
                return m.group(0)
            return settings[key]

        filled = TOKEN.sub(fill, text)
        if filled != text:
            page.write_text(filled, encoding="utf-8")

    if missing:
        print("Unresolved tokens (add the key to site-settings.yml):", file=sys.stderr)
        for item in missing:
            print("  " + item, file=sys.stderr)
        sys.exit(1)

    print(f"Built _site/ with {len(settings)} setting(s): {', '.join(sorted(settings))}")


if __name__ == "__main__":
    main()
