'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import SocialPostCard from './social-post-card';
import { Sparkles, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

/**
 * CampusPulseFeed Component
 * 
 * THE HARDENED PULSE: Targets the flat 'campus_pulse' collection.
 * Uses 'isTokenReady' to prevent Liaison identity race conditions and ensure
 * read permissions are correctly validated by the fortress.
 */
export default function CampusPulseFeed({
    activeCampusId,
    filterTag,
    tab = 'all',
}: {
    activeCampusId: string;
    filterTag?: string;
    tab?: 'all' | 'vlogs';
}) {
    const { firestore } = useFirebase();
    const { user, isTokenReady } = useAuth();
    
    const socialQuery = useMemoFirebase(() => {
        // 1. HARDENED GUARD: Wait for full authentication handshake and Firestore readiness
        if (!firestore || !activeCampusId || !user || !isTokenReady) return null;
        if (tab !== 'all' && tab !== 'vlogs') return null;

        // 2. Query the FLAT Root Collection
        const pulseRef = collection(firestore, 'campus_pulse');
        const constraints: QueryConstraint[] = [];
        
        // Segregation Logic: Filter by the current campus context
        if (activeCampusId !== 'all') {
            constraints.push(where('campusId', '==', activeCampusId));
        }

        if (filterTag && filterTag !== 'All') {
            constraints.push(where('tags', 'array-contains', filterTag.toLowerCase()));
        }
        
        if (tab === 'vlogs') {
            constraints.push(where('mediaType', 'in', ['video', 'youtube', 'tiktok']));
        }

        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(20));

        return query(pulseRef, ...constraints);
    }, [firestore, activeCampusId, filterTag, tab, user?.id, isTokenReady]);

    const srcQuery = useMemoFirebase(() => {
        // Apply the same hardened guard to SRC bulletins
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

    if (error) {
        // If this fires, it's 99% a missing Composite Index or a persistent identity drift
        console.error("Pulse Error: Check Composite Indexes for campus_pulse", error);
        return (
            <div className="p-10 text-center bg-red-50 dark:bg-red-950/20 rounded-[3rem] border-2 border-red-100 dark:border-red-900/50">
                <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4">Vibration Mismatch</p>
                <p className="text-xs text-slate-500 mb-6 italic leading-relaxed">
                    Access Denied. Ensure the national composite indexes (campusId + createdAt) are provisioned.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 mx-auto bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-red-700 transition-all active:scale-95"
                >
                    <RefreshCcw size={14} /> Re-sync Identity
                </button>
            </div>
        );
    }

    const unifiedPosts = useMemo(() => {
        if (!posts) return [];
        
        const mappedSrc: SocialPost[] = (srcPosts || []).map(p => ({
            id: p.id,
            authorId: p.authorId,
            authorName: 'SRC Official',
            authorAvatarUrl: '', 
            campusId: p.campusId,
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

        return [...mappedSrc, ...posts].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [posts, srcPosts]);

    // Ensure we don't show the feed until the token is fully synchronized
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
            {unifiedPosts.length === 0 ? (
                <div className="text-center py-24 bg-card rounded-[3rem] border-2 border-dashed border-border/50 col-span-full">
                    <Sparkles className="mx-auto h-16 w-16 text-muted-foreground/20 mb-6" />
                    <p className="text-xl font-black text-foreground">The Pulse is Silent</p>
                    <p className="text-sm text-muted-foreground mt-2">No vibrations detected on this campus yet.</p>
                </div>
            ) : (
                unifiedPosts.map((post) => (
                    <SocialPostCard key={post.id} post={post} />
                ))
            )}
        </div>
    );
}
