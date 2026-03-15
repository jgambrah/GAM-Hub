
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
 * Real-time competitive theater for inter-uni battles.
 * Upgraded to DUAL-STREAM mode for side-by-side campus showdowns.
 * Implements high-fidelity energy bars and synchronized national chat.
 */
export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [battle, setBattle] = useState<ArenaBattle | null>(null);
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
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

  // 🏆 WINNER DETECTION LOGIC
  const winnerInfo = useMemo(() => {
    if (!battle || battle.status !== 'ended' || !battle.votes) return null;
    const entries = Object.entries(battle.votes);
    if (entries.length === 0) return null;
    
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const winnerId = sorted[0][0];
    return {
        id: winnerId,
        info: battle.participantInfo[winnerId],
        isDraw: sorted.length > 1 && sorted[0][1] === sorted[1][1]
    };
  }, [battle]);

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
    }).catch(err => console.error("Liaison Chat Drift:", err));
  };

  const handleVote = async (participantId: string) => {
    if (!firestore || !user || hasVoted || isVoting || battle?.status === 'ended') return;
    setIsVoting(true);
    
    try {
      const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
      await setDoc(voteRef, { 
        votedFor: participantId,
        timestamp: serverTimestamp() 
      });

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

  const isEnded = battle.status === 'ended';

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      
      {/* --- THE RING STAGE (DUAL STREAM) --- */}
      <div className="flex-[3] relative bg-slate-950 flex flex-col">
        
        {/* TOP HUD: STATUS & EXIT */}
        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all border border-white/10"><X size={24}/></button>
            <div className={cn(
                "px-4 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 backdrop-blur-md border border-white/10",
                isEnded ? "bg-amber-500" : "bg-red-600 animate-pulse"
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full bg-white", !isEnded && "animate-ping")} />
              {isEnded ? "NATIONAL VERDICT" : "LIVE SHOWDOWN"}
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-3 pointer-events-auto">
            <Users size={14} className="text-slate-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest tabular-nums">{battle.viewerCount || 0} Citizens Watching</span>
          </div>
        </div>

        {/* THE SPLIT STAGE */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
          
          {/* OPPONENT A PLAYER */}
          <div className={cn(
              "relative rounded-[2rem] overflow-hidden border-4 bg-black group transition-all duration-700",
              isEnded && winnerInfo?.id === p1Id ? "border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)]" : "border-white/5"
          )}>
            <ReactPlayer 
                url={battle.streamUrls?.[p1Id] || battle.streamUrl} // Support legacy single URL
                playing={!isEnded} 
                muted={false} 
                width="100%" height="100%" 
                className="absolute inset-0"
                onError={() => setErrors(p => ({ ...p, [p1Id]: true }))}
            />
            {/* Player Label */}
            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-white shadow-xl">
                    <AvatarImage src={p1.avatarUrl} />
                    <AvatarFallback>{p1.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">{p1.campusAcronym} HUB</p>
                    <p className="text-xs font-bold text-white truncate max-w-[100px]">{p1.name}</p>
                </div>
            </div>
            {errors[p1Id] && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-30 p-10 text-center">
                    <AlertCircle className="text-red-500 mb-4" size={48} />
                    <p className="text-xs font-black text-white uppercase tracking-widest">Signal Lost</p>
                </div>
            )}
          </div>

          {/* OPPONENT B PLAYER */}
          <div className={cn(
              "relative rounded-[2rem] overflow-hidden border-4 bg-black group transition-all duration-700",
              isEnded && winnerInfo?.id === p2Id ? "border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)]" : "border-white/5"
          )}>
            <ReactPlayer 
                url={battle.streamUrls?.[p2Id]} 
                playing={!isEnded} 
                muted={false} 
                width="100%" height="100%" 
                className="absolute inset-0"
                onError={() => setErrors(p => ({ ...p, [p2Id]: true }))}
            />
            {/* Player Label */}
            <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3 flex-row-reverse">
                <Avatar className="h-10 w-10 border-2 border-white shadow-xl">
                    <AvatarImage src={p2.avatarUrl} />
                    <AvatarFallback>{p2.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-right">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">{p2.campusAcronym} HUB</p>
                    <p className="text-xs font-bold text-white truncate max-w-[100px]">{p2.name}</p>
                </div>
            </div>
            {errors[p2Id] && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-30 p-10 text-center">
                    <AlertCircle className="text-red-500 mb-4" size={48} />
                    <p className="text-xs font-black text-white uppercase tracking-widest">Signal Lost</p>
                </div>
            )}
          </div>
        </div>

        {/* THE HUD: LIVE VOTE CONTROL */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
          <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
            
            {isEnded && winnerInfo ? (
              <div className="text-center py-4 animate-in zoom-in duration-500">
                  <div className="flex justify-center mb-4">
                      <div className="p-5 bg-amber-500 rounded-full shadow-[0_0_40px_rgba(245,158,11,0.6)] animate-bounce">
                          <Trophy size={40} className="text-slate-950" />
                      </div>
                  </div>
                  <h2 className="text-3xl font-black italic text-amber-500 tracking-tighter uppercase mb-1">
                      {winnerInfo.isDraw ? "The Yard is Split" : `${winnerInfo.info.campusAcronym} VICTORIOUS`}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      {winnerInfo.isDraw ? "Mutual Incineration" : `National Salute to ${winnerInfo.info.name}`}
                  </p>
              </div>
            ) : (
              <>
                  <div className="flex justify-between items-end mb-6 px-4">
                      <div className="text-left">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{p1.campusAcronym}</p>
                        <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{battle.votes[p1Id] || 0}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <Swords size={32} className="text-red-600 animate-pulse mb-2" />
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Energy Tally</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">{p2.campusAcronym}</p>
                        <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{battle.votes[p2Id] || 0}</p>
                      </div>
                  </div>

                  {/* DYNAMIC PUSH-PULL ENERGY BAR */}
                  <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                      <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)]" style={{ width: `${p1Pct}%` }} />
                      <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)]" style={{ width: `${p2Pct}%` }} />
                      {/* Center Point */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
                  </div>
                  
                  {!hasVoted ? (
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleVote(p1Id)} 
                            disabled={isVoting}
                            className="py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                        >
                            BOOST {p1.campusAcronym}
                        </button>
                        <button 
                            onClick={() => handleVote(p2Id)} 
                            disabled={isVoting}
                            className="py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                        >
                            BOOST {p2.campusAcronym}
                        </button>
                      </div>
                  ) : (
                      <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in-95">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                            <CheckCircle2 className="text-emerald-500" size={14} /> Vote Authenticated in National Hub
                        </p>
                      </div>
                  )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- RIGHT: THE CROWD (LIVE COMEBACKS) --- */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col shadow-2xl relative">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black italic tracking-tight uppercase truncate max-w-[180px]">{battle.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", isEnded ? "bg-slate-500" : "bg-red-600 animate-pulse")} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isEnded ? "Archives Locked" : "Vibrating Now"}</span>
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl text-slate-400"><MessageSquare size={20} /></div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
          {messages?.map((m) => {
            const isParticipant = battle.participants.includes(m.userId);
            return (
              <div key={m.id} className={cn("animate-in slide-in-from-bottom-2", isParticipant ? "my-6" : "")}>
                <p className={cn(
                  "text-[9px] font-black uppercase tracking-tighter mb-1",
                  isParticipant ? "text-amber-500 flex items-center gap-1" : "text-slate-500"
                )}>
                  {isParticipant && <Crown size={10} />}
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

        {!isEnded && (
            <form onSubmit={handleSendMessage} className="p-6 bg-slate-950/80 border-t border-white/10 flex gap-2">
            <input 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Throw live shade..."
                className="flex-1 bg-white/5 rounded-[1.5rem] px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-slate-700 shadow-inner"
            />
            <button 
                type="submit" 
                disabled={!message.trim()} 
                className="p-4 bg-red-600 text-white rounded-full active:scale-90 transition-all shadow-lg shadow-red-900/40 disabled:opacity-30 flex items-center justify-center"
            >
                <Send size={20} />
            </button>
            </form>
        )}
      </div>
    </div>
  );
}
