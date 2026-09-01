import type { Plugin } from 'vite';
import { getClientScript } from './client.js';

export { getClientScript };

export interface SpecterOptions {
  shortcuts?: {
    activate?: string;
  };
  /**
   * Enable the "Send to Claude" button in the Specs panel. Batches every Spec to a
   * local Specter MCP bridge (see `mcp-bridge/`) that Claude Code / Kiro pull from.
   * `true` uses the default bridge at http://127.0.0.1:8787; pass `{ url }` to override.
   */
  claudeBridge?: boolean | { url?: string };
}

export function specter(options: SpecterOptions = {}): Plugin {
  return {
    name: 'vite-plugin-specter',
    apply: 'serve',
    transformIndexHtml(html) {
      const script = getClientScript(options).replace(/<\/script>/gi, '<\\/script>');
      return html.replace('</body>', () => `<script>\n${script}\n</script>\n</body>`);
    },
  };
}
