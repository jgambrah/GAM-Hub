
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, onSnapshot, serverTimestamp, getDoc, setDoc, increment } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { ArenaPost, ArenaBattle, CampusWar, ArenaWaitingPoolEntry, ArenaSeason, ArenaTournament } from '@/lib/types';
import { Swords, Trophy, Zap, Loader2, Flame, Sparkles, Globe, Radar, X, Crown, ShieldAlert, Send, ShieldCheck, Target, Smile, ImagePlus, Youtube, PlusCircle, Star, Megaphone, Calendar, Users, Coins } from 'lucide-react';
import { ArenaPostCard } from '@/components/arena/ArenaPostCard';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { campuses as staticCampuses } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArenaRules } from '@/components/arena/ArenaRules';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { extractHashtags, updateHashtagIndex, updateHashtagGraph } from '@/lib/hashtag-utils';
import { generatePostEmbedding } from '@/ai/flows/generate-post-embedding';
import { generateSemanticHashtags } from '@/ai/flows/generate-semantic-hashtags';
import { validateVideo, generateFileHash } from '@/lib/video-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateBattleModal } from '@/components/arena/CreateBattleModal';
import { LiveBattleCard } from '@/components/arena/LiveBattleCard';
import { LiveBattleRoom } from '@/components/arena/LiveBattleRoom';
import { ArenaChampions } from '@/components/arena/ArenaChampions';
import { ArenaLegends } from '@/components/arena/ArenaLegends';
import { CampusWarCard } from '@/components/arena/CampusWarCard';
import { CampusWarRoom } from '@/components/arena/CampusWarRoom';
import { CreateWarModal } from '@/components/arena/CreateWarModal';
import { CampusWarLeaderboard } from '@/components/arena/CampusWarLeaderboard';
import { TournamentSection } from '@/components/arena/TournamentSection';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import HallOfFame from '@/components/social/HallOfFame';
import ArenaLeaderboard from '@/components/social/ArenaLeaderboard';

const INITIAL_LIMIT = 50;
const LOAD_MORE_BATCH = 25;

