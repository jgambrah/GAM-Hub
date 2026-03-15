
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limitToLast, serverTimestamp, addDoc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { ArenaBattle, BattleMessage } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, Flame, Crown, AlertCircle, Youtube, CheckCircle2, Mic
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Real-time competitive stage for inter-uni showdowns.
 * Features a Dual-Stream side-by-side grid.
 * Fixed: Added defensive checks for opponentA/B data to prevent TypeError.
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

  // 1. REAL-TIME BATTLE SYNC
  useEffect(() => {
    if (!firestore || !battleId) return;
    const unsub = onSnapshot(doc(firestore, 'arena_battles', battleId), (snap) => {
      if (snap.exists()) setBattle({ id: snap.id, ...snap.data() } as ArenaBattle);
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 2. LIVE COMEBACK STREAM
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  // 3. VOTE AUDIT
  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { if (snap.exists()) setHasVoted(true); });
  }, [firestore, user, battleId]);

  // 4. AUTO-SCROLL
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || battle?.status === 'ended') return;
    const text = message.trim();
    setMessage('');
    
    addDoc(collection(firestore, 'arena_battles', battleId, 'messages'), {
      userId: user.id,
      userName: user.name,
      text,
      createdAt: serverTimestamp()
    });
  };

  const handleVote = async (targetUserId: string) => {
    if (!firestore || !user || hasVoted || isVoting || !battle || battle.status === 'ended') return;
    setIsVoting(true);
    
    try {
      const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
      await setDoc(voteRef, { votedFor: targetUserId, timestamp: serverTimestamp() });

      const isOpponentA = targetUserId === battle.opponentA?.userId;
      const battleRef = doc(firestore, 'arena_battles', battleId);
      
      await updateDoc(battleRef, {
        [isOpponentA ? 'opponentA.votes' : 'opponentB.votes']: increment(1),
        [`votes.${targetUserId}`]: increment(1)
      });

      setHasVoted(true);
      toast({ title: "Vote Logged! 🗳️" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Vote Failed" });
    } finally {
      setIsVoting(false);
    }
  };

  // 🛡️ LIAISON DEFENSE: Wait for full data sync before rendering competitors
  if (!battle || !battle.opponentA || !battle.opponentB) {
    return (
        <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center">
            <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Calibrating Battle Stream...</p>
            </div>
        </div>
    );
  }

  const { opponentA, opponentB, participantInfo = {} } = battle;
  const p1 = participantInfo[opponentA.userId];
  const p2 = participantInfo[opponentB.userId];
  
  const totalVotes = (opponentA.votes || 0) + (opponentB.votes || 0);
  const p1Pct = totalVotes > 0 ? ((opponentA.votes || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  const isEnded = battle.status === 'ended';

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      
      {/* --- THE STAGE: DUAL VIDEO GRID --- */}
      <div className="flex-[3] relative bg-slate-950 flex flex-col">
        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all border border-white/10"><X size={24}/></button>
            <div className={cn(
                "px-4 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 backdrop-blur-md border border-white/10",
                isEnded ? "bg-amber-500" : "bg-red-600 animate-pulse"
            )}>
              {isEnded ? "NATIONAL VERDICT" : "LIVE SHOWDOWN"}
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-3 pointer-events-auto text-[10px] text-white font-black uppercase">
            <Users size={14} className="text-slate-400" /> {battle.viewerCount || 0} Citizens
          </div>
        </div>

        {/* SIDE-BY-SIDE GRID */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
          <div className="relative rounded-[2rem] overflow-hidden border-4 border-white/5 bg-black group transition-all duration-700">
            <ReactPlayer url={opponentA.videoUrl} playing={!isEnded} muted={false} width="100%" height="100%" className="absolute inset-0" />
            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-white shadow-xl">
                    <AvatarImage src={p1?.avatarUrl} />
                    <AvatarFallback>{p1?.name?.[0] || 'A'}</AvatarFallback>
                </Avatar>
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">{p1?.campusAcronym || 'GH'}</p>
                    <p className="text-xs font-bold text-white">{p1?.name || 'Opponent A'}</p>
                </div>
            </div>
          </div>

          <div className="relative rounded-[2rem] overflow-hidden border-4 border-white/5 bg-black group transition-all duration-700">
            <ReactPlayer url={opponentB.videoUrl} playing={!isEnded} muted={false} width="100%" height="100%" className="absolute inset-0" />
            <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3 flex-row-reverse">
                <Avatar className="h-10 w-10 border-2 border-white shadow-xl">
                    <AvatarImage src={p2?.avatarUrl} />
                    <AvatarFallback>{p2?.name?.[0] || 'B'}</AvatarFallback>
                </Avatar>
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-right">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">{p2?.campusAcronym || 'GH'}</p>
                    <p className="text-xs font-bold text-white">{p2?.name || 'Opponent B'}</p>
                </div>
            </div>
          </div>
        </div>

        {/* HUD: ENERGY TALLY */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
          <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
            <div className="flex justify-between items-end mb-6 px-4">
                <div className="text-left"><p className="text-[10px] font-black text-blue-400 uppercase">{p1?.campusAcronym || 'A'}</p><p className="text-4xl font-black text-white">{opponentA.votes || 0}</p></div>
                <Swords size={32} className="text-red-600 animate-pulse mb-2" />
                <div className="text-right"><p className="text-[10px] font-black text-amber-400 uppercase">{p2?.campusAcronym || 'B'}</p><p className="text-4xl font-black text-white">{opponentB.votes || 0}</p></div>
            </div>

            <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
            </div>
            
            {!hasVoted && !isEnded ? (
                <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleVote(opponentA.userId)} className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">BOOST {p1?.campusAcronym || 'A'}</button>
                <button onClick={() => handleVote(opponentB.userId)} className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">BOOST {p2?.campusAcronym || 'B'}</button>
                </div>
            ) : (
                <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in-95">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <CheckCircle2 size={14} /> Vote Authenticated in National Hub
                </p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* --- SIDEBAR: LIVE CHAT --- */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black italic tracking-tight uppercase truncate max-w-[180px]">{battle.title}</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Comebacks</span>
          </div>
          <MessageSquare size={20} className="text-slate-400" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
          {messages?.map((m) => (
            <div key={m.id} className="animate-in slide-in-from-bottom-2">
              <p className="text-[9px] font-black uppercase text-slate-500 mb-1">{m.userName}</p>
              <div className="p-3 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 text-slate-300">
                <p className="text-sm font-medium leading-relaxed">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {!isEnded && (
            <form onSubmit={handleSendMessage} className="p-6 bg-slate-950/80 border-t border-white/10 flex gap-2">
            <input 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Throw live shade..."
                className="flex-1 bg-white/5 rounded-[1.5rem] px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold shadow-inner"
            />
            <button type="submit" disabled={!message.trim()} className="p-4 bg-red-600 text-white rounded-full active:scale-90 transition-transform shadow-lg"><Send size={20} /></button>
            </form>
        )}
      </div>
    </div>
  );
}
