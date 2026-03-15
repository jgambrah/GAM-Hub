
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Swords, Zap, Search, X, Info, Video, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { campuses } from '@/lib/data';

/**
 * CreateBattleModal Component
 * --------------------------
 * The gateway to the Live Ring.
 * Refined with better validation feedback to ensure users know why the launch button is disabled.
 */
export function CreateBattleModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [opponentEmail, setOpponentEmail] = useState('');
  const [opponent, setOpponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearchOpponent = async () => {
    if (!opponentEmail || !firestore || !user) return;
    setSearching(true);
    setOpponent(null);
    try {
      const q = query(
        collection(firestore, 'users'), 
        where('email', '==', opponentEmail.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        
        if (d.id === user.id) {
            toast({ 
                variant: 'destructive', 
                title: "Challenge Denied", 
                description: "You cannot challenge yourself to a battle! Find a rival." 
            });
            return;
        }

        setOpponent({ id: d.id, ...data });
        toast({ title: "Opponent Located!", description: `${data.name} is ready for the challenge.` });
      } else {
        toast({ 
            variant: 'destructive', 
            title: "Student not found", 
            description: "Ensure they have signed up for a GAM Hub account first." 
        });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "Search Error", description: "Could not connect to the citizen registry." });
    } finally {
      setSearching(false);
    }
  };

  const handleLaunch = async () => {
    if (!firestore || !user || !opponent || !title || !streamUrl) return;
    setIsLoading(true);

    const opponentCampus = campuses.find(c => c.id === opponent.campusId);
    const myCampus = campuses.find(c => c.id === user.campusId);

    const battleData = {
      title: title.trim(),
      streamUrl: streamUrl.trim(),
      creatorId: user.id,
      creatorName: user.name,
      participants: [user.id, opponent.id],
      participantInfo: {
        [user.id]: {
          name: user.name,
          avatarUrl: user.avatarUrl,
          campusAcronym: myCampus?.acronym || 'GH',
          primaryColor: myCampus?.primaryColor || '#000'
        },
        [opponent.id]: {
          name: opponent.name,
          avatarUrl: opponent.avatarUrl,
          campusAcronym: opponentCampus?.acronym || 'GH',
          primaryColor: opponentCampus?.primaryColor || '#000'
        }
      },
      status: 'live',
      votes: {
        [user.id]: 0,
        [opponent.id]: 0
      },
      viewerCount: 1,
      createdAt: serverTimestamp(),
      endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min duration
    };

    try {
      await addDocumentNonBlocking(collection(firestore, 'arena_battles'), battleData);
      toast({ title: "Battle Live! ⚔️", description: "The Yard is now watching your frequency." });
      onOpenChange(false);
      // Reset state for next time
      setTitle(''); setStreamUrl(''); setOpponentEmail(''); setOpponent(null);
    } catch (err) {
      toast({ variant: 'destructive', title: "Launch Failed" });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = title.trim().length > 3 && streamUrl.trim().length > 10 && !!opponent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
              <Swords size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic">Launch Live Battle</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Sync your frequency with the national hub</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background max-h-[60vh] overflow-y-auto no-scrollbar">
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-dashed border-blue-100 dark:border-blue-800 flex items-start gap-3">
            <Info className="text-blue-600 shrink-0 mt-1" size={16} />
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">Social Anchor Instructions</p>
              <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed font-medium italic">
                1. Start a Live Stream on <b>TikTok</b> or <b>YouTube</b>.<br/>
                2. Copy the public link.<br/>
                3. Paste it below to anchor your video into the Arena HUD.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Battle Headline</Label>
            <Input 
              placeholder="e.g. UG vs KNUST: The Ultimate Roast" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="rounded-xl border-none bg-muted font-bold h-12 focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Stream Link (TikTok/YouTube)</Label>
            <div className="relative">
              <Input 
                placeholder="Paste Link here..." 
                value={streamUrl} 
                onChange={e => setStreamUrl(e.target.value)} 
                className="rounded-xl border-none bg-muted font-mono text-xs h-12 pl-10 focus:ring-2 focus:ring-red-500 transition-all"
              />
              <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Challenge Opponent (Email)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  placeholder="opponent@st.edu.gh" 
                  value={opponentEmail} 
                  onChange={e => setOpponentEmail(e.target.value)} 
                  onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSearchOpponent(); } }}
                  className="rounded-xl border-none bg-muted font-bold h-12 focus:ring-2 focus:ring-red-500 transition-all"
                />
              </div>
              <Button 
                onClick={handleSearchOpponent}
                disabled={searching || !opponentEmail}
                className="h-12 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase px-6 hover:bg-blue-600 transition-all active:scale-95"
              >
                {searching ? <Loader2 className="animate-spin" size={14} /> : <><Search size={14} className="mr-2" /> Find</>}
              </Button>
            </div>
          </div>

          {opponent ? (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-800 flex items-center justify-between animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <Avatar className="border-2 border-white shadow-sm h-10 w-10">
                  <AvatarImage src={opponent.avatarUrl} />
                  <AvatarFallback>{opponent.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-black text-sm text-foreground">{opponent.name}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{opponent.campusId?.toUpperCase()} RIVAL</p>
                </div>
              </div>
              <button 
                onClick={() => setOpponent(null)} 
                className="p-2 bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-200 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={16}/>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-slate-400">
                <AlertCircle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Opponent Selection Required</span>
            </div>
          )}
        </div>

        <DialogFooter className="bg-muted/30 p-6 border-t flex flex-col gap-4">
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl font-bold">Cancel</Button>
            <Button 
                onClick={handleLaunch} 
                disabled={isLoading || !isFormValid}
                className={cn(
                    "flex-[2] rounded-xl font-black px-8 h-14 shadow-xl transition-all active:scale-95",
                    isFormValid ? "bg-red-600 text-white hover:bg-red-500" : "bg-slate-200 text-slate-400 grayscale"
                )}
            >
                {isLoading ? <Loader2 className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> Enter The Arena</>}
            </Button>
          </div>
          {!isFormValid && (
              <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                Complete all fields + find an opponent to activate the ring
              </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
