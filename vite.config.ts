import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';
export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Goozemon', short_name: 'Goozemon',
      description: 'Scan Pokémon cards and explore their market value.',
      theme_color: '#152c26', background_color: '#f5f4ee', display: 'standalone',
      id: base, start_url: base, scope: base,
      icons: [192, 512].map(size => ({ src: `icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2,woff}'],
      globIgnores: ['ocr/**'],
      navigateFallback: 'index.html',
      runtimeCaching: [{
        urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.includes('/ocr/'),
        handler: 'CacheFirst', options: { cacheName: 'goozemon-ocr-v1', expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 } },
      }],
    },
  })],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
