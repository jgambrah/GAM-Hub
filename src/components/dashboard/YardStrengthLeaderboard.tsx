'use client';

import React from 'react';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Landmark, TrendingUp, Sparkles, Building2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import type { Campus } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function YardStrengthLeaderboard() {
  const { firestore } = useFirebase();

  // 1. Fetch the GDP scores
  const strengthDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'platform_stats', 'yard_strength');
  }, [firestore]);
  
  const { data: rankings, isLoading: isLoadingStats } = useDoc(strengthDocRef);

  // 2. Fetch campuses to resolve names
  const campusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'campuses');
  }, [firestore]);
  const { data: allCampuses, isLoading: isLoadingCampuses } = useCollection<Campus>(campusesQuery);

  if (isLoadingStats || isLoadingCampuses) {
    return (
      <div className="mx-4 mb-8">
        <Skeleton className="h-48 w-full rounded-[2.5rem]" />
      </div>
    );
  }

  const scores = rankings?.scores || {};
  const sortedStats = Object.entries(scores)
    .filter(([id, pts]) => typeof pts === 'number')
    .map(([id, pts]: any) => {
        const campus = allCampuses?.find(c => c.id === id);
        return {
            id,
            acronym: campus?.acronym || id.toUpperCase(),
            points: pts,
            color: campus?.primaryColor || '#0f172a'
        };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const maxPoints = sortedStats[0]?.points || 1;

  if (sortedStats.length === 0) return null;

  return (
    <div className="mx-4 mb-10 bg-slate-100 dark:bg-slate-900/50 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-inner relative overflow-hidden">
      {/* Background Graphic */}
      <div className="absolute right-0 top-0 p-8 opacity-5">
        <Building2 size={150} />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <TrendingUp size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">National Productivity Index</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Yard Strength</h2>
          </div>
          <div className="bg-white dark:bg-card px-4 py-2 rounded-2xl shadow-sm border flex items-center gap-2">
             <Landmark size={16} className="text-blue-600" />
             <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Monthly GDP</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {sortedStats.map((item, i) => (
            <div key={item.id} className="space-y-2 group">
              <div className="flex justify-between items-end px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400">#{i + 1}</span>
                  <span className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-tighter">{item.acronym}</span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{item.points.toLocaleString()} PTS</span>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-100 dark:border-slate-900">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                  style={{ width: `${(item.points / maxPoints) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
             <Sparkles size={12} /> Points: Trade (1/GHS) • Unity (5/Link) • Groups (15/Launch)
           </p>
           <p className="text-[9px] text-blue-500 font-black italic">Next reset: 1st of the month</p>
        </div>
      </div>
    </div>
  );
}
