'use client';

import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Bell, Gavel } from 'lucide-react';
import type { SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

export function CampusBulletin() {
  const { user, isUserLoading, isTokenReady } = useAuth();
  const { firestore } = useFirebase();

  // 1. Liaison Logic: Fetch official headlines from the SRC collection
  const bulletinQuery = useMemoFirebase(() => {
    // ✅ QUERY GUARD: Must wait for token readiness
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    return query(
      collection(firestore, 'src_posts'),
      where('campusId', '==', user.campusId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
  }, [firestore, user?.campusId, isTokenReady]);

  const { data: posts, isLoading } = useCollection<SrcPost>(bulletinQuery);
  const latest = posts?.[0];

  if (isLoading || isUserLoading) {
    return <div className="px-4 pt-4"><Skeleton className="h-20 w-full rounded-[2rem]" /></div>;
  }

  if (!latest) {
    return null; // Don't render anything if there's no bulletin from SRC
  }

  return (
    <div className="px-4 pt-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-[2.5rem] flex items-center gap-4 border border-blue-100 dark:border-blue-800 shadow-sm animate-in fade-in duration-700">
        <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none">
          <Gavel size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Official SRC Bulletin</p>
          <p className="font-bold truncate text-sm text-slate-900 dark:text-slate-100">
              {latest.title}
          </p>
        </div>
        <Button 
          size="sm"
          className="rounded-xl text-[10px] font-black uppercase bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 h-10 px-5"
        >
          Read Post
        </Button>
      </div>
    </div>
  );
}