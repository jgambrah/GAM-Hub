
'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Megaphone, TrendingUp, ShoppingBag, ArrowRight, Zap, Loader2 } from 'lucide-react';
import type { DemandSignal } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * DemandFeed Component
 * 
 * Part of the Supply-Demand Engine.
 * Shows vendors exactly what students on their campus are looking for.
 */
export default function DemandFeed({ campusId }: { campusId: string }) {
  const { firestore } = useFirebase();

  const demandQuery = useMemoFirebase(() => {
    if (!firestore || !campusId) return null;
    return query(
      collection(firestore, "demand_signals"),
      where("campusId", "==", campusId),
      orderBy("demandCount", "desc"),
      limit(10)
    );
  }, [firestore, campusId]);

  const { data: signals, isLoading } = useCollection<DemandSignal>(demandQuery);

  return (
    <div className="bg-white dark:bg-card rounded-[3rem] border border-slate-100 dark:border-border shadow-xl overflow-hidden">
      <div className="p-8 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-foreground">Campus Demand Intel</h3>
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Live Sourcing Signals</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border flex items-center gap-2">
           <Zap size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Real-time</span>
        </div>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-border">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : signals && signals.length > 0 ? (
          signals.map((signal, index) => (
            <div key={signal.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-muted/30 transition-all group">
              <div className="flex items-center gap-6">
                <span className="text-2xl font-black text-slate-200 dark:text-slate-800 italic group-hover:text-blue-200 transition-colors">
                  0{index + 1}
                </span>
                <div>
                  <h4 className="font-black text-lg text-slate-900 dark:text-foreground uppercase tracking-tight">
                    {signal.item}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest">
                      {signal.category || 'General'}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold">Updated {new Date(signal.lastUpdated?.toDate?.() || signal.lastUpdated).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-600 tabular-nums">{signal.demandCount}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Requests</p>
                </div>
                <button className="p-3 bg-slate-900 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95">
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-20 text-center flex flex-col items-center opacity-30">
            <Megaphone size={64} className="mb-4" />
            <p className="font-black uppercase tracking-widest text-sm">Quiet Hub</p>
            <p className="text-xs mt-2 italic font-medium">No demand signals logged for this campus yet.</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-50 dark:bg-muted/20 border-t flex justify-center">
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Powered by Liaison Supply-Demand Engine</p>
      </div>
    </div>
  );
}
