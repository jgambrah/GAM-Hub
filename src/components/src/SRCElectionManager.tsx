
'use client';

import React, { useState } from 'react';
import { Trophy, UserCheck, Star } from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import type { User as AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export default function SRCElectionManager({ userProfile }: { userProfile: AppUser }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [announcementType, setType] = useState<'vetted_list' | 'winner'>('vetted_list');
  const [vettedList, setVettedList] = useState({ position: '', names: '' });
  const [winner, setWinner] = useState({ name: '', position: '', photoUrl: '', message: '' });

  const announceCandidates = async () => {
    if (!firestore || !vettedList.position || !vettedList.names) return;
    
    await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), {
      title: `Official Vetted Candidates: ${vettedList.position}`,
      content: `The following aspirants have been cleared to campaign: ${vettedList.names}`,
      type: 'vetted_announcement',
      campusId: userProfile.campusId,
      authorId: userProfile.id,
      authorName: "SRC Electoral Commission",
      authorAvatarUrl: userProfile.avatarUrl,
      isOfficial: true,
      createdAt: new Date().toISOString(),
      likes: 0,
      commentCount: 0,
    });

    toast({ title: "Vetted List Published!" });
    setVettedList({ position: '', names: '' });
  };

  const announceWinner = async () => {
    if (!firestore || !winner.name || !winner.position) return;
    
    await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), {
      title: `ELECTION RESULT: New ${winner.position} Elect!`,
      content: winner.message || `Congratulations to ${winner.name} on your victory!`,
      winnerName: winner.name,
      winnerPhoto: winner.photoUrl,
      position: winner.position,
      type: 'election_winner',
      campusId: userProfile.campusId,
      authorId: userProfile.id,
      authorName: "SRC Electoral Commission",
      authorAvatarUrl: userProfile.avatarUrl,
      isOfficial: true,
      createdAt: new Date().toISOString(),
      likes: 0,
      commentCount: 0,
    });
    
    toast({ title: "Winner Crowned!" });
    setWinner({ name: '', position: '', photoUrl: '', message: '' });
  };

  return (
    <div className="bg-card rounded-[3rem] p-10 shadow-xl border border-border max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="text-amber-600" size={24} />
        <h2 className="text-2xl font-black">Election Command</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 bg-muted p-2 rounded-2xl">
        <button onClick={() => setType('vetted_list')} className={announcementType === 'vetted_list' ? 'bg-background p-2 rounded-xl font-bold' : 'p-2 text-muted-foreground'}>Vetted List</button>
        <button onClick={() => setType('winner')} className={announcementType === 'winner' ? 'bg-amber-500 text-white p-2 rounded-xl font-bold' : 'p-2 text-muted-foreground'}>Winner</button>
      </div>

      <div className="space-y-4">
        {announcementType === 'vetted_list' ? (
          <div className="space-y-4">
            <Input placeholder="Position" value={vettedList.position} onChange={e => setVettedList({...vettedList, position: e.target.value})} />
            <Textarea placeholder="Names..." value={vettedList.names} onChange={e => setVettedList({...vettedList, names: e.target.value})} />
            <button onClick={announceCandidates} className="w-full py-4 bg-primary text-white rounded-2xl font-black">Publish List</button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="Winner" value={winner.name} onChange={e => setWinner({...winner, name: e.target.value})} />
            <Input placeholder="Position" value={winner.position} onChange={e => setWinner({...winner, position: e.target.value})} />
            <button onClick={announceWinner} className="w-full py-5 bg-amber-500 text-white rounded-[2rem] font-black">Announce Victory</button>
          </div>
        )}
      </div>
    </div>
  );
}
