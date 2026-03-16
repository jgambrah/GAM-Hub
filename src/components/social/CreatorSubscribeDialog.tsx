
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
    Gem, Loader2, Sparkles, CheckCircle2, ShieldCheck, 
    MessageSquare, Swords, Zap, Globe, Coins, CreditCard, AlertTriangle
} from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { subscribeToCreator } from '@/lib/monetization';
import { usePaystackPayment } from 'react-paystack';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { CreatorSettings } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

interface CreatorSubscribeDialogProps {
  creator: {
    id: string;
    name: string;
    avatarUrl: string;
    campusAcronym?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function CreatorSubscribeDialog({ creator, isOpen, onClose }: CreatorSubscribeDialogProps) {
  const { firestore, auth } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Fetch Creator Commercial Settings
  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !creator.id) return null;
    return doc(firestore, 'creator_settings', creator.id);
  }, [firestore, creator.id]);

  const { data: settings, isLoading: isLoadingSettings } = useDoc<CreatorSettings>(settingsRef);

  const monthlyPrice = settings?.subscriptionPrice || 3;
  const isEnabled = settings?.subscriptionsEnabled !== false;

  const paystackConfig = {
    reference: `SUB_${creator.id}_${Date.now()}`,
    email: user?.email || '',
    amount: monthlyPrice * 100, // GHS to Pesewas
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
    metadata: {
        custom_fields: [
            { display_name: "Type", variable_name: "type", value: "creator_subscription" },
            { display_name: "Creator", variable_name: "creator_name", value: creator.name }
        ]
    }
  };

  const initializeSubscription = usePaystackPayment(paystackConfig);

  const handleSubscribe = () => {
    if (!user?.email) {
        toast({ variant: 'destructive', title: 'Login Required' });
        return;
    }

    if (!isEnabled) {
        toast({ variant: 'destructive', title: 'Inner Circle Closed', description: 'This creator is not accepting new members yet.' });
        return;
    }

    initializeSubscription({
        onSuccess: async (ref: any) => {
            setIsProcessing(true);
            try {
                if (firestore && user) {
                    await subscribeToCreator(firestore, user.id, creator.id, monthlyPrice, ref.reference);
                    toast({
                        title: "Subscribed! 💎",
                        description: `You are now a premium supporter of ${creator.name}.`,
                    });
                    onClose();
                }
            } catch (err) {
                toast({ variant: 'destructive', title: 'Sync Failed' });
            } finally {
                setIsProcessing(false);
            }
        },
        onClose: () => {
            toast({ title: 'Subscription cancelled' });
        }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-10 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
            <Gem size={150} />
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                <Image src={creator.avatarUrl} fill className="object-cover rounded-3xl border-4 border-white/10 shadow-2xl relative z-10" alt="" />
                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1.5 rounded-full z-20 shadow-lg">
                    <Gem size={14} fill="currentColor" />
                </div>
            </div>
            <DialogTitle className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                Inner Circle
            </DialogTitle>
            <DialogDescription className="text-blue-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">
                Support {creator.name} • {creator.campusAcronym}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8 bg-background">
          {!isEnabled ? (
              <div className="p-8 bg-red-50 dark:bg-red-950/20 rounded-[2rem] border-2 border-dashed border-red-200 text-center space-y-4">
                  <AlertTriangle className="mx-auto text-red-600" size={48} />
                  <h4 className="font-black text-red-900 dark:text-red-200 uppercase tracking-tight">Access Restricted</h4>
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed font-medium">
                      This creator hasn't enabled their Inner Circle support tier yet. Keep vibing!
                  </p>
              </div>
          ) : (
            <>
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Supporter Benefits</p>
                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { icon: Gem, label: "Supporter Badge", desc: "Show your status in comments" },
                            { icon: Swords, label: "Exclusive Battles", desc: "Access to private showdowns" },
                            { icon: MessageSquare, label: "Priority Chat", desc: "Your messages stay on top" },
                            { icon: Zap, label: "Early Access", desc: "See victory archives first" }
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-transparent hover:border-blue-100 transition-all group">
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                    <benefit.icon size={18} />
                                </div>
                                <div>
                                    <h4 className="font-black text-xs uppercase tracking-tight">{benefit.label}</h4>
                                    <p className="text-[10px] font-medium text-muted-foreground">{benefit.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-slate-900 rounded-[2rem] border-2 border-amber-500/30 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Coins size={64}/></div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-2 relative z-10">Premium Access</p>
                    {isLoadingSettings ? (
                        <Skeleton className="h-10 w-24 bg-slate-800" />
                    ) : (
                        <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-4xl font-black text-white italic tracking-tighter">GHS {monthlyPrice}</span>
                            <span className="text-xs font-bold text-slate-500 uppercase">/ Month</span>
                        </div>
                    )}
                </div>
            </>
          )}
        </div>

        <DialogFooter className="bg-muted/30 p-8 border-t flex flex-col gap-3">
            <Button 
                onClick={handleSubscribe} 
                disabled={isProcessing || !isEnabled || isLoadingSettings} 
                className="w-full rounded-2xl font-black px-8 h-16 shadow-2xl transition-all active:scale-95 text-lg bg-blue-600 hover:bg-blue-500 text-white border-none flex items-center justify-center gap-3"
            >
                {isProcessing ? <Loader2 className="animate-spin" /> : <><CreditCard size={20} /> Subscribe with MoMo</>}
            </Button>
            <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-[0.2em]">
                Secure Recurring Handshake • Cancel Anytime
            </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
