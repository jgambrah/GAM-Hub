
'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { HallOfFameEntry, Campus } from '@/lib/types';
import { Trophy, History, Crown, Medal } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

export default function HallOfFame() {
  const { firestore } = useFirebase();

  // 1. Fetch past weekly kings
  const hofQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'hall_of_fame'),
      orderBy('weekEnding', 'desc'),
      limit(10)
    );
  }, [firestore]);

  const { data: entries, isLoading } = useCollection<HallOfFameEntry>(hofQuery);

  // 2. Fetch all campuses to resolve acronyms
  const campusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'campuses');
  }, [firestore]);
  const { data: allCampuses } = useCollection<Campus>(campusesQuery);

  if (isLoading) return (
    <div className="mx-4 mb-12 p-8 bg-slate-50 dark:bg-slate-900/30 rounded-[3rem] border-2 border-dashed">
        <div className="flex gap-4">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
    </div>
  );

  if (!entries || entries.length === 0) return null;

  return (
    <div className="mx-4 mb-12 p-8 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-2xl">
          <History size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">The Archives</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Past Kings of the Yard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry, i) => {
          const campus = allCampuses?.find(c => c.id === entry.campusId);
          const date = entry.weekEnding?.toDate ? entry.weekEnding.toDate() : new Date(entry.weekEnding);
          
          return (
            <div key={entry.id} className="p-5 bg-white dark:bg-card border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-xl", i === 0 ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>
                    {i === 0 ? <Crown size={16} /> : <Medal size={16} />}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {format(date, 'MMM do')}
                  </span>
                </div>
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full uppercase">
                  Winner
                </span>
              </div>
              
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {campus?.acronym || entry.campusId.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {entry.totalBurns.toLocaleString()} Total Burns
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
