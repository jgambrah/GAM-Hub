'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, TrendingUp, Crown, Rocket, CheckCircle2, Coins } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { boostVibe, PROMOTION_PACKAGES } from '@/lib/monetization';
import type { SocialPost, HubWallet } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BoostVibeDialogProps {
  post: SocialPost;
  isOpen: boolean;
  onClose: () => void;
}

export function BoostVibeDialog({ post, isOpen, onClose }: BoostVibeDialogProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<keyof typeof PROMOTION_PACKAGES | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);

  const walletRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'wallets', user.id);
  }, [firestore, user?.id]);
  const { data: wallet } = useDoc<HubWallet>(walletRef);

  const handleBoost = async () => {
    if (!firestore || !user || !selectedTier) return;
    
    const pack = PROMOTION_PACKAGES[selectedTier];
    if ((wallet?.coins || 0) < pack.cost) {
        toast({ variant: 'destructive', title: 'Insufficient Coins', description: 'Refill your Hub Wallet to deploy this boost.' });
        return;
    }

    setIsBoosting(true);
    try {
        await boostVibe(firestore, user.id, post.id, selectedTier);
        toast({ 
            title: "Performance Boosted! 🚀", 
            description: `Liaison is deploying your victory to ${pack.target.toLocaleString()} more viewers.` 
        });
        onClose();
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Deployment Failed', description: err.message });
    } finally {
        setIsBoosting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
              <Zap size={24} fill="currentColor" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic">Major Boost</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">
                Reach More People in the Yard
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background">
          <div className="flex justify-between items-center px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Promotion Tier</p>
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                <Coins size={12} className="text-amber-500" />
                <span className="text-[10px] font-black text-amber-600">{wallet?.coins || 0} Available</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {(Object.entries(PROMOTION_PACKAGES) as [keyof typeof PROMOTION_PACKAGES, any][]).map(([key, tier]) => {
                const isActive = selectedTier === key;
                const Icon = key === 'large' ? Crown : key === 'medium' ? Rocket : TrendingUp;
                
                return (
                    <button
                        key={key}
                        onClick={() => setSelectedTier(key)}
                        className={cn(
                            "flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left group active:scale-95",
                            isActive 
                                ? "bg-blue-50 border-blue-500 shadow-lg shadow-blue-100 dark:bg-blue-900/20 dark:shadow-none" 
                                : "bg-card border-border hover:border-blue-200"
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-2xl transition-all",
                            isActive ? "bg-blue-600 text-white shadow-xl" : "bg-muted text-slate-400 group-hover:text-blue-500"
                        )}>
                            <Icon size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-black text-sm uppercase tracking-tight">{tier.label}</h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
                                Guaranteed Audience Reach
                            </p>
                        </div>
                        <div className="text-right">
                            <p className={cn("font-black text-lg", isActive ? "text-blue-600" : "text-slate-900 dark:text-white")}>{tier.cost}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Coins</p>
                        </div>
                    </button>
                );
            })}
          </div>

          <div className="p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-border flex items-start gap-3">
             <Rocket className="text-blue-500 mt-1" size={16} />
             <p className="text-[9px] text-muted-foreground leading-relaxed font-bold italic">
                Liaison Handshake: Boosted highlights are prioritized in the scroller until your view target is reached. Transparency: Viewers will see a "Promoted" badge on your vibration.
             </p>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-8 border-t">
            <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
            <Button 
                onClick={handleBoost} 
                disabled={isBoosting || !selectedTier} 
                className={cn(
                    "flex-1 rounded-2xl font-black px-8 h-16 shadow-2xl transition-all active:scale-95 text-lg",
                    selectedTier ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                )}
            >
                {isBoosting ? <Loader2 className="animate-spin" /> : "BOOST NOW"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
