import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Agent of Chaos | Fantasy Command Center',
  description: 'A private fantasy football draft and team management cockpit.',
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
  return <html lang="en"><body>{children}</body></html>;
}
