import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Harmony — Free music for everyone', template: '%s · Harmony' },
  description:
    'Stream a growing library of legally distributable music: royalty-free, public domain, Creative Commons, and artist-uploaded tracks.',
  openGraph: { title: 'Harmony', siteName: 'Harmony', type: 'website' },
  twitter: { card: 'summary_large_image' },
  applicationName: 'Harmony',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Harmony' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
