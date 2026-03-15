
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp, query, where, limit } from 'firebase/firestore';
import { Loader2, Swords, Zap, Video, Search, UserPlus, X, Target, Globe } from 'lucide-react';
import { campuses } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User } from '@/lib/types';

export function CreateBattleModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { firestore } = useFirebase();
  const { user, campus } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [myStreamUrl, setMyStreamUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // RIVAL SEARCH STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRival, setSelectedRival] = useState<User | null>(null);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || searchQuery.length < 2) return null;
    return query(
        collection(firestore, 'users'),
        where('name', '>=', searchQuery),
        where('name', '<=', searchQuery + '\uf8ff'),
        limit(5)
    );
  }, [firestore, searchQuery]);

  const { data: searchResults } = useCollection<User>(usersQuery);

  const handleLaunch = async () => {
    if (!firestore || !user || !title || !myStreamUrl) return;
    setIsLoading(true);

    try {
      if (selectedRival) {
        // 1. DIRECT CHALLENGE: Create a battle in 'waiting' state targeting someone
        const myCampus = campuses.find(c => c.id === user.campusId);
        const battleData: any = {
          title: title.trim(),
          creatorId: user.id,
          creatorName: user.name,
          participants: [user.id],
          opponentA: {
            userId: user.id,
            videoUrl: myStreamUrl.trim(),
            votes: 0
          },
          opponentB: null,
          participantInfo: {
            [user.id]: {
              name: user.name,
              avatarUrl: user.avatarUrl || '',
              campusAcronym: myCampus?.acronym || 'GH',
              primaryColor: myCampus?.primaryColor || '#000'
            }
          },
          status: 'waiting',
          targetUserId: selectedRival.id,
          targetUserName: selectedRival.name,
          votes: { [user.id]: 0 },
          viewerCount: 1,
          createdAt: serverTimestamp(),
          endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        };

        await addDocumentNonBlocking(collection(firestore, 'arena_battles'), battleData);
        toast({ title: `Challenged ${selectedRival.name}! 🏹`, description: "Invitation sent to their device." });
      } else {
        // 2. AUTO-MATCH: Enter the staging pool for automated pairing
        const entryData = {
          userId: user.id,
          userName: user.name,
          avatarUrl: user.avatarUrl || '',
          campusAcronym: campus?.acronym || 'GH',
          campusId: user.campusId,
          videoUrl: myStreamUrl.trim(),
          title: title.trim(),
          createdAt: serverTimestamp()
        };

        await addDocumentNonBlocking(collection(firestore, 'arena_waiting_pool'), entryData);
        toast({ title: "Entering Waiting Pool... ⏳", description: "Liaison is matching you with a worthy rival across the Hub." });
      }

      onOpenChange(false);
      resetForm();

    } catch (err: any) {
      toast({ variant: 'destructive', title: "Launch Refused" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
      setTitle(''); 
      setMyStreamUrl(''); 
      setSearchQuery(''); 
      setSelectedRival(null);
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
              <DialogTitle className="text-2xl font-black italic">Arena Deployment</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Call out specific rivals or auto-match across the Yard</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background max-h-[60vh] overflow-y-auto no-scrollbar">
          <div className="space-y-6">
            
            {/* 1. RIVAL TARGETING */}
            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-indigo-500 px-1 flex items-center gap-2">
                    <Target size={12} /> Challenge a Specific Rival (Optional)
                </Label>
                
                {selectedRival ? (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 animate-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white">
                                <AvatarImage src={selectedRival.avatarUrl} />
                                <AvatarFallback>{selectedRival.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-black text-sm">{selectedRival.name}</p>
                                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">{selectedRival.campusAcronym || selectedRival.campusId.toUpperCase()}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedRival(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X size={16}/></button>
                    </div>
                ) : (
                    <div className="relative">
                        <Input 
                            placeholder="Search citizen to call out..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="rounded-xl border-none bg-muted font-bold h-12 pl-10" 
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        
                        {/* Search Results Dropdown */}
                        {searchQuery.length >= 2 && searchResults && (
                            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border rounded-2xl shadow-2xl p-2 animate-in slide-in-from-top-2">
                                {searchResults.filter(u => u.id !== user?.id).map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => { setSelectedRival(u); setSearchQuery(''); }}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-xl transition-all"
                                    >
                                        <Avatar className="h-8 w-8"><AvatarImage src={u.avatarUrl}/></Avatar>
                                        <div className="text-left">
                                            <p className="font-black text-xs">{u.name}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">{u.campusId}</p>
                                        </div>
                                        <UserPlus size={14} className="ml-auto text-primary" />
                                    </button>
                                ))}
                                {searchResults.length === 0 && <p className="p-4 text-center text-xs italic text-muted-foreground">No matches in the Yard.</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Challenge Topic</Label>
                    <Input placeholder="e.g. Best Freestyle in GH?" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl border-none bg-muted font-bold h-12" />
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-500 px-1">Your Video/Stream URL</Label>
                    <div className="relative">
                        <Input placeholder="YouTube or TikTok link..." value={myStreamUrl} onChange={e => setMyStreamUrl(e.target.value)} className="rounded-xl border-none bg-blue-50 dark:bg-blue-900/20 font-mono text-sm h-12 pl-10" />
                        <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                    </div>
                </div>
            </div>

            {!selectedRival && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                    <Zap className="text-blue-600 mt-1" size={16} />
                    <p className="text-[10px] text-blue-800 dark:text-blue-300 font-bold leading-relaxed italic">
                        Liaison Auto-Match: Launching without a target rival will enter you into the National Waiting Pool for automated pairing.
                    </p>
                </div>
            )}
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-6 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleLaunch} disabled={isLoading || !isFormValid} className={cn("flex-1 rounded-xl font-black px-8 h-14 shadow-xl transition-all active:scale-95", isFormValid ? "bg-red-600 text-white" : "bg-slate-200 text-slate-400")}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> {selectedRival ? 'DISPATCH CHALLENGE' : 'ENTER AUTO-MATCH'}</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
