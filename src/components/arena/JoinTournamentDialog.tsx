
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Zap, Coins, Loader2, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { joinTournament } from '@/lib/monetization';
import type { ArenaTournament, HubWallet } from '@/lib/types';
import { cn } from '@/lib/utils';

interface JoinTournamentDialogProps {
  tournament: ArenaTournament;
  children: React.ReactNode;
}

export function JoinTournamentDialog({ tournament, children }: JoinTournamentDialogProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const walletRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'wallets', user.id);
  }, [firestore, user?.id]);
  const { data: wallet } = useDoc<HubWallet>(walletRef);

  const handleJoin = async () => {
    if (!firestore || !user) return;
    
    if ((wallet?.coins || 0) < tournament.entryFeeCoins) {
        toast({ variant: 'destructive', title: 'Insufficient Artillery', description: 'Refill your Hub Wallet to enter this tournament.' });
        return;
    }

    setIsJoining(true);
    try {
        await joinTournament(firestore, user.id, user.name || "Warrior", user.avatarUrl, tournament.id);
        toast({ 
            title: "Deployment Successful! ⚔️", 
            description: `You are officially enlisted in the ${tournament.name}. Prepare for battle!` 
        });
        setOpen(false);
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Enlistment Failed', description: err.message });
    } finally {
        setIsJoining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex-1" onClick={() => setOpen(true)}>{children}</div>
      <DialogContent className="rounded-[3rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-10 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
            <Trophy size={150} />
          </div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="p-4 bg-amber-500 text-slate-950 rounded-3xl shadow-lg">
              <Swords size={28} />
            </div>
            <div>
              <DialogTitle className="text-3xl font-black italic tracking-tighter uppercase">Join War</DialogTitle>
              <DialogDescription className="text-amber-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
                National Tournament Entry
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8 bg-background">
          <div className="space-y-2 text-center">
            <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">"{tournament.name}"</h4>
            <p className="text-sm text-muted-foreground font-medium italic leading-relaxed px-4">
                Structured elimination tournament. Winners of each round advance until a single Champion is crowned.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entry Fee</p>
                <div className="flex items-center justify-center gap-2">
                    <Coins size={18} className="text-amber-500" />
                    <span className="text-2xl font-black">{tournament.entryFeeCoins}</span>
                </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Your Coins</p>
                <div className="flex items-center justify-center gap-2">
                    <Zap size={18} className="text-blue-500" fill="currentColor" />
                    <span className={cn("text-2xl font-black", (wallet?.coins || 0) < tournament.entryFeeCoins ? "text-red-500" : "text-emerald-500")}>
                        {wallet?.coins || 0}
                    </span>
                </div>
            </div>
          </div>

          <div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-[2rem] border-2 border-dashed border-amber-200 dark:border-amber-800 flex items-start gap-4">
             <ShieldCheck className="text-amber-600 mt-1" size={20} />
             <div>
                <h5 className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest">Enlistment Protocol</h5>
                <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium italic mt-1">
                    Entry fees are non-refundable. Your contribution directly increases the national prize pool. Fight with honor.
                </p>
             </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-8 border-t flex-row gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold flex-1 h-14">Withdraw</Button>
            <Button 
                onClick={handleJoin} 
                disabled={isJoining} 
                className={cn(
                    "flex-[2] rounded-2xl font-black px-8 h-14 shadow-2xl transition-all active:scale-95 text-sm uppercase tracking-widest",
                    (wallet?.coins || 0) < tournament.entryFeeCoins ? "bg-slate-200 text-slate-400" : "bg-slate-900 text-white"
                )}
            >
                {isJoining ? <Loader2 className="animate-spin" /> : "Authorize Entry"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
