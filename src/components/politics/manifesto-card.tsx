'use client';

import type { Manifesto } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText, Play, Award } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export default function ManifestoCard({ manifesto }: { manifesto: Manifesto }) {
  const { firestore } = useFirebase();

  const handleEndorse = async () => {
    if (!firestore) return;
    const manifestoRef = doc(firestore, 'manifestos', manifesto.id);
    await updateDoc(manifestoRef, {
      endorsements: increment(1)
    });
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
           <Button className="w-full py-3 h-auto bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-blue-600 dark:bg-slate-800 dark:hover:bg-blue-600">
              <FileText size={16} /> Read Manifesto
           </Button>
           {manifesto.campaignVideoUrl && (
             <a href={manifesto.campaignVideoUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="secondary" className="w-full py-3 h-auto bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40">
                    <Play size={16} className="fill-current" /> Watch Campaign
                </Button>
             </a>
           )}
        </div>
      </div>

      {/* ENDORSEMENT FOOTER */}
      <div className="p-4 bg-muted/50 border-t flex justify-between items-center px-8">
         <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase">
            <Award size={14} className="text-amber-500" /> {manifesto.endorsements || 0} Endorsements
         </div>
         <button onClick={handleEndorse} className="text-primary font-black text-[10px] uppercase tracking-widest hover:underline">
            Endorse
         </button>
      </div>
    </div>
  );
}
