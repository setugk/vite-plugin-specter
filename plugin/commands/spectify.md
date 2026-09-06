---
description: Pull the Specter annotations staged from the browser and implement them
argument-hint: "[url or port substring — only needed if multiple projects are synced]"
allowed-tools: Bash(curl:*)
---

The user's Specter annotations auto-sync from the browser to a local bridge. Below is
the current synced set, read live from that bridge (a peek — it is not cleared, so the
browser panel stays the source of truth). If the user passed an argument (`$ARGUMENTS`),
it filters to batches whose page URL contains that substring — e.g. `/spectify 5173`:

!`curl -s --max-time 3 "http://127.0.0.1:8787/pending?url=$ARGUMENTS" || echo '{"ok":false,"offline":true}'`

Now act on it:

- **If `offline` is true** (curl failed): the Specter bridge isn't running. Tell the user
  to start it (`node <specter>/mcp-bridge/server.mjs`, or register it in `.mcp.json` so the
  IDE launches it) — then run `/spectify` again. Stop here.
- **If `batches` is empty**: nothing is synced. If the user passed an argument, note that no
  synced project matched `$ARGUMENTS` (check the filter). Otherwise tell them to activate
  Specter (Ctrl+Option+Z) and drop some Specs (they auto-sync — watch for the green "synced"
  dot in the panel) — then run `/spectify` again. Stop here.
- **If the batches span more than one distinct `url` AND the user passed no argument**: the
  bridge is serving multiple projects and it's ambiguous which one to apply. Do **not** guess
  or implement across all of them. List the distinct URLs with each one's Spec count and ask
  the user to re-run scoped, e.g. `/spectify 5173`. Stop here. (Skip this check when a filter
  was given, or when every batch shares one origin.)
- **Otherwise**, for each Spec in each batch:
  1. `note` is the change to make.
  2. The Spec's `body` has a `find:` line — the best anchor for locating the element in
     source: a `[data-testid=…]` / `#id` / `.class` selector, an `aria-label "…"`, or
     `text "…"`. Grep for that anchor to jump straight to the code (don't broad-search).
  3. Implement the change in the source.

Work through them in order. When done, summarize what you changed per Spec (`#n → file:line`),
and flag any Spec whose element you couldn't confidently locate rather than guessing. Then tell
the user to mark the applied Specs as **done (✓)** in the Specter panel — resolved Specs drop out
of the sync, so a later `/spectify` won't re-apply what's already shipped.
