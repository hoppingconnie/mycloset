'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Shirt, Palette, Database } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',            label: 'コーデ',   Icon: LayoutGrid },
  { href: '/clothes',     label: '服管理',   Icon: Shirt      },
  { href: '/color-rules', label: '色ルール', Icon: Palette    },
  { href: '/settings',    label: 'データ',   Icon: Database   },
] as const;

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-cream border-t border-border-w"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex-1 min-w-0 flex flex-col items-center justify-center py-2.5 gap-1',
                'transition-colors',
                active ? 'text-navy' : 'text-muted',
              ].join(' ')}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className={[
                'text-[9px] tracking-[0.08em] leading-tight',
                active ? 'font-medium' : 'font-normal',
              ].join(' ')}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
