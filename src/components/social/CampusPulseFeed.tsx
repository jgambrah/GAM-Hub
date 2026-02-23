'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, User as AppUser, SrcPost, Product } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import SocialPostCard from './social-post-card';
import { CommunityConnectCard } from '../connections/student-profile-card';
import { MessageSquare, Users, ShoppingBag, Trophy, Gavel } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';

/**
 * CampusPulseFeed Component
 * 
 * Fetches and displays the social heartbeat of a campus.
 * Updated to use the TOP-LEVEL social_posts collection for rule compliance.
 */
export default function CampusPulseFeed({
    activeCampusId,
    filterTag,
    searchQuery,
    tab = 'all',
}: {
    activeCampusId: string;
    filterTag?: string;
    searchQuery?: string;
    tab?: 'all' | 'people' | 'market' | 'vlogs';
}) {
    const { firestore } = useFirebase();
    const { user: currentUser, isUserLoading, isTokenReady } = useAuth();
    
    // --- QUERIES ---
    const socialQuery = useMemoFirebase(() => {
        // ✅ QUERY GUARD: Wait for token readiness and valid campus
        if (!firestore || !isTokenReady || !activeCampusId) return null;
        if (tab !== 'all' && tab !== 'vlogs') return null;

        const constraints: QueryConstraint[] = [];
        
        // Filter by campus at the top level
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

        // Use the Top-Level Unified Path to satisfy 'allow read: if true' rule
        return query(collection(firestore, 'social_posts'), ...constraints);
    }, [firestore, activeCampusId, filterTag, tab, isTokenReady]);

    const srcQuery = useMemoFirebase(() => {
        if (!firestore || !isTokenReady || tab !== 'all' || !activeCampusId || activeCampusId === 'all') return null;
        return query(
            collection(firestore, 'src_posts'),
            where('campusId', '==', activeCampusId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
    }, [firestore, tab, activeCampusId, isTokenReady]);

    const peopleQuery = useMemoFirebase(() => {
        if (!firestore || tab !== 'people' || !activeCampusId || activeCampusId === 'all') return null;
        return query(
            collection(firestore, 'users'), 
            where('campusId', '==', activeCampusId),
            where('visibility', '==', 'public'), 
            limit(50)
        );
    }, [firestore, tab, activeCampusId]);

    const productsQuery = useMemoFirebase(() => {
        if (!firestore || tab !== 'market' || !activeCampusId || activeCampusId === 'all') return null;
        return query(
            collection(firestore, 'products'), 
            where('campusId', '==', activeCampusId),
            orderBy('createdAt', 'desc'), 
            limit(50)
        );
    }, [firestore, tab, activeCampusId]);

    const { data: posts, isLoading: isLoadingPosts } = useCollection<SocialPost>(socialQuery);
    const { data: srcPosts, isLoading: isLoadingSrc } = useCollection<SrcPost>(srcQuery);
    const { data: people, isLoading: isLoadingPeople } = useCollection<AppUser>(peopleQuery);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

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
            isOfficial: true,
            isLiaisonBoosted: true
        }));

        return [...mappedSrc, ...posts].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [posts, srcPosts]);

    if (isUserLoading || isLoadingPosts || isLoadingPeople || isLoadingProducts || isLoadingSrc) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-96 rounded-3xl" />
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        );
    }

    const EmptyState = ({ icon: Icon, title, message }: { icon: React.ElementType, title: string, message: string }) => (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl col-span-full">
            <Icon className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-semibold">{title}</p>
            <p className="text-sm">{message}</p>
        </div>
    );

    switch(tab) {
        case 'people':
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {people?.map(p => <CommunityConnectCard key={p.id} student={p} currentUser={currentUser!} />)}
                </div>
            );
        case 'market':
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {/* Simplified product cards for explore tab */}
                    {products?.map(p => (
                        <div key={p.id} className="bg-card p-4 rounded-2xl border shadow-sm">
                            <div className="aspect-square relative rounded-xl overflow-hidden mb-3">
                                <Image src={p.imageUrl} fill className="object-cover" alt={p.name} />
                            </div>
                            <p className="font-bold text-sm truncate">{p.name}</p>
                            <p className="text-xs text-primary font-black">GHS {p.price.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            )
        case 'vlogs':
        case 'all':
        default:
            if (unifiedPosts.length === 0) return <EmptyState icon={MessageSquare} title="No Vibes Found" message="The pulse is quiet today." />;
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {unifiedPosts.map((post) => {
                        if (post.type === 'election_winner') {
                            return (
                                <div key={post.id} className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden mb-6">
                                  <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><Trophy size={150} /></div>
                                  <div className="relative z-10 text-center">
                                    <div className="bg-amber-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase w-fit mx-auto mb-6">Official Result</div>
                                    <h2 className="text-2xl font-black">Congratulations {post.winnerName}</h2>
                                    <p className="text-amber-400 font-bold uppercase tracking-widest text-xs mt-1">Elected {post.position}</p>
                                    <p className="mt-6 text-sm text-slate-400 leading-relaxed italic">"{post.content}"</p>
                                  </div>
                                </div>
                              );
                        }
                        return <SocialPostCard key={post.id} post={post} />;
                    })}
                </div>
            );
    }
}
