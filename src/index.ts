import type { Plugin } from 'vite';
import { getClientScript } from './client.js';

export interface InspektOptions {
  shortcuts?: {
    activate?: string;
  };
}

export function inspekt(options: InspektOptions = {}): Plugin {
  return {
    name: 'vite-plugin-inspekt',
    apply: 'serve',
    transformIndexHtml(html) {
      const script = getClientScript(options);
      return html.replace('</body>', `<script>\n${script}\n</script>\n</body>`);
    },
  };
}
