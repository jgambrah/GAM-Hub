'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward, PlusCircle, ArrowDown, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer } from './VibePlayerContext';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

/**
 * CampusPulseFeed Component
 * 
 * Implements the "Bucketed Retrieval Strategy" for discoverability at scale.
 * This ensures the candidate pool is diverse and relevant without loading the entire DB.
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
     * 🏗️ THE BUCKETED RETRIEVAL COMMAND
     * Pipeline: Firestore Retrieval -> Vector Filter -> Local Ranking -> AI Selection
     */
    const fetchBucketedCandidates = async () => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        
        try {
            // Bucket 1: RECENT (National Hub - 200 candidates)
            const recentQuery = query(
                pulseRef,
                orderBy('createdAt', 'desc'),
                limit(200)
            );

            // Bucket 2: TRENDING (High Velocity - 150 candidates)
            const trendingStatsQuery = query(
                collection(firestore, 'trending_stats'),
                orderBy('trendScore', 'desc'),
                limit(150)
            );

            // Bucket 3: LOCAL CAMPUS (Specific Yard - 100 candidates)
            const campusQuery = query(
                pulseRef,
                where('campusId', '==', activeCampusId),
                orderBy('createdAt', 'desc'),
                limit(100)
            );

            // Liaison Handshake: Parallel retrieval for speed
            const [recentSnap, trendingSnap, campusSnap] = await Promise.all([
                getDocs(recentQuery),
                getDocs(trendingStatsQuery),
                getDocs(campusQuery)
            ]);

            const mergedMap = new Map<string, SocialPost>();
            
            // 1. Add direct post data from snaps
            [...recentSnap.docs, ...campusSnap.docs].forEach(doc => {
                mergedMap.set(doc.id, { id: doc.id, ...doc.data() } as SocialPost);
            });

            // 2. Hydrate Trending IDs (those not already in the map)
            const trendingIds = trendingSnap.docs.map(d => d.id);
            const missingIds = trendingIds.filter(id => !mergedMap.has(id));
            
            if (missingIds.length > 0) {
                // Fetch missing high-velocity post data (limited batch for performance)
                const missingFetches = missingIds.slice(0, 30).map(id => getDoc(doc(firestore, 'campus_pulse', id)));
                const missingSnaps = await Promise.all(missingFetches);
                missingSnaps.forEach(snap => {
                    if (snap.exists()) {
                        mergedMap.set(snap.id, { id: snap.id, ...snap.data() } as SocialPost);
                    }
                });
            }

            const finalPool = Array.from(mergedMap.values());

            // Push to the Vector Pipeline in VibePlayerContext
            setPosts(finalPool);
            addToQueue(finalPool);

            // Fetch Official SRC Bulletin separately for pinning
            const srcQuery = query(
                collection(firestore, 'src_posts'),
                where('campusId', '==', activeCampusId),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const srcSnap = await getDocs(srcQuery);
            setSrcPosts(srcSnap.docs.map(d => ({ id: d.id, ...d.data() } as SrcPost)));

        } catch (err) {
            console.error("Liaison Bucketed Retrieval Error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBucketedCandidates();
    }, [firestore, activeCampusId, user?.id, isTokenReady]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchBucketedCandidates();
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
                        <Zap size={20} className={isContinuous ? "animate-pulse" : ""} fill={isContinuous ? "currentColor" : "none"} />
                    </div>
                    <div>
                        <h4 className="font-black text-sm tracking-tight">Bucketed Discovery</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline:</span>
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={10} /> Active
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