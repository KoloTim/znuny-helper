# Znuny Helper

Chromium-first WebExtension that consolidates the former Tampermonkey helpers into one addon with popup-based feature toggles.

## Included Features

- Open Znuny popup actions in new tabs.
- Preview PDF and image attachments in an overlay.
- Force the search modal to Ticket-Nummer.
- Search inside ticket article overview rows and article text on ticket zoom pages.
- Add an Empfangsbestaetigung button on relevant ticket zoom pages.
- Categorize, group, highlight, and locally annotate tickets in the locked ticket view.

## Load In Chromium

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Choose "Load unpacked".
4. Select this folder: `znuny-helper-extension`.

The extension currently matches:

```text
https://otrs.staff.hsrw/otrs/index.pl*
```

Change the match pattern in `manifest.json` if the Znuny URL changes.

## Notes For Firefox Later

The code already uses the WebExtensions `browser`/`chrome` API shape where practical. The one Chromium-specific part is `content_scripts[].world = "MAIN"` in `manifest.json`, which is used so the extension can patch page-level `window.open` behavior. For Firefox packaging, keep the DOM features as-is and replace that bridge with the Firefox-supported page-script injection approach if needed.
