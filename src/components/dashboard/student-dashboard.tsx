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
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Sparkles, ShoppingBag, ChevronRight, Video, Image as ImageIcon, Youtube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import StaffLounge from './staff-lounge';
import CampusVibeFeed from '../spotlight/campus-vibe-feed';
import { CampusBulletin } from '../spotlight/CampusBulletin';
import { summarizeSocialFeed } from '@/ai/flows/summarize-social-feed';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import ShareVibeModal from '../social/ShareVibeModal';


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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingBag size={20} /> My Recent Orders</CardTitle>
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
                <Link href={`/orders/${order.id}`} key={order.id} className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{order.productName}</p>
                      <p className="text-sm text-muted-foreground">GH₵{order.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={statusVariant} className={cn(order.status === 'confirmed' && 'bg-blue-600')}>{status}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">You haven't placed any orders yet.</p>
        )}
      </CardContent>
    </Card>
  );
}


export default function StudentDashboard({ showBulletin = true, showStaffLounge = true, showVibeFeed = true }: { showBulletin?: boolean, showStaffLounge?: boolean, showVibeFeed?: boolean }) {
  const { user } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);


  // Fetch social feed for summary
  const socialFeedQuery = useMemoFirebase(() => {
    if (!firestore || !user || !user.campusId) return null;
    return query(collection(firestore, 'social_posts'), where('campusId', '==', user.campusId));
  }, [firestore, user]);
  const { data: socialFeed, isLoading: isLoadingSocial } = useCollection<SocialPost>(socialFeedQuery);

  // Fetch product catalog for recommendations
  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);


  async function handleSummarize() {
    if (!user || !user.campusId || !socialFeed) return;
    try {
      setLoadingSummary(true);
      const socialContent = socialFeed
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
        purchaseHistory: [], // Mock purchase history
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
    <div className="space-y-12">
        
        <Card onClick={() => setShowShareModal(true)} className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
            <div className="flex items-start space-x-4">
                <Avatar>
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="p-3 bg-muted rounded-xl text-muted-foreground h-12 flex items-center">
                        What's on your mind, {user.name?.split(' ')[0]}?
                    </div>
                    <div className="flex items-center justify-end mt-2 space-x-2 text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                        <Video className="h-5 w-5" />
                        <Youtube className="h-5 w-5" />
                    </div>
                </div>
            </div>
            </CardContent>
        </Card>
        
        {showShareModal && <ShareVibeModal userProfile={user} onClose={() => setShowShareModal(false)} />}

        {showBulletin && <CampusBulletin />}
        {showVibeFeed && <CampusVibeFeed />}
        {showStaffLounge && <StaffLounge user={user} />}

        <section>
            <div className="grid gap-6 lg:grid-cols-2">
            <StudentOrders />
            <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Campus Buzz</CardTitle>
                        <CardDescription>A summary of what's happening on your campus social feed.</CardDescription>
                    </div>
                    <Button onClick={handleSummarize} size="sm" variant="outline" disabled={loadingSummary || isLoadingSocial}>
                        {loadingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Generate
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
                <p className="text-sm text-muted-foreground">{summary}</p>
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">Click "Generate" to get a summary of the campus feed.</p>
                )}
            </CardContent>
            </Card>
        </div>
      </section>

      <section className="p-6 bg-blue-50/50 dark:bg-primary/10 rounded-[2.5rem] border border-blue-100 dark:border-primary/20">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-blue-900 dark:text-blue-300 flex items-center gap-2">
              <Sparkles size={18} /> Especially for {user.name?.split(' ')[0]}
            </h3>
            <Button onClick={handleGetRecommendations} size="sm" variant="outline" disabled={loadingRecs || isLoadingProducts} className="bg-background/70 dark:bg-primary/20 backdrop-blur-sm">
                {loadingRecs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Refresh Recs
            </Button>
        </div>

        {loadingRecs ? (
            <div className="relative">
                <div className="flex space-x-4 pb-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-80 space-y-3">
                            <Skeleton className="h-40 w-full rounded-lg"/>
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        ) : recommendations.length > 0 ? (
          <ScrollArea>
            <div className="flex space-x-4 pb-4">
              {recommendations.map(product => (
                <ProductCard key={product.id} product={product} className="w-80 flex-shrink-0" />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-200/50 py-16 text-center">
            <h2 className="text-xl font-semibold tracking-tight text-blue-900/80 dark:text-blue-300/80">Discover Your Next Favorite Thing</h2>
            <p className="text-sm text-muted-foreground">Click "Refresh Recs" to see products tailored for you.</p>
          </div>
        )}
      </section>
    </div>
  );
}
