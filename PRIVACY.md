# Privacy Policy — Specter

_Last updated: 2026-07-18_

Specter is a browser extension and Vite plugin that lets developers inspect the
styles of elements on a web page.

## The short version

**Specter does not collect, store, transmit, or share any user data.**

## Details

- **Runs entirely on your device.** Specter operates locally inside your browser.
  It has no backend, no server, and no account system.
- **No network requests.** Specter never sends any data anywhere. It has no
  analytics, no tracking, and no telemetry of any kind.
- **Reading page elements is local and transient.** When you activate Specter and
  hover an element, it reads that element's computed styles and dimensions using
  standard browser APIs, solely to draw an on-screen overlay. This information is
  never stored and never leaves your device.
- **Clipboard.** When you press the copy shortcut, Specter writes a text summary
  of the element you inspected (plus any note you typed) to your own clipboard, on
  your device, at your explicit request. Specter does not read your clipboard and
  does not transmit clipboard contents anywhere.
- **Broad host access.** Specter's content script is present on all sites so it can
  activate instantly via its keyboard shortcut, but it stays completely inactive
  until you explicitly turn it on, and even then only does the local inspection
  described above.

Because Specter collects no data, there is nothing for us to sell, share, or
disclose to third parties.

## Contact

Questions or concerns? Please open an issue at
<https://github.com/setugk/vite-plugin-specter/issues>.
