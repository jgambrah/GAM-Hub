
'use client';

import React from 'react';
import { CoinShop } from '@/components/wallet/CoinShop';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { WalletTransaction } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, History, Zap, Sparkles, ArrowUpRight, ArrowDownLeft, Gift, Swords } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function WalletPage() {
  const { user, isUserLoading } = useAuth();
  const { firestore } = useFirebase();

  // 1. Fetch Transaction History
  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return query(
      collection(firestore, 'wallet_transactions'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, user?.id]);

  const { data: transactions, isLoading: isLoadingHistory } = useCollection<WalletTransaction>(historyQuery);

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

  const getTransactionIcon = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'purchase': return <ArrowUpRight className="text-emerald-500" />;
      case 'gift_sent': return <Gift className="text-red-500" />;
      case 'gift_received': return <Gift className="text-emerald-500" />;
      case 'powerup_used': return <Zap className="text-amber-500" />;
      case 'tournament_entry': return <Swords className="text-blue-500" />;
      default: return <History className="text-slate-400" />;
    }
  };

  const getTransactionLabel = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'purchase': return 'Coin Refill';
      case 'gift_sent': return 'Sent Gift';
      case 'gift_received': return 'Received Gift';
      case 'powerup_used': return 'Arena Power-Up';
      case 'tournament_entry': return 'Tournament Entry';
      default: return 'Transaction';
    }
  };

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

      {/* COIN REFILL STATION */}
      <CoinShop />

      {/* TRANSACTION HISTORY LEDGER */}
      <section className="animate-in fade-in duration-1000">
        <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
                <History size={20} />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Recent Vibrations</h3>
        </div>
        
        <div className="bg-white dark:bg-slate-900/50 rounded-[3rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            {isLoadingHistory ? (
                <div className="p-10 space-y-4">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
            ) : transactions && transactions.length > 0 ? (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-muted rounded-2xl">
                                    {getTransactionIcon(tx.type)}
                                </div>
                                <div>
                                    <p className="font-black text-sm text-foreground uppercase tracking-tight">
                                        {getTransactionLabel(tx.type)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                        {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'PPP p') : 'Pending Sync'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={cn(
                                    "text-lg font-black tabular-nums",
                                    tx.type === 'purchase' || tx.type === 'gift_received' ? "text-emerald-500" : "text-red-500"
                                )}>
                                    {tx.type === 'purchase' || tx.type === 'gift_received' ? '+' : '-'}{tx.coins} 
                                    <span className="text-[10px] ml-1 uppercase">Coins</span>
                                </p>
                                {tx.amountPaidGHS && (
                                    <p className="text-[10px] font-black text-slate-400 uppercase">
                                        GHS {tx.amountPaidGHS.toFixed(2)}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-20 text-center flex flex-col items-center">
                    <Sparkles className="text-slate-200 dark:text-slate-800 mb-4" size={64} />
                    <p className="font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-xs">No transactions logged</p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-700 mt-2 italic">Refill your Hub Coins to start participating in Arena monetization.</p>
                </div>
            )}
        </div>
      </section>

      <div className="mt-12 flex justify-center opacity-30">
         <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Liaison National Ledger • GH 🇬🇭</p>
      </div>
    </div>
  );
}
