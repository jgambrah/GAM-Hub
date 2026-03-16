
'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Gem, Loader2, Save, Users, Zap, ShieldCheck, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { CreatorSettings } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CreatorSettingsCard() {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'creator_settings', user.id);
  }, [firestore, user?.id]);

  const { data: settings, isLoading } = useDoc<CreatorSettings>(settingsRef);

  const [localSettings, setLocalSettings] = useState<Partial<CreatorSettings>>({
    subscriptionsEnabled: false,
    subscriptionPrice: 3,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!firestore || !user) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'creator_settings', user.id), {
        ...localSettings,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: "Inner Circle Updated! 💎",
        description: "Your subscription terms have been synced to the Yard.",
      });
    } catch (err) {
      toast({ variant: 'destructive', title: "Sync Failed" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-[2.5rem]" />;

  return (
    <Card className="rounded-[2.5rem] border-2 border-indigo-500/10 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="bg-indigo-500/5 p-8 border-b">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
            <Gem size={24} />
          </div>
          <div>
            <CardTitle className="text-2xl font-black">Creator Monetization</CardTitle>
            <CardDescription className="font-medium">Manage your Inner Circle subscription settings.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        
        {/* ENABLE TOGGLE */}
        <div className="flex items-center justify-between p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800">
            <div className="space-y-1">
                <Label className="text-lg font-black text-indigo-900 dark:text-indigo-200">Enable Subscriptions</Label>
                <p className="text-xs text-indigo-700/60 dark:text-indigo-400/60 font-medium">Allow fans to support you monthly.</p>
            </div>
            <Switch 
                checked={localSettings.subscriptionsEnabled} 
                onCheckedChange={(val) => setLocalSettings({...localSettings, subscriptionsEnabled: val})} 
            />
        </div>

        {/* PRICING TIERS */}
        <div className="space-y-4">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Monthly Support Price (GHS)</Label>
            <div className="grid grid-cols-3 gap-3">
                {[2, 3, 5].map((price) => {
                    const isActive = localSettings.subscriptionPrice === price;
                    return (
                        <button
                            key={price}
                            onClick={() => setLocalSettings({...localSettings, subscriptionPrice: price as any})}
                            className={cn(
                                "p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 active:scale-95",
                                isActive 
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200" 
                                    : "bg-muted/30 border-border text-muted-foreground hover:border-indigo-200"
                            )}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Tier</span>
                            <span className="text-2xl font-black">GHS {price}</span>
                        </button>
                    )
                })}
            </div>
        </div>

        {/* STATS HUB */}
        <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={64}/></div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 relative z-10">Active Supporters</p>
                <h4 className="text-3xl font-black relative z-10 tabular-nums">{settings?.subscriberCount || 0}</h4>
            </div>
            <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={64}/></div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 relative z-10">Creator Rank</p>
                <h4 className="text-3xl font-black relative z-10 italic">#{(settings?.subscriberCount || 0) > 100 ? 'GOLD' : 'EMERGING'}</h4>
            </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-border flex items-start gap-3">
            <ShieldCheck className="text-indigo-600 mt-1" size={18} />
            <p className="text-[9px] text-muted-foreground leading-relaxed font-bold italic">
                Liaison Protocol: Monthly subscriptions generate recurring GHS payouts directly to your Creator Wallet. Ensure your MoMo details are verified in the Payment section.
            </p>
        </div>
      </CardContent>
      <CardFooter className="p-8 bg-muted/20 border-t flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-2xl px-10 h-14 font-black bg-slate-900 text-white shadow-xl active:scale-95 transition-all">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
            Save Creator Terms
        </Button>
      </CardFooter>
    </Card>
  );
}
