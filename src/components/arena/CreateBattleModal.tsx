
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, Swords, Zap, Video } from 'lucide-react';
import { campuses } from '@/lib/data';
import { cn } from '@/lib/utils';

export function CreateBattleModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [myStreamUrl, setMyStreamUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLaunch = () => {
    if (!firestore || !user || !title || !myStreamUrl) return;
    setIsLoading(true);

    try {
      const myCampus = campuses.find(c => c.id === user.campusId);

      const battleData = {
        title: title.trim(),
        creatorId: user.id,
        creatorName: user.name,
        participants: [user.id],
        opponentA: {
          userId: user.id,
          videoUrl: myStreamUrl.trim(),
          votes: 0
        },
        opponentB: null, // Initially null until someone joins
        participantInfo: {
          [user.id]: {
            name: user.name,
            avatarUrl: user.avatarUrl || '',
            campusAcronym: myCampus?.acronym || 'GH',
            primaryColor: myCampus?.primaryColor || '#000'
          }
        },
        status: 'waiting', // New status for open challenges
        votes: { [user.id]: 0 },
        viewerCount: 1,
        createdAt: serverTimestamp(),
        endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // Longer expiry for waiting
      };

      addDocumentNonBlocking(collection(firestore, 'arena_battles'), battleData);
      
      toast({ title: "Challenge Launched! 🛡️", description: "Waiting for a rival to enter the ring." });
      onOpenChange(false);
      setTitle(''); setMyStreamUrl('');

    } catch (err: any) {
      toast({ variant: 'destructive', title: "Launch Refused" });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = title.trim().length > 3 && myStreamUrl.trim().length > 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
              <Swords size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic">Launch Challenge</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Call out rivals from across the Yard</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background">
          <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Challenge Headline</Label>
                <Input placeholder="e.g. Best Dancer in the Yard?" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl border-none bg-muted font-bold h-12" />
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-blue-500 px-1">Your Video/Stream URL</Label>
                <div className="relative">
                    <Input placeholder="YouTube or TikTok link..." value={myStreamUrl} onChange={e => setMyStreamUrl(e.target.value)} className="rounded-xl border-none bg-blue-50 dark:bg-blue-900/20 font-mono text-sm h-12 pl-10" />
                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                </div>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-6 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleLaunch} disabled={isLoading || !isFormValid} className={cn("flex-1 rounded-xl font-black px-8 h-14 shadow-xl transition-all active:scale-95", isFormValid ? "bg-red-600 text-white" : "bg-slate-200 text-slate-400")}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> BROADCAST CHALLENGE</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
