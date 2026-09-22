import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build        → אפליקציה מלאה (PWA) לפריסה ב-Firebase Hosting
// npm run build:demo   → קובץ HTML יחיד במצב הדגמה
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'demo'
      ? viteSingleFile()
      : VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg'],
          manifest: {
            name: 'ניהול דוכנים',
            short_name: 'דוכנים',
            lang: 'he',
            dir: 'rtl',
            start_url: '/',
            display: 'standalone',
            background_color: '#f6f5f1',
            theme_color: '#1f6f55',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
        }),
  ],
  build: { target: 'es2022', outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  test: { environment: 'node' },
}));
