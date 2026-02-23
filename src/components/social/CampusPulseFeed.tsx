
'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, User as AppUser, SrcPost, Product } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import SocialPostCard from './social-post-card';
import { CommunityConnectCard } from '../connections/student-profile-card';
import { MessageSquare, Trophy, Gavel, Sparkles, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';

/**
 * CampusPulseFeed Component
 * 
 * THE UNIFIED FIX: Targets the flat 'campus_pulse' collection.
 * No longer waits for 'isTokenReady' for reads to eliminate UI lag.
 */
export default function CampusPulseFeed({
    activeCampusId,
    filterTag,
    tab = 'all',
}: {
    activeCampusId: string;
    filterTag?: string;
    searchQuery?: string;
    tab?: 'all' | 'people' | 'market' | 'vlogs';
}) {
    const { firestore } = useFirebase();
    const { user: currentUser, isUserLoading } = useAuth();
    
    const socialQuery = useMemoFirebase(() => {
        // UNIFIED CALL: Target the flat root collection immediately
        if (!firestore || !activeCampusId) return null;
        if (tab !== 'all' && tab !== 'vlogs') return null;

        const constraints: QueryConstraint[] = [];
        const pulseRef = collection(firestore, 'campus_pulse');
        
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
    }, [firestore, activeCampusId, filterTag, tab]);

    const srcQuery = useMemoFirebase(() => {
        if (!firestore || tab !== 'all' || !activeCampusId || activeCampusId === 'all') return null;
        return query(
            collection(firestore, 'src_posts'),
            where('campusId', '==', activeCampusId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
    }, [firestore, tab, activeCampusId]);

    const { data: posts, isLoading: isLoadingPosts, error } = useCollection<SocialPost>(socialQuery);
    const { data: srcPosts, isLoading: isLoadingSrc } = useCollection<SrcPost>(srcQuery);

    // LIAISON IDENTITY REFRESH
    if (error) {
        return (
            <div className="p-10 text-center bg-red-50 dark:bg-red-950/20 rounded-[3rem] border-2 border-red-100 dark:border-red-900/50">
                <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4">Identity Sync Required</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 mx-auto bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-red-700 transition-all"
                >
                    <RefreshCcw size={14} /> Refresh Handshake
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

    if (isLoadingPosts || isLoadingSrc) {
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
                unifiedPosts.map((post) => {
                    if (post.type === 'election_winner') {
                        return (
                            <div key={post.id} className="md:col-span-2 bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden mb-6">
                              <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><Trophy size={150} /></div>
                              <div className="relative z-10 text-center">
                                <div className="bg-amber-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase w-fit mx-auto mb-6">Official Result</div>
                                <h2 className="text-3xl font-black italic tracking-tighter">Congratulations {post.winnerName}</h2>
                                <p className="text-amber-400 font-bold uppercase tracking-widest text-xs mt-1">Elected {post.position}</p>
                                <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-[2rem] max-w-xl mx-auto">
                                    <p className="text-sm text-slate-300 leading-relaxed italic">"{post.content}"</p>
                                </div>
                              </div>
                            </div>
                          );
                    }
                    return <SocialPostCard key={post.id} post={post} />;
                })
            )}
        </div>
    );
}
