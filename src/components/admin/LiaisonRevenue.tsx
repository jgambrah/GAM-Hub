'use client';

import React from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Banknote, TrendingUp, Coins, Calendar } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export default function LiaisonRevenue() {
  const { firestore } = useFirebase();
  
  const revenueDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'platform_stats', 'revenue');
  }, [firestore]);
  
  const { data: revenue, isLoading } = useDoc(revenueDocRef);

  if (isLoading) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-44 rounded-[2.5rem]" />
            <Skeleton className="h-44 rounded-[2.5rem]" />
        </div>
    )
  };

  const totalEarnings = revenue?.total_fees_collected || 0;
  const totalVolume = revenue?.total_volume || 0;
  const lastUpdated = revenue?.last_updated?.toDate ? revenue.last_updated.toDate().toLocaleString() : 'N/A';


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* CARD 1: LIAISON COMMISSION */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Banknote size={100} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Coins size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Platform Earnings (2%)</span>
          </div>
          <h2 className="text-5xl font-black">GHS {totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <p className="text-xs text-slate-400 mt-4 flex items-center gap-2">
            <Calendar size={12} /> Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* CARD 2: TOTAL MARKET VOLUME */}
      <div className="bg-white dark:bg-card p-8 rounded-[2.5rem] border border-slate-100 dark:border-card shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <TrendingUp size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Gross Trade Volume</span>
        </div>
        <h2 className="text-4xl font-black text-slate-800 dark:text-foreground">GHS {totalVolume.toLocaleString()}</h2>
        <div className="mt-6 flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl w-fit">
           <span className="text-[10px] font-black uppercase">Market is Healthy</span>
        </div>
      </div>

    </div>
  );
}
