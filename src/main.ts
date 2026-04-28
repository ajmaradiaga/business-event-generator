import { loadConfig } from './config/ConfigLoader.js';
import { App } from './ui/App.js';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app element not found');

  const config = await loadConfig(import.meta.env.BASE_URL.replace(/\/$/, ''));
  new App(container, config);
}

bootstrap().catch(err => {
  const container = document.getElementById('app');
  if (container) {
    container.innerHTML = `<p style="color: #bb0000; padding: 2rem;">Failed to initialize: ${String(err)}</p>`;
  }
});
