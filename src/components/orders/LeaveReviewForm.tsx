'use client';

import React, { useState } from 'react';
import { Star, Send, Loader2 } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LeaveReviewFormProps {
  order: Order;
  onReviewSubmitted: () => void;
}

export function LeaveReviewForm({ order, onReviewSubmitted }: LeaveReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({
        variant: 'destructive',
        title: "Rating required",
        description: "Please select a star rating before submitting.",
      });
      return;
    }
    if (!firestore || !user) return;

    setIsLoading(true);
    try {
      const reviewData = {
        orderId: order.id,
        vendorId: order.vendorId,
        buyerId: order.buyerId,
        rating,
        comment,
        createdAt: new Date().toISOString()
      };
      
      const reviewsRef = collection(firestore, 'reviews');
      await addDocumentNonBlocking(reviewsRef, reviewData);
      
      toast({
        title: "Review Submitted!",
        description: "Thank you for helping improve the community.",
      });
      onReviewSubmitted();

    } catch (err) {
      console.error("Review submission failed:", err);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'Could not submit your review. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={submitReview} className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">How was your experience with the order for <strong>{order.productName}</strong>?</p>
      
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setRating(star)}>
            <Star 
              size={32} 
              className={cn(
                "transition-colors",
                star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600 hover:text-gray-400"
              )}
            />
          </button>
        ))}
      </div>

      <Textarea 
        placeholder="Tell others about the delivery, quality..."
        className="min-h-[100px]"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <Button 
        type="submit"
        disabled={isLoading || rating === 0}
        className="w-full"
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send size={18} />}
        Submit Review
      </Button>
    </form>
  );
}
