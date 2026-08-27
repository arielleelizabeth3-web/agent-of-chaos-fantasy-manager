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
  icons: { icon: '/agent-of-chaos-family.webp' },
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
  return <html lang="en"><body>{children}<PwaRegister /></body></html>;
}
