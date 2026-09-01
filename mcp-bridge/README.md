# Specter → Claude MCP bridge

A tiny, zero-dependency local process so a whole batch of Specter annotations reaches
Claude Code (or Kiro) with no copy-paste. It:

1. Listens on `http://127.0.0.1:8787` — Specter **auto-syncs** its current Specs here
   as you annotate (a fresh snapshot per page; the panel's dot shows ● synced / ○ offline).
2. Serves the **MCP** protocol over stdio, exposing tools Claude pulls from.

```
Specter panel  ──auto-sync POST──▶  bridge (this process)  ──MCP──▶  Claude Code / Kiro
 (green ● dot)                       mirrors your Specs                pop_specs
```

## 1. Turn on auto-sync in Specter

In your `vite.config.*`:

```js
import { specter } from 'vite-plugin-specter';
export default { plugins: [specter({ claudeBridge: true })] };
```

`claudeBridge: true` targets the default bridge (`http://127.0.0.1:8787`). Pass
`{ url: 'http://127.0.0.1:9000' }` to override (match `SPECTER_BRIDGE_PORT`).

## 2. Register the bridge with your agent

**Claude Code** (from your project root):

```bash
claude mcp add specter -- node /absolute/path/to/vite-plugin-specter/mcp-bridge/server.mjs
```

or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "specter": { "command": "node", "args": ["/absolute/path/to/mcp-bridge/server.mjs"] }
  }
}
```

**Kiro** — add the same `command`/`args` to its MCP config (`mcp.json`).

Claude Code launches the process for you (stdio); the HTTP listener comes up
alongside it. To run it standalone (e.g. to test), `npm start` in this folder.

## 3. Use it

1. Drop Specs in the browser — they auto-sync (watch the panel's green ● dot).
2. In the IDE, run **`/spectify`** (or tell Claude *"apply my Specter notes"*).
   Claude reads the synced batch and edits your code. The `/spectify` command lives at
   `~/.claude/commands/spectify.md`.

## Tools

| tool | what it does |
|------|--------------|
| `pop_specs`  | return all pending Specs as one batch, then clear the queue |
| `peek_specs` | return them without clearing |
| `clear_specs`| discard pending Specs |

## Notes & limits

- **Local only.** Binds `127.0.0.1`; nothing leaves your machine.
- **Pull, not push.** MCP is pull-based — auto-sync keeps the batch *staged*; running
  `/spectify` (or a prompt) is what makes Claude fetch it. There's no way to inject text
  into a live agent session unprompted.
- **One HTTP owner.** If several agent sessions each spawn the bridge, the first
  to bind `8787` owns the browser endpoint; the rest still serve MCP over stdio.
- `SPECTER_BRIDGE_PORT` overrides the port (keep it in sync with `claudeBridge.url`).
