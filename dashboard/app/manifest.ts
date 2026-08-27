import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agent of Chaos Fantasy Command Center',
    short_name: 'Agent of Chaos',
    description: 'A private fantasy football draft and team management cockpit.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070b12',
    theme_color: '#c7f04b',
    orientation: 'portrait-primary',
    icons: [
      { src: '/agent-of-chaos-family.webp', sizes: 'any', type: 'image/webp', purpose: 'maskable' },
      { src: '/agent-of-chaos-friends.webp', sizes: 'any', type: 'image/webp', purpose: 'any' },
    ],
  };
}
