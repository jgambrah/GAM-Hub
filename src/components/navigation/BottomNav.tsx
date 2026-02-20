'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Flame, MessageSquare, Globe } from 'lucide-react';
import { useView } from '@/context/ViewContext';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const pathname = usePathname();
  const { viewMode } = useView();

  // Hide bottom nav if we are in Admin mode or on a page with its own layout
  if (viewMode === 'admin' || pathname.startsWith('/chat')) {
    return null;
  }

  const navItems = [
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'Arena', icon: Flame, path: '/arena' },
    { name: 'Market', icon: ShoppingBag, path: '/products' },
    { name: 'Explore', icon: Globe, path: '/explore' },
    { name: 'Chats', icon: MessageSquare, path: '/chat' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border px-6 py-3 flex justify-between items-center z-[5000] md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));

        return (
          <Link key={item.name} href={item.path} className="flex flex-col items-center gap-1">
            <div className={cn('p-2 rounded-xl transition-all', isActive ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground')}>
              <Icon size={20} />
            </div>
            <span className={cn('text-[10px] font-bold', isActive ? 'text-primary' : 'text-muted-foreground')}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
