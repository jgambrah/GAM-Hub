
'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { ArenaPost, ArenaBattle, CampusWar, ArenaWaitingPoolEntry } from '@/lib/types';
import { Swords, Trophy, Zap, Loader2, Plus, Flame, Sparkles, Globe, Search, Radar, X, Timer } from 'lucide-react';
import { ArenaPostCard } from '@/components/arena/ArenaPostCard';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { campuses as staticCampuses } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ArenaLeaderboard from '@/components/social/ArenaLeaderboard';
import HallOfFame from '@/components/social/HallOfFame';
import { ArenaRules } from '@/components/arena/ArenaRules';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { generatePostEmbedding } from '@/ai/flows/generate-post-embedding';
import { extractHashtags } from '@/lib/hashtag-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateBattleModal } from '@/components/arena/CreateBattleModal';
import { LiveBattleCard } from '@/components/arena/LiveBattleCard';
import { LiveBattleRoom } from '@/components/arena/LiveBattleRoom';
import { ArenaChampions } from '@/components/arena/ArenaChampions';
import { CampusWarCard } from '@/components/arena/CampusWarCard';
import { CampusWarRoom } from '@/components/arena/CampusWarRoom';
import { CreateWarModal } from '@/components/arena/CreateWarModal';
import { CampusWarLeaderboard } from '@/components/arena/CampusWarLeaderboard';

const INITIAL_LIMIT = 50;

/**
 * ArenaPage Component
 * -------------------
 * National Inter-Uni Battleground.
 * Features the "Matching Desk" HUD for auto-match seekers.
 */