export default function ArenaPage() {
    const { firestore, storage } = useFirebase();
    const { user, isTokenReady, isAdmin, campus } = useAuth();
    const { toast } = useToast();
    
    const [isPosting, setIsPosting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [limitCount, setLimitCount] = useState(INITIAL_LIMIT);
    const [content, setContent] = useState('');
    const [vibeType, setVibeType] = useState<'shade' | 'celebration'>('celebration');
    const [targetCampus, setTargetCampus] = useState('all');
    
    const [showHallOfFame, setShowHallOfFame] = useState(false);
    const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
    const [isWarModalOpen, setIsWarModalOpen] = useState(false);
    const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
    const [activeWarId, setActiveWarId] = useState<string | null>(null);
    const [matchCountdown, setMatchCountdown] = useState<number | null>(null);
    const [secondsInPool, setSecondsInPool] = useState(0);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const userCampusInfo = user ? staticCampuses.find(c => c.id === user.campusId) : undefined;
    
    // 0. NATIONAL SEASON SYNC
    const seasonRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'platform_stats', 'arena_season');
    }, [firestore]);
    const { data: season } = useDoc<ArenaSeason>(seasonRef);

    // 1. NATIONAL TOURNAMENTS (NEW)
    // Managed in its own section via the TournamentSection component

    // 2. SPONSORED BATTLES (PRIORITY HUB)
    const featuredBattlesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'arena_battles'), 
            where('isSponsored', '==', true),
            where('status', 'in', ['waiting', 'live']),
            limit(5)
        );
    }, [firestore]);
    const { data: featuredBattles, isLoading: isLoadingFeatured } = useCollection<ArenaBattle>(featuredBattlesQuery);

    // 3. LIVE SHOWDOWNS (REGULAR RING)
    const battlesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'arena_battles'), 
            where('isSponsored', '==', false),
            where('status', 'in', ['waiting', 'live']), 
            limit(15)
        );
    }, [firestore]);
    const { data: liveBattles, isLoading: isLoadingBattles } = useCollection<ArenaBattle>(battlesQuery);

    // 4. AUTO-MATCH POOL
    const poolQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'arena_waiting_pool'), where('userId', '==', user.id), limit(1));
    }, [firestore, user?.id]);
    const { data: poolEntries } = useCollection<ArenaWaitingPoolEntry>(poolQuery);
    const isMatching = poolEntries && poolEntries.length > 0;

    useEffect(() => {
        if (!isMatching || !firestore || !user?.id) return;

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
            await deleteDocumentNonBlocking(doc(firestore, 'arena_waiting_pool', entry.id));
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
                isSponsored: false,
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

    // 5. CAMPUS WARS
    const warsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'campus_wars'), where('status', '==', 'live'), limit(2));
    }, [firestore]);
    const { data: liveWars, isLoading: isLoadingWars } = useCollection<CampusWar>(warsQuery);

    // 6. HIGHLIGHTS & VIBES
    const postsQuery = useMemoFirebase(() => {
        if (!firestore || !user || !isTokenReady) return null;
        return query(
            collection(firestore, 'campus_pulse'),
            where('isArenaEntry', '==', true),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
    }, [firestore, user?.id, isTokenReady, limitCount]);
    const { data: posts, isLoading: isLoadingPosts } = useCollection<ArenaPost>(postsQuery);

    const handleCancelMatch = async () => {
        if (!firestore || !poolEntries?.[0]) return;
        try {
            await deleteDocumentNonBlocking(doc(firestore, 'arena_waiting_pool', poolEntries[0].id));
            toast({ title: 'Search Aborted' });
        } catch (e) {}
    };

    const resetInputs = () => {
        setContent(''); setVibeType('celebration'); setTargetCampus('all'); setVideoUrl(''); setFile(null); setPreviewUrl(null);
        setUploadProgress(0);
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 10 * 1024 * 1024) {
                toast({ variant: "destructive", title: "File too large", description: "Maximum upload size is 10MB" });
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || (!content.trim() && !file && !videoUrl.trim())) return;

        setIsPosting(true);
        setUploadProgress(0);
        try {
            let postData: any = {
                content,
                vibeType,
                targetCampus: targetCampus !== 'all' ? staticCampuses.find(c => c.id === targetCampus)?.acronym : 'National',
                authorId: user.id,
                authorName: user.name || "Campus Member",
                authorAvatarUrl: user.avatarUrl || "",
                authorCampus: userCampusInfo?.acronym || "GH",
                authorColor: userCampusInfo?.primaryColor || "#0f172a",
                stats: { likes: 0, burns: 0 },
                createdAt: new Date().toISOString(),
                isArenaEntry: true,
                campusId: user.campusId,
                storageTier: 'hot'
            };

            if (file && storage && firestore) {
                const isVideo = file.type.startsWith('video');
                if (isVideo) {
                    await validateVideo(file);
                    const hash = await generateFileHash(file);
                    const hashRef = doc(firestore, 'video_hashes', hash);
                    const hashSnap = await getDoc(hashRef);

                    if (hashSnap.exists()) {
                        const existing = hashSnap.data();
                        postData.mediaUrl = existing.mediaUrl;
                        postData.mediaType = 'video';
                        postData.imageUrl = existing.imageUrl;
                        postData.storageTier = existing.storageTier || 'hot';
                        postData.videoHash = hash;
                        await setDoc(hashRef, { uploads: increment(1) }, { merge: true });
                        toast({ title: "Viral Vibe Detected!", description: "Reusing existing version from the Yard." });
                    } else {
                        const filePath = `videos/hot/${user.id}/${Date.now()}_${file.name}`;
                        const fileRef = ref(storage, filePath);
                        const uploadTask = uploadBytesResumable(fileRef, file, { customMetadata: { hash } });
                        await new Promise((resolve, reject) => {
                            uploadTask.on("state_changed", 
                                (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
                                reject, () => resolve(null)
                            );
                        });
                        postData.mediaUrl = await getDownloadURL(fileRef);
                        postData.mediaType = 'video';
                        postData.videoHash = hash;
                        await setDoc(hashRef, { mediaUrl: postData.mediaUrl, storagePath: filePath, storageTier: 'hot', processed: false, uploads: 1, updatedAt: serverTimestamp() });
                    }
                } else {
                    const filePath = `arena_media/${user.id}/${Date.now()}_${file.name}`;
                    const fileRef = ref(storage, filePath);
                    const uploadTask = uploadBytesResumable(fileRef, file);
                    await new Promise((resolve, reject) => {
                        uploadTask.on("state_changed", 
                            (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
                            reject, () => resolve(null)
                        );
                    });
                    postData.mediaUrl = await getDownloadURL(fileRef);
                    postData.mediaType = 'image';
                }
            } else if (videoUrl.trim()) {
                postData.mediaUrl = videoUrl.trim();
                postData.mediaType = videoUrl.includes('youtube') ? 'youtube' : 'tiktok';
            }

            const manualTags = extractHashtags(content);
            let aiTags: string[] = [];
            try {
                const aiResult = await generateSemanticHashtags({ content, campusAcronym: userCampusInfo?.acronym });
                aiTags = aiResult.tags;
            } catch (e) {}

            const finalHashtags = Array.from(new Set([...manualTags, ...aiTags])).slice(0, 10);
            postData.tags = finalHashtags;
            const embedding = await generatePostEmbedding({ content, tags: finalHashtags });
            postData.embedding = embedding;

            await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), postData);
            if (finalHashtags.length > 0 && firestore) {
                await updateHashtagIndex(firestore, finalHashtags);
                if (finalHashtags.length >= 2) await updateHashtagGraph(firestore, finalHashtags);
            }

            toast({ title: 'Vibe Shared in The Arena!' });
            resetInputs();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Action Blocked', description: error.message });
        } finally {
            setIsPosting(false);
        }
    };

    const isLiaison = user?.role === 'admin' || isAdmin;
    const isSRC = user?.role === 'src' || isLiaison;
    const hasMore = posts && posts.length >= limitCount;

    return (
        <div className="p-4 bg-muted/50 min-h-screen pb-32">
            
            {/* MATCHMAKING HUD */}
            {isMatching && (
                <div className="fixed inset-0 z-[9000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="max-w-md w-full text-center space-y-10">
                        {matchCountdown !== null ? (
                            <div className="space-y-8 animate-in zoom-in duration-300">
                                <div className="p-8 bg-green-500 rounded-full w-fit mx-auto shadow-[0_0_50px_rgba(34,197,94,0.5)]">
                                    <Swords size={80} className="text-white animate-bounce" />
                                </div>
                                <h2 className="text-5xl font-black italic text-white uppercase tracking-tighter">Rival Found!</h2>
                                <p className="text-slate-400 font-bold uppercase tracking-[0.4em]">Deployment in {matchCountdown}...</p>
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
                                    <h2 className="text-3xl font-black italic text-white uppercase">Searching for Rival</h2>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full mt-6 overflow-hidden">
                                        <div className="bg-indigo-50 h-full transition-all duration-1000 ease-linear" style={{ width: `${(secondsInPool / 30) * 100}%` }} />
                                    </div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{30 - secondsInPool}s until Public Release</p>
                                </div>
                                <Button variant="ghost" onClick={handleCancelMatch} className="text-slate-500 hover:text-white font-black text-xs uppercase tracking-widest h-14 rounded-2xl">
                                    <X size={16} className="mr-2" /> Abort Combat Search
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 🛡️ NATIONAL SEASON BANNER */}
            {season && season.isActive && (
                <section className="max-w-5xl mx-auto mb-12 animate-in slide-in-from-top-4 duration-1000">
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl border-b-8 border-indigo-500">
                        <div className="absolute right-0 top-0 p-10 opacity-5 rotate-12 pointer-events-none">
                            <Trophy size={200} />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                                    <div className="bg-amber-500 p-2 rounded-xl text-slate-950">
                                        <Star size={16} fill="currentColor" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400">National Arena Season</span>
                                </div>
                                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">
                                    {season.title}
                                </h1>
                                <p className="text-sm md:text-lg font-bold text-slate-400 mt-4 uppercase tracking-widest">
                                    Powered by <span className="text-white">{season.sponsorName}</span>
                                </p>
                            </div>
                            {season.sponsorLogo && (
                                <div className="w-32 h-32 md:w-48 md:h-48 bg-white rounded-[2.5rem] p-6 shadow-2xl flex items-center justify-center border-4 border-white/10 group hover:scale-105 transition-transform duration-500">
                                    <img src={season.sponsorLogo} alt="season sponsor" className="w-full h-full object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            <ArenaLeaderboard />
            <CampusWarLeaderboard />

            {/* 🏆 NATIONAL TOURNAMENTS SECTION */}
            <TournamentSection />

            {/* 🛡️ NATIONAL FEATURED SECTION (SPONSORED) */}
            {featuredBattles && featuredBattles.length > 0 && (
                <section className="max-w-5xl mx-auto mb-16 animate-in fade-in duration-700">
                    <div className="flex items-center gap-3 mb-8 px-4">
                        <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-xl">
                            <Megaphone size={20} fill="currentColor" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic tracking-tighter text-foreground uppercase">Featured Challenges</h2>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] mt-1">National Brand Showdowns</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {featuredBattles.map(battle => (
                            <LiveBattleCard key={battle.id} battle={battle} onClick={() => setActiveBattleId(battle.id)} />
                        ))}
                    </div>
                </section>
            )}

            {/* CAMPUS WARS */}
            {liveWars && liveWars.length > 0 && (
                <section className="max-w-5xl mx-auto mb-16">
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
                        {isSRC && <Button onClick={() => setIsWarModalOpen(true)} className="rounded-2xl bg-indigo-600 text-white font-black px-8 h-14 shadow-xl">Declare War</Button>}
                    </div>
                    <div className="grid grid-cols-1 gap-8">
                        {liveWars.map(war => (
                            <CampusWarCard key={war.id} war={war} onClick={() => setActiveWarId(war.id)} />
                        ))}
                    </div>
                </section>
            )}

            {/* LIVE SHOWDOWNS */}
            <section className="max-w-4xl mx-auto mb-12">
                <div className="flex items-center justify-between mb-6 px-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg animate-pulse">
                            <Swords size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">Live Showdowns</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time inter-uni rivalries</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsBattleModalOpen(true)} className="rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest px-6 h-12 shadow-xl">Launch Challenge</Button>
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
                        </div>
                    )}
                </div>
            </section>

            {/* SHARE VIBE HUB */}
            {user && (
                <section className="max-w-2xl mx-auto mb-16 px-4">
                    <div className="bg-card rounded-[2.5rem] p-8 shadow-xl border border-border">
                        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
                            <div className="flex gap-2">
                                <button onClick={() => setVibeType('celebration')} className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2", vibeType === 'celebration' ? "bg-amber-100 text-amber-700 shadow-sm" : "bg-muted text-muted-foreground")}>
                                    <Star size={14} fill={vibeType === 'celebration' ? 'currentColor' : 'none'} /> Victory
                                </button>
                                <button onClick={() => setVibeType('shade')} className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2", vibeType === 'shade' ? "bg-red-100 text-red-700 shadow-sm" : "bg-muted text-muted-foreground")}>
                                    <Flame size={14} fill={vibeType === 'shade' ? 'currentColor' : 'none'} /> Shade
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={targetCampus} onValueChange={setTargetCampus}>
                                    <SelectTrigger className="w-[180px] rounded-xl font-bold border-none bg-muted h-10">
                                        <Target className="mr-2 text-primary" size={14} />
                                        <SelectValue placeholder="All Rivals" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 text-white border-white/10 rounded-2xl">
                                        <SelectItem value="all">🌍 All Rivals (National)</SelectItem>
                                        {staticCampuses.filter(c => c.id !== user.campusId).map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.acronym} Hub</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <form onSubmit={handlePost} className="space-y-6">
                            {previewUrl && (
                                <div className="relative aspect-video rounded-[2rem] overflow-hidden border-4 border-muted shadow-inner bg-black animate-in zoom-in">
                                    {file?.type.startsWith('image') ? <img src={previewUrl} className="w-full h-full object-cover" alt="" /> : <video src={previewUrl} className="w-full h-full object-cover" muted />}
                                    <button type="button" onClick={() => { setFile(null); setPreviewUrl(null); }} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X size={16} /></button>
                                </div>
                            )}
                            <div className="relative flex items-center gap-2 bg-muted p-2 rounded-[2.5rem] border-2 border-transparent focus-within:bg-background focus-within:border-primary/20 transition-all shadow-inner">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3.5 text-muted-foreground hover:text-blue-500 rounded-full transition-colors"><ImagePlus size={24} /></button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                                <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder={vibeType === 'shade' ? "Dropping a national heat-seek... 🧨" : "Broadcasting Yard success! 🏆"} className="flex-1 bg-transparent border-none outline-none font-bold text-base h-14" />
                                <Button type="submit" disabled={isPosting || (!content.trim() && !file)} className={cn("p-5 rounded-full shadow-lg h-auto", vibeType === 'shade' ? "bg-red-600 hover:bg-red-700" : "bg-amber-50 hover:bg-amber-600")}>
                                    {isPosting ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} fill="currentColor" />}
                                </Button>
                            </div>
                        </form>
                    </div>
                </section>
            )}

            <ArenaLegends />
            <ArenaChampions />

            <div className="max-w-4xl mx-auto">
                <ArenaRules />
                <div className="space-y-8 max-w-2xl mx-auto">
                    {isLoadingPosts && limitCount === INITIAL_LIMIT ? (
                        <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                    ) : posts?.map(post => <ArenaPostCard key={post.id} post={post} />)}
                </div>
                {hasMore && (
                    <div className="flex flex-col items-center pt-12 pb-20">
                        <Button onClick={() => setLimitCount(prev => prev + LOAD_MORE_BATCH)} disabled={isLoadingPosts} className="bg-slate-900 text-white rounded-2xl px-12 h-16 font-black shadow-xl">
                            {isLoadingPosts ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />} Load More Showdowns
                        </Button>
                    </div>
                )}
                <div className="mt-16 mb-8 flex justify-center">
                    <button onClick={() => setShowHallOfFame(true)} className="bg-white text-amber-600 border-2 border-amber-100 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95">
                        <Trophy size={16} className="inline mr-2" /> Open National Archives
                    </button>
                </div>
            </div>

            <CreateBattleModal open={isBattleModalOpen} onOpenChange={setIsBattleModalOpen} />
            <CreateWarModal open={isWarModalOpen} onOpenChange={setIsWarModalOpen} />
            {activeBattleId && <LiveBattleRoom battleId={activeBattleId} onClose={() => setActiveBattleId(null)} />}
            {activeWarId && <CampusWarRoom warId={activeWarId} onClose={() => setActiveWarId(null)} />}

            <Sheet open={showHallOfFame} onOpenChange={setShowHallOfFame}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[3.5rem] overflow-y-auto border-t-8 border-amber-500">
                    <SheetHeader className="mb-8"><SheetTitle className="text-3xl font-black text-center italic flex items-center justify-center gap-3"><Trophy className="text-amber-500" size={32} /> THE NATIONAL ARCHIVES</SheetTitle></SheetHeader>
                    <HallOfFame />
                </SheetContent>
            </Sheet>
        </div>
    )
}
