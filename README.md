# Pack 3721 Fundraising

Fundraising tools for Cub Scout Pack 3721, published at
[pack3721.github.io/fundraise](https://pack3721.github.io/fundraise/).

Plain static HTML/CSS/JS — no Jekyll. The only build step is
[`build.py`](build.py), which copies the site into `_site/` and fills
`{{ key }}` tokens in HTML pages from [`site-settings.yml`](site-settings.yml)
(a token with no matching key fails the build). The build also supplies
`{{ build_hash }}` / `{{ build_sha }}` — the deployed commit — which the
footer badges show, and appends `?v=<hash>` to every local stylesheet, script
and image reference so a deploy never serves a stale asset from cache. Pushing to `main` runs it and
deploys through GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## What's here

| Path | What it is |
| --- | --- |
| [`index.html`](index.html) | Landing page listing the tools |
| [`site-settings.yml`](site-settings.yml) | Site-wide settings (pack number); filled into pages by the build, and read directly by the flyer at runtime |
| [`build.py`](build.py) | Assembles `_site/`, filling `{{ key }}` tokens from the settings |
| [`popcorn-flyer/`](popcorn-flyer/) | Fill-in-the-blanks printable popcorn flyer — see its [README](popcorn-flyer/README.md) |
| [`2025-archive/`](2025-archive/) | The 2025 Jekyll site, kept as code only |

`2025-archive/` is **not deployed** — the workflow excludes it. It is still
Jekyll source (Liquid tags, `_config.yml`, `_includes/`) and would not render
correctly as static files anyway.

## Local preview

```
python3 build.py && python3 -m http.server 8000 -d _site
```

Then open <http://127.0.0.1:8000/>. Re-run `build.py` after editing; it's the
same script the deploy runs, so `_site/` is exactly what ships.

---

*This project is not officially endorsed by the Boy Scouts of America. It is
provided as a community resource for fundraising support.*