export default function ArenaPage() {
    const { firestore } = useFirebase();
    const { user, isTokenReady, isAdmin, campus } = useAuth();
    const { toast } = useToast();
    
    const [isPosting, setIsPosting] = useState(false);
    const [content, setContent] = useState('');
    const [vibeType, setVibeType] = useState<'shade' | 'celebration'>('celebration');
    const [targetCampus, setTargetCampus] = useState('all');
    
    // MODAL & HUD STATES
    const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
    const [isWarModalOpen, setIsWarModalOpen] = useState(false);
    const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
    const [activeWarId, setActiveWarId] = useState<string | null>(null);
    const [matchCountdown, setMatchCountdown] = useState<number | null>(null);
    const [secondsInPool, setSecondsInPool] = useState(0);

    const userCampusInfo = user ? staticCampuses.find(c => c.id === user.campusId) : undefined;
    
    // 📡 1. RETRIEVE ACTIVE BATTLES (Waiting or Live)
    const battlesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'arena_battles'), where('status', 'in', ['waiting', 'live']), limit(10));
    }, [firestore]);
    const { data: liveBattles, isLoading: isLoadingBattles } = useCollection<ArenaBattle>(battlesQuery);

    // 📡 2. MATCHING DESK: Detect if current user is in the Waiting Pool
    const poolQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'arena_waiting_pool'), where('userId', '==', user.id), limit(1));
    }, [firestore, user?.id]);
    const { data: poolEntries } = useCollection<ArenaWaitingPoolEntry>(poolQuery);
    const isMatching = poolEntries && poolEntries.length > 0;

    // 📡 3. MATCH HANDSHAKE: Auto-Open BattleRoom when matched
    useEffect(() => {
        if (!isMatching || !firestore || !user?.id) return;

        // Listen for ANY live battle where the user is a participant
        const q = query(
            collection(firestore, 'arena_battles'), 
            where('status', '==', 'live'),
            where('participants', 'array-contains', user.id),
            limit(1)
        );

        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const battle = snap.docs[0];
                const battleData = battle.data() as ArenaBattle;
                
                // Only trigger if battle was created RECENTLY (within last 30s)
                const createdAt = battleData.createdAt?.toMillis?.() || 0;
                if (Date.now() - createdAt < 30000) {
                    setMatchCountdown(3);
                    const timer = setInterval(() => {
                        setMatchCountdown(prev => {
                            if (prev === 1) {
                                clearInterval(timer);
                                setActiveBattleId(battle.id);
                                return null;
                            }
                            return prev ? prev - 1 : null;
                        });
                    }, 1000);
                }
            }
        });

        return () => unsub();
    }, [isMatching, firestore, user?.id]);

    // ⏱️ MATCHING TIMEOUT: If no auto-match in 30s, automatically graduate to public challenge
    useEffect(() => {
        let interval: any;
        if (isMatching && !matchCountdown) {
            interval = setInterval(() => {
                setSecondsInPool(prev => {
                    const next = prev + 1;
                    if (next >= 30) {
                        handleGoPublic();
                        clearInterval(interval);
                    }
                    return next;
                });
            }, 1000);
        } else {
            setSecondsInPool(0);
        }
        return () => clearInterval(interval);
    }, [isMatching, !!matchCountdown]);

    const handleGoPublic = async () => {
        if (!firestore || !poolEntries?.[0] || !user) return;
        setIsPosting(true);
        try {
            const entry = poolEntries[0];
            // 1. Delete Pool Entry
            await deleteDocumentNonBlocking(doc(firestore, 'arena_waiting_pool', entry.id));
            
            // 2. Create Public Challenge
            const battleData: any = {
                title: entry.title || "Open Auto-Match Challenge",
                creatorId: user.id,
                creatorName: user.name,
                participants: [user.id],
                opponentA: {
                    userId: user.id,
                    videoUrl: entry.videoUrl,
                    votes: 0
                },
                opponentB: null,
                participantInfo: {
                    [user.id]: {
                        name: user.name,
                        avatarUrl: user.avatarUrl || '',
                        campusAcronym: campus?.acronym || 'GH',
                        primaryColor: campus?.primaryColor || '#0f172a'
                    }
                },
                status: 'waiting',
                votes: { [user.id]: 0 },
                viewerCount: 1,
                createdAt: serverTimestamp(),
                endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            };
            await addDocumentNonBlocking(collection(firestore, 'arena_battles'), battleData);
            toast({ title: "Challenge Graduated! 🚀", description: "Liaison matchmaker timed out. Opening challenge to public rivals." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Transition failed" });
        } finally {
            setIsPosting(false);
        }
    };

    // 📡 4. RETRIEVE LIVE WARS (University vs University)
    const warsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'campus_wars'), where('status', '==', 'live'), limit(2));
    }, [firestore]);
    const { data: liveWars, isLoading: isLoadingWars } = useCollection<CampusWar>(warsQuery);

    // 📡 5. RETRIEVE BATTLE THREADS (Posts)
    const postsQuery = useMemoFirebase(() => {
        if (!firestore || !user || !isTokenReady) return null;
        return query(
            collection(firestore, 'campus_pulse'),
            where('isArenaEntry', '==', true),
            orderBy('createdAt', 'desc'),
            limit(INITIAL_LIMIT)
        );
    }, [firestore, user?.id, isTokenReady]);
    const { data: posts, isLoading: isLoadingPosts } = useCollection<ArenaPost>(postsQuery);

    const handleCancelMatch = async () => {
        if (!firestore || !poolEntries?.[0]) return;
        try {
            await deleteDocumentNonBlocking(doc(firestore, 'arena_waiting_pool', poolEntries[0].id));
            toast({ title: 'Search Aborted' });
        } catch (e) {}
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !content.trim()) return;

        setIsPosting(true);
        try {
            const postData: any = {
                content,
                vibeType,
                targetCampus: targetCampus !== 'all' ? staticCampuses.find(c => c.id === targetCampus)?.acronym : 'National',
                authorId: user.id,
                authorName: user.name,
                authorAvatarUrl: user.avatarUrl,
                authorCampus: userCampusInfo?.acronym || "GH",
                authorColor: userCampusInfo?.primaryColor || "#0f172a",
                stats: { likes: 0, burns: 0 },
                createdAt: new Date().toISOString(),
                isArenaEntry: true,
                campusId: user.campusId,
            };

            const manualTags = extractHashtags(content);
            const embedding = await generatePostEmbedding({ content, tags: manualTags });
            postData.embedding = embedding;
            postData.tags = manualTags;

            await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), postData);
            toast({ title: 'Vibe Shared!' });
            setContent('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Action Blocked' });
        } finally {
            setIsPosting(false);
        }
    };

    const isLiaison = user?.role === 'admin' || isAdmin;
    const isSRC = user?.role === 'src' || isLiaison;

    return (
        <div className="p-4 bg-muted/50 min-h-screen pb-32">
            
            {/* ⏳ SMART MATCHING OVERLAY */}
            {isMatching && (
                <div className="fixed inset-0 z-[9000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="max-w-md w-full text-center space-y-10">
                        {matchCountdown !== null ? (
                            <div className="space-y-8 animate-in zoom-in duration-300">
                                <div className="p-8 bg-green-500 rounded-full w-fit mx-auto shadow-[0_0_50px_rgba(34,197,94,0.5)]">
                                    <Swords size={80} className="text-white animate-bounce" />
                                </div>
                                <div>
                                    <h2 className="text-5xl font-black italic text-white tracking-tighter uppercase italic">Rival Found!</h2>
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.4em] mt-4">Deployment in {matchCountdown}...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <div className="w-48 h-48 border-4 border-indigo-500/20 rounded-full mx-auto flex items-center justify-center">
                                        <div className="w-40 h-40 border-4 border-indigo-500/40 rounded-full flex items-center justify-center animate-spin-slow">
                                            <div className="w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.8)]" style={{ transform: 'translateX(80px)' }} />
                                        </div>
                                        <Radar className="absolute inset-0 m-auto text-indigo-500 animate-pulse" size={48} />
                                    </div>
                                    <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl" />
                                </div>

                                <div className="space-y-4">
                                    <h2 className="text-3xl font-black italic text-white tracking-tight uppercase italic">Searching for Rival</h2>
                                    <p className="text-sm text-slate-400 font-medium italic">"Liaison Matchmaker is auditing the National Hub for a worthy contender..."</p>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full mt-6 overflow-hidden">
                                        <div 
                                            className="bg-indigo-500 h-full transition-all duration-1000 ease-linear" 
                                            style={{ width: `${(secondsInPool / 30) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{30 - secondsInPool}s until Public Release</p>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-3">
                                        <div className="p-2 bg-indigo-600 rounded-lg"><Sparkles size={14} className="text-white" /></div>
                                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest text-left leading-relaxed">
                                            Pairing priority: Inter-campus rivalry established.
                                        </p>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        onClick={handleCancelMatch}
                                        className="text-slate-500 hover:text-white font-black text-xs uppercase tracking-widest h-14 rounded-2xl border border-white/5"
                                    >
                                        <X size={16} className="mr-2" /> Abort Combat Search
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <ArenaLeaderboard />
            
            <CampusWarLeaderboard />

            {/* 🏛️ CAMPUS WAR SECTION */}
            {liveWars && liveWars.length > 0 && (
                <section className="max-w-5xl mx-auto mb-16 animate-in fade-in duration-700">
                    <div className="flex items-center justify-between mb-8 px-4">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-2xl shadow-indigo-200">
                                <Globe size={28} className="animate-spin-slow" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">Campus Wars</h2>
                                <p className="text-[10px] font-black text-indigo-50 uppercase tracking-[0.3em] mt-1">National University Conflict</p>
                            </div>
                        </div>
                        {isSRC && (
                            <Button onClick={() => setIsWarModalOpen(true)} className="rounded-2xl bg-indigo-600 text-white font-black px-8 h-14 shadow-xl active:scale-95 transition-all">
                                Declare War
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-8">
                        {liveWars.map(war => (
                            <CampusWarCard key={war.id} war={war} onClick={() => setActiveWarId(war.id)} />
                        ))}
                    </div>
                </section>
            )}

            {/* LIVE RING SECTION */}
            <section className="max-w-4xl mx-auto mb-12">
                <div className="flex items-center justify-between mb-6 px-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg animate-pulse">
                            <Swords size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic tracking-tight text-foreground">The Live Ring</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time inter-uni showdowns</p>
                        </div>
                    </div>
                    <Button 
                        onClick={() => setIsBattleModalOpen(true)}
                        className="rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest px-6 h-12 shadow-xl active:scale-95 transition-all"
                    >
                        Launch Challenge
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {isLoadingBattles ? (
                        <Skeleton className="h-64 rounded-[3rem]" />
                    ) : liveBattles && liveBattles.length > 0 ? (
                        liveBattles.map(battle => (
                            <LiveBattleCard key={battle.id} battle={battle} onClick={() => setActiveBattleId(battle.id)} />
                        ))
                    ) : (
                        <div className="col-span-full py-16 bg-white dark:bg-card border-4 border-dashed rounded-[3.5rem] flex flex-col items-center justify-center text-center opacity-40">
                            <Zap size={48} className="mb-4 text-slate-300" />
                            <p className="font-black uppercase tracking-widest text-xs">The Ring is Open</p>
                            <p className="text-[10px] italic mt-2">Launch a challenge to start a live battle.</p>
                        </div>
                    )}
                </div>
            </section>

            <ArenaChampions />

            <div className="bg-slate-900 rounded-[3rem] p-8 mb-8 text-white relative overflow-hidden shadow-2xl mx-auto max-w-4xl">
                <div className="absolute right-0 top-0 p-6 opacity-20"><Flame size={120} /></div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase">Arena Threads</h1>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em]">National Inter-Uni Battleground</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
                <ArenaRules />

                {user && (
                    <div className="bg-card rounded-[2.5rem] p-6 mb-10 shadow-xl border border-border">
                        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                            <div className="flex gap-2">
                                <button onClick={() => setVibeType('celebration')} className={cn("px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all", vibeType === 'celebration' ? 'bg-amber-100 text-amber-700 shadow-sm ring-2 ring-amber-500/20' : 'bg-muted text-muted-foreground')}> Victory</button>
                                <button onClick={() => setVibeType('shade')} className={cn("px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all", vibeType === 'shade' ? 'bg-red-100 text-red-700 shadow-sm ring-2 ring-red-500/20' : 'bg-muted text-muted-foreground')}> Shade</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select onValueChange={setTargetCampus} value={targetCampus}>
                                    <SelectTrigger className="w-[180px] rounded-xl font-bold border-none bg-muted h-10 text-[10px]">
                                        <SelectValue placeholder="All Rivals" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                        <SelectItem value="all">🌍 All Rivals</SelectItem>
                                        {staticCampuses.filter(c => c.id !== user.campusId).map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.acronym} Hub</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <form onSubmit={handlePost} className="flex gap-2">
                            <Input value={content} onChange={e => setContent(e.target.value)} placeholder="Dropping some national heat..." className="rounded-2xl border-none bg-muted font-bold" />
                            <Button disabled={isPosting} className="rounded-2xl bg-slate-900 text-white h-12 px-8">
                                {isPosting ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
                            </Button>
                        </form>
                    </div>
                )}

                <div className="space-y-8 max-w-2xl mx-auto">
                    {isLoadingPosts ? (
                        <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                    ) : posts?.map(post => <ArenaPostCard key={post.id} post={post} />)}
                </div>

                <HallOfFame />
            </div>

            {/* BATTLE MODALS */}
            <CreateBattleModal open={isBattleModalOpen} onOpenChange={setIsBattleModalOpen} />
            <CreateWarModal open={isWarModalOpen} onOpenChange={setIsWarModalOpen} />
            
            {activeBattleId && (
                <LiveBattleRoom battleId={activeBattleId} onClose={() => setActiveBattleId(null)} />
            )}
            {activeWarId && (
                <CampusWarRoom warId={activeWarId} onClose={() => setActiveWarId(null)} />
            )}
        </div>
    )
}
