
'use client';

import React, { useState } from 'react';
import type { Manifesto } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText, PlayCircle, ThumbsUp, Award, Loader2, CheckCircle, BookOpen } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * ManifestoCard Component
 * 
 * Elite "Hero" UI for candidate presentation in the Politics Hub.
 * Features the Liaison Anti-Fraud Endorsement Engine using Firestore Transactions.
 */
export default function ManifestoCard({ manifesto }: { manifesto: Manifesto }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEndorsing, setIsEndorsing] = useState(false);

  // Check if current user has already endorsed via sub-collection (Liaison Anti-Fraud Protocol)
  const endorsementRef = useMemoFirebase(() => {
    if (!firestore || !user || !manifesto.id) return null;
    return doc(firestore, 'manifestos', manifesto.id, 'endorsements', user.id);
  }, [firestore, user, manifesto.id]);

  const { data: userEndorsement, isLoading: isChecking } = useDoc(endorsementRef);
  const hasEndorsed = !!userEndorsement;

  const handleEndorse = async () => {
    if (!firestore || !user || hasEndorsed || isEndorsing) return;
    
    setIsEndorsing(true);
    
    const manifestoRef = doc(firestore, 'manifestos', manifesto.id);
    const endorRef = doc(firestore, 'manifestos', manifesto.id, 'endorsements', user.id);

    try {
      // THE ENDORSEMENT TRANSACTION: Ensures atomic count and unique endorsement per user
      await runTransaction(firestore, async (transaction) => {
        const endorSnap = await transaction.get(endorRef);
        
        if (endorSnap.exists()) {
          throw new Error("Already endorsed this candidate.");
        }

        // 1. Create unique endorsement record (The Citizen's Vote)
        transaction.set(endorRef, {
          userId: user.id,
          userName: user.name,
          campusId: user.campusId,
          timestamp: serverTimestamp(),
        });

        // 2. Atomic Increment for the Yard Tally
        transaction.update(manifestoRef, {
          endorsements: (manifesto.endorsements || 0) + 1
        });
      });

      toast({
        title: "Vibration Logged!",
        description: `Your endorsement for ${manifesto.candidateName} is now official.`
      });
    } catch (err: any) {
      console.error("Endorsement failed:", err);
      toast({
        variant: "destructive",
        title: "Action Blocked",
        description: err.message || "Failed to process endorsement."
      });
    } finally {
      setIsEndorsing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 hover:-translate-y-2 transition-all duration-500 group flex flex-col h-full">
      {/* 1. CAMPAIGN HERO HEADER */}
      <div className="relative h-56 bg-slate-900 overflow-hidden">
        <Image 
          src={manifesto.candidateImage || `https://picsum.photos/seed/${manifesto.id}/600/400`}
          alt={manifesto.candidateName}
          fill
          className="object-cover opacity-80 group-hover:scale-110 transition-transform duration-1000"
          data-ai-hint="student leader campaign portrait"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
        
        <div className="absolute bottom-4 left-6 z-10">
          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-xl">
            {manifesto.position}
          </span>
        </div>
        
        <div className="absolute top-4 right-6 z-10">
           <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-white">
              <Award size={18} className="text-amber-400" />
           </div>
        </div>
      </div>

      {/* 2. IDENTITY & MOTTO */}
      <div className="p-8 flex-1 flex flex-col">
        <div className="mb-6">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1 group-hover:text-primary transition-colors">
                {manifesto.candidateName}
            </h3>
            <p className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest mb-3">
                {manifesto.hall || 'Residing in the Yard'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm italic font-medium leading-relaxed">
                "{manifesto.motto || 'My vision for a better campus starts today.'}"
            </p>
        </div>
        
        {/* 3. CAMPAIGN ASSETS */}
        <div className="flex gap-3 mb-8">
          <Button variant="secondary" className="flex-1 rounded-2xl h-12 font-black text-xs uppercase bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300">
            <BookOpen size={16} /> Manifesto
          </Button>
          {manifesto.campaignVideoUrl && (
            <Button 
                onClick={() => window.open(manifesto.campaignVideoUrl, '_blank')}
                variant="secondary" 
                className="flex-1 rounded-2xl h-12 font-black text-xs uppercase bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100"
            >
                <PlayCircle size={16} /> Vlog
            </Button>
          )}
        </div>

        {/* 4. THE ENDORSEMENT COMMAND (CITIZEN ACTION) */}
        <div className="mt-auto">
            {hasEndorsed ? (
                <div className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-100 dark:border-emerald-900 rounded-[1.5rem] text-emerald-600 dark:text-emerald-400 animate-in zoom-in duration-300">
                    <CheckCircle size={20} />
                    <span className="text-sm font-black uppercase tracking-widest">Endorsed & Verified</span>
                    <span className="ml-2 bg-emerald-600 text-white px-3 py-0.5 rounded-full text-xs">
                        {manifesto.endorsements || 0}
                    </span>
                </div>
            ) : (
                <button 
                    onClick={handleEndorse}
                    disabled={isEndorsing || isChecking}
                    className="w-full bg-slate-900 dark:bg-primary text-white py-5 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 shadow-2xl shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isEndorsing ? <Loader2 className="animate-spin" size={18} /> : <ThumbsUp size={18} />}
                    Endorse Candidate
                    <span className="bg-white/20 px-3 py-0.5 rounded-full text-xs font-bold ml-2">
                        {manifesto.endorsements || 0}
                    </span>
                </button>
            )}
            
            <p className="text-[8px] text-slate-400 text-center font-bold uppercase tracking-[0.3em] mt-4 opacity-50">
                Liaison Voter Security Protocol Active
            </p>
        </div>
      </div>
    </div>
  );
}
