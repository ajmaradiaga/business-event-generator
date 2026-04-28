import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills(),
  ],
  base: process.env.VITE_BASE_URL ?? '/business-event-generator/',
  optimizeDeps: {
    include: ['solclientjs', 'rhea'],
  },
  define: {
    'process.env': '{}',
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
