
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateApplicationCard } from '@/components/settings/CandidateApplicationCard';
import VendorMomoSettings from '@/components/vendor/VendorMomoSettings';
import { Switch } from '@/components/ui/switch';
import { Bell, ShieldAlert, Clock, Moon, Sun, Loader2, Save } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { updateNotificationSettings } from '@/lib/market-intelligence';
import type { NotificationSettings } from '@/lib/types';
import { CreatorSettingsCard } from '@/components/settings/CreatorSettingsCard';

function NotificationCommand({ userId }: { userId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'user_notifications', userId);
    }, [firestore, userId]);

    const { data: settings, isLoading } = useDoc<NotificationSettings>(settingsRef);

    const [localSettings, setLocalSettings] = useState<Partial<NotificationSettings>>({
        priceDrops: true,
        trendingProducts: true,
        vendorUpdates: true,
        recommendations: true,
        quietHours: { start: 22, end: 7 }
    });

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const handleSave = async () => {
        if (!firestore) return;
        setSaving(true);
        try {
            await updateNotificationSettings(firestore, userId, localSettings);
            toast({ title: "Preferences Saved", description: "Your Yard alert settings are now active." });
        } catch (err) {
            toast({ variant: 'destructive', title: "Sync Failed" });
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) return <Skeleton className="h-96 w-full rounded-[2.5rem]" />;

    return (
        <Card className="rounded-[2.5rem] border-2 border-primary/10 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-muted/20 p-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-lg">
                        <Bell size={24} />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black">Notification Command</CardTitle>
                        <CardDescription className="font-medium">Orchestrate how the Yard reaches your device.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="space-y-6">
                    {[
                        { id: 'priceDrops', label: 'Price Drop Alerts', desc: 'Instantly know when a saved item gets cheaper.', icon: Sun },
                        { id: 'trendingProducts', label: 'Trending Momentum', desc: 'Alerts for viral vibrations on campus.', icon: Bell },
                        { id: 'vendorUpdates', label: 'Vendor New Arrivals', desc: 'Broadcasts from shops you follow.', icon: Bell },
                        { id: 'recommendations', label: 'AI Smart Picks', desc: 'Personalized recommendations tailored for you.', icon: Bell },
                    ].map((pref) => (
                        <div key={pref.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-transparent hover:border-primary/10 transition-all">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-black uppercase tracking-tight">{pref.label}</Label>
                                <p className="text-[10px] text-muted-foreground font-medium">{pref.desc}</p>
                            </div>
                            <Switch 
                                checked={(localSettings as any)[pref.id]} 
                                onCheckedChange={(val) => setLocalSettings({...localSettings, [pref.id]: val})} 
                            />
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12"><Moon size={80} /></div>
                    <div className="relative z-10">
                        <h4 className="font-black text-sm flex items-center gap-2 mb-4">
                            <Clock size={16} className="text-blue-400" /> Quiet Hours Protocol
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Silence Start (Hour)</Label>
                                <Input 
                                    type="number" min="0" max="23"
                                    className="bg-white/10 border-white/10 text-white rounded-xl h-12 font-bold"
                                    value={localSettings.quietHours?.start}
                                    onChange={(e) => setLocalSettings({...localSettings, quietHours: { ...localSettings.quietHours!, start: parseInt(e.target.value)}})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Silence End (Hour)</Label>
                                <Input 
                                    type="number" min="0" max="23"
                                    className="bg-white/10 border-white/10 text-white rounded-xl h-12 font-bold"
                                    value={localSettings.quietHours?.end}
                                    onChange={(e) => setLocalSettings({...localSettings, quietHours: { ...localSettings.quietHours!, end: parseInt(e.target.value)}})}
                                />
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-4 italic">
                            *The Liaison will queue non-urgent alerts during this window.
                        </p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-8 bg-muted/20 border-t flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="rounded-2xl px-10 h-14 font-black bg-slate-900 text-white shadow-xl active:scale-95 transition-all">
                    {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    Save Preferences
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function SettingsPage() {
  const { user, isUserLoading } = useAuth();
  const { toast } = useToast();

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
        title: "Settings Saved",
        description: "Your profile information has been updated.",
    })
  };

  if (isUserLoading || !user) {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="space-y-2">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
  }

  const isVendor = user.role === 'vendor';

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-32">
        <div className="space-y-2">
            <h1 className="font-headline text-4xl font-black tracking-tight text-foreground italic uppercase">Settings</h1>
            <p className="text-muted-foreground font-medium">Manage your account settings and preferences.</p>
        </div>
      
      <form onSubmit={handleSaveChanges}>
        <Card className="rounded-[2.5rem] border shadow-sm">
          <CardHeader>
            <CardTitle>Identity Profile</CardTitle>
            <CardDescription>This is how others will see you on the site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={user.name} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user.email} disabled className="rounded-xl opacity-50" />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button className="rounded-xl font-bold">Save Identity Changes</Button>
          </CardFooter>
        </Card>
      </form>

      {/* NOTIFICATION PREFERENCES */}
      {!isVendor && <NotificationCommand userId={user.id} />}

      {isVendor && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <VendorMomoSettings vendorData={user} />
        </div>
      )}

      {/* CREATOR MONETIZATION HUB (Step 7) */}
      {!isVendor && <CreatorSettingsCard />}

      {!isVendor && <CandidateApplicationCard />}
      
      <div className="p-6 bg-slate-50 dark:bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-border text-center">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Liaison Infrastructure • GH 🇬🇭</p>
      </div>
    </div>
  );
}
