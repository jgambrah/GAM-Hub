'use client';

import React, { useState, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
    Swords, Megaphone, Plus, Trophy, Globe, 
    Upload, X, Loader2, Save, BadgeCheck, Zap, Building2, ShieldCheck, Banknote, DollarSign, Target, TrendingUp, Crown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ArenaSponsor, ArenaBattle } from '@/lib/types';
import Image from 'next/image';

/**
 * SponsoredBattleManager Component
 * ------------------------------
 * Official tool for the National Liaison to manage brand partnerships.
 * Now includes Commercial Pricing Intelligence guide.
 */
export default function SponsoredBattleManager() {
  const { firestore, storage, auth } = useFirebase();
  const { toast } = useToast();
  
  const [view, setView] = useState<'overview' | 'create_sponsor' | 'launch_battle'>('overview');
  const [loading, setLoading] = useState(false);

  // --- SPONSOR STATE ---
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorSite, setSponsorSite] = useState('');
  const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // --- BATTLE STATE ---
  const [battleTitle, setBattleTitle] = useState('');
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [prizeAmount, setPrizeAmount] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch existing sponsors
  const sponsorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'arena_sponsors'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: sponsors, isLoading: isLoadingSponsors } = useCollection<ArenaSponsor>(sponsorsQuery);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSponsorLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const registerSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !storage || !sponsorLogoFile || !sponsorName) return;

    setLoading(true);
    try {
      const logoRef = ref(storage, `arena_sponsors/${Date.now()}_${sponsorLogoFile.name}`);
      await uploadBytes(logoRef, sponsorLogoFile);
      const logoUrl = await getDownloadURL(logoRef);

      await addDocumentNonBlocking(collection(firestore, 'arena_sponsors'), {
        name: sponsorName,
        website: sponsorSite,
        logoUrl,
        createdAt: serverTimestamp()
      });

      toast({ title: "Sponsor Registered!", description: `${sponsorName} is now an official Arena partner.` });
      setView('overview');
      setSponsorName(''); setSponsorSite(''); setSponsorLogoFile(null); setLogoPreview(null);
    } catch (err) {
      toast({ variant: 'destructive', title: "Registration Failed" });
    } finally {
      setLoading(false);
    }
  };

  const launchSponsoredBattle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedSponsorId || !battleTitle || !auth?.currentUser) return;

    setLoading(true);
    try {
      const sponsor = sponsors?.find(s => s.id === selectedSponsorId);
      if (!sponsor) throw new Error("Sponsor not found");

      const battleData: any = {
        title: battleTitle.trim(),
        status: 'waiting',
        isSponsored: true,
        sponsorId: sponsor.id,
        sponsorName: sponsor.name,
        sponsorLogo: sponsor.logoUrl,
        prizeAmount: parseFloat(prizeAmount) || 0,
        creatorId: auth.currentUser.uid,
        creatorName: 'National Hub',
        participants: [auth.currentUser.uid],
        opponentA: {
            userId: auth.currentUser.uid,
            videoUrl: '', // Host video placeholder
            votes: 0
        },
        opponentB: null,
        participantInfo: {
            [auth.currentUser.uid]: {
                name: 'National Liaison',
                avatarUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131546.png',
                campusAcronym: 'HUB',
                primaryColor: '#0f172a'
            }
        },
        votes: { [auth.currentUser.uid]: 0 },
        viewerCount: 0,
        createdAt: serverTimestamp(),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour duration for sponsored events
      };

      await addDocumentNonBlocking(collection(firestore, 'arena_battles'), battleData);
      
      toast({ title: "Sponsored Battle Live!", description: "The challenge has been broadcasted to all campuses." });
      setView('overview');
      setBattleTitle(''); setPrizeAmount('');
    } catch (err) {
      toast({ variant: 'destructive', title: "Launch Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-card p-8 rounded-[3rem] border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
              <Building2 size={24} />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Arena Command</h1>
          </div>
          <p className="text-sm text-muted-foreground font-medium italic">Manage national brand partnerships and high-stakes tournaments.</p>
        </div>
        <div className="flex gap-2">
          {view !== 'overview' ? (
            <Button variant="ghost" onClick={() => setView('overview')} className="rounded-xl font-bold">Back</Button>
          ) : (
            <>
              <Button onClick={() => setView('create_sponsor')} variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest border-2">
                Register Sponsor
              </Button>
              <Button onClick={() => setView('launch_battle')} className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-900 text-white shadow-xl">
                Launch Sponsored War
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── CREATE SPONSOR VIEW ───────────────────────────────────────────── */}
      {view === 'create_sponsor' && (
        <Card className="max-w-2xl mx-auto rounded-[3rem] border-2 shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="p-10 border-b bg-muted/20">
            <CardTitle className="text-2xl font-black">Brand Registrar</CardTitle>
            <CardDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Add a new commercial partner to the National Hub</CardDescription>
          </CardHeader>
          <CardContent className="p-10">
            <form onSubmit={registerSponsor} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Brand Name</Label>
                <Input required value={sponsorName} onChange={e => setSponsorName(e.target.value)} placeholder="e.g. MTN Ghana" className="h-14 rounded-2xl border-none bg-muted font-bold text-lg shadow-inner" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Official Website (Optional)</Label>
                <Input value={sponsorSite} onChange={e => setSponsorSite(e.target.value)} placeholder="https://..." className="h-14 rounded-2xl border-none bg-muted font-mono text-sm shadow-inner" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Brand Logo</Label>
                <div className="aspect-video bg-muted/50 rounded-[2rem] border-4 border-dashed border-muted-foreground/10 flex items-center justify-center overflow-hidden relative">
                  {logoPreview ? (
                    <div className="relative w-full h-full">
                      <Image src={logoPreview} fill className="object-contain p-8" alt="preview" />
                      <button type="button" onClick={() => { setSponsorLogoFile(null); setLogoPreview(null); }} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X size={16}/></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg"><Upload size={24}/></div>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Select PNG Logo</span>
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>
              <Button disabled={loading || !sponsorLogoFile} type="submit" className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} className="mr-2"/> Register Partner</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── LAUNCH BATTLE VIEW ────────────────────────────────────────────── */}
      {view === 'launch_battle' && (
        <Card className="max-w-2xl mx-auto rounded-[3rem] border-2 border-amber-500/20 shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="p-10 border-b bg-amber-500/10">
            <CardTitle className="text-2xl font-black text-amber-600">Battle Architect</CardTitle>
            <CardDescription className="font-bold uppercase text-[10px] tracking-widest text-amber-500/60">Create a high-stakes sponsored showdown</CardDescription>
          </CardHeader>
          <CardContent className="p-10">
            <form onSubmit={launchSponsoredBattle} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Tournament Title</Label>
                <Input required value={battleTitle} onChange={e => setBattleTitle(e.target.value)} placeholder="e.g. The MTN Freestyle Siege" className="h-14 rounded-2xl border-none bg-muted font-bold text-lg shadow-inner" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Official Sponsor</Label>
                <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                  <SelectTrigger className="h-14 rounded-2xl border-none bg-muted font-black shadow-inner">
                    <SelectValue placeholder="Select Brand Partner" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {sponsors?.map(s => (
                      <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-amber-600 px-1">Prize Pool (GHS)</Label>
                <div className="relative">
                  <Input required type="number" value={prizeAmount} onChange={e => setPrizeAmount(e.target.value)} placeholder="5000" className="h-14 rounded-2xl border-none bg-amber-50 dark:bg-amber-950/20 font-black text-2xl pl-12 text-amber-600" />
                  <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={20} />
                </div>
              </div>
              <Button disabled={loading || !selectedSponsorId} type="submit" className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : <><Zap size={24} fill="currentColor" className="mr-2"/> DEPLOY NATIONAL WAR</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── OVERVIEW VIEW ─────────────────────────────────────────────────── */}
      {view === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 💰 COMMERCIAL PRICING GUIDE */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[3rem] border-2 border-primary/10 shadow-lg overflow-hidden h-fit">
                <CardHeader className="bg-primary/5 p-8 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary text-white rounded-2xl shadow-lg">
                            <Banknote size={20} />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black">Pricing Intel</CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold text-primary/60">Liaison Revenue Model</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {[
                        { label: 'Battle Placement', price: 'GHS 3,000+', icon: Target, desc: 'Single live showdown branding.' },
                        { label: 'Weekly Tournament', price: 'GHS 15,000+', icon: TrendingUp, desc: 'Full week of sponsored wars.' },
                        { label: 'Yard Championship', price: 'GHS 75,000+', icon: Crown, desc: 'Exclusive National TV rights.' }
                    ].map((tier) => (
                        <div key={tier.label} className="p-4 bg-muted/30 rounded-2xl border border-transparent hover:border-primary/10 transition-all group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-black uppercase text-foreground flex items-center gap-2">
                                    <tier.icon size={12} className="text-primary" /> {tier.label}
                                </span>
                                <span className="text-sm font-black text-primary group-hover:scale-110 transition-transform">{tier.price}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">{tier.desc}</p>
                        </div>
                    ))}
                    <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-inner text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Total Hub Revenue</p>
                        <p className="text-xl font-black">GHS 124,500.00</p>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Sponsors List */}
          <div className="lg:col-span-1">
            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden h-full">
                <CardHeader className="p-8 border-b bg-muted/20">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                    <ShieldCheck className="text-blue-600" /> Partner Registry
                </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                <div className="divide-y max-h-[500px] overflow-y-auto no-scrollbar">
                    {isLoadingSponsors ? (
                    <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600"/></div>
                    ) : sponsors && sponsors.length > 0 ? (
                    sponsors.map(s => (
                        <div key={s.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white border shadow-inner">
                            <Image src={s.logoUrl} fill className="object-contain p-1" alt="logo" />
                            </div>
                            <div>
                            <p className="font-black text-foreground">{s.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{s.website || 'National Partner'}</p>
                            </div>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><BadgeCheck size={18}/></div>
                        </div>
                    ))
                    ) : (
                    <div className="p-20 text-center text-muted-foreground italic">No official partners registered yet.</div>
                    )}
                </div>
                </CardContent>
            </Card>
          </div>

          {/* Logistics Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[3rem] bg-indigo-600 text-white p-8 border-none shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute right-0 top-0 p-8 opacity-10 rotate-12"><Globe size={150}/></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-4">Yard Monetization</h3>
                <p className="text-sm text-indigo-100 leading-relaxed font-medium">
                  Sponsored battles drive national visibility for brands while providing professional rewards for campus creators. Every battle launched here is prioritized across all university feeds.
                </p>
                
                <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Zap size={14} className="text-amber-400" /></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Sponsored Highlights Tagged</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Megaphone size={14} className="text-blue-300" /></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Push Notifications Deployed</p>
                    </div>
                </div>
              </div>
              
              <div className="relative z-10 pt-10 mt-auto flex items-center justify-between opacity-60">
                 <p className="text-[8px] font-black text-white uppercase tracking-widest">National Command Node • GH</p>
                 <ShieldCheck size={16} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
