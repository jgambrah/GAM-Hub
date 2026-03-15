
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
import { Loader2, Swords, Zap, Search, X, Info, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { campuses } from '@/lib/data';

/**
 * CreateBattleModal Component
 * --------------------------
 * The gateway to the Live Ring.
 * Explains the "Social Anchor" mechanism where external streams are synced with Yard HUDs.
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
    if (!opponentEmail || !firestore) return;
    setSearching(true);
    try {
      const q = query(
        collection(firestore, 'users'), 
        where('email', '==', opponentEmail.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        setOpponent({ id: d.id, ...d.data() });
      } else {
        toast({ variant: 'destructive', title: "Student not found", description: "Ensure they have a GAM Hub account." });
      }
    } catch (e) {
      console.error(e);
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
      title,
      streamUrl,
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
    } catch (err) {
      toast({ variant: 'destructive', title: "Launch Failed" });
    } finally {
      setIsLoading(false);
    }
  };

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
              className="rounded-xl border-none bg-muted font-bold h-12"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Stream Link (Public Link)</Label>
            <div className="relative">
              <Input 
                placeholder="TikTok or YouTube Link..." 
                value={streamUrl} 
                onChange={e => setStreamUrl(e.target.value)} 
                className="rounded-xl border-none bg-muted font-mono text-xs h-12 pl-10"
              />
              <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Challenge Opponent (Email)</Label>
            <div className="relative">
              <Input 
                placeholder="opponent@st.edu.gh" 
                value={opponentEmail} 
                onChange={e => setOpponentEmail(e.target.value)} 
                className="rounded-xl border-none bg-muted font-bold h-12 pr-24"
              />
              <Button 
                onClick={handleSearchOpponent}
                disabled={searching || !opponentEmail}
                className="absolute right-1 top-1 bottom-1 h-auto rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase px-4"
              >
                {searching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
              </Button>
            </div>
          </div>

          {opponent && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-100 dark:border-blue-800 flex items-center justify-between animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <Avatar className="border-2 border-white shadow-sm h-10 w-10">
                  <AvatarImage src={opponent.avatarUrl} />
                  <AvatarFallback>{opponent.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-black text-sm text-foreground">{opponent.name}</p>
                  <p className="text-[10px] font-bold text-blue-500 uppercase">{opponent.campusId}</p>
                </div>
              </div>
              <button onClick={() => setOpponent(null)} className="p-1 hover:bg-red-50 rounded-full text-red-500"><X size={16}/></button>
            </div>
          )}
        </div>

        <DialogFooter className="bg-muted/30 p-6 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
          <Button 
            onClick={handleLaunch} 
            disabled={isLoading || !opponent || !title || !streamUrl}
            className="rounded-xl font-black bg-red-600 text-white px-8 h-12 shadow-xl active:scale-95 transition-all"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> Enter The Arena</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
