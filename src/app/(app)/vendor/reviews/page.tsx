'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Star, MessageSquare, TrendingUp, Award, User as UserIcon, Quote, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import type { Review } from '@/lib/types';
import { format } from 'date-fns';

export default function VendorReviewsPage() {
  const { user: vendorData, isUserLoading: isAuthLoading } = useAuth();
  const { firestore } = useFirebase();

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore || !vendorData) return null;
    return query(
      collection(firestore, 'reviews'),
      where('vendorId', '==', vendorData.id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, vendorData]);

  const { data: reviews, isLoading: isReviewsLoading } = useCollection<Review>(reviewsQuery);
  const isLoading = isAuthLoading || isReviewsLoading;

  if (isLoading || !vendorData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-end">
            <div className="space-y-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-80" />
            </div>
            <Skeleton className="h-24 w-72 rounded-3xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
                <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                <Skeleton className="h-32 w-full rounded-[2rem]" />
            </div>
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-40 w-full rounded-[2.5rem]" />
                <Skeleton className="h-40 w-full rounded-[2.5rem]" />
            </div>
        </div>
      </div>
    );
  }
  
  const ratingAverage = vendorData.rating || 0;
  const reviewCount = vendorData.reviewCount || 0;
  const ratingPercentage = (ratingAverage / 5) * 100;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Star className="text-primary fill-primary" /> Customer Feedback
          </h1>
          <p className="text-muted-foreground font-medium mt-1">See what students and staff are saying about your business</p>
        </div>
        
        {/* Spotlight Progress Meter */}
        <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Spotlight Vibe Score</CardTitle>
                    <div className="flex items-center gap-2">
                        <Progress value={ratingPercentage} className="w-32 h-2" />
                        <span className="text-sm font-bold text-foreground">{ratingAverage.toFixed(1)}/5.0</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Summary Stats */}
        <div className="space-y-6">
          <div className="bg-foreground text-background p-8 rounded-[2.5rem] shadow-xl">
            <p className="text-muted text-xs font-bold uppercase tracking-[0.2em] mb-2">Lifetime Rating</p>
            <div className="flex items-center gap-3">
              <h2 className="text-6xl font-black">{ratingAverage.toFixed(1)}</h2>
              <Star className="text-amber-400 fill-amber-400" size={40} />
            </div>
            <p className="text-sm text-muted mt-4">Based on {reviewCount} verified campus purchases.</p>
          </div>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Award size={18} className="text-primary" /> Vibe Achievements
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewCount > 10 ? (
                <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl text-primary text-xs font-bold">
                  <CheckCircle size={14} /> Established Vendor
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl text-muted-foreground text-xs font-bold">
                  <CheckCircle size={14} /> Complete 10 more orders to earn a badge
                </div>
              )}
              {ratingAverage >= 4.5 && reviewCount > 5 ? (
                <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900/20 rounded-xl text-green-700 text-xs font-bold">
                  <CheckCircle size={14} /> High Quality Service
                </div>
              ) : (
                 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl text-muted-foreground text-xs font-bold">
                  <CheckCircle size={14} /> Achieve a 4.5+ rating for a badge
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Review Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-4">Latest Reviews</h3>
          
          {isLoading ? (
             <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-[2.5rem]" />
                <Skeleton className="h-40 w-full rounded-[2.5rem]" />
            </div>
          ) : reviews?.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageSquare className="mx-auto text-muted-foreground/30 mb-4" size={48} />
              <p className="text-muted-foreground font-medium">No reviews yet. Complete your first QR Handshake to get rated!</p>
            </Card>
          ) : (
            reviews?.map((review: Review) => (
              <Card key={review.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Verified Buyer</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Order #{review.orderId.slice(-6)}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={12} 
                        className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"} 
                      />
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Quote className="absolute -left-2 -top-2 text-primary/10" size={40} />
                  <p className="text-sm text-muted-foreground leading-relaxed pl-4 italic relative z-10">
                    "{review.comment || 'No comment provided.'}"
                  </p>
                </div>
                
                <p className="text-[10px] text-muted-foreground/50 font-bold text-right mt-4 uppercase">
                  {format(new Date(review.createdAt), 'PP')}
                </p>
              </Card>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
