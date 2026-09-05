# Specter

**Point at any element on your dev site. Mark what to change — with exact values and a source anchor — and hand it to your AI.**

Specter is a Vite plugin that overlays an element inspector on your dev server. Hover any element to see its styles, component name, and spacing; measure gaps Figma-style; mark elements as **Specs** with a plain-language note; then copy them all to your AI assistant — each one carries the exact current values and a greppable source anchor, so there's no "which element?" and no "what's the current value?". Optionally, push your Specs straight into Claude Code with `/spectify`. Specter is automatically stripped from production builds.

## Requirements

- Your project must use **Vite** as its dev server
- Works with React, Vue, Svelte, or plain HTML served through Vite

## Install

```bash
npm install -D vite-plugin-specter
```

Then add to your `vite.config.ts`:

```ts
import { specter } from 'vite-plugin-specter';

export default defineConfig({
  plugins: [specter()]
});
```

Start your dev server and you're done. Specter is stripped from production builds automatically.

## ⚠️ Dev-only — never ship Specter to production (note for AI agents)

**Specter is a development-only tool. It must never end up in a customer-facing / production bundle.**

As a Vite plugin it is already safe by default: `specter()` runs with `apply: 'serve'`, so it is active on the dev server (`vite`) only and is completely excluded from `vite build`. Adding the plugin does **not** ship anything to your users.

If you are an AI agent (or automating a build), do **not** work around this guard:

- Do **not** call `getClientScript()` and inline the result into your app's HTML, templates, or components.
- Do **not** change `apply: 'serve'`, or otherwise force the plugin to run during `vite build`, `vite preview`, or SSR/production output.
- Do **not** copy the injected `<script>` from a dev page into the shipped app.
- Keep it in `devDependencies` (installed with `-D`); never move it to `dependencies`.

