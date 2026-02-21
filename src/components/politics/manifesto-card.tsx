'use client';

import React, { useState } from 'react';
import type { Manifesto } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText, Play, Award, Loader2, CheckCircle } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ManifestoCard({ manifesto }: { manifesto: Manifesto }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEndorsing, setIsEndorsing] = useState(false);

  // Check if current user has already endorsed via sub-collection
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
      await runTransaction(firestore, async (transaction) => {
        const endorSnap = await transaction.get(endorRef);
        
        if (endorSnap.exists()) {
          throw new Error("Already endorsed this candidate.");
        }

        // 1. Create unique endorsement record (Anti-Fraud)
        transaction.set(endorRef, {
          userId: user.id,
          userName: user.name,
          campusId: user.campusId,
          timestamp: serverTimestamp(),
        });

        // 2. Atomic Increment for total count
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
    <div className="bg-card rounded-[3rem] border border-border shadow-xl overflow-hidden hover:-translate-y-2 transition-all group dark:bg-slate-900/50 dark:border-slate-800">
      {/* Campaign Header */}
      <div className="h-32 bg-slate-900 p-6 relative">
         <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
         <span className="relative z-10 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">
           {manifesto.position}
         </span>
      </div>

      {/* Identity */}
      <div className="px-8 pb-8 -mt-16 relative z-10">
        <div className="w-24 h-24 rounded-[2rem] bg-card border-4 border-card dark:border-slate-900/50 shadow-2xl overflow-hidden mb-4">
           <Image 
                src={manifesto.candidateImage || `https://picsum.photos/seed/${manifesto.id}/200`}
                alt={manifesto.candidateName}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                data-ai-hint="student politician portrait"
            />
        </div>
        
        <h3 className="text-xl font-black text-foreground">{manifesto.candidateName}</h3>
        <p className="text-xs text-primary font-bold uppercase tracking-widest mb-4">{manifesto.hall}</p>
        
        <p className="text-sm text-muted-foreground italic mb-6 leading-relaxed">
          "{manifesto.motto}"
        </p>

        {/* ACTION BUTTONS */}
        <div className="space-y-3">
           <Button className="w-full py-3 h-auto bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-blue-600 dark:bg-slate-800 dark:hover:bg-blue-600 shadow-lg">
              <FileText size={16} /> Read Manifesto
           </Button>
           {manifesto.campaignVideoUrl && (
             <a href={manifesto.campaignVideoUrl} target="_blank" rel="noopener noreferrer" className="w-full block">
                <Button variant="secondary" className="w-full py-3 h-auto bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 border-none shadow-sm">
                    <Play size={16} className="fill-current" /> Watch Campaign
                </Button>
             </a>
           )}
        </div>
      </div>

      {/* ENDORSEMENT FOOTER */}
      <div className="p-4 bg-muted/50 border-t flex justify-between items-center px-8">
         <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase">
            <Award size={14} className={cn(hasEndorsed ? "text-blue-500" : "text-amber-500")} /> 
            {manifesto.endorsements || 0} Endorsements
         </div>
         
         {hasEndorsed ? (
            <div className="flex items-center gap-1.5 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                <CheckCircle size={14} /> Verified
            </div>
         ) : (
            <button 
                onClick={handleEndorse} 
                disabled={isEndorsing || isChecking}
                className="text-primary font-black text-[10px] uppercase tracking-widest hover:underline flex items-center gap-2 disabled:opacity-50"
            >
                {isEndorsing ? <Loader2 size={12} className="animate-spin" /> : "Endorse Now"}
            </button>
         )}
      </div>
    </div>
  );
}
