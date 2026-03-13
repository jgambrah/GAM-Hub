'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, type DocumentSnapshot } from 'firebase/firestore';
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
import { DEFAULT_STRATEGY, type FeedStrategyId } from '@/lib/feed-strategies';
import { recordBanditTrial } from '@/lib/bandit-learning';
import { computeVibeScore } from '@/lib/vibe-scoring';

const BATCH_SIZE = 20;

/**
 * CampusPulseFeed Component
 * 
 * The main scroller orchestrator.
 * Implements MAB Strategy Selection, Infinite Loop, and Semantic Search Injection.
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
    
    // 🛍️ COMMERCE ENGINE: Fetch product candidates for injection
    const { products: marketProducts } = useMarketRecommendations(searchQuery);
    
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [srcPosts, setSrcPosts] = useState<SrcPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [queryVector, setQueryVector] = useState<number[] | null>(null);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [globalTrends, setGlobalTrends] = useState<Record<string, number>>({});

    const fetchBatch = async (isLoadMore = false) => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        if (!isLoadMore) setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        const tagToFilter = activeTag || (searchQuery.startsWith('#') ? searchQuery.slice(1).toLowerCase() : null);
        
        try {
            // 🧠 SEMANTIC AI: Generate query vector for search
            if (!isLoadMore && searchQuery.trim() && !searchQuery.startsWith('#')) {
                setIsEmbedding(true);
                const vector = await generateQueryEmbedding(searchQuery);
                setQueryVector(vector);
                setIsEmbedding(false);
            }

            // 🏎️ RETRIEVAL LOGIC: Paginated Batch
            let batchQuery = tagToFilter 
                ? query(pulseRef, where('tags', 'array-contains', tagToFilter), orderBy('createdAt', 'desc'), limit(BATCH_SIZE))
                : query(pulseRef, orderBy('createdAt', 'desc'), limit(BATCH_SIZE));

            if (isLoadMore && lastDoc) {
                batchQuery = query(batchQuery, startAfter(lastDoc));
            }

            const snap = await getDocs(batchQuery);
            if (snap.empty) {
                setHasMore(false);
                if (!isLoadMore) setIsLoading(false);
                return;
            }

            setLastDoc(snap.docs[snap.docs.length - 1]);
            const newPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));

            setPosts(prev => isLoadMore ? [...prev, ...newPosts] : newPosts);
            
            // Register into global pool for prefetching
            addToQueue(newPosts);

            // Auto-Start: set first active if none
            if (!isLoadMore && newPosts.length > 0 && !activePostId) {
                setActivePost(newPosts[0]);
            }

            // Fetch metadata for ranking
            if (!isLoadMore) {
                const srcQuery = query(
                    collection(firestore, 'src_posts'),
                    where('campusId', '==', activeCampusId),
                    orderBy('createdAt', 'desc'),
                    limit(2)
                );
                const srcSnap = await getDocs(srcQuery);
                setSrcPosts(srcSnap.docs.map(d => ({ id: d.id, ...d.data() } as SrcPost)));

                if (currentStrategy) {
                    recordBanditTrial(firestore, currentStrategy as FeedStrategyId);
                }
            }

        } catch (err) {
            console.error("Liaison Batch Retrieval Error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsEmbedding(false);
        }
    };

    useEffect(() => {
        setPosts([]);
        setLastDoc(null);
        setHasMore(true);
        fetchBatch();
    }, [firestore, activeCampusId, user?.id, isTokenReady, activeTag, searchQuery, tab, currentStrategy]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setPosts([]);
        setLastDoc(null);
        setHasMore(true);
        fetchBatch();
    };

    const filteredPosts = useMemo(() => {
        if (!posts || posts.length === 0) return [];

        // 🎰 STAGE 1: NEURAL RANKING
        // Rank candidates using Query Vector, Personal profile, and Trends
        const rankedBatch = posts
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

        // STAGE 2: SRC HANDSHAKE
        const mappedSrc: SocialPost[] = (srcPosts || []).map(p => ({
            id: p.id,
            authorId: p.authorId,
            authorName: 'SRC Official',
            authorAvatarUrl: '', 
            campusId: p.campusId,
            campusAcronym: p.campusId.toUpperCase(),
            content: p.content,
            mediaType: p.mediaUrls && p.mediaUrls.length > 0 ? 'image' : 'text',
            imageUrl: p.mediaUrls && p.mediaUrls.length > 0 ? p.mediaUrls[0] : null,
            createdAt: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : new Date().toISOString(),
            likes: 0,
            commentCount: 0,
            type: 'src_official',
            isOfficial: true
        }));

        return lastDoc && posts.length > BATCH_SIZE ? rankedBatch : [...mappedSrc, ...rankedBatch];
    }, [posts, srcPosts, queryVector, globalTrends, getPersonalScore, sessionProfile, lastDoc]);

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
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ranker:</span>
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={10} /> Neural Retrieval
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

            <VibeFeed 
                posts={filteredPosts} 
                products={marketProducts}
                hasMore={hasMore} 
                onLoadMore={() => fetchBatch(true)} 
                isLoadingMore={isLoading && posts.length > 0}
            />

            {isLoading && posts.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-[500px] rounded-[3rem]" />
                    <Skeleton className="h-[500px] rounded-[3rem]" />
                    <Skeleton className="h-[500px] rounded-[3rem]" />
                </div>
            )}
        </div>
    );
}
