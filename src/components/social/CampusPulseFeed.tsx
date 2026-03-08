'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import SocialPostCard from './social-post-card';
import { Sparkles, RefreshCcw, SearchX, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

/**
 * CampusPulseFeed Component
 * 
 * THE HARDENED PULSE: Targets the flat 'campus_pulse' collection.
 * Includes search query support and LIAISON GLOBAL BROADCAST awareness.
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
    
    const socialQuery = useMemoFirebase(() => {
        if (!firestore || !activeCampusId || !user || !isTokenReady) return null;
        
        const pulseRef = collection(firestore, 'campus_pulse');
        const constraints: QueryConstraint[] = [];
        
        // SEEDING LOGIC: If a specific campus is selected, also fetch 'all' (Liaison global vibes)
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

        // --- INTELLIGENT SEARCH FILTER ---
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-96 rounded-3xl" />
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPosts.length === 0 ? (
                <div className="text-center py-24 bg-card rounded-[3rem] border-2 border-dashed border-border/50 col-span-full">
                    {searchQuery ? (
                        <>
                            <SearchX className="mx-auto h-16 w-16 text-muted-foreground/20 mb-6" />
                            <p className="text-xl font-black text-foreground">No matches found</p>
                            <p className="text-sm text-muted-foreground mt-2 italic">Try different keywords or tags.</p>
                        </>
                    ) : (
                        <>
                            <Sparkles className="mx-auto h-16 w-16 text-muted-foreground/20 mb-6" />
                            <p className="text-xl font-black text-foreground">The Pulse is Silent</p>
                            <p className="text-sm text-muted-foreground mt-2">No vibrations detected on this campus yet.</p>
                        </>
                    )}
                </div>
            ) : (
                filteredPosts.map((post) => (
                    <div key={post.id} className="relative group">
                        {post.campusId === 'all' && (
                            <div className="absolute -top-2 -right-2 z-20 animate-in zoom-in duration-500">
                                <div className="bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 border-2 border-card">
                                    <Globe size={10} /> Global Vibe
                                </div>
                            </div>
                        )}
                        <SocialPostCard post={post} />
                    </div>
                ))
            )}
        </div>
    );
}