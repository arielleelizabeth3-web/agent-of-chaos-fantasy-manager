import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from './pwa-register';

export const viewport: Viewport = { themeColor: '#070b12', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  metadataBase: new URL('https://agent-of-chaos-fantasy-manager.arielle-elizabeth3.chatgpt.site'),
  title: 'Agent of Chaos | Fantasy Command Center',
  description: 'A private fantasy football draft and team management cockpit.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Agent of Chaos' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/app-icon-v2-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon-v2.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Agent of Chaos | Fantasy Command Center',
    description: 'A private fantasy football draft and team management cockpit.',
    images: [{ url: '/og.webp', width: 1000, height: 523, alt: 'Agent of Chaos Fantasy Command Center' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent of Chaos | Fantasy Command Center',
    description: 'A private fantasy football draft and team management cockpit.',
    images: ['/og.webp'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-v2.png?v=2" /><link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png?v=2" /></head><body>{children}<PwaRegister /></body></html>;
}
