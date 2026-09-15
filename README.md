# Pack 3721 Fundraising

Fundraising tools for Cub Scout Pack 3721, published at
[pack3721.github.io/fundraise](https://pack3721.github.io/fundraise/).

Plain static HTML/CSS/JS — no Jekyll, no build step. Pushing to `main`
deploys the site through GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## What's here

| Path | What it is |
| --- | --- |
| [`index.html`](index.html) | Landing page listing the tools |
| [`site-settings.yml`](site-settings.yml) | Site-wide settings (pack number), read by every page at load |
| [`site-settings.js`](site-settings.js) | The shared loader for it |
| [`popcorn-flyer/`](popcorn-flyer/) | Fill-in-the-blanks printable popcorn flyer — see its [README](popcorn-flyer/README.md) |
| [`2025-archive/`](2025-archive/) | The 2025 Jekyll site, kept as code only |

`2025-archive/` is **not deployed** — the workflow excludes it. It is still
Jekyll source (Liquid tags, `_config.yml`, `_includes/`) and would not render
correctly as static files anyway.

## Local preview

```
python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000/>. Since there's no build step, what you see
locally is what gets deployed.

---

*This project is not officially endorsed by the Boy Scouts of America. It is
provided as a community resource for fundraising support.*