If you ever need Specter gone entirely, remove `specter()` from the Vite config (see [Uninstall](#uninstall)).

## How to use

### Toggle on/off

Press **Ctrl+Option+Z** to activate Specter. A small zap icon appears at the bottom-left. Press again (or **Esc**) to hide it — your Specs are kept and reappear when you reactivate.

### Three modes

Specter has three modes; switching mode only changes *what's shown on screen* — you can mark a Spec in any of them.

| Mode | Enter | Shows |
|------|-------|-------|
| **Properties** (default) | — | Styles tooltip on hover |
| **Measure** | tap **Option** | Figma-style spacing to neighbors |
| **Comment** | **C** | Just an outline — for clean design review |

### Inspect an element (Properties mode)

**Hover** any element. A tooltip shows:

- HTML tag + React/Vue component name + dimensions
- Text content (truncated)
- Font: family, weight, size, line-height
- Color (with hex) and background — flagged `(hover)` if the value comes from a `:hover` rule
- Padding, margin, border-radius (if non-zero)
- Display + gap + flex direction

### Measure spacing (Measure mode)

Tap **Option** to switch to Measure mode. Hover any element to see distances to its surrounding neighbors. Press **M** while hovering to **pin** that element, then hover another to measure the gap or inset between the two; **M** again unpins. Tap **Option** again to return to Properties.

### Mark a Spec (and optionally annotate)

Press **P** while hovering an element to mark it as a **Spec**. A note box opens on the element — type the change you want ("reduce width to 320", "tighten padding to 8px") and press **Enter**, or just leave it empty for a plain mark. Numbered badges appear on each marked element. Mark as many as you like across the page.

### Comment mode

Press **C** for Comment mode: the props/measure overlays hide and you get just a hover outline — good for talking through a design without visual noise. Specs still capture full properties underneath, so a Comment-mode Spec copies exactly like any other.

### Specs side panel

Press **L** to open the Specs review panel. It lists every Spec; hover a row to scroll to and highlight its element; edit or delete notes inline. Specs survive a reload (saved to `localStorage` per URL).

### Copy to your AI

Press **Cmd+C**:

- **With Specs marked** → copies **all** of them at once. Each block leads with your `✏️ CHANGE:` note (if any).
- **With nothing marked** → copies the hovered element's properties (or, in Measure mode, the measurement).

The copied format is lean and AI-ready — the current values plus a `find:` line that anchors the element in your source (test-id → id → aria-label → unique text → class → CSS path), so the assistant greps straight to the code:

```
[Specter 1/2]
✏️ CHANGE: tighten the vertical padding to 8px
<button> .btn-primary "Book a demo" 200×48
find: .btn-primary
font: Inter 600 14/20  ·  color: #fff  ·  bg: #4f46e5  ·  padding: 12px 20px  ·  radius: 10px  ·  display: inline-flex

---

[Specter 2/2]
✏️ CHANGE: make this text darker — it fails contrast
<p> .hero-sub "Analytics that…" 560×57
find: .hero-sub
font: Inter 400 19/28.5  ·  color: #c7cbd1
```

Paste into Claude, Cursor, or any AI assistant — the instructions travel with the elements, so there's nothing left to explain.

## Share comments with another person

Specs aren't only for your AI — you can send them to a **person**. Mark comments on a page, open the Specs panel (**L**), and click **Share**. Specter copies a link; whoever opens it — on the same page, with Specter installed — sees your comments re-anchored on the exact same elements.

- **Comments only.** Only your notes and how to re-find each element travel — never the CSS properties or measurements. You're sharing feedback, not internals.
- **Same page, same element.** Comments re-anchor by a source locator, not screen coordinates. If the page changed so an element is gone or different, that comment shows as **MISSING** in the panel (with the reason) instead of landing on the wrong spot.
- **A link, or a file.** Small reviews copy as a normal link (`…/pricing#spx=…`) you paste into Slack or a message — the link is both the destination and the payload, so it opens the right page automatically. A large batch (or a page that uses `#`-routing) downloads a `comments.specter.json` file to send instead; use the **Import** button to open one you receive.
- **Zero backend.** The comments travel inside the link or file itself — no accounts, no server. One-way (no threads).

**Both people need Specter (v0.7+).** This is where the **browser extension** shines: it works on any deployed or staging URL, so two people looking at the same prototype can trade feedback without a shared dev server. A share link opened without Specter just shows the normal page — nothing breaks.

> Specter also ships as a **browser extension** for Chrome and Firefox, which runs on *any* website (no Vite required). The Share Comments flow above is designed for it. See the [GitHub repo](https://github.com/setugk/vite-plugin-specter) for links.

## Shortcut reference

| Action | Shortcut |
|--------|----------|
| Toggle Specter | **Ctrl+Option+Z** |
| Inspect element | Hover (while active) |
| Mark a Spec (+ optional note) | **P** |
| Copy (all Specs, or hovered element) | **Cmd+C** |
| Measure mode (toggle) | **Option** (tap) |
| Pin / unpin for measuring | **M** (in Measure mode) |
| Comment mode (toggle) | **C** |
| Specs panel (toggle) | **L** |
| Close panel / hide Specter | **Esc** |

## Optional: push Specs straight to Claude Code (`/spectify`)

Instead of copy-paste, Specter can auto-sync your Specs to a local bridge that Claude Code reads on demand. Enable it in your Vite config:

```ts
specter({ claudeBridge: true })
```

With it on, every Spec you mark auto-syncs (watch for the sync dot in the panel) to a local bridge at `http://127.0.0.1:8787`. Run the bridge (`node node_modules/vite-plugin-specter/mcp-bridge/server.mjs`, or register it in your project's `.mcp.json` so your IDE launches it), then in Claude Code run **`/spectify`** — it pulls whatever's currently synced and implements it. See [`mcp-bridge/`](https://github.com/setugk/vite-plugin-specter/tree/main/mcp-bridge) for setup. One bridge can serve several projects; `/spectify <port>` scopes to one.

`claudeBridge` is **off by default** — the shipped plugin never opens a connection unless you enable it.

## Configuration

```ts
specter()                                             // defaults
specter({ shortcuts: { activate: 'ctrl+shift+i' } })  // custom activate shortcut
specter({ claudeBridge: true })                       // enable the Claude Code bridge
```

The `activate` shortcut accepts any combination of `ctrl`, `alt`, `shift`, `meta`/`cmd`, and a key. Default is `ctrl+alt+z`.

## Optional: `data-style` attribute

Tag elements with `data-style="keyName"` to surface the style-object key in the inspector and the copied output:

```jsx
<h1 data-style="pageTitle">Welcome</h1>
```

## Uninstall

```bash
npm uninstall vite-plugin-specter
```

Then remove `specter()` from your `vite.config.ts` plugins array and delete the import line.

## Package info

- **GitHub:** https://github.com/setugk/vite-plugin-specter
- **npm:** https://www.npmjs.com/package/vite-plugin-specter
- **Author:** Setu Kathawate
- **License:** MIT
