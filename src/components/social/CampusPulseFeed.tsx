'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import VibeFeed from './VibeFeed';
import { RefreshCcw, Zap, Globe, FastForward } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useVibePlayer } from './VibePlayerContext';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';

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
    const { isContinuous, setIsContinuous, queue } = useVibePlayer();
    
    const socialQuery = useMemoFirebase(() => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return null;
        
        const pulseRef = collection(firestore, 'campus_pulse');
        const constraints: QueryConstraint[] = [];
        
        if (activeCampusId !== 'all') {
            constraints.push(where('campusId', 'in', [activeCampusId, 'all']));
        }

        if (filterTag && filterTag !== 'All') {
            constraints.push(where('tags', 'array-contains', filterTag.toLowerCase()));
        }
        
        if (tab === 'vlogs') {
            constraints.push(where('mediaType', 'in', ['video', 'youtube', 'tiktok']));
        }

        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(50)); 

        return query(pulseRef, ...constraints);
    }, [firestore, activeCampusId, filterTag, tab, user?.id, isTokenReady]);

    const srcQuery = useMemoFirebase(() => {
        if (!firestore || tab !== 'all' || !activeCampusId || activeCampusId === 'all' || !user || !isTokenReady) return null;
        return query(
            collection(firestore, 'src_posts'),
            where('campusId', '==', activeCampusId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
    }, [firestore, tab, activeCampusId, user?.id, isTokenReady]);

    const { data: posts, isLoading: isLoadingPosts, error } = useCollection<SocialPost>(socialQuery);
    const { data: srcPosts, isLoading: isLoadingSrc } = useCollection<SrcPost>(srcQuery);

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

        let combined = [...mappedSrc, ...posts].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

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

    if (error) {
        return (
            <div className="p-10 text-center bg-red-50 dark:bg-red-950/20 rounded-[3rem] border-2 border-red-100 dark:border-red-900/50 col-span-full">
                <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4">Vibration Mismatch</p>
                <button onClick={() => window.location.reload()} className="flex items-center gap-2 mx-auto bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-red-700 transition-all active:scale-95">
                    <RefreshCcw size={14} /> Re-sync Identity
                </button>
            </div>
        );
    }

    if (isLoadingPosts || isLoadingSrc || !isTokenReady) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Skeleton className="h-96 rounded-[2.5rem]" />
                <Skeleton className="h-96 rounded-[2.5rem]" />
                <Skeleton className="h-96 rounded-[2.5rem]" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 border-b-4 border-blue-500 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl transition-all", isContinuous ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]" : "bg-white/10")}>
                        <Zap size={20} className={isContinuous ? "animate-pulse" : ""} fill={isContinuous ? "currentColor" : "none"} />
                    </div>
                    <div>
                        <h4 className="font-black text-sm tracking-tight">Continuous Vibe Mode</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Matching: {isContinuous ? 'ACTIVE' : 'OFF'}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-black uppercase text-slate-400">Autoplay</span>
                        <Switch checked={isContinuous} onCheckedChange={setIsContinuous} className="data-[state=checked]:bg-blue-500" />
                    </div>
                </div>
            </div>

            <VibeFeed posts={filteredPosts} searchQuery={searchQuery} />
        </div>
    );
}
