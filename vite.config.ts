import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Variables lues au build (voir .env.example et .github/workflows/deploy.yml) :
 * - VITE_BASE    : '/' en local, '/Habikit/' (prod) ou '/Habikit/dev/' (dev) sur GitHub Pages.
 * - VITE_APP_ENV : 'local' | 'dev' | 'prod'. En dev, la PWA s'appelle « Habikit DEV » pour
 *                  pouvoir installer les deux côte à côte sur l'écran d'accueil.
 */
export default defineConfig(({ mode }) => {
  // loadEnv fusionne .env.* et les variables déjà présentes dans l'environnement (CI).
  const env = loadEnv(mode, '.', 'VITE_');
  const base = env.VITE_BASE ?? '/';
  const appEnv = env.VITE_APP_ENV ?? 'local';
  const isDev = appEnv === 'dev';
  const name = isDev ? 'Habikit DEV' : 'Habikit';
  const themeColor = isDev ? '#3b2a06' : '#0b0b0c';
  const escaped = base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name,
          short_name: name,
          description: 'Suivi d’habitudes : grille, compteurs, objectifs.',
          lang: 'fr',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#0b0b0c',
          theme_color: themeColor,
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // Le service worker prod (scope /Habikit/) ne doit pas servir son index.html
          // à la place de /Habikit/dev/ : les deux apps cohabitent sur le même site Pages.
          navigateFallbackDenylist: [new RegExp(`^${escaped}dev/`)],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173, host: true },
  };
});
