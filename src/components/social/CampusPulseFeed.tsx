'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, type DocumentSnapshot } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward, TrendingUp, Shuffle, Hash, Search as SearchIcon, Loader2, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer } from './VibePlayerContext';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { generateQueryEmbedding } from '@/ai/flows/generate-query-embedding';
import { FEED_STRATEGIES, DEFAULT_STRATEGY, type FeedStrategyId } from '@/lib/feed-strategies';
import { recordBanditTrial } from '@/lib/bandit-learning';

const BATCH_SIZE = 20;

/**
 * CampusPulseFeed Component
 * 
 * Implements the "Infinite Feed Engagement Loop".
 * Upgraded with Pagination, Instant Start, and MAB Feed Construction.
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
    const { isLoaded: isProfileLoaded, currentStrategy, getPersonalScore } = useVibeProfile();
    
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [srcPosts, setSrcPosts] = useState<SrcPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [queryVector, setQueryVector] = useState<number[] | null>(null);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const fetchBatch = async (isLoadMore = false) => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        if (!isLoadMore) setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        const tagToFilter = activeTag || (searchQuery.startsWith('#') ? searchQuery.slice(1).toLowerCase() : null);
        
        try {
            if (!isLoadMore && searchQuery.trim() && !searchQuery.startsWith('#')) {
                setIsEmbedding(true);
                const vector = await generateQueryEmbedding(searchQuery);
                setQueryVector(vector);
                setIsEmbedding(false);
            }

            // Retrieval Logic: Paginated Batch
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
            addToQueue(newPosts);

            // Auto-Start Loop: Set first post as active if none is active on initial load
            if (!isLoadMore && newPosts.length > 0 && !activePostId) {
                setActivePost(newPosts[0]);
            }

            if (!isLoadMore) {
                const srcQuery = query(
                    collection(firestore, 'src_posts'),
                    where('campusId', '==', activeCampusId),
                    orderBy('createdAt', 'desc'),
                    limit(3)
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

        const strategyId = currentStrategy || DEFAULT_STRATEGY;
        const config = FEED_STRATEGIES[strategyId];

        // 🎰 STAGE 1: CLASSIFY BATCH CANDIDATES
        // Since we fetch in small batches now, we rank within the batch to preserve diversity
        const rankedBatch = posts
            .map(p => ({ ...p, pScore: getPersonalScore(p) }))
            .sort((a, b) => b.pScore - a.pScore);

        const diverseBatch = enforceDiversity(rankedBatch);

        // STAGE 2: MAPPED SRC (Pinned at top of initial load)
        const mappedSrc: SocialPost[] = (srcPosts || []).map(p => ({
            id: p.id,
            authorId: p.authorId,
            authorName: 'SRC Official',
            authorAvatarUrl: '', 
            campusId: p.campusId,
            campusAcronym: p.campusId.toUpperCase(),
            content: p.content,
            title: p.title,
            mediaType: p.mediaUrls && p.mediaUrls.length > 0 ? 'image' : 'text',
            imageUrl: p.mediaUrls && p.mediaUrls.length > 0 ? p.mediaUrls[0] : null,
            createdAt: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : new Date().toISOString(),
            likes: 0,
            commentCount: 0,
            type: 'src_official',
            isOfficial: true
        }));

        return lastDoc ? diverseBatch : [...mappedSrc, ...diverseBatch];
    }, [posts, srcPosts, currentStrategy, getPersonalScore, lastDoc]);

    return (
        <div className="space-y-8 pb-20">
            {activeTag && (
                <div className="flex items-center gap-3 px-2">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                        <Hash size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white">#{activeTag}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Hashtag Hub</p>
                    </div>
                </div>
            )}

            {searchQuery && !activeTag && (
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <SearchIcon size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                {isEmbedding ? 'Understanding meaning...' : `Results for "${searchQuery}"`}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Zap size={10} className="text-indigo-500 fill-indigo-500" /> 
                                {queryVector ? 'Hybrid Personalized Engine Active' : 'Keyword Discovery Pool'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "p-6 rounded-[2.5rem] shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 border-b-4 animate-in slide-in-from-top-4",
                tab === 'shoppable' ? "bg-indigo-950 text-white border-amber-500" : "bg-slate-900 text-white border-blue-500"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl transition-all", isContinuous ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-white/10")}>
                        {tab === 'shoppable' ? <ShoppingBag size={20} className="text-amber-400" /> : <Shuffle size={20} className={isContinuous ? "animate-spin-slow" : ""} />}
                    </div>
                    <div>
                        <h4 className="font-black text-sm tracking-tight">
                            {tab === 'shoppable' ? 'Trending Shoppable Hub' : searchQuery ? 'Personalized Search Stream' : 'Liaison Optimization'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Strategy:</span>
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={10} /> {currentStrategy || 'Learning...'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing || isLoading}
                        className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90 disabled:opacity-50"
                        title="Re-sync Yard"
                    >
                        <RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} />
                    </button>
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-black uppercase text-slate-400">Autoplay</span>
                        <Switch checked={isContinuous} onCheckedChange={setIsContinuous} className="data-[state=checked]:bg-blue-600" />
                    </div>
                </div>
            </div>

            {isLoading && posts.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-96 rounded-[2.5rem]" />
                    <Skeleton className="h-96 rounded-[2.5rem]" />
                    <Skeleton className="h-96 rounded-[2.5rem]" />
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="p-20 text-center bg-white dark:bg-card rounded-[3rem] border-2 border-dashed">
                    <SearchIcon className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                    <p className="font-black text-slate-400 uppercase tracking-widest">The Signal is Quiet</p>
                    <p className="text-xs text-slate-300 mt-2">No matching vibes found. Try searching for broader topics.</p>
                </div>
            ) : (
                <>
                    <VibeFeed posts={filteredPosts} searchQuery={searchQuery} />
                    {hasMore && (
                        <div className="flex justify-center pt-8">
                            <Button 
                                variant="ghost" 
                                onClick={() => fetchBatch(true)} 
                                disabled={isLoading}
                                className="rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-all"
                            >
                                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <FastForward className="mr-2" />}
                                Load More Vibrations
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
