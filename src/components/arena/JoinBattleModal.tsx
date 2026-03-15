
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { Loader2, Swords, Video, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function JoinBattleModal({ battle, isOpen, onClose }: { battle: any, isOpen: boolean, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user, campus } = useAuth();
  const { toast } = useToast();
  
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    if (!firestore || !user || !videoUrl.trim() || !battle) return;
    setIsLoading(true);

    try {
      const challengerRef = doc(firestore, 'arena_battles', battle.id, 'challengers', user.id);
      
      const challengerData = {
        userId: user.id,
        userName: user.name,
        avatarUrl: user.avatarUrl || '',
        campusAcronym: campus?.acronym || 'GH',
        videoUrl: videoUrl.trim(),
        createdAt: serverTimestamp()
      };

      await setDocumentNonBlocking(challengerRef, challengerData, {});
      
      toast({ 
        title: "Challenge Sent! ⚔️", 
        description: "The creator has been notified. You will enter the ring if they accept your video." 
      });
      onClose();
      setVideoUrl('');

    } catch (err: any) {
      toast({ variant: 'destructive', title: "Action Refused" });
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = videoUrl.trim().length > 10;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-indigo-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-2xl shadow-lg">
              <Swords size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic">Enter the Ring</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-indigo-200">Submit your video to challenge {battle.creatorName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background">
          <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Your Rival Video/Stream URL</Label>
                <div className="relative">
                    <Input 
                        placeholder="Paste YouTube or TikTok Link..." 
                        value={videoUrl} 
                        onChange={e => setVideoUrl(e.target.value)} 
                        className="rounded-xl border-none bg-indigo-50 dark:bg-indigo-950/20 font-mono text-sm h-12 pl-10" 
                    />
                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={16} />
                </div>
                <p className="text-[9px] text-slate-500 italic px-1">
                    *The creator will review your video before the battle goes LIVE.
                </p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-6 border-t">
            <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleJoin} disabled={isLoading || !isValid} className={cn("flex-1 rounded-xl font-black px-8 h-14 shadow-xl transition-all active:scale-95", isValid ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400")}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> DEPLOY CHALLENGE</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
