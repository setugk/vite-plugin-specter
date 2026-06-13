import type { Plugin } from 'vite';
import { getClientScript } from './client.js';

export { getClientScript };

export interface SpecterOptions {
  shortcuts?: {
    activate?: string;
  };
}

export function specter(options: SpecterOptions = {}): Plugin {
  return {
    name: 'vite-plugin-specter',
    apply: 'serve',
    transformIndexHtml(html) {
      const script = getClientScript(options);
      return html.replace('</body>', `<script>\n${script}\n</script>\n</body>`);
    },
  };
}
