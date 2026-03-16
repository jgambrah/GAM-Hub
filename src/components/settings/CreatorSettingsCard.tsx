
'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Gem, Loader2, Save, Users, Zap, ShieldCheck, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { CreatorSettings, CreatorAnalytics } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CreatorSettingsCard() {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // 1. Fetch Commercial Settings
  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'creator_settings', user.id);
  }, [firestore, user?.id]);

  const { data: settings, isLoading: isLoadingSettings } = useDoc<CreatorSettings>(settingsRef);

  // 2. Fetch Business Analytics
  const analyticsRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'creator_analytics', user.id);
  }, [firestore, user?.id]);

  const { data: analytics, isLoading: isLoadingAnalytics } = useDoc<CreatorAnalytics>(analyticsRef);

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

  if (isLoadingSettings || isLoadingAnalytics) return <Skeleton className="h-96 w-full rounded-[2.5rem]" />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* A. ANALYTICS HUB: Talent ROI Dashboard */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 pointer-events-none">
            <BarChart3 size={200} />
        </div>
        
        <CardHeader className="p-8 border-b border-white/5">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Talent ROI Hub</CardTitle>
                    <CardDescription className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mt-1">Creator Business Intelligence</CardDescription>
                </div>
            </div>
        </CardHeader>

        <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Monthly Revenue Signal</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black tabular-nums">GHS {(analytics?.monthlyIncomeGHS || 0).toLocaleString()}</span>
                        <span className="text-[8px] font-bold text-blue-400 uppercase">/ MO</span>
                    </div>
                </div>
                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Active Inner Circle</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black tabular-nums">{analytics?.activeSubscribers || 0}</span>
                        <span className="text-[8px] font-bold text-indigo-400 uppercase">Citizens</span>
                    </div>
                </div>
                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Growth (Last 30d)</p>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-black text-emerald-400 tabular-nums">+{analytics?.newSubscribersLast30 || 0}</span>
                        <div className="p-1 bg-emerald-500/20 rounded-md"><TrendingUp size={12} className="text-emerald-400" /></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Revenue Split: 70% Creator / 30% Hub</span>
                </div>
                <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.4em]">Audit Node Active</p>
            </div>
        </CardContent>
      </Card>

      {/* B. GOVERNANCE: Commercial Settings */}
      <Card className="rounded-[2.5rem] border-2 border-indigo-500/10 shadow-xl overflow-hidden">
        <CardHeader className="bg-indigo-500/5 p-8 border-b">
            <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                <Gem size={24} />
            </div>
            <div>
                <CardTitle className="text-2xl font-black">Creator Governance</CardTitle>
                <CardDescription className="font-medium">Manage your subscription price and availability.</CardDescription>
            </div>
            </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
            
            {/* ENABLE TOGGLE */}
            <div className="flex items-center justify-between p-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl border border-indigo-100 dark:border-indigo-800">
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
                                type="button"
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

            <div className="p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-border flex items-start gap-3">
                <ShieldCheck className="text-indigo-600 mt-1" size={18} />
                <p className="text-[9px] text-muted-foreground leading-relaxed font-bold italic">
                    Liaison Protocol: Monthly subscriptions generate recurring GHS payouts directly to your Creator Wallet. Revenue is split 70/30 to maintain national Arena infrastructure.
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
    </div>
  );
}
