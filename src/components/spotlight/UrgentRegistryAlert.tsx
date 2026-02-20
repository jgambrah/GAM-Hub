'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { RegistryPost } from '@/lib/types';
import { ShieldAlert, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * UrgentRegistryAlert Component
 * 
 * Monitors the /registry_posts collection for high-priority directives.
 * Access restricted to management role only.
 */
export default function UrgentRegistryAlert() {
  const { user, isTokenReady } = useAuth();
  const { firestore } = useFirebase();

  // LIAISON RESTRICTION: Only management can see urgent registry alerts now
  const isAuthorized = React.useMemo(() => {
    return user?.role === 'management';
  }, [user]);

  // Querying the registry_posts path for urgent alerts
  const urgentQuery = useMemoFirebase(() => {
    // ✅ QUERY GUARD: Must wait for token refresh (isTokenReady) AND authorization
    if (!firestore || !user?.campusId || !isTokenReady || !isAuthorized) return null;
    return query(
      collection(firestore, 'registry_posts'),
      where('campusId', '==', user.campusId),
      where('isUrgent', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
  }, [firestore, user?.campusId, isTokenReady, isAuthorized]);

  const { data: alerts, isLoading } = useCollection<RegistryPost>(urgentQuery);
  const latestAlert = alerts?.[0];

  if (isLoading && isAuthorized) {
    return (
      <div className="px-4 mt-4">
        <Skeleton className="h-16 w-full rounded-3xl" />
      </div>
    );
  }

  if (!latestAlert || !isAuthorized) return null;

  return (
    <div className="px-4 mt-4 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-red-600 text-white p-4 rounded-[2rem] flex items-center justify-between gap-4 shadow-xl shadow-red-500/20 border-2 border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
            <ShieldAlert size={20} className="animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Registry Urgent Notice</p>
            <h4 className="text-sm font-black truncate max-w-[200px] sm:max-w-md">{latestAlert.title}</h4>
          </div>
        </div>
        <Link href="/registry">
          <Button size="sm" className="bg-white text-red-600 hover:bg-slate-100 rounded-xl font-black text-[10px] uppercase h-10 px-5 shadow-lg shadow-red-900/20">
            Open Alert <ChevronRight size={14} className="ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}