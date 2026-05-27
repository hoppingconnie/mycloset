'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',            label: 'コーデ提案', icon: '👗' },
  { href: '/clothes',     label: '服の管理',   icon: '🧺' },
  { href: '/color-rules', label: '色ルール',   icon: '🎨' },
] as const;

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5',
                'text-xs font-medium transition-colors',
                active ? 'text-rose-600' : 'text-slate-400',
              ].join(' ')}
            >
              <span className="text-2xl leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
