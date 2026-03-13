'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward, PlusCircle, ArrowDown, TrendingUp, Shuffle, Hash, Search as SearchIcon, Loader2, UserCheck, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer, cosineSimilarity } from './VibePlayerContext';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { generateQueryEmbedding } from '@/ai/flows/generate-query-embedding';
import { FEED_STRATEGIES, DEFAULT_STRATEGY } from '@/lib/feed-strategies';

/**
 * CampusPulseFeed Component
 * 
 * Implements the "Blended Bucketed Retrieval Strategy" (Multi-Armed Bandit).
 * Upgraded with Personalized Hybrid Semantic Search and MAB Feed Construction.
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
    const { isContinuous, setIsContinuous, addToQueue } = useVibePlayer();
    const { getTopInterests, isLoaded: isProfileLoaded, currentStrategy, getPersonalScore } = useVibeProfile();
    
    const [posts, setPosts] = useState<SocialPost[]>();
    const [srcPosts, setSrcPosts] = useState<SrcPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [queryVector, setQueryVector] = useState<number[] | null>(null);

    const fetchBlendedCandidates = async () => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        const tagToFilter = activeTag || (searchQuery.startsWith('#') ? searchQuery.slice(1).toLowerCase() : null);
        
        try {
            if (searchQuery.trim() && !searchQuery.startsWith('#')) {
                setIsEmbedding(true);
                const vector = await generateQueryEmbedding(searchQuery);
                setQueryVector(vector);
                setIsEmbedding(false);
            } else {
                setQueryVector(null);
            }

            // Retrieval Buckets
            let recentQuery = tagToFilter 
                ? query(pulseRef, where('tags', 'array-contains', tagToFilter), orderBy('createdAt', 'desc'), limit(200))
                : query(pulseRef, orderBy('createdAt', 'desc'), limit(400));

            const trendingStatsQuery = query(
                collection(firestore, 'trending_stats'),
                orderBy('trendScore', 'desc'),
                limit(150)
            );

            const campusQuery = tagToFilter
                ? query(pulseRef, where('campusId', '==', activeCampusId), where('tags', 'array-contains', tagToFilter), orderBy('createdAt', 'desc'), limit(150))
                : query(pulseRef, where('campusId', '==', activeCampusId), orderBy('createdAt', 'desc'), limit(150));

            const [recentSnap, trendingSnap, campusSnap] = await Promise.all([
                getDocs(recentQuery),
                getDocs(trendingStatsQuery),
                getDocs(campusQuery)
            ]);

            const trendingDocs = trendingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const trendingMap = new Map(trendingDocs.map(d => [d.id, d]));

            const mergedMap = new Map<string, SocialPost>();
            
            const addDocsToMap = (snap: any) => {
                snap.docs.forEach((doc: any) => {
                    if (!mergedMap.has(doc.id)) {
                        const stats = trendingMap.get(doc.id);
                        mergedMap.set(doc.id, { 
                            id: doc.id, 
                            ...doc.data(), 
                            trendScore: stats?.trendScore || 0 
                        } as SocialPost);
                    }
                });
            };

            addDocsToMap(recentSnap);
            addDocsToMap(campusSnap);

            const finalPool = Array.from(mergedMap.values());
            setPosts(finalPool);
            addToQueue(finalPool);

            const srcQuery = query(
                collection(firestore, 'src_posts'),
                where('campusId', '==', activeCampusId),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const srcSnap = await getDocs(srcQuery);
            setSrcPosts(srcSnap.docs.map(d => ({ id: d.id, ...d.data() } as SrcPost)));

        } catch (err) {
            console.error("Liaison Blended Retrieval Error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsEmbedding(false);
        }
    };

    useEffect(() => {
        fetchBlendedCandidates();
    }, [firestore, activeCampusId, user?.id, isTokenReady, activeTag, searchQuery, tab]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchBlendedCandidates();
    };

    const filteredPosts = useMemo(() => {
        if (!posts) return [];

        const strategyId = currentStrategy || DEFAULT_STRATEGY;
        const config = FEED_STRATEGIES[strategyId];

        // 🎰 STAGE 1: PARTITION INTO MAB BUCKETS
        const trendingCandidates = posts
            .filter(p => (p.trendScore || 0) > 15)
            .sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0));

        const exploreCandidates = posts
            .filter(p => p.likes < 10)
            .sort(() => Math.random() - 0.5);

        const personalizedCandidates = posts
            .filter(p => !trendingCandidates.includes(p)) // Exclude obvious trending to rank specifically for user
            .map(p => ({ ...p, pScore: getPersonalScore(p) }))
            .sort((a, b) => b.pScore - a.pScore);

        // 🎰 STAGE 2: APPLY STRATEGY WEIGHTS (Target size: 40)
        const totalSize = 40;
        const pCount = Math.floor(config.personalized * totalSize);
        const tCount = Math.floor(config.trending * totalSize);
        const eCount = Math.floor(config.explore * totalSize);

        const constructedFeed = [
            ...personalizedCandidates.slice(0, pCount),
            ...trendingCandidates.slice(0, tCount),
            ...exploreCandidates.slice(0, eCount)
        ];

        // 🎰 STAGE 3: SHUFFLE TO AVOID PATTERN BIAS
        constructedFeed.sort(() => Math.random() - 0.5);

        // STAGE 4: MAPPED SRC (Pinned at top)
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

        return [...mappedSrc, ...constructedFeed];
    }, [posts, srcPosts, currentStrategy, getPersonalScore]);

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
                        {tab === 'shoppable' ? <ShoppingBag size(20) className="text-amber-400" /> : <Shuffle size={20} className={isContinuous ? "animate-spin-slow" : ""} />}
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

            {isLoading && (!posts || posts.length === 0) ? (
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
                <VibeFeed posts={filteredPosts} searchQuery={searchQuery} />
            )}
        </div>
    );
}
