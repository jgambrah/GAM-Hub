
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, setDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
    Swords, Megaphone, Plus, Trophy, Globe, 
    Upload, X, Loader2, Save, BadgeCheck, Zap, Building2, ShieldCheck, Banknote, DollarSign, Target, TrendingUp, Crown, Calendar, Users, Coins, Play, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { ArenaSponsor, ArenaBattle, ArenaPricingTier, ArenaSeason, ArenaTournament, ArenaMatch, User } from '@/lib/types';
import Image from 'next/image';

export default function SponsoredBattleManager() {
  const { firestore, storage, auth } = useFirebase();
  const { toast } = useToast();
  
  const [view, setView] = useState<'overview' | 'create_sponsor' | 'launch_battle' | 'season' | 'create_tournament' | 'manage_brackets'>('overview');
  const [loading, setLoading] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<ArenaTournament | null>(null);

  // --- SPONSOR STATE ---
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorSite, setSponsorSite] = useState('');
  const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // --- BATTLE STATE ---
  const [battleTitle, setBattleTitle] = useState('');
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [prizeAmount, setPrizeAmount] = useState('');

  // --- SEASON STATE ---
  const [seasonData, setSeasonData] = useState({ title: '', sponsorName: '', logoUrl: '', isActive: true });

  // --- TOURNAMENT STATE ---
  const [tournamentForm, setTournamentForm] = useState({
      name: '',
      entryFee: '200',
      maxPlayers: '64'
  });

  const logoInputRef = useRef<HTMLInputElement>(null);

  // 1. LIVE DATA SYNC
  const statsRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform_stats', 'revenue') : null, [firestore]);
  const { data: revenueData } = useDoc(statsRef);

  const seasonRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform_stats', 'arena_season') : null, [firestore]);
  const { data: currentSeason } = useDoc<ArenaSeason>(seasonRef);

  const pricingQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'arena_pricing'), orderBy('order', 'asc')) : null, [firestore]);
  const { data: pricingTiers, isLoading: isLoadingPricing } = useCollection<ArenaPricingTier>(pricingQuery);

  const sponsorsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'arena_sponsors'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const { data: sponsors, isLoading: isLoadingSponsors } = useCollection<ArenaSponsor>(sponsorsQuery);

  const tournamentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'arena_tournaments'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const { data: tournaments, isLoading: isLoadingTournaments } = useCollection<ArenaTournament>(tournamentsQuery);

  useEffect(() => {
    if (currentSeason) {
        setSeasonData({
            title: currentSeason.title || '',
            sponsorName: currentSeason.sponsorName || '',
            logoUrl: currentSeason.sponsorLogo || '',
            isActive: currentSeason.isActive ?? true
        });
    }
  }, [currentSeason]);

  const getPricingIcon = (type: string) => {
    switch(type) {
      case 'target': return Target;
      case 'trending': return TrendingUp;
      case 'crown': return Crown;
      default: return Zap;
    }
  }

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

  const handleSaveSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !storage) return;
    setLoading(true);
    try {
        let finalLogoUrl = seasonData.logoUrl;
        
        if (sponsorLogoFile) {
            const logoRef = ref(storage, `arena_seasons/${Date.now()}_logo`);
            await uploadBytes(logoRef, sponsorLogoFile);
            finalLogoUrl = await getDownloadURL(logoRef);
        }

        await setDoc(doc(firestore, 'platform_stats', 'arena_season'), {
            title: seasonData.title,
            sponsorName: seasonData.sponsorName,
            sponsorLogo: finalLogoUrl,
            isActive: seasonData.isActive,
            updatedAt: serverTimestamp()
        }, { merge: true });

        toast({ title: "Arena Season Activated!" });
        setView('overview');
    } catch (err) {
        toast({ variant: 'destructive', title: "Activation Failed" });
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
            videoUrl: '', 
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
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
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

  const handleCreateTournament = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!firestore || !tournamentForm.name) return;
      setLoading(true);
      try {
          const tData = {
              name: tournamentForm.name,
              entryFeeCoins: parseInt(tournamentForm.entryFee),
              maxPlayers: parseInt(tournamentForm.maxPlayers),
              currentPlayers: 0,
              prizePool: 0,
              status: 'registration',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
          };
          await addDocumentNonBlocking(collection(firestore, 'arena_tournaments'), tData);
          toast({ title: "Tournament Announced!", description: "Enlistment is now open for all citizens." });
          setView('overview');
          setTournamentForm({ name: '', entryFee: '200', maxPlayers: '64' });
      } catch (err) {
          toast({ variant: 'destructive', title: "Deployment Failed" });
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateBracket = async (tournament: ArenaTournament) => {
    if (!firestore) return;
    setLoading(true);
    try {
        // 1. Fetch all registered players
        const playersSnap = await getDocs(collection(firestore, 'arena_tournaments', tournament.id, 'players'));
        const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(p => !p.eliminated);

        if (players.length < 2) {
            toast({ variant: 'destructive', title: "Insufficient Warriors", description: "At least 2 players are needed to generate a bracket." });
            return;
        }

        // 2. Shuffle & Pair
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const batch = writeBatch(firestore);
        
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            const pA = shuffled[i];
            const pB = shuffled[i+1];
            const matchRef = doc(collection(firestore, 'arena_tournaments', tournament.id, 'matches'));
            batch.set(matchRef, {
                playerA: pA.userId,
                playerB: pB.userId,
                playerAName: pA.userName,
                playerBName: pB.userName,
                playerAAvatar: pA.avatarUrl,
                playerBAvatar: pB.avatarUrl,
                winner: null,
                round: 1,
                battleId: null,
                status: 'pending',
                createdAt: serverTimestamp()
            });
        }

        // 3. Update status to ongoing
        batch.update(doc(firestore, 'arena_tournaments', tournament.id), { status: 'ongoing', updatedAt: serverTimestamp() });
        
        await batch.commit();
        toast({ title: "Round 1 Bracket Generated!", description: "Matches are now prepared for deployment." });
        setSelectedTournament(tournament);
        setView('manage_brackets');
    } catch (err) {
        toast({ variant: 'destructive', title: "Bracket Generation Failed" });
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
        <div className="flex gap-2 flex-wrap justify-end">
          {view !== 'overview' ? (
            <Button variant="ghost" onClick={() => setView('overview')} className="rounded-xl font-bold transition-all hover:bg-muted">Back to Console</Button>
          ) : (
            <>
              <Button onClick={() => setView('create_tournament')} variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest border-2">
                <Trophy size={14} className="mr-2" /> New Tournament
              </Button>
              <Button onClick={() => setView('season')} variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest border-2">
                Season Sponsor
              </Button>
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

      {/* ── TOURNAMENT BRACKETS VIEW ───────────────────────────────────────── */}
      {view === 'manage_brackets' && selectedTournament && (
          <TournamentBracketManager 
            tournament={selectedTournament} 
            onBack={() => setView('overview')} 
          />
      )}

      {/* ── TOURNAMENT ARCHITECT VIEW ─────────────────────────────────────── */}
      {view === 'create_tournament' && (
        <Card className="max-w-2xl mx-auto rounded-[3rem] border-2 border-indigo-500/20 shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="p-10 border-b bg-indigo-500/10">
            <CardTitle className="text-2xl font-black text-indigo-600">Tournament Architect</CardTitle>
            <CardDescription className="font-bold uppercase text-[10px] tracking-widest text-indigo-500/60">Configure structured national competition</CardDescription>
          </CardHeader>
          <CardContent className="p-10">
            <form onSubmit={handleCreateTournament} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Tournament Name</Label>
                <Input required value={tournamentForm.name} onChange={e => setTournamentForm({...tournamentForm, name: e.target.value})} placeholder="e.g. National Campus Roast Championship" className="h-14 rounded-2xl border-none bg-muted font-bold text-lg shadow-inner" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Entry Fee (Hub Coins)</Label>
                    <Input required type="number" value={tournamentForm.entryFee} onChange={e => setTournamentForm({...tournamentForm, entryFee: e.target.value})} className="h-14 rounded-2xl border-none bg-muted font-black text-lg shadow-inner" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Max Warriors</Label>
                    <Select value={tournamentForm.maxPlayers} onValueChange={v => setTournamentForm({...tournamentForm, maxPlayers: v})}>
                        <SelectTrigger className="h-14 rounded-2xl border-none bg-muted font-black shadow-inner">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {['16', '32', '64', '128'].map(n => <SelectItem key={n} value={n}>{n} Players</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <Button disabled={loading} type="submit" className="w-full py-8 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : <><Trophy size={20} className="mr-2"/> Launch National Competition</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── SEASON SPONSOR VIEW ───────────────────────────────────────────── */}
      {view === 'season' && (
        <Card className="max-w-2xl mx-auto rounded-[3rem] border-2 border-indigo-500/20 shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="p-10 border-b bg-indigo-500/10">
            <CardTitle className="text-2xl font-black text-indigo-600">Season Architect</CardTitle>
            <CardDescription className="font-bold uppercase text-[10px] tracking-widest text-indigo-500/60">Configure recurring national seasonal branding</CardDescription>
          </CardHeader>
          <CardContent className="p-10">
            <form onSubmit={handleSaveSeason} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Season Title</Label>
                <Input required value={seasonData.title} onChange={e => setSeasonData({...seasonData, title: e.target.value})} placeholder="e.g. Arena Season 1: The Takeover" className="h-14 rounded-2xl border-none bg-muted font-bold text-lg shadow-inner" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Anchor Sponsor Name</Label>
                <Input required value={seasonData.sponsorName} onChange={e => setSeasonData({...seasonData, sponsorName: e.target.value})} placeholder="e.g. MTN Ghana" className="h-14 rounded-2xl border-none bg-muted font-bold text-lg shadow-inner" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Season Logo</Label>
                <div className="aspect-video bg-muted/50 rounded-[2rem] border-4 border-dashed border-muted-foreground/10 flex items-center justify-center overflow-hidden relative">
                  {(logoPreview || seasonData.logoUrl) ? (
                    <div className="relative w-full h-full">
                      <Image src={logoPreview || seasonData.logoUrl} fill className="object-contain p-8" alt="preview" />
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
              <Button disabled={loading} type="submit" className="w-full py-8 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : <><Calendar size={20} className="mr-2"/> Activate National Season</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
          
          {/* 💰 LIVE COMMERCIAL INTELLIGENCE */}
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
                    {isLoadingPricing ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
                        </div>
                    ) : pricingTiers && pricingTiers.length > 0 ? (
                        pricingTiers.map((tier) => {
                            const TierIcon = getPricingIcon(tier.iconType);
                            return (
                                <div key={tier.id} className="p-4 bg-muted/30 rounded-2xl border border-transparent hover:border-primary/10 transition-all group">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black uppercase text-foreground flex items-center gap-2">
                                            <TierIcon size={12} className="text-primary" /> {tier.label}
                                        </span>
                                        <span className="text-sm font-black text-primary group-hover:scale-110 transition-transform">{tier.price}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic">{tier.description}</p>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-[10px] text-muted-foreground text-center py-4 italic">No pricing tiers defined.</p>
                    )}

                    <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-inner text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Total Hub Revenue</p>
                        <p className="text-xl font-black">
                            GHS {(revenueData?.total_fees_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Sponsors & Tournaments List */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden h-fit">
                <CardHeader className="p-8 border-b bg-muted/20">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                    <ShieldCheck className="text-blue-600" /> Partner Registry
                </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                <div className="divide-y max-h-[300px] overflow-y-auto no-scrollbar">
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

            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden h-fit">
                <CardHeader className="p-8 border-b bg-indigo-50">
                <CardTitle className="text-xl font-black flex items-center gap-2 text-indigo-600">
                    <Trophy className="text-indigo-600" /> Active Competitions
                </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                <div className="divide-y max-h-[300px] overflow-y-auto no-scrollbar">
                    {isLoadingTournaments ? (
                    <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>
                    ) : tournaments && tournaments.length > 0 ? (
                    tournaments.map(t => (
                        <div key={t.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-all">
                            <div onClick={() => { setSelectedTournament(t); setView('manage_brackets'); }} className="cursor-pointer group flex-1">
                                <p className="font-black text-foreground group-hover:text-indigo-600 transition-colors">{t.name}</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{t.status}</span>
                                    <span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase"><Users size={10}/> {t.currentPlayers}/{t.maxPlayers}</span>
                                </div>
                            </div>
                            {t.status === 'registration' && (
                                <Button onClick={() => handleGenerateBracket(t)} size="sm" className="bg-indigo-600 text-white font-black text-[8px] uppercase h-8 rounded-lg shadow-lg">Start</Button>
                            )}
                        </div>
                    ))
                    ) : (
                    <div className="p-20 text-center text-muted-foreground italic">No tournaments launched.</div>
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
                  Sponsored battles and tournaments drive national visibility for brands while providing professional rewards for campus creators. Entry fees from structured wars directly fuel high-stakes prize pools.
                </p>
                
                <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Zap size={14} className="text-amber-400" /></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Tournament Fees Logged</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg"><Megaphone size={14} className="text-blue-300" /></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">National Prize Pools Active</p>
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

function TournamentBracketManager({ tournament, onBack }: { tournament: ArenaTournament, onBack: () => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const matchesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'arena_tournaments', tournament.id, 'matches'), orderBy('round', 'asc'), orderBy('createdAt', 'asc'));
    }, [firestore, tournament.id]);

    const { data: matches, isLoading } = useCollection<ArenaMatch>(matchesQuery);

    const startMatchBattle = async (match: ArenaMatch) => {
        if (!firestore) return;
        setLoadingId(match.id);
        
        try {
            // 1. Fetch participants metadata for high-fidelity battle card
            const pASnap = await getDoc(doc(firestore, 'users', match.playerA));
            const pBSnap = await getDoc(doc(firestore, 'users', match.playerB));
            const uA = pASnap.data() as User;
            const uB = pBSnap.data() as User;

            const battleData: any = {
                title: `${tournament.name}: Round ${match.round}`,
                creatorId: match.playerA,
                creatorName: uA.name,
                participants: [match.playerA, match.playerB],
                opponentA: {
                    userId: match.playerA,
                    videoUrl: '', // To be filled by player
                    votes: 0
                },
                opponentB: {
                    userId: match.playerB,
                    videoUrl: '', 
                    votes: 0
                },
                participantInfo: {
                    [match.playerA]: {
                        name: uA.name,
                        avatarUrl: uA.avatarUrl || '',
                        campusAcronym: uA.campusAcronym || 'GH',
                        primaryColor: '#3b82f6'
                    },
                    [match.playerB]: {
                        name: uB.name,
                        avatarUrl: uB.avatarUrl || '',
                        campusAcronym: uB.campusAcronym || 'GH',
                        primaryColor: '#ef4444'
                    }
                },
                votes: { [match.playerA]: 0, [match.playerB]: 0 },
                viewerCount: 0,
                status: "live",
                tournamentMatch: true,
                tournamentId: tournament.id,
                matchId: match.id,
                round: match.round,
                createdAt: serverTimestamp(),
                endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 Hour Match
            };

            const battleRef = await addDoc(collection(firestore, "arena_battles"), battleData);
            
            await updateDocumentNonBlocking(doc(firestore, 'arena_tournaments', tournament.id, 'matches', match.id), {
                battleId: battleRef.id,
                status: 'live'
            });

            toast({ title: "Tournament Match Live!", description: `${uA.name} vs ${uB.name} has begun.` });
        } catch (err) {
            toast({ variant: 'destructive', title: "Match deployment failed" });
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden">
                <CardHeader className="bg-indigo-600 text-white p-10 flex flex-row items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy size={16} className="text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Competition Management</span>
                        </div>
                        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">{tournament.name}</CardTitle>
                        <CardDescription className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest mt-2">Bracket Status: {tournament.status}</CardDescription>
                    </div>
                    <Button onClick={onBack} variant="outline" className="rounded-xl bg-white/10 text-white border-white/20">Back to Hub</Button>
                </CardHeader>
                <CardContent className="p-10">
                    <div className="space-y-6">
                        {isLoading ? (
                            <Skeleton className="h-40 w-full rounded-[2rem]" />
                        ) : matches && matches.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {matches.map((match) => (
                                    <div key={match.id} className="p-6 bg-muted rounded-[2.5rem] border-2 border-transparent hover:border-indigo-500/30 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-6">
                                            <div className="text-center">
                                                <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-white overflow-hidden mb-2">
                                                    <img src={(match as any).playerAAvatar} className="w-full h-full object-cover" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase truncate max-w-[80px]">{match.playerAName}</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="p-2 bg-slate-200 rounded-full text-slate-500 mb-1"><Swords size={12}/></div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase">Round {match.round}</span>
                                            </div>
                                            <div className="text-center">
                                                <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-white overflow-hidden mb-2">
                                                    <img src={(match as any).playerBAvatar} className="w-full h-full object-cover" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase truncate max-w-[80px]">{match.playerBName}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            {match.status === 'pending' ? (
                                                <Button 
                                                    onClick={() => startMatchBattle(match)} 
                                                    disabled={loadingId === match.id}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase h-10 px-6"
                                                >
                                                    {loadingId === match.id ? <Loader2 className="animate-spin" /> : <><Play size={12} className="mr-2"/> Launch</>}
                                                </Button>
                                            ) : (
                                                <div className={cn(
                                                    "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border",
                                                    match.status === 'live' ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-600 border-green-100"
                                                )}>
                                                    {match.status}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center border-4 border-dashed rounded-[3rem] opacity-30 flex flex-col items-center">
                                <Swords size={64} className="mb-4" />
                                <p className="font-black uppercase tracking-[0.3em]">No matches generated yet</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
