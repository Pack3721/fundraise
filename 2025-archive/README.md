# St. Louis Area Council Coffee Fundraiser Landing Page

This repository provides a customizable landing page for the St. Louis Area Council's Coffee Fundraiser, designed for use by St. Louis scouting units. The site is built to be easily forked and deployed via GitHub Pages, allowing each unit to personalize their own fundraiser page.

This repo (formerly hosted directly at `pack3721.github.io`) is published as a project page at [pack3721.github.io/fundraise](https://pack3721.github.io/fundraise/), served under the `/fundraise` path via `_config.yml`'s `baseurl`.

## Features

- **Modern Landing Page**: Clean, mobile-friendly design for promoting the coffee fundraiser.
- **Sectioned Content**: Includes dedicated pages for making coffee online landing pages (`make/`), with a custom landing page for just (`coffee/`) and another optional page for coffee and popcorn if your unit is doing it as well (`sell/`).
- **Image Assets**: Fundraiser-related images stored in `assets/images/` for easy updates.
- **Reusable Includes**: Common HTML snippets in `_includes/` for modular page construction.
- **Configurable**: Unit specific site settings managed via `_config.yml` for easy customization.

## Configuration

- **_config.yml**: Contains site-wide settings. Update this file to reflect your unit's details.
- **HTML Includes**: Edit sell_body in `_includes/` to change the `coffee` and `sell` landing page templates.
- **Assets**: Add images in `assets/images/` with your own unit's branding or fundraiser photos.

## Forking and Customization

1. **Fork the Repository**: Click the "Fork" button on GitHub to create your own copy.
2. **Update Config**: Edit `_config.yml` to set your unit's name, fundraiser details, and contact info. If your fork's repo name differs from `fundraise`, also update `url`/`baseurl` in `_config.yml` to match (or clear `baseurl` entirely if deploying as a `<user>.github.io` root site).
3. **Customize Content** (optional): Modify the HTML files in the root and subfolders (`coffee/`, `make/`, `sell/`) to match your unit's messaging.
4. **Replace Images** (optional): Add or replace images in `assets/images/` as needed.
5. **Preview Locally** (optional): Use Jekyll or GitHub Pages' preview feature to test your changes.
6. **Deploy with GitHub Pages** (optional): Enable GitHub Pages in your repository settings. Your site will be published at `https://<your-username or organization>.github.io/<your-repo>/`.

For more information, see the official [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).


*This project is not officially endorsed by the Boy Scouts of America. It is provided as a community resource for fundraising support.*
