import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import BottomNav from './NavBar';
import MigrationRunner from './MigrationRunner';

const notoSansJP = Noto_Sans_JP({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'My Closet',
  description: '服の管理とコーディネート提案',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJP.className}>
      <body className="min-h-screen bg-ivory">
        <MigrationRunner />
        {/* 上部ヘッダー */}
        <header
          className="sticky top-0 z-50 bg-cream border-b border-border-w"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="h-12 flex items-center px-5 max-w-2xl mx-auto">
            <span className="text-sm font-medium tracking-[0.18em] text-navy">MY CLOSET</span>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="max-w-2xl mx-auto px-4 py-5 pb-28">
          {children}
        </main>

        {/* ボトムナビ */}
        <BottomNav />
      </body>
    </html>
  );
}
