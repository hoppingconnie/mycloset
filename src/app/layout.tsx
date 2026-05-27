import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from './NavBar';

export const metadata: Metadata = {
  title: 'マイクローゼット',
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
    <html lang="ja">
      <body className="min-h-screen bg-slate-50">
        {/* 上部タイトルバー */}
        <header
          className="sticky top-0 z-50 bg-white border-b border-slate-200"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="h-12 flex items-center px-4 max-w-2xl mx-auto">
            <span className="font-bold text-slate-800">👗 マイクローゼット</span>
          </div>
        </header>

        {/* メインコンテンツ — ボトムナビ分 pb-24 で隠れないようにする */}
        <main className="max-w-2xl mx-auto px-4 py-5 pb-28">
          {children}
        </main>

        {/* ボトムナビ */}
        <BottomNav />
      </body>
    </html>
  );
}
