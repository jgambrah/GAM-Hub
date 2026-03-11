'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward, PlusCircle, ArrowDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer } from './VibePlayerContext';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

const INITIAL_LIMIT = 50;
const LOAD_MORE_BATCH = 50;

/**
 * CampusPulseFeed Component
 * 
 * Implements the "Bucketed Retrieval Strategy" for discoverability at scale.
 * Fetches multiple candidate pools (Recent, Trending, Global) and merges them
 * to feed the 3-Stage Ranking Pipeline.
 */
export default function CampusPulseFeed({
    activeCampusId,
    filterTag,
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
    const [limitCount, setLimitCount] = useState(INITIAL_LIMIT);
    const [isRefreshing, setIsRefreshing] = useState(false);

    /**
     * 🏗️ THE BUCKETED RETRIEVAL COMMAND
     * Fetches candidates from multiple distinct Firestore indexes.
     */
    const fetchBucketedCandidates = async () => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return;
        
        setIsLoading(true);
        const pulseRef = collection(firestore, 'campus_pulse');
        
        try {
            // Bucket 1: RECENT (The local yard)
            const recentQuery = query(
                pulseRef,
                where('campusId', '==', activeCampusId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );

            // Bucket 2: GLOBAL (The national pulse)
            const globalQuery = query(
                pulseRef,
                where('campusId', '==', 'all'),
                orderBy('createdAt', 'desc'),
                limit(30)
            );

            // Bucket 3: LIAISON SEED (Official high-vibe boosts)
            const seedQuery = query(
                pulseRef,
                where('isLiaisonSeed', '==', true),
                limit(10)
            );

            const [recentSnap, globalSnap, seedSnap] = await Promise.all([
                getDocs(recentQuery),
                getDocs(globalQuery),
                getDocs(seedQuery)
            ]);

            const mergedMap = new Map<string, SocialPost>();
            
            [...seedSnap.docs, ...globalSnap.docs, ...recentSnap.docs].forEach(doc => {
                mergedMap.set(doc.id, { id: doc.id, ...doc.data() } as SocialPost);
            });

            const finalPool = Array.from(mergedMap.values()).sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setPosts(finalPool);
            addToQueue(finalPool);

            // Fetch Official SRC Bulletin separately
            const srcQuery = query(
                collection(firestore, 'src_posts'),
                where('campusId', '==', activeCampusId),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const srcSnap = await getDocs(srcQuery);
            setSrcPosts(srcSnap.docs.map(d => ({ id: d.id, ...d.data() } as SrcPost)));

        } catch (err) {
            console.error("Liaison Retrieval Error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBucketedCandidates();
    }, [firestore, activeCampusId, user?.id, isTokenReady, limitCount]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setLimitCount(INITIAL_LIMIT);
        fetchBucketedCandidates();
    };

    const handleLoadMore = () => {
        setLimitCount(prev => prev + LOAD_MORE_BATCH);
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
                const titleMatch = post.title?.toLowerCase().includes(term);
                const authorMatch = post.authorName?.toLowerCase().includes(term);
                const tagMatch = post.tags?.some(tag => tag.toLowerCase().includes(term));
                return contentMatch || titleMatch || authorMatch || tagMatch;
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
                        <h4 className="font-black text-sm tracking-tight">Continuous Discovery</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bucket Retrieval: ACTIVE</p>
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
                <>
                    <VibeFeed posts={filteredPosts} searchQuery={searchQuery} />
                    
                    <div className="flex flex-col items-center gap-4 pt-10">
                        <Button 
                            onClick={handleLoadMore} 
                            disabled={isLoading}
                            className="bg-slate-900 text-white rounded-[1.5rem] px-10 py-6 h-auto font-black text-sm shadow-xl active:scale-95 transition-all"
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" size={18} />}
                            Expand Candidate Pool
                        </Button>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discovery Engine: {posts.length} vibes indexed</p>
                    </div>
                </>
            )}
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return <RefreshCcw className={cn("animate-spin", className)} />;
}
