
'use client';

import React from 'react';
import { CoinShop } from '@/components/wallet/CoinShop';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, History, Zap, Sparkles } from 'lucide-react';

export default function WalletPage() {
  const { user, isUserLoading } = useAuth();

  if (isUserLoading || !user) {
    return (
      <div className="max-w-6xl mx-auto space-y-10 p-6">
        <Skeleton className="h-48 w-full rounded-[3.5rem]" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[3rem]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in slide-in-from-left-4 duration-700">
        <div>
          <h1 className="text-4xl font-black text-foreground flex items-center gap-3 tracking-tighter uppercase italic">
            <Wallet className="text-primary" /> Hub Wallet
          </h1>
          <p className="text-muted-foreground font-medium mt-1 italic">
            Your personal artillery for dominance in the Arena.
          </p>
        </div>
        
        <div className="flex gap-3">
            <div className="bg-amber-100 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
                <Zap className="text-amber-500 animate-pulse" size={18} fill="currentColor" />
                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Artillery Ready</span>
            </div>
        </div>
      </header>

      <CoinShop />

      {/* Transaction History Placeholder */}
      <section className="animate-in fade-in duration-1000">
        <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
                <History size={20} />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Recent Vibrations</h3>
        </div>
        
        <div className="bg-white dark:bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800 p-20 text-center flex flex-col items-center">
            <Sparkles className="text-slate-200 dark:text-slate-800 mb-4" size={64} />
            <p className="font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-xs">No transactions logged</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-700 mt-2 italic">Refill your Hub Coins to start participating in Arena monetization.</p>
        </div>
      </section>
    </div>
  );
}
