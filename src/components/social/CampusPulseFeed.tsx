
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward, PlusCircle, ArrowDown, TrendingUp, Shuffle, Hash, Search as SearchIcon, Loader2, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer, cosineSimilarity } from './VibePlayerContext';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { generateQueryEmbedding } from '@/ai/flows/generate-query-embedding';

/**
 * CampusPulseFeed Component
 * 
 * Implements the "Blended Bucketed Retrieval Strategy" (Multi-Armed Bandit).
 * Upgraded with Personalized Hybrid Semantic Search (Vector Similarity + Hashtag Matching + Interest Boost).
 */
export default function CampusPulseFeed({
    activeCampusId,
    searchQuery = '',
    tab = 'all',
    activeTag,
}: {
    activeCampusId: string;
    searchQuery?: string;
    tab?: 'all' | 'vlogs' | 'people' | 'market';
    activeTag?: string;
}) {
    const { firestore } = useFirebase();
    const { user, isTokenReady } = useAuth();
    const { isContinuous, setIsContinuous, addToQueue } = useVibePlayer();
    const { getTopInterests, isLoaded: isProfileLoaded } = useVibeProfile();
    
    const [posts, setPosts] = useState<SocialPost[]>();
    const [srcPosts, setSrcPosts] = useState<SrcPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [queryVector, setQueryVector] = useState<number[] | null>(null);

    /**
     * 🏗️ THE BLENDED RETRIEVAL COMMAND
     * Pipeline: Firestore Retrieval (4 Buckets) -> Vector Blending -> Local Hybrid Ranking
     */
    const fetchBlendedCandidates = async () => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        const tagToFilter = activeTag || (searchQuery.startsWith('#') ? searchQuery.slice(1).toLowerCase() : null);
        
        try {
            // 🧠 SEMANTIC PASS: Generate embedding for search queries
            if (searchQuery.trim() && !searchQuery.startsWith('#')) {
                setIsEmbedding(true);
                const vector = await generateQueryEmbedding(searchQuery);
                setQueryVector(vector);
                setIsEmbedding(false);
            } else {
                setQueryVector(null);
            }

            // Bucket 1: RECENT (National Hub)
            const recentQuery = tagToFilter 
                ? query(pulseRef, where('tags', 'array-contains', tagToFilter), orderBy('createdAt', 'desc'), limit(150))
                : query(pulseRef, orderBy('createdAt', 'desc'), limit(250));

            // Bucket 2: TRENDING (High Velocity)
            const trendingStatsQuery = query(
                collection(firestore, 'trending_stats'),
                orderBy('trendScore', 'desc'),
                limit(150)
            );

            // Bucket 3: LOCAL CAMPUS
            const campusQuery = tagToFilter
                ? query(pulseRef, where('campusId', '==', activeCampusId), where('tags', 'array-contains', tagToFilter), orderBy('createdAt', 'desc'), limit(100))
                : query(pulseRef, where('campusId', '==', activeCampusId), orderBy('createdAt', 'desc'), limit(100));

            // Bucket 4: EXPLORATION
            const explorationQuery = tagToFilter
                ? query(pulseRef, where('tags', 'array-contains', tagToFilter), limit(50))
                : query(pulseRef, where('likes', '<', 10), orderBy('likes', 'asc'), orderBy('createdAt', 'desc'), limit(50));

            // 🛰️ STAGE 1: Parallel broad candidate retrieval
            const [recentSnap, trendingSnap, campusSnap, explorationSnap] = await Promise.all([
                getDocs(recentQuery),
                getDocs(trendingStatsQuery),
                getDocs(campusQuery),
                getDocs(explorationQuery)
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
            addDocsToMap(explorationSnap);

            // 🏎️ TRENDING HYDRATION: Fetch post data for IDs in trending stats
            const trendingIds = trendingDocs.map((d: any) => d.id);
            const missingIds = trendingIds.filter((id: string) => !mergedMap.has(id));
            if (missingIds.length > 0) {
                const missingSnaps = await Promise.all(missingIds.slice(0, 50).map((id: string) => getDoc(doc(firestore, 'campus_pulse', id))));
                missingSnaps.forEach(snap => {
                    if (snap.exists()) {
                        const stats = trendingMap.get(snap.id);
                        const postData = { 
                            id: snap.id, 
                            ...snap.data(), 
                            trendScore: stats?.trendScore || 0 
                        } as SocialPost;
                        if (!tagToFilter || postData.tags?.includes(tagToFilter)) {
                            mergedMap.set(snap.id, postData);
                        }
                    }
                });
            }

            const finalPool = Array.from(mergedMap.values());
            setPosts(finalPool);
            addToQueue(finalPool);

            // Fetch Official SRC Bulletin
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
    }, [firestore, activeCampusId, user?.id, isTokenReady, activeTag, searchQuery]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchBlendedCandidates();
    };

    const filteredPosts = useMemo(() => {
        if (!posts) return [];

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

        let combined = [...mappedSrc, ...posts];

        // 🧠 STAGE 2: HYBRID PERSONALIZED RANKING (Semantic + Keyword + Trend + Quality + Interest)
        if (queryVector || (searchQuery.trim() && !searchQuery.startsWith('#'))) {
            const userInterests = new Set(getTopInterests(20).map(t => t.toLowerCase()));
            
            combined = combined
                .map(post => {
                    // 1. Semantic Similarity (0.6 weight)
                    const similarity = (queryVector && post.embedding) ? cosineSimilarity(queryVector, post.embedding) : 0;
                    
                    // 2. Exact Keyword Match (0.2 weight)
                    const term = searchQuery.toLowerCase().trim();
                    const queryWords = term.split(/\s+/).filter(w => w.length > 2);
                    const postTags = new Set([
                        ...(post.tags || []),
                        ...(post.aiTags || [])
                    ].map(t => t.toLowerCase()));
                    
                    const tagMatchCount = queryWords.filter(w => postTags.has(w)).length;
                    const hashtagMatch = Math.min(tagMatchCount / Math.max(queryWords.length, 1), 1);
                    const contentMatch = post.content?.toLowerCase().includes(term) ? 0.2 : 0;

                    // 3. Trending Boost (0.1 weight)
                    const trendingBoost = post.trendScore ? Math.min(post.trendScore / 100, 1) : 0;

                    // 4. Creator Quality (0.1 weight)
                    const creatorScore = post.authorQualityScore ? post.authorQualityScore / 100 : 0.5;

                    // 🎯 5. PERSONALIZATION BOOST (0.15 weight)
                    let personalizationBoost = 0;
                    const matchesInterest = Array.from(postTags).some(t => userInterests.has(t));
                    if (matchesInterest) {
                        personalizationBoost = 0.15;
                    }

                    // Compute Professional Hybrid Personalized Score
                    const finalScore = (similarity * 0.6) + (Math.max(hashtagMatch, contentMatch) * 0.2) + (trendingBoost * 0.1) + (creatorScore * 0.1) + personalizationBoost;

                    return { ...post, searchScore: finalScore, matchesInterest };
                })
                .filter(post => {
                    if (queryVector) return (post as any).searchScore > 0.25;
                    const term = searchQuery.toLowerCase().trim();
                    return post.content?.toLowerCase().includes(term) || post.authorName?.toLowerCase().includes(term) || (post as any).searchScore > 0.3;
                })
                .sort((a, b) => (b as any).searchScore - (a as any).searchScore);
        }

        return combined;
    }, [posts, srcPosts, searchQuery, queryVector, getTopInterests]);

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
                    {queryVector && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800 animate-in zoom-in flex items-center gap-2">
                            <UserCheck size={10} className="text-indigo-600" />
                            <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Interest Matched</span>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 border-b-4 border-blue-500 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl transition-all", isContinuous ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-white/10")}>
                        <Shuffle size={20} className={isContinuous ? "animate-spin-slow" : ""} />
                    </div>
                    <div>
                        <h4 className="font-black text-sm tracking-tight">{searchQuery ? 'Personalized Search Stream' : 'Blended Discovery'}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Algorithm:</span>
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={10} /> {searchQuery ? 'Semantic + Profile' : 'Exploit + Explore'}
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
                    <p className="text-xs text-slate-300 mt-2">No matching vibes found. Try searching for broader topics like "campus life".</p>
                </div>
            ) : (
                <VibeFeed posts={filteredPosts} searchQuery={searchQuery} />
            )}
        </div>
    );
}
