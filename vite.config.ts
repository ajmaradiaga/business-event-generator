import { defineConfig } from 'vitest/config';

export default defineConfig({
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
