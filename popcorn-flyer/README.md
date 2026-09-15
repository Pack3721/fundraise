# Popcorn Flyer Maker

A fill-in-the-blanks flyer for a Cub Scout popcorn fundraiser. A scout types
their name, dates, goal and order link, drops in a few photos, and prints a
finished letter-size flyer.

Plain HTML/CSS/JS — no build step, no server, no accounts. Everything a scout
enters (photos included) is saved in their own browser's `localStorage` and
never leaves the device.

## Starting defaults

The site-wide [`site-settings.yml`](../site-settings.yml) (one level up, shared
with the landing page) supplies starting values for a brand-new flyer —
currently just `pack_number`. These have **no rollout date**: each key is
applied the first time a browser sees it and never again, so changing a value
there never disturbs anyone's saved flyer. Adding a *new* key does reach
existing scouts once, on their next visit, because each key is tracked
separately. **Start over** re-applies them.

## Updating the product list

`products.yml` holds the pack-wide presets everyone starts from — the order
deadline and the product list:

```yaml
updated: 2026-09-15

order_by: October 31st

products:
  - name: Salted Caramel Corn
    price: $20
```

Each browser remembers the `updated` value that was in force the last time
presets were applied to it. When the date in the file is **newer** than that,
the saved order-by date and product list are both replaced with the file's on
the next visit, and the scout is told why. So:

- **New season, new prices or deadline** — change the values *and* bump
  `updated`. It rolls out to everyone, including scouts who had edited their
  own copy.
- **Fixing a typo** — change the values and leave `updated` alone. Nobody's
  saved flyer is touched; only scouts starting fresh see the change.

`order_by` is free text printed as "Order by <this>", so write it the way it
should read on paper. A scout can still override it on their own flyer.

`store_base` is where a Scout's online store lives; a bare 8-digit Scout code
typed into the flyer expands to this plus the code. It's read live rather than
saved per flyer, so it isn't subject to the `updated` gate.

Anyone can also hit **Reset to pack presets** to pull the current file in on
demand.

## Backups

Everything lives in one browser's `localStorage`, keyed to the exact origin —
so `localhost` and `127.0.0.1` are two different flyers, and a phone can't see
a laptop's. **Save backup (.zip)** writes `flyer.json` plus the photos as
ordinary image files; **Import backup** restores it anywhere, including the
defaults seed log so `site-settings.yml` doesn't re-seed over the imported values.
Import only accepts fields the page knows about, so a hand-edited or
newer-version zip can't write junk.

The zip is built in the browser with [JSZip](https://stuk.github.io/jszip/),
loaded from a CDN like the QR library.

## Printing

Print at 100% / "actual size" with no page scaling and margins set to none —
the flyer is drawn at exactly 8.5in × 11in. Backgrounds must be enabled
("Background graphics" in Chrome's print dialog) or the flyer prints white.

Long names and long product lists shrink the type automatically so the flyer
always stays on one page.

## The QR code

The QR is generated from the order link with
[`@liquid-js/qr-code-styling`](https://www.npmjs.com/package/@liquid-js/qr-code-styling),
the same generator the pack's [cub-qr](https://github.com/Pack3721/cub-qr) site
uses, so flyer codes match the pack's other material — minus cub-qr's ring
border, which the flyer doesn't use. The library loads from a CDN; if it can't
be reached the flyer still fills in and prints, just without a QR code.

The code is plain — no ring border, no center logo — with a 4-module quiet zone
and error correction level H, and is checked by decoding the rendered SVG at
print resolution.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Editor panel plus the flyer itself |
| `flyer.css` | Design tokens, the printable sheet, editor chrome, print rules |
| `app.js` | State, `localStorage`, image downscaling, site settings, presets, QR, backups |
| `products.yml` | Order-by date, product presets, and their rollout date |
| `assets/` | Cub Scouts logo |

The flyer's layout is a fixed 8.5in × 11in box with `container-type: size`, so
the `cqh`/`cqw` lengths throughout `flyer.css` are percentages of real paper.
On screen the sheet is only visually scaled, which leaves those units at their
printed values — the preview and the print are the same drawing at different
zooms.
