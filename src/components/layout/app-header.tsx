'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from './user-nav';
import { FlameKindling } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '../ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useCampusView } from '@/hooks/use-campus-view';
import { CampusSwitcher } from './campus-switcher';

export default function AppHeader() {
  const { isMobile } = useSidebar();
  const { user, campus, isAdmin } = useAuth();
  const { viewAsCampus } = useCampusView();

  // Determine the campus to display based on role and view-as state
  const displayCampus = isAdmin ? (viewAsCampus ?? { acronym: 'GAM' }) : campus;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-b-primary/20 bg-primary px-4 text-primary-foreground md:px-6">
      <div className={cn('flex items-center gap-2', !isMobile && 'md:hidden')}>
        <SidebarTrigger />
        <FlameKindling className="h-6 w-6" />
        <span className="font-headline text-lg font-semibold">{displayCampus?.acronym ?? 'GAM'}</span>
      </div>

      <div className="hidden flex-1 items-center gap-4 md:flex">
        {/* Future search bar could go here */}
      </div>

      <div className="flex items-center justify-end gap-4">
        {isAdmin && <CampusSwitcher />}
        <UserNav />
      </div>
    </header>
  );
}
