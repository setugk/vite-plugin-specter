# Specter

**Hover any element on your dev site. See its styles. Copy to AI.**

Specter is a Vite plugin that adds an element inspector overlay to your dev server. Toggle it on, hover any element to see its styles, component name, and spacing. Copy with one shortcut and paste into your AI assistant for one-shot edits. Specter is automatically stripped from production builds.

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

## How to use

### Toggle on/off

Press **Ctrl+Option+Z** to enter Specter mode. A small zap icon appears at the bottom-left. Press again (or Esc) to exit.

### Inspect an element

Once active, just **hover** any element. A tooltip shows:

- HTML tag + React/Vue component name + dimensions
- Text content (truncated)
- Font: family, weight, size, line-height
- Color (with hex) and background
- Padding, margin, border-radius (if non-zero)
- Display + gap + flex direction

### Copy to clipboard

Press **Cmd+C** while hovering. The element info is copied in an AI-optimized format. Paste it into Claude, Cursor, or any AI assistant and say what you want changed.

### Measure mode

Tap **Option** to switch to Measure mode. Hover any element to see distance measurements to its surrounding neighbors (like Figma's spacing view). Tap **Option** again to return to Properties mode.

### Pin an element

In Measure mode, press **M** while hovering to pin that element. Then hover any other element to measure the gap or inset between the two. Press **Cmd+C** to copy the measurement. Press **Esc** to clear the pin.

### Multi-select

Press **P** while hovering an element to pick it. Numbered badges appear on each picked element. Press **Cmd+C** to copy all selected elements at once. Press **Esc** to clear the selection.

### Annotate a change (skip the re-explaining)

Press **N** while hovering an element to attach a change note to it. A small field opens on the element — type what you want ("reduce width to 320", "tighten padding to 8px"), press **Enter** to save. The element is added to the selection and its badge shows a chip with your note. Annotate as many issues across the page as you like, then press **Cmd+C** once.

Each element's copied block now leads with your instruction:

```
[Specter 1/3]
✏️ CHANGE: reduce width to 320, tighten vertical padding
<button>.btn-primary Button 200×48
font: Inter 600 14/20
padding: 12px 20px
...
```

So when you paste into your AI assistant, it already knows both *what* to change and *which element* — no follow-up typing. Notes are ephemeral (cleared on **Esc** or when you toggle Specter off).

## Shortcut reference

| Action | Shortcut |
|--------|----------|
| Toggle Specter | **Ctrl+Option+Z** |
| Inspect element | Hover (while active) |
| Copy properties | **Cmd+C** |
| Switch to Measure mode | **Option** (tap) |
| Pin element for measuring | **M** (in Measure mode) |
| Pick element (multi-select) | **P** (in Properties mode) |
| Annotate a change | **N** (in Properties mode) |
| Clear pin / clear selection | **Esc** |
| Exit Specter | **Esc** (when nothing selected/pinned) |

## Workflow with AI assistants

1. Toggle Specter (Ctrl+Option+Z)
2. Hover the element you want to change
3. Either press **Cmd+C** to copy its properties, or press **N** to annotate the exact change you want first
4. Repeat **N** on every element you want to change, then **Cmd+C** once to copy them all
5. Paste into your AI assistant's chat — the instructions travel with the elements, so there's nothing left to explain

No more "which element?", no more "what's the current value?", and now no more re-typing the change. One paste gives your assistant everything it needs.

## Configuration

```ts
specter()                              // Default shortcuts
specter({ shortcuts: { activate: 'ctrl+shift+i' } }) // Custom activate shortcut
```

The `activate` shortcut accepts any combination of `ctrl`, `alt`, `shift`, `meta`/`cmd`, and a key. Default is `ctrl+alt+z`.

## Optional: `data-style` attribute

Tag elements with `data-style="keyName"` to show the style object key in the inspector:

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
