#!/usr/bin/env node
// Specter → Claude MCP bridge.
//
// One tiny process that does two things at once:
//   1. Runs an HTTP listener on 127.0.0.1 that Specter auto-syncs its Specs to
//      (a fresh snapshot per page URL, replacing the previous one — it mirrors
//      whatever is currently in the browser panel).
//   2. Speaks the MCP protocol over stdio so Claude Code / Kiro can pull those
//      Specs with the `pop_specs` tool — no copy-paste, no button.
//
// Zero dependencies. stdout is reserved for MCP messages; all logs go to stderr.

import http from 'node:http';
import readline from 'node:readline';

const PORT = Number(process.env.SPECTER_BRIDGE_PORT) || 8787;
// url -> { url, receivedAt, text, specs[] }. Auto-sync REPLACES a url's snapshot,
// so the bridge always reflects the browser's current Specs (empty sync clears it).
let snapshots = {};

function log(...a) { console.error('[specter-bridge]', ...a); } // NEVER stdout
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function all() { return Object.values(snapshots); }
function specCount() { return all().reduce((n, s) => n + s.specs.length, 0); }

// ─── HTTP listener (Specter auto-syncs here) ──────────────────────────────────
const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sources: all().length, specs: specCount() }));
    return;
  }
  // Plain-HTTP read of the staged Specs (peek). Lets any tool — curl, /spectify,
  // a Kiro extension — read the batch without speaking MCP. ?clear=1 consumes.
  if (req.method === 'GET' && (req.url === '/pending' || req.url.startsWith('/pending?'))) {
    // Lean payload for /spectify: each spec's `body` already carries the note-less
    // properties + the greppable `find:` anchor, so drop the batch-level `text`
    // (a full duplicate of every body) to avoid shipping the same data twice.
    const batches = all().map((b) => ({ url: b.url, receivedAt: b.receivedAt, specs: b.specs }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, batches }));
    if (req.url.indexOf('clear=1') >= 0) { log(`GET ${req.url} → returned + cleared`); snapshots = {}; }
    return;
  }
  if (req.method === 'POST' && req.url === '/specs') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const url = data.url || 'default';
        const specs = Array.isArray(data.specs) ? data.specs : [];
        if (specs.length) snapshots[url] = { url, receivedAt: new Date().toISOString(), text: String(data.text || ''), specs };
        else delete snapshots[url]; // empty sync = the page has no Specs anymore
        log(`sync from ${url}: ${specs.length} Spec(s) (${specCount()} total across ${all().length} source(s))`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, specs: specCount() }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'bad json' }));
      }
    });
    return;
  }
  res.writeHead(404); res.end();
});
httpServer.on('error', (e) => {
  if (e.code === 'EADDRINUSE') log(`port ${PORT} already in use — another bridge owns the HTTP listener; MCP still served over stdio.`);
  else log('HTTP error:', e.message);
});
httpServer.listen(PORT, '127.0.0.1', () => log(`HTTP listening on http://127.0.0.1:${PORT}  (POST /specs, GET /pending, GET /health)`));

// ─── MCP over stdio (newline-delimited JSON-RPC 2.0) ──────────────────────────
const TOOLS = [
  {
    name: 'pop_specs',
    description: 'Return ALL Specter annotations currently synced from the browser (each with its note, element selector, and captured properties), then clear them. Call this when the user says to apply their Specter notes / Specs / annotations.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'peek_specs',
    description: 'Return the currently synced Specter annotations WITHOUT clearing them (preview).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'clear_specs',
    description: 'Discard the currently synced Specter annotations.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function renderPending() {
  const batches = all();
  if (!batches.length) return 'No Specter annotations are synced. In the browser: activate Specter (Ctrl+Option+Z) and drop some Specs — they auto-sync here. Then run /spectify.';
  return batches.map((b) => {
    const head = `# Specter — ${b.specs.length} Spec(s)${b.url && b.url !== 'default' ? ' from ' + b.url : ''}`;
    return head + '\n\n' + (b.text || b.specs.map((s, i) => `#${s.num ?? i + 1} ${s.note || '(no note)'}\n${s.body || ''}`).join('\n\n'));
  }).join('\n\n' + '─'.repeat(40) + '\n\n');
}

function handle(msg) {
  const { id, method, params } = msg;
  const hasId = id !== undefined && id !== null;

  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: {
      protocolVersion: (params && params.protocolVersion) || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'specter-bridge', version: '0.1.0' },
    } });
    return;
  }
  if (method && method.startsWith('notifications/')) return; // no response
  if (method === 'ping') { if (hasId) send({ jsonrpc: '2.0', id, result: {} }); return; }
  if (method === 'tools/list') { send({ jsonrpc: '2.0', id, result: { tools: TOOLS } }); return; }
  if (method === 'tools/call') {
    const name = params && params.name;
    if (name === 'pop_specs' || name === 'peek_specs') {
      const text = renderPending();
      if (name === 'pop_specs') { log(`pop_specs → returned + cleared ${specCount()} Spec(s)`); snapshots = {}; }
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
      return;
    }
    if (name === 'clear_specs') {
      const n = specCount(); snapshots = {};
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Cleared ${n} synced Spec(s).` }] } });
      return;
    }
    send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool: ' + name } });
    return;
  }
  if (hasId) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  try { handle(msg); } catch (e) { log('handler error:', e.message); }
});
rl.on('close', () => { httpServer.close(); process.exit(0); });

log('MCP stdio ready — waiting for Claude to connect');
