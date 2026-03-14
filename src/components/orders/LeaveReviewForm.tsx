
'use client';

import React, { useState } from 'react';
import { Star, Send, Loader2, Mic, CheckCircle2, Music } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import VoiceRecorder from '../social/VoiceRecorder';
import VoicePlayer from '../social/VoicePlayer';
import { uploadAudio } from '@/lib/audio-service';

interface LeaveReviewFormProps {
  order: Order;
  onReviewSubmitted: () => void;
}

export function LeaveReviewForm({ order, onReviewSubmitted }: LeaveReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  
  const { firestore, storage, user } = useFirebase();
  const { toast } = useToast();

  const handleAudioPrepared = (blob: Blob, duration: number) => {
    setAudioBlob(blob);
    setAudioDuration(duration);
  };

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
    if (!firestore || !user || !storage) return;

    setIsLoading(true);
    try {
      let audioUrl = '';
      
      // 🎙️ VOICE REVIEW HANDSHAKE: Upload audio if it exists
      if (audioBlob) {
        setIsUploadingAudio(true);
        const path = `product_reviews/${order.id}/${Date.now()}_voice_review.webm`;
        audioUrl = await uploadAudio(storage, audioBlob, path);
        setIsUploadingAudio(false);
      }

      const reviewData = {
        orderId: order.id,
        vendorId: order.vendorId,
        buyerId: order.buyerId,
        rating,
        comment,
        audioUrl,
        duration: audioDuration,
        createdAt: new Date().toISOString()
      };
      
      const reviewsRef = collection(firestore, 'reviews');
      await addDocumentNonBlocking(reviewsRef, reviewData);
      
      toast({
        title: "Review Submitted! ✨",
        description: "Your feedback helps build trust in the Yard.",
      });
      onReviewSubmitted();

    } catch (err: any) {
      console.error("Review submission failed:", err);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: err.message || 'Could not submit your review. Please try again.',
      });
    } finally {
      setIsLoading(false);
      setIsUploadingAudio(false);
    }
  };

  return (
    <form onSubmit={submitReview} className="space-y-8 p-2">
      <div className="text-center space-y-2">
        <p className="text-sm font-bold text-muted-foreground">How was your vibe with the <strong>{order.productName}</strong>?</p>
        <div className="flex gap-2 justify-center py-4">
            {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)} className="hover:scale-110 transition-transform active:scale-95">
                <Star 
                size={40} 
                className={cn(
                    "transition-all",
                    star <= rating ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]" : "text-slate-200 dark:text-slate-800"
                )}
                />
            </button>
            ))}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Detailed Feedback</Label>
        <Textarea 
            placeholder="Tell the Yard about the quality, delivery, or vendor vibe..."
            className="min-h-[120px] rounded-2xl bg-slate-50 dark:bg-muted border-none font-medium text-sm focus:ring-2 focus:ring-primary shadow-inner"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {/* 🎙️ VOICE REVIEW SECTION */}
      <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border-2 border-dashed border-blue-100 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Music size={16} className="text-blue-600" />
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Add Voice Review</span>
            </div>
            {audioBlob && (
                <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase">
                    <CheckCircle2 size={10} /> Recorded
                </div>
            )}
        </div>
        
        <div className="flex flex-col items-center gap-4">
            <VoiceRecorder onSend={handleAudioPrepared} disabled={isLoading} />
            <p className="text-[9px] text-blue-500/60 text-center font-medium italic">
                "Voice reviews build 10x more trust among fellow students."
            </p>
        </div>
      </div>

      <Button 
        type="submit"
        disabled={isLoading || rating === 0 || isUploadingAudio}
        className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all"
      >
        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Send size={20} className="mr-2" /> Broadcast Review</>}
      </Button>
      
      <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-[0.3em]">Liaison Trust Protocol Active</p>
    </form>
  );
}
