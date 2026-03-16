'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, TrendingUp, Shuffle, Search as SearchIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer } from './VibePlayerContext';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { useMarketRecommendations } from '@/hooks/use-market-recommendations';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { generateQueryEmbedding } from '@/ai/flows/generate-query-embedding';
import { recordBanditTrial } from '@/lib/bandit-learning';
import { computeVibeScore } from '@/lib/vibe-scoring';

// LIAISON PROTOCOL: Increase batch size to ensure all recent vibes are visible
const BATCH_SIZE = 100;

/**
 * CampusPulseFeed Component
 * ------------------------
 * The main scroller orchestrator.
 * Upgraded to handle explicit tab filtering and high-capacity retrieval.
 */
export default function CampusPulseFeed({
    activeCampusId,
    searchQuery = '',
    tab = 'all',
    activeTag,
}: {
    activeCampusId: string;
    searchQuery?: string;
    tab?: 'all' | 'vlogs' | 'people' | 'market' | 'shoppable';
    activeTag?: string;
}) {
    const { firestore } = useFirebase();
    const { user, isTokenReady } = useAuth();
    const { isContinuous, setIsContinuous, addToQueue, setActivePost, activePostId } = useVibePlayer();
    const { currentStrategy, getPersonalScore, sessionProfile } = useVibeProfile();
    
    const { products: marketProducts } = useMarketRecommendations(searchQuery);
    
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [queryVector, setQueryVector] = useState<number[] | null>(null);
    const [globalTrends, setGlobalTrends] = useState<Record<string, number>>({});

    // 🏎️ REAL-TIME RETRIEVAL ENGINE
    useEffect(() => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        const tagToFilter = activeTag || (searchQuery.startsWith('#') ? searchQuery.slice(1).toLowerCase() : null);
        
        // 1. Build the base query with campus filtering
        let baseQuery = pulseRef as any;
        if (activeCampusId !== 'all') {
            baseQuery = query(pulseRef, where('campusId', '==', activeCampusId));
        }

        // 2. Add tag filtering if active
        if (tagToFilter) {
            baseQuery = query(baseQuery, where('tags', 'array-contains', tagToFilter));
        }

        // 3. TAB FILTERING: Ensure the query matches the user's discovery intent
        if (tab === 'vlogs' || tab === 'shoppable') {
            // Priority: Surface all video types first
            baseQuery = query(baseQuery, where('mediaType', 'in', ['video', 'native', 'youtube', 'tiktok']));
        }

        // 4. Final Ordering and Limits (Expanded for high visibility)
        const finalQuery = query(baseQuery, orderBy('createdAt', 'desc'), limit(BATCH_SIZE));

        // 🧠 SEMANTIC AI: Generate query vector for search if needed
        if (searchQuery.trim() && !searchQuery.startsWith('#')) {
            setIsEmbedding(true);
            generateQueryEmbedding(searchQuery).then(vector => {
                setQueryVector(vector);
                setIsEmbedding(false);
            });
        }

        // 📡 LIVE HANDSHAKE: onSnapshot for instant updates
        const unsubscribe = onSnapshot(finalQuery, (snapshot) => {
            const newPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
            setPosts(newPosts);
            addToQueue(newPosts);
            
            // Auto-Start first vibe if nothing playing
            if (newPosts.length > 0 && !activePostId) {
                setTimeout(() => setActivePost(newPosts[0]), 500);
            }
            
            setIsLoading(false);
            setIsRefreshing(false);
        }, (err) => {
            console.error("Liaison Pulse Error:", err);
            setIsLoading(false);
        });

        if (currentStrategy) {
            recordBanditTrial(firestore, currentStrategy);
        }

        return () => unsubscribe();
    }, [firestore, activeCampusId, user?.id, isTokenReady, activeTag, searchQuery, tab, currentStrategy, addToQueue, setActivePost, activePostId]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        // onSnapshot handles live updates automatically, this just triggers local visual reset if needed
    };

    const filteredPosts = useMemo(() => {
        if (!posts || posts.length === 0) return [];

        // 🎰 STAGE 1: NEURAL RANKING
        // We calculate scores but preserve the total set to ensure nothing is missing
        return posts
            .map(p => ({ 
                ...p, 
                pScore: computeVibeScore(p, {
                    queryVector,
                    userIntelligence: sessionProfile,
                    globalTrendScores: globalTrends,
                    activeMood: 'all',
                    getPersonalScore
                }) 
            }))
            .sort((a, b) => b.pScore - a.pScore);
    }, [posts, queryVector, globalTrends, getPersonalScore, sessionProfile]);

    return (
        <div className="space-y-8 pb-20">
            {searchQuery && !activeTag && (
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm">
                            <SearchIcon size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                {isEmbedding ? 'Neural Decoding...' : `Discoveries for "${searchQuery}"`}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Zap size={10} className="text-indigo-500 fill-indigo-500" /> 
                                {queryVector ? 'Semantic AI Match Active' : 'Keyword Matrix Pool'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "p-6 rounded-[2.5rem] shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 border-b-4 animate-in slide-in-from-top-4 duration-500",
                tab === 'shoppable' ? "bg-indigo-950 text-white border-amber-500" : "bg-slate-900 text-white border-blue-500"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl transition-all", isContinuous ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-white/10")}>
                        <Shuffle size={20} className={isContinuous ? "animate-spin-slow" : ""} />
                    </div>
                    <div>
                        <h4 className="font-black text-sm tracking-tight">Vibration Pipeline</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status:</span>
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE PULSE
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <button onClick={handleRefresh} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 active:scale-90"><RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} /></button>
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-black uppercase text-slate-400">Autoplay</span>
                        <Switch checked={isContinuous} onCheckedChange={setIsContinuous} className="data-[state=checked]:bg-blue-600" />
                    </div>
                </div>
            </div>

            {isLoading && posts.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-[500px] rounded-[3rem]" />
                    <Skeleton className="h-[500px] rounded-[3rem]" />
                    <Skeleton className="h-[500px] rounded-[3rem]" />
                </div>
            ) : (
                <VibeFeed 
                    posts={filteredPosts} 
                    products={marketProducts}
                    hasMore={false} 
                    isLoadingMore={false}
                />
            )}
        </div>
    );
}
