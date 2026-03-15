
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limitToLast, serverTimestamp, addDoc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { ArenaBattle, BattleMessage } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, Flame
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Real-time competitive theater for inter-uni battles.
 * Implements the "Live Comeback Messages" protocol and "Single-Vote Handshake".
 */
export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [battle, setBattle] = useState<ArenaBattle | null>(null);
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. REAL-TIME BATTLE SYNC: Monitors global tallies and status
  useEffect(() => {
    if (!firestore || !battleId) return;
    const unsub = onSnapshot(doc(firestore, 'arena_battles', battleId), (snap) => {
      if (snap.exists()) setBattle({ id: snap.id, ...snap.data() } as ArenaBattle);
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 2. LIVE COMEBACK STREAM: Synchronized chatter from the Crowd
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  // 3. VOTE AUDIT: Single-Vote Protocol check
  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { if (snap.exists()) setHasVoted(true); });
  }, [firestore, user, battleId]);

  // 4. AUTO-SCROLL: Keep latest vibes visible
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user) return;
    const text = message.trim();
    setMessage('');
    
    // 🚀 LIAISON BROADCAST: High-velocity message sync
    addDoc(collection(firestore, 'arena_battles', battleId, 'messages'), {
      userId: user.id,
      userName: user.name,
      text,
      createdAt: serverTimestamp()
    }).catch(err => console.error("Liaison Chat Drift:", err));
  };

  const handleVote = async (participantId: string) => {
    if (!firestore || !user || hasVoted || isVoting) return;
    setIsVoting(true);
    
    try {
      // 🛡️ SECURE HANDSHAKE: Log the individual vote for audit
      const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
      await setDoc(voteRef, { 
        votedFor: participantId,
        timestamp: serverTimestamp() 
      });

      // 📈 ATOMIC TALLY: Update the global counter
      const battleRef = doc(firestore, 'arena_battles', battleId);
      await updateDoc(battleRef, {
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
      {/* LEFT: THE RING STAGE (STREAM) */}
      <div className="flex-[2] relative bg-slate-950 flex flex-col">
        <div className="absolute top-6 left-6 z-20 flex items-center gap-4">
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all"><X size={24}/></button>
          <div className="bg-red-600 px-4 py-1.5 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-2xl animate-pulse flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            LIVE BATTLE
          </div>
        </div>

        <div className="flex-1 w-full bg-black relative">
          <ReactPlayer 
            url={battle.streamUrl} 
            playing={true} 
            muted={false} 
            width="100%" height="100%" 
            className="absolute inset-0"
          />
          
          {/* THE HUD: LIVE VOTE STATUS */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-20">
            <div className="bg-slate-950/60 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-end mb-6 px-2">
                <div className="text-left group">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">{p1.campusAcronym}</p>
                  <p className="text-3xl font-black text-white tabular-nums">{battle.votes[p1Id] || 0}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Swords size={24} className="text-red-500 animate-bounce" />
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Energy</p>
                </div>
                <div className="text-right group">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-amber-400 transition-colors">{p2.campusAcronym}</p>
                  <p className="text-3xl font-black text-white tabular-nums">{battle.votes[p2Id] || 0}</p>
                </div>
              </div>

              {/* DYNAMIC ENERGY BAR */}
              <div className="h-4 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/5 mb-8 shadow-inner">
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" style={{ width: `${p1Pct}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" style={{ width: `${p2Pct}%` }} />
              </div>
              
              {!hasVoted ? (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleVote(p1Id)} 
                    disabled={isVoting}
                    className="py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    VOTE {p1.campusAcronym}
                  </button>
                  <button 
                    onClick={() => handleVote(p2Id)} 
                    disabled={isVoting}
                    className="py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    VOTE {p2.campusAcronym}
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in-95">
                   <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                     <CheckCircle size={14} /> Vote Authenticated
                   </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: THE CROWD (LIVE COMEBACKS) */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col shadow-2xl relative">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black italic tracking-tight uppercase">{battle.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{battle.viewerCount} Spectators</span>
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl text-slate-400"><MessageSquare size={20} /></div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
          <div className="flex items-center gap-2 mb-6 opacity-40">
             <div className="h-[1px] flex-1 bg-white/10" />
             <span className="text-[8px] font-black text-white uppercase tracking-[0.4em]">Live Comebacks</span>
             <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          {messages?.map((m) => {
            const isParticipant = battle.participants.includes(m.userId);
            return (
              <div key={m.id} className={cn("animate-in slide-in-from-bottom-2", isParticipant ? "my-6" : "")}>
                <p className={cn(
                  "text-[9px] font-black uppercase tracking-tighter mb-1",
                  isParticipant ? "text-amber-500 flex items-center gap-1" : "text-slate-500"
                )}>
                  {isParticipant && <Trophy size={10} />}
                  {m.userName}
                </p>
                <div className={cn(
                  "p-3 rounded-2xl rounded-tl-none border shadow-sm transition-all",
                  isParticipant ? "bg-amber-500/10 border-amber-500/30 text-white" : "bg-white/5 border-white/5 text-slate-300"
                )}>
                  <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-6 bg-slate-950/80 border-t border-white/10 flex gap-2">
          <input 
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Throw some live shade..."
            className="flex-1 bg-white/5 rounded-[1.5rem] px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-slate-600 shadow-inner"
          />
          <button 
            type="submit" 
            disabled={!message.trim()} 
            className="p-4 bg-red-600 text-white rounded-full active:scale-90 transition-all shadow-lg shadow-red-900/40 disabled:opacity-30 flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

function CheckCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
