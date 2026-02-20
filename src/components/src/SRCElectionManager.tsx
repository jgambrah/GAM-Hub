'use client';

import React, { useState } from 'react';
import { Trophy, UserCheck, Megaphone, Send, Star, ShieldCheck } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import type { User as AppUser, SocialPost } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export default function SRCElectionManager({ userProfile }: { userProfile: AppUser }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [announcementType, setType] = useState<'vetted_list' | 'winner'>('vetted_list');
  
  // Vetted List State
  const [vettedList, setVettedList] = useState({ position: '', names: '' });

  // Winner State
  const [winner, setWinner] = useState({ name: '', position: '', photoUrl: '', message: '' });

  const announceCandidates = async () => {
    if (!firestore || !vettedList.position || !vettedList.names) return;
    
    await addDocumentNonBlocking(collection(firestore, 'social_posts'), {
      title: `Official Vetted Candidates: ${vettedList.position}`,
      content: `The following aspirants have been cleared to campaign: ${vettedList.names}`,
      type: 'vetted_announcement', // Custom type
      campusId: userProfile.campusId,
      authorId: userProfile.id,
      authorName: "SRC Electoral Commission",
      authorAvatarUrl: userProfile.avatarUrl,
      isOfficial: true,
      createdAt: serverTimestamp(),
      likes: 0,
      commentCount: 0,
    });

    toast({ title: "Official Vetted List Published!", description: "Candidates can now begin their campaigns." });
    setVettedList({ position: '', names: '' });
  };

  const announceWinner = async () => {
    if (!firestore || !winner.name || !winner.position) return;
    
    await addDocumentNonBlocking(collection(firestore, 'social_posts'), {
      title: `ELECTION RESULT: New ${winner.position} Elect!`,
      content: winner.message || `Congratulations to ${winner.name} on your victory!`,
      winnerName: winner.name,
      winnerPhoto: winner.photoUrl,
      position: winner.position,
      type: 'election_winner', // Special type for Victory Card
      campusId: userProfile.campusId,
      authorId: userProfile.id,
      authorName: "SRC Electoral Commission",
      authorAvatarUrl: userProfile.avatarUrl,
      isOfficial: true,
      createdAt: serverTimestamp(),
      likes: 0,
      commentCount: 0,
    });
    
    toast({ title: "Winner Crowned on GAM Hub!", description: "A victory card has been posted to the campus feed." });
    setWinner({ name: '', position: '', photoUrl: '', message: '' });
  };

  return (
    <div className="bg-white dark:bg-card rounded-[3rem] p-10 shadow-xl border border-slate-100 dark:border-border max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-2xl">
          <Trophy size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground">Election Command</h2>
          <p className="text-sm text-muted-foreground">Announce vetted lists and election winners.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 bg-slate-100 dark:bg-muted p-2 rounded-2xl">
        <button onClick={() => setType('vetted_list')} className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${announcementType === 'vetted_list' ? 'bg-white dark:bg-card shadow-sm text-blue-600' : 'text-slate-400'}`}>
           <UserCheck size={16} /> Publish Vetted List
        </button>
        <button onClick={() => setType('winner')} className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${announcementType === 'winner' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'}`}>
            <Star size={16}/> Crown Winner
        </button>
      </div>

      <div className="space-y-4">
        {announcementType === 'vetted_list' ? (
          <div className="space-y-4 animate-in fade-in">
            <Input placeholder="Position (e.g. SRC President)" className="w-full p-4 h-auto rounded-2xl bg-slate-50 dark:bg-muted border-none outline-none font-bold" value={vettedList.position} onChange={e => setVettedList({...vettedList, position: e.target.value})} />
            <Textarea placeholder="List names of cleared candidates..." className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-muted border-none h-32 outline-none text-sm" value={vettedList.names} onChange={e => setVettedList({...vettedList, names: e.target.value})} />
            <button onClick={announceCandidates} className="w-full py-4 bg-slate-900 dark:bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-2"><UserCheck size={18}/> Publish Vetted List</button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            <Input placeholder="Winner Name" className="w-full p-4 h-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-none outline-none font-bold" value={winner.name} onChange={e => setWinner({...winner, name: e.target.value})} />
            <Input placeholder="Position Won" className="w-full p-4 h-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-none outline-none font-bold" value={winner.position} onChange={e => setWinner({...winner, position: e.target.value})} />
            <Input placeholder="Winner's Photo URL" className="w-full p-4 h-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-none outline-none font-bold" value={winner.photoUrl} onChange={e => setWinner({...winner, photoUrl: e.target.value})} />
            <Textarea placeholder="Victory message... (optional)" className="w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-none h-24 outline-none text-sm" value={winner.message} onChange={e => setWinner({...winner, message: e.target.value})} />
            <button onClick={announceWinner} className="w-full py-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-orange-100 flex items-center justify-center gap-3">
              <Star fill="currentColor" size={20} /> Announce Victory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
