
'use client';

import React, { useState, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { ArenaPost, ArenaBattle } from '@/lib/types';
import { Swords, Trophy, Zap, Loader2, Plus, Flame, Sparkles } from 'lucide-react';
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

const INITIAL_LIMIT = 50;

export default function ArenaPage() {
    const { firestore } = useFirebase();
    const { user, isTokenReady } = useAuth();
    const { toast } = useToast();
    
    const [isPosting, setIsPosting] = useState(false);
    const [content, setContent] = useState('');
    const [vibeType, setVibeType] = useState<'shade' | 'celebration'>('celebration');
    const [targetCampus, setTargetCampus] = useState('all');
    
    // BATTLE STATE
    const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
    const [activeBattleId, setActiveBattleId] = useState<string | null>(null);

    const userCampusInfo = user ? staticCampuses.find(c => c.id === user.campusId) : undefined;
    
    // 📡 1. RETRIEVE LIVE BATTLES
    const battlesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'arena_battles'), where('status', '==', 'live'), limit(5));
    }, [firestore]);
    const { data: liveBattles, isLoading: isLoadingBattles } = useCollection<ArenaBattle>(battlesQuery);

    // 📡 2. RETRIEVE BATTLE THREADS (Posts)
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

    return (
        <div className="p-4 bg-muted/50 min-h-screen pb-32">
            <ArenaLeaderboard />
            
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
                        Launch Battle
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
                            <p className="text-[10px] italic mt-2">Launch a live battle to challenge a rival campus.</p>
                        </div>
                    )}
                </div>
            </section>

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
            {activeBattleId && (
                <LiveBattleRoom battleId={activeBattleId} onClose={() => setActiveBattleId(null)} />
            )}
        </div>
    )
}
