
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limitToLast, serverTimestamp, addDoc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { ArenaBattle, BattleMessage } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, Trophy, 
  Loader2, Mic, Volume2, MessageSquare, Flame, Star, ShieldCheck
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [battle, setBattle] = useState<ArenaBattle | null>(null);
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. REAL-TIME BATTLE SYNC
  useEffect(() => {
    if (!firestore || !battleId) return;
    const unsub = onSnapshot(doc(firestore, 'arena_battles', battleId), (snap) => {
      if (snap.exists()) setBattle({ id: snap.id, ...snap.data() } as ArenaBattle);
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 2. LIVE CHAT STREAM
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'arena_battles', battleId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(30)) : null
  , [firestore, battleId]);
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  // 3. VOTE AUDIT: Check if user already voted
  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { if (snap.exists()) setHasVoted(true); });
  }, [firestore, user, battleId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user) return;
    const text = message.trim();
    setMessage('');
    await addDoc(collection(firestore, 'arena_battles', battleId, 'messages'), {
      userId: user.id,
      userName: user.name,
      text,
      createdAt: serverTimestamp()
    });
  };

  const handleVote = async (participantId: string) => {
    if (!firestore || !user || hasVoted || isVoting) return;
    setIsVoting(true);
    try {
      const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
      await setDoc(voteRef, { timestamp: serverTimestamp() });
      await updateDoc(doc(firestore, 'arena_battles', battleId), {
        [`votes.${participantId}`]: increment(1)
      });
      setHasVoted(true);
      toast({ title: "Vote Logged! 🗳️", description: "You've amplified this warrior's frequency." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Vote Failed" });
    } finally {
      setIsVoting(false);
    }
  };

  if (!battle) return (
    <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={48} />
    </div>
  );

  const p1Id = battle.participants[0];
  const p2Id = battle.participants[1];
  const p1 = battle.participantInfo[p1Id];
  const p2 = battle.participantInfo[p2Id];
  
  const totalVotes = (battle.votes[p1Id] || 0) + (battle.votes[p2Id] || 0);
  const p1Pct = totalVotes > 0 ? (battle.votes[p1Id] / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      {/* LEFT: THE STAGE (VIDEO) */}
      <div className="flex-[2] relative bg-slate-950 flex flex-col">
        <div className="absolute top-6 left-6 z-20 flex items-center gap-4">
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all"><X size={24}/></button>
          <div className="bg-red-600 px-4 py-1.5 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-2xl animate-pulse">LIVE RING</div>
        </div>

        <div className="flex-1 w-full bg-black relative">
          <ReactPlayer 
            url={battle.streamUrl} 
            playing={true} 
            muted={false} 
            width="100%" height="100%" 
            className="absolute inset-0"
          />
          {/* VOTE HUD (Overlaid on video) */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-20">
            <div className="bg-black/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div className="flex justify-between items-end mb-4 px-2">
                <div className="text-left">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{p1.campusAcronym}</p>
                  <p className="text-lg font-black text-white">{battle.votes[p1Id] || 0}</p>
                </div>
                <div className="flex flex-col items-center">
                  <Zap size={16} className="text-amber-500 animate-bounce" fill="currentColor" />
                  <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Energy</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{p2.campusAcronym}</p>
                  <p className="text-lg font-black text-white">{battle.votes[p2Id] || 0}</p>
                </div>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden flex p-0.5">
                <div className="h-full bg-red-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
              </div>
              
              {!hasVoted && (
                <div className="flex gap-3 mt-6">
                  <button onClick={() => handleVote(p1Id)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">Empower {p1.campusAcronym}</button>
                  <button onClick={() => handleVote(p2Id)} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">Empower {p2.campusAcronym}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: THE CROWD (CHAT) */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/5 bg-slate-950/50">
          <h3 className="text-white font-black italic tracking-tight">{battle.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <Users size={14} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{battle.viewerCount} Spectators Joined</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {messages?.map((m) => (
            <div key={m.id} className="animate-in slide-in-from-bottom-2">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-tighter">{m.userName}</p>
              <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 mt-1">
                <p className="text-sm text-slate-200 font-medium">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-6 bg-slate-950/80 border-t border-white/5 flex gap-2">
          <input 
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Shout into the Yard..."
            className="flex-1 bg-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold"
          />
          <button type="submit" disabled={!message.trim()} className="p-3 bg-red-600 text-white rounded-2xl active:scale-90 transition-all shadow-lg shadow-red-900/20">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
