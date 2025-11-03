import Script from 'next/script';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yamago - 山手線リアル鬼ごっこ',
  description: '山手線内で行うリアル鬼ごっこイベント用PWAアプリ',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Yamago',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#22B59B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Yamago" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Initialize theme before React renders to avoid FOUC */}
        <Script id="yamago-theme-init" strategy="beforeInteractive">{`
          try {
            const persisted = localStorage.getItem('yamago:theme') || 'light';
            document.documentElement.dataset.theme = persisted;
          } catch (_) {
            document.documentElement.dataset.theme = 'light';
          }
        `}</Script>
      </head>
      <body className="bg-app min-h-screen">
        <Script src="/yamago-logger.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
