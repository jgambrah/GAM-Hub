'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { SocialPost, Product, User as AppUser, SrcPost } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import SocialPostCard from './social-post-card';
import ProductCard from '../products/product-card';
import { CommunityConnectCard } from '../connections/student-profile-card';
import { MessageSquare, Users, ShoppingBag, Trophy, Gavel } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';

export default function CampusPulseFeed({
    activeCampusId,
    filterTag,
    searchQuery,
    tab = 'all',
}: {
    activeCampusId?: string;
    filterTag?: string;
    searchQuery?: string;
    tab?: 'all' | 'people' | 'market' | 'vlogs';
}) {
    const { firestore } = useFirebase();
    const { user: currentUser, isUserLoading, isTokenReady } = useAuth();
    
    // --- QUERIES ---
    const socialQuery = useMemoFirebase(() => {
        // ✅ QUERY GUARD: Wait for token readiness
        if (!firestore || !isTokenReady || (tab !== 'all' && tab !== 'vlogs')) return null;

        const constraints: QueryConstraint[] = [];
        if (activeCampusId) constraints.push(where('campusId', '==', activeCampusId));
        if (filterTag && filterTag !== 'All') constraints.push(where('tags', 'array-contains', filterTag.toLowerCase()));
        if (tab === 'vlogs') constraints.push(where('mediaType', 'in', ['video', 'youtube', 'tiktok']));

        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(20));

        return query(collection(firestore, 'social_posts'), ...constraints);
    }, [firestore, activeCampusId, filterTag, tab, isTokenReady]);

    // 1. Liaison Strategy: Fetch SRC Posts to merge into the feed
    const srcQuery = useMemoFirebase(() => {
        // ✅ QUERY GUARD: Wait for token readiness
        if (!firestore || !isTokenReady || tab !== 'all' || !activeCampusId) return null;
        return query(
            collection(firestore, 'src_posts'),
            where('campusId', '==', activeCampusId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
    }, [firestore, tab, activeCampusId, isTokenReady]);

    const peopleQuery = useMemoFirebase(() => {
        if (!firestore || tab !== 'people') return null;
        const constraints: QueryConstraint[] = [where('visibility', '==', 'public'), limit(50)];
        if (activeCampusId) constraints.push(where('campusId', '==', activeCampusId));
        return query(collection(firestore, 'users'), ...constraints);
    }, [firestore, tab, activeCampusId]);

    const productsQuery = useMemoFirebase(() => {
        if (!firestore || tab !== 'market') return null;
        const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(50)];
        if (activeCampusId) constraints.push(where('campusId', '==', activeCampusId));
        return query(collection(firestore, 'products'), ...constraints);
    }, [firestore, tab, activeCampusId]);

    const { data: posts, isLoading: isLoadingPosts } = useCollection<SocialPost>(socialQuery);
    const { data: srcPosts, isLoading: isLoadingSrc } = useCollection<SrcPost>(srcQuery);
    const { data: people, isLoading: isLoadingPeople } = useCollection<AppUser>(peopleQuery);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    // 2. Merge SRC posts with Social Posts
    const unifiedPosts = useMemo(() => {
        if (!posts) return [];
        
        // Map SRC posts to SocialPost format for unified rendering
        const mappedSrc: SocialPost[] = (srcPosts || []).map(p => ({
            id: p.id,
            authorId: p.authorId,
            authorName: 'SRC Official',
            authorAvatarUrl: '', // Default fallback
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

    // --- FILTERING ---
    const filteredPosts = useMemo(() => {
        if (!unifiedPosts) return [];
        if (!searchQuery) return unifiedPosts;
        return unifiedPosts.filter(post => 
            post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.tags?.some(tag => tag?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [unifiedPosts, searchQuery]);

    const filteredPeople = useMemo(() => {
        if (!people) return [];
        if (!searchQuery) return people;
        return people.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.major?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.department?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [people, searchQuery]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        if (!searchQuery) return products;
        return products.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [products, searchQuery]);
    
    const isLoading = isUserLoading || isLoadingPosts || isLoadingPeople || isLoadingProducts || isLoadingSrc;

    // --- RENDER LOGIC ---
    if (isLoading) {
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
            if (filteredPeople.length === 0) return <EmptyState icon={Users} title="No People Found" message="Try a different search." />;
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filteredPeople.map(p => <CommunityConnectCard key={p.id} student={p} currentUser={currentUser!} />)}
                </div>
            );
        case 'market':
            if (filteredProducts.length === 0) return <EmptyState icon={ShoppingBag} title="No Products Found" message="Try a different search." />;
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filteredProducts.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
            );
        case 'vlogs':
        case 'all':
        default:
            if (filteredPosts.length === 0) return <EmptyState icon={MessageSquare} title="No Vibes Found" message="Try a different tag or search query." />;
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredPosts.map((post) => {
                        if (post.type === 'election_winner') {
                            return (
                                <div key={post.id} className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden mb-6">
                                  <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><Trophy size={150} /></div>
                                  <div className="relative z-10 text-center">
                                    <div className="bg-amber-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase w-fit mx-auto mb-6">Official Result</div>
                                    <div className="w-24 h-24 rounded-full border-4 border-amber-500 mx-auto mb-4 overflow-hidden shadow-xl">
                                       <Image src={post.winnerPhoto || `https://picsum.photos/seed/${post.id}/200`} width={96} height={96} className="w-full h-full object-cover" alt={post.winnerName || 'Winner'} />
                                    </div>
                                    <h2 className="text-2xl font-black">Congratulations {post.winnerName}</h2>
                                    <p className="text-amber-400 font-bold uppercase tracking-widest text-xs mt-1">Elected {post.position}</p>
                                    <p className="mt-6 text-sm text-slate-400 leading-relaxed italic">"{post.content}"</p>
                                  </div>
                                </div>
                              );
                        }
                        
                        // Handle Official SRC Post Styling
                        if (post.type === 'src_official') {
                            return (
                                <div key={post.id} className="relative bg-white dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-blue-500/30 overflow-hidden shadow-xl shadow-blue-500/5 group hover:border-blue-500 transition-all">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
                                    <div className="p-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                                    <Gavel size={16} />
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">SRC Official</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(post.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="font-black text-lg text-foreground mb-2 group-hover:text-blue-600 transition-colors">{post.title}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-4">{post.content}</p>
                                        <button className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-black text-xs uppercase tracking-tighter hover:bg-blue-600 hover:text-white transition-all">View Official Post</button>
                                    </div>
                                </div>
                            )
                        }

                        return <SocialPostCard key={post.id} post={post} />;
                    })}
                </div>
            );
    }
}