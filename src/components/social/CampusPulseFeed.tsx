
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward, PlusCircle, ArrowDown, TrendingUp, Shuffle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer } from './VibePlayerContext';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

/**
 * CampusPulseFeed Component
 * 
 * Implements the "Blended Bucketed Retrieval Strategy" (Multi-Armed Bandit).
 * This ensures the candidate pool is diverse, including personalized matches,
 * trending viral content, and new vibrations for exploration.
 */
export default function CampusPulseFeed({
    activeCampusId,
    searchQuery = '',
    tab = 'all',
}: {
    activeCampusId: string;
    filterTag?: string;
    searchQuery?: string;
    tab?: 'all' | 'vlogs' | 'people' | 'market';
}) {
    const { firestore } = useFirebase();
    const { user, isTokenReady } = useAuth();
    const { isContinuous, setIsContinuous, addToQueue } = useVibePlayer();
    
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [srcPosts, setSrcPosts] = useState<SrcPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    /**
     * 🏗️ THE BLENDED RETRIEVAL COMMAND
     * Pipeline: Firestore Retrieval (4 Buckets) -> Vector Blending -> Local Ranking
     */
    const fetchBlendedCandidates = async () => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        
        try {
            // Bucket 1: RECENT (National Hub - 150 candidates)
            const recentQuery = query(
                pulseRef,
                orderBy('createdAt', 'desc'),
                limit(150)
            );

            // Bucket 2: TRENDING (High Velocity - 100 candidates)
            const trendingStatsQuery = query(
                collection(firestore, 'trending_stats'),
                orderBy('trendScore', 'desc'),
                limit(100)
            );

            // Bucket 3: LOCAL CAMPUS (Specific Yard - 100 candidates)
            const campusQuery = query(
                pulseRef,
                where('campusId', '==', activeCampusId),
                orderBy('createdAt', 'desc'),
                limit(100)
            );

            // Bucket 4: EXPLORATION (Randomly sampling "under-vibrated" content)
            // We use a different sort order or a random seed if available
            const explorationQuery = query(
                pulseRef,
                where('likes', '<', 5), // Target newer/lesser known content
                orderBy('likes', 'asc'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            // Liaison Handshake: Parallel retrieval
            const [recentSnap, trendingSnap, campusSnap, explorationSnap] = await Promise.all([
                getDocs(recentQuery),
                getDocs(trendingStatsQuery),
                getDocs(campusQuery),
                getDocs(explorationQuery)
            ]);

            const mergedMap = new Map<string, SocialPost>();
            
            // Merge all buckets into a unified pool
            const addDocsToMap = (snap: any, type: SocialPost['type'] = 'regular') => {
                snap.docs.forEach((doc: any) => {
                    if (!mergedMap.has(doc.id)) {
                        mergedMap.set(doc.id, { id: doc.id, ...doc.data() } as SocialPost);
                    }
                });
            };

            addDocsToMap(recentSnap);
            addDocsToMap(campusSnap);
            addDocsToMap(explorationSnap);

            // Hydrate Trending IDs
            const trendingIds = trendingSnap.docs.map(d => d.id);
            const missingIds = trendingIds.filter(id => !mergedMap.has(id));
            if (missingIds.length > 0) {
                const missingSnaps = await Promise.all(missingIds.slice(0, 30).map(id => getDoc(doc(firestore, 'campus_pulse', id))));
                missingSnaps.forEach(snap => {
                    if (snap.exists()) {
                        mergedMap.set(snap.id, { id: snap.id, ...snap.data() } as SocialPost);
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
        }
    };

    useEffect(() => {
        fetchBlendedCandidates();
    }, [firestore, activeCampusId, user?.id, isTokenReady]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchBlendedCandidates();
    };

    const filteredPosts = useMemo(() => {
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

        if (searchQuery.trim()) {
            const term = searchQuery.toLowerCase().trim();
            combined = combined.filter(post => {
                const contentMatch = post.content?.toLowerCase().includes(term);
                const authorMatch = post.authorName?.toLowerCase().includes(term);
                const tagMatch = post.tags?.some(tag => tag.toLowerCase().includes(term));
                return contentMatch || authorMatch || tagMatch;
            });
        }

        return combined;
    }, [posts, srcPosts, searchQuery]);

    return (
        <div className="space-y-8 pb-20">
            <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 border-b-4 border-blue-500 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl transition-all", isContinuous ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-white/10")}>
                        <Shuffle size={20} className={isContinuous ? "animate-spin-slow" : ""} />
                    </div>
                    <div>
                        <h4 className="font-black text-sm tracking-tight">Blended Discovery</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Multi-Armed Bandit:</span>
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={10} /> Exploiting + Exploring
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
                        <Switch checked={isContinuous} onCheckedChange={setIsContinuous} className="data-[state=checked]:bg-blue-500" />
                    </div>
                </div>
            </div>

            {isLoading && posts.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-96 rounded-[2.5rem]" />
                    <Skeleton className="h-96 rounded-[2.5rem]" />
                    <Skeleton className="h-96 rounded-[2.5rem]" />
                </div>
            ) : (
                <VibeFeed posts={filteredPosts} searchQuery={searchQuery} />
            )}
        </div>
    );
}
