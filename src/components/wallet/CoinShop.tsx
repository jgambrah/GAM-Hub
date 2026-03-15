
'use client';

/**
 * @fileOverview Hub Coin Shop Component.
 * Implements Step 1 of Arena Monetization using GHS currency and Paystack.
 * Now synchronized with the National Ledger.
 */

import React, { useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { doc } from 'firebase/firestore';
import { usePaystackPayment } from 'react-paystack';
import { 
    Zap, ShoppingCart, Loader2, Coins, 
    ShieldCheck, Star, Crown, Gift 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { HubWallet } from '@/lib/types';
import { addCoins } from '@/lib/monetization';

const COIN_PACKAGES = [
  { id: 'starter', label: 'Starter Kit', coins: 50, priceGHS: 5, icon: Zap, color: 'from-blue-500 to-indigo-600' },
  { id: 'vibe', label: 'Vibe Pack', coins: 250, priceGHS: 20, icon: Star, color: 'from-indigo-600 to-purple-600', savings: 'GHS 5 OFF' },
  { id: 'war', label: 'War Chest', coins: 1000, priceGHS: 75, icon: Crown, color: 'from-purple-600 to-red-600', savings: 'GHS 25 OFF', bestValue: true },
  { id: 'vault', label: 'Legend Vault', coins: 5000, priceGHS: 300, icon: Gift, color: 'from-red-600 to-amber-500', savings: 'GHS 200 OFF' },
];

export function CoinShop() {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const walletRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'wallets', user.id);
  }, [firestore, user?.id]);

  const { data: wallet, isLoading: isLoadingWallet } = useDoc<HubWallet>(walletRef);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Wallet Balance Header */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border-4 border-slate-800">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
          <Coins size={200} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-2">Available Artillery</p>
            <div className="flex items-center gap-4 justify-center md:justify-start">
                <h2 className="text-7xl font-black italic tracking-tighter tabular-nums">
                    {isLoadingWallet ? '...' : (wallet?.coins || 0).toLocaleString()}
                </h2>
                <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                    <Zap size={32} fill="currentColor" />
                </div>
            </div>
            <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-widest">Hub Coins Active</p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2.5rem] text-center md:text-right">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">National Standing</p>
             <div className="flex items-center gap-2 justify-center md:justify-end text-emerald-400">
                <ShieldCheck size={16} />
                <span className="font-black text-sm uppercase">Verified Payer</span>
             </div>
             <p className="text-[9px] text-slate-500 mt-4 italic">"Wealth in the Yard is power in the Arena."</p>
          </div>
        </div>
      </div>

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {COIN_PACKAGES.map((pkg) => (
          <CoinPackageCard 
            key={pkg.id} 
            pkg={pkg} 
            user={user} 
            firestore={firestore} 
            isProcessing={isProcessing === pkg.id}
            onStart={() => setIsProcessing(pkg.id)}
            onEnd={() => setIsProcessing(null)}
          />
        ))}
      </div>
    </div>
  );
}

function CoinPackageCard({ pkg, user, firestore, isProcessing, onStart, onEnd }: any) {
    const { toast } = useToast();
    
    const config = {
        reference: `COIN_${user?.id}_${Date.now()}`,
        email: user?.email || '',
        amount: pkg.priceGHS * 100,
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
    };

    const initializePayment = usePaystackPayment(config);

    const handleSuccess = async (ref: any) => {
        if (!firestore || !user?.id) return;
        
        try {
            // 🚀 LIAISON PROTOCOL: Standardized Coin Handshake with History
            await addCoins(firestore, user.id, pkg.coins, pkg.priceGHS);

            toast({
                title: "Refill Successful!",
                description: `${pkg.coins} Hub Coins added to your artillery. ⚡`,
            });
        } catch (e) {
            console.error("Coin Refill Failed:", e);
            toast({ variant: 'destructive', title: 'Refill Failed', description: 'Could not update your balance.' });
        } finally {
            onEnd();
        }
    };

    return (
        <div className={cn(
            "group relative bg-card rounded-[3rem] p-8 border-4 transition-all hover:scale-[1.02] active:scale-95 shadow-xl flex flex-col justify-between overflow-hidden",
            pkg.bestValue ? "border-amber-500 scale-105 z-10" : "border-slate-100 dark:border-slate-800"
        )}>
            {pkg.bestValue && (
                <div className="absolute top-0 right-0 p-4">
                    <div className="bg-amber-500 text-slate-950 px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg">BEST VALUE</div>
                </div>
            )}

            <div>
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl bg-gradient-to-br text-white", pkg.color)}>
                    <pkg.icon size={32} fill="currentColor" />
                </div>
                <h3 className="text-xl font-black text-foreground mb-1">{pkg.label}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-primary tabular-nums">{pkg.coins}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Coins</span>
                </div>
                {pkg.savings && (
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg w-fit">
                        {pkg.savings}
                    </p>
                )}
            </div>

            <div className="mt-8 pt-8 border-t border-dashed border-border">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Price: GHS {pkg.priceGHS.toFixed(2)}</p>
                <Button 
                    onClick={() => {
                        onStart();
                        initializePayment({
                            onSuccess: handleSuccess,
                            onClose: onEnd
                        });
                    }}
                    disabled={isProcessing}
                    className={cn(
                        "w-full py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all",
                        pkg.bestValue ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "bg-slate-900 text-white"
                    )}
                >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><ShoppingCart size={16} className="mr-2" /> Buy Pack</>}
                </Button>
            </div>
        </div>
    );
}
