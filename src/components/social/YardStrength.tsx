'use client';

import React from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { BarChart3, TrendingUp, ShieldCheck, Landmark } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

/**
 * YardStrength Component
 * 
 * Displays the National Productivity Index (The "Serious" board).
 * Contrasts with the fiery Arena using Emerald and Slate tones.
 * Located on the main Dashboard (/dashboard).
 */
export default function YardStrength() {
  const { firestore } = useFirebase();

  // 1. Fetch the monthly GDP scores from platform_stats
  const strengthDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'platform_stats', 'yard_strength');
  }, [firestore]);

  const { data: stats, isLoading } = useDoc(strengthDocRef);

  if (isLoading) {
    return (
      <div className="mx-4">
        <Skeleton className="h-64 w-full rounded-[3.5rem]" />
      </div>
    );
  }

  // 2. Process and sort campus scores, filtering out system fields
  const scores = stats?.scores || {};
  const sorted = Object.entries(scores)
    .filter(([id, points]) => {
        const isSystemField = ['lastUpdate', 'name', 'type', 'value', 'lastReset'].includes(id.toLowerCase());
        return typeof points === 'number' && !isSystemField;
    })
    .map(([id, points]: any) => ({ id: id.toUpperCase(), points }))
    .sort((a, b) => b.points - a.points);

  if (sorted.length === 0 && !isLoading) {
    return (
      <div className="mx-4 p-8 bg-white dark:bg-card rounded-[3.5rem] border border-slate-100 dark:border-border text-center">
        <Landmark className="mx-auto text-slate-200 mb-4" size={40} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Yard Strength is Warming Up...</p>
        <p className="text-[10px] text-slate-300 mt-2 italic">Monthly GDP rankings reset on the 1st.</p>
      </div>
    );
  }

  return (
    <div className="mx-4 p-8 bg-white dark:bg-card rounded-[3.5rem] border border-slate-100 dark:border-border shadow-sm relative overflow-hidden">
      {/* Visual Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-foreground flex items-center gap-2">
            <BarChart3 className="text-emerald-500" /> National Yard Strength
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly Productivity Index</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-2xl text-[10px] font-black uppercase border border-emerald-100 dark:border-emerald-900/50">
          Month: {new Date().toLocaleString('default', { month: 'long' })}
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-6">
        {sorted.slice(0, 5).map((campus, i) => (
          <div key={campus.id} className="relative">
            <div className="flex justify-between items-center mb-2 px-2">
               <div className="flex items-center gap-3">
                  <span className="font-black text-slate-300 italic">#{i+1}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{campus.id}</span>
               </div>
               <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                 {campus.points.toLocaleString()} PTS
               </span>
            </div>
            <div className="h-2 w-full bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800">
               <div 
                 className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                 style={{ width: `${(campus.points / (sorted[0]?.points || 1)) * 100}%` }}
               />
            </div>
          </div>
        ))}
      </div>

      {/* Footer Credentials */}
      <div className="mt-8 pt-8 border-t border-slate-50 dark:border-border flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-1"><TrendingUp size={12}/> Based on Productivity & Trade</div>
        <div className="flex items-center gap-1"><ShieldCheck size={12}/> Liaison Verified</div>
      </div>
    </div>
  );
}
