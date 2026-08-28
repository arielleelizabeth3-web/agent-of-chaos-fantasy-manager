import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agent of Chaos Fantasy Command Center',
    short_name: 'Agent of Chaos',
    description: 'A private fantasy football draft and team management cockpit.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#070b12',
    theme_color: '#c7f04b',
    orientation: 'portrait-primary',
    icons: [
      { src: '/app-icon-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-v2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
