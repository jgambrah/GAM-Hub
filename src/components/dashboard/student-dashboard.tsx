'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPersonalizedProductRecommendations } from '@/ai/flows/personalized-product-recommendations';
import type { Product, Order, SocialPost } from '@/lib/types';
import ProductCard from '@/components/products/product-card';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Sparkles, ShoppingBag, ChevronRight, Image as ImageIcon, Video, Youtube, MessageSquare, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import StaffLounge from './staff-lounge';
import CampusVibeFeed from '../spotlight/campus-vibe-feed';
import { CampusBulletin } from '../spotlight/CampusBulletin';
import { summarizeSocialFeed } from '@/ai/flows/summarize-social-feed';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import ShareVibeModal from '../social/ShareVibeModal';
import SocialPostCard from '../social/social-post-card';

function StudentOrders() {
  const { user } = useAuth();
  const { firestore } = useFirebase();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'orders'),
      where('buyerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  return (
    <Card className="rounded-[2.5rem] border-slate-100 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingBag size={20} className="text-primary" /> My Recent Orders</CardTitle>
        <CardDescription>Track your recent purchases and manage disputes.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-3">
            {orders.slice(0, 3).map(order => {
              const status = order.status.replace(/_/g, ' ');
              const statusVariant = order.status === 'awaiting_confirmation' ? 'secondary' : order.status === 'disputed' ? 'destructive' : 'default';

              return (
                <Link href={`/orders/${order.id}`} key={order.id} className="block rounded-2xl border p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{order.productName}</p>
                      <p className="text-xs text-muted-foreground">GH₵{order.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={statusVariant} className={cn('text-[8px] font-black uppercase', order.status === 'confirmed' && 'bg-blue-600')}>{status}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground py-8 italic">You haven't placed any orders yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentDashboard({ showBulletin = true, showStaffLounge = true, showVibeFeed = true }: { showBulletin?: boolean, showStaffLounge?: boolean, showVibeFeed?: boolean }) {
  const { user, isTokenReady } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // FETCH: Real-time vibes for the "Recent Activity" section
  const recentVibesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    return query(
        collection(firestore, 'campus_pulse'), 
        where('campusId', '==', user.campusId),
        orderBy('createdAt', 'desc'),
        limit(3)
    );
  }, [firestore, user?.campusId, isTokenReady]);
  const { data: recentVibes, isLoading: isLoadingVibes } = useCollection<SocialPost>(recentVibesQuery);

  // Fetch product catalog for recommendations
  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  async function handleSummarize() {
    if (!user || !user.campusId || !recentVibes) return;
    try {
      setLoadingSummary(true);
      const socialContent = recentVibes
        .map(p => p.content)
        .join('\n---\n');
      
      const summaryResult = await summarizeSocialFeed({
        campusId: user.campusId,
        socialFeedContent: socialContent,
      });
      setSummary(summaryResult.summary);
    } catch (error) {
      console.error('Error summarizing social feed:', error);
      setSummary('Could not load social feed summary.');
      toast({ variant: 'destructive', title: 'API Error', description: 'Failed to get social feed summary.' });
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleGetRecommendations() {
    if (!user || !user.campusId || !allProducts || (user.role !== 'student' && user.role !== 'staff')) return;
    try {
      setLoadingRecs(true);

      const payload = {
        userId: user.id,
        campusId: user.campusId,
        role: user.role as 'student' | 'staff',
        majorOrDepartment: user.role === 'student' ? user.major : user.department,
        interests: user.interests,
        purchaseHistory: [], 
        productCatalog: allProducts.map(p => ({ 
            productId: p.id, 
            name: p.name, 
            description: p.description, 
            category: p.category,
            targetAudience: p.targetAudience
        })),
      };

      const recommendationResult = await getPersonalizedProductRecommendations(payload);
      
      const recommendedProducts = recommendationResult.recommendations
        ? allProducts.filter(p => recommendationResult.recommendations.includes(p.id))
        : [];
        
      setRecommendations(recommendedProducts);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      setRecommendations([]);
      toast({ variant: 'destructive', title: 'API Error', description: 'Failed to get product recommendations.' });
    } finally {
      setLoadingRecs(false);
    }
  }

  if (!user) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <div className="space-y-12 pb-24">
        {/* BROADCAST HUB */}
        <Card onClick={() => setShowShareModal(true)} className="cursor-pointer hover:bg-muted/50 transition-colors rounded-[3rem] border-slate-100 dark:border-border mx-4">
            <CardContent className="p-6">
            <div className="flex items-start space-x-4">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="font-black">{user.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="p-4 bg-muted rounded-[1.5rem] text-muted-foreground h-14 flex items-center font-medium">
                        What's on your mind, {user.name?.split(' ')[0]}?
                    </div>
                    <div className="flex items-center justify-end mt-3 space-x-4 text-muted-foreground px-2">
                        <div className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4 text-blue-500" /> <span className="text-[10px] font-black uppercase">Photo</span></div>
                        <div className="flex items-center gap-1.5"><Video className="h-4 w-4 text-red-500" /> <span className="text-[10px] font-black uppercase">Video</span></div>
                        <div className="flex items-center gap-1.5"><Mic className="h-4 w-4 text-indigo-500" /> <span className="text-[10px] font-black uppercase">Shoutout</span></div>
                    </div>
                </div>
            </div>
            </CardContent>
        </Card>
        
        {showShareModal && <ShareVibeModal userProfile={user} onClose={() => setShowShareModal(false)} />}

        {showBulletin && <CampusBulletin />}
        
        {/* RECENT VIBES PREVIEW */}
        <section className="px-4">
            <div className="flex justify-between items-center mb-6 px-2">
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                    <Zap className="text-indigo-500 fill-indigo-500" size={20} /> Recent Pulse
                </h3>
                <Link href="/pulse" className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline">View Full Feed</Link>
            </div>
            <div className="space-y-6">
                {isLoadingVibes ? (
                    <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                ) : recentVibes && recentVibes.length > 0 ? (
                    recentVibes.map(vibe => (
                        <div key={vibe.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <SocialPostCard post={vibe} />
                        </div>
                    ))
                ) : (
                    <div className="p-12 text-center bg-muted/20 rounded-[3.5rem] border-2 border-dashed border-border/50">
                        <MessageSquare className="mx-auto text-muted-foreground/20 mb-4" size={48} />
                        <p className="text-sm font-bold text-muted-foreground">The Yard is quiet.</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 italic">Be the first to share a vibe today!</p>
                    </div>
                )}
            </div>
        </section>

        {showVibeFeed && <CampusVibeFeed />}
        {showStaffLounge && <StaffLounge user={user} />}

        <section className="px-4">
            <div className="grid gap-6 lg:grid-cols-2">
            <StudentOrders />
            <Card className="rounded-[2.5rem] border-slate-100 dark:border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Sparkles className="text-indigo-500" size={20}/> Campus Buzz</CardTitle>
                        <CardDescription>AI summary of your campus feed.</CardDescription>
                    </div>
                    <Button onClick={handleSummarize} size="sm" variant="outline" disabled={loadingSummary || isLoadingVibes} className="rounded-xl font-black text-[10px] uppercase tracking-widest">
                        {loadingSummary ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                        Vibe-Check
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loadingSummary ? (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
                ) : summary ? (
                <p className="text-xs text-muted-foreground leading-relaxed italic">"{summary}"</p>
                ) : (
                    <p className="text-center text-[10px] text-muted-foreground py-8 italic opacity-60">Click "Vibe-Check" to summarize the latest vibrations.</p>
                )}
            </CardContent>
            </Card>
        </div>
      </section>

      {/* PERSONALIZED RECS */}
      <section className="mx-4 p-8 bg-blue-50/50 dark:bg-primary/10 rounded-[3rem] border border-blue-100 dark:border-primary/20 shadow-inner">
        <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-2xl text-blue-900 dark:text-blue-300 tracking-tight flex items-center gap-3">
              <Sparkles size={24} className="fill-blue-500 text-blue-500" /> Tailored for {user.name?.split(' ')[0]}
            </h3>
            <Button onClick={handleGetRecommendations} size="sm" variant="outline" disabled={loadingRecs || isLoadingProducts} className="bg-white dark:bg-primary/20 backdrop-blur-sm rounded-xl font-black text-[10px] uppercase tracking-widest px-6 h-10 border-blue-200">
                {loadingRecs ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                Refresh
            </Button>
        </div>

        {loadingRecs ? (
            <div className="relative">
                <div className="flex space-x-4 pb-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-80 space-y-3">
                            <Skeleton className="h-40 w-full rounded-3xl"/>
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        ) : recommendations.length > 0 ? (
          <ScrollArea>
            <div className="flex space-x-6 pb-6">
              {recommendations.map(product => (
                <ProductCard key={product.id} product={product} className="w-80 flex-shrink-0" />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-blue-200/50 py-16 text-center bg-white/20">
            <h2 className="text-xl font-black tracking-tight text-blue-900/80 dark:text-blue-300/80">Discover Your Next Favorite Thing</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Click "Refresh" to see products tailored for you.</p>
          </div>
        )}
      </section>
    </div>
  );
}
