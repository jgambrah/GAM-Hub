
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limitToLast, serverTimestamp, addDoc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { ArenaBattle, BattleMessage, CounterAttack, BattleReaction } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, Flame, Crown, AlertCircle, Youtube, CheckCircle2, Mic, Video, Plus, Play, Heart, Smile, Scale, Bot, Star
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
import { getBattleVerdict } from '@/ai/flows/arena-referee-flow';
import dynamic from 'next/dynamic';

const TikTokEmbed = dynamic(() => import('../social/tiktok-embed').then(mod => mod.TikTokEmbed), {
  ssr: false,
  loading: () => <div className="h-60 w-[325px] bg-muted animate-pulse rounded-lg mx-auto" />
});

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

const REACTIONS = ['🔥', '😂', '😱', '💯', '👑'];

/**
 * LiveBattleRoom Component
 * -----------------------
 * Real-time competitive stage for inter-uni showdowns.
 * Upgraded with End-of-Battle Victory Theater and AI Referee Judgment.
 */
export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [battle, setBattle] = useState<ArenaBattle | null>(null);
  const [inputMode, setInputMode] = useState<'chat' | 'artillery'>('chat');
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [bursts, setBursts] = useState<{ id: string, emoji: string, x: number }[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const artilleryRef = useRef<HTMLDivElement>(null);

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

  // 3. LIVE ARTILLERY STREAM
  const artilleryQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "counter_attacks"),
      orderBy("createdAt", "asc"),
      limitToLast(10)
    ) : null
  , [firestore, battleId]);

  const { data: counterAttacks } = useCollection<CounterAttack>(artilleryQuery);

  // 4. JUDGMENT PROTOCOL: Trigger AI Referee when battle ends
  useEffect(() => {
    if (!battle || battle.status !== 'ended' || battle.aiVerdict || !user || !firestore) return;

    // RULE: Only the creator (Liaison designated host) triggers the AI Referee to save tokens
    if (battle.creatorId === user.id) {
        const runReferee = async () => {
            setVerdictLoading(true);
            try {
                const participantIds = battle.participants;
                const p1 = battle.participantInfo[participantIds[0]];
                const p2 = battle.participantInfo[participantIds[1]];

                const verdictResult = await getBattleVerdict({
                    originalShade: battle.title,
                    comebacks: messages?.map(m => m.text) || ["Silence in the Yard."],
                    originalCampus: p1?.campusAcronym || 'GH',
                    targetCampus: p2?.campusAcronym || 'Rival'
                });

                await updateDoc(doc(firestore, 'arena_battles', battleId), {
                    aiVerdict: verdictResult
                });

                toast({ title: "Verdit Logged! ⚖️" });
            } catch (err) {
                console.error("Liaison Referee Drifted:", err);
            } finally {
                setVerdictLoading(false);
            }
        };
        runReferee();
    }
  }, [battle?.status, battle?.aiVerdict, user?.id, firestore, battleId, messages]);

  // 5. LIVE REACTION LISTENER
  useEffect(() => {
    if (!firestore || !battleId) return;
    const q = query(
        collection(firestore, 'arena_battles', battleId, 'reactions'),
        orderBy('createdAt', 'desc'),
        limitToLast(5)
    );
    const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const id = Math.random().toString(36).substring(7);
                setBursts(prev => [...prev, { id, emoji: change.doc.data().emoji, x: 20 + Math.random() * 60 }]);
                setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 3000);
            }
        });
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 6. VOTE AUDIT
  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    getDoc(doc(firestore, 'arena_battles', battleId, 'user_votes', user.id)).then(snap => { if (snap.exists()) setHasVoted(true); });
  }, [firestore, user, battleId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || battle?.status === 'ended') return;
    const text = message.trim();
    setMessage('');
    addDoc(collection(firestore, 'arena_battles', battleId, 'messages'), { userId: user.id, userName: user.name, text, createdAt: serverTimestamp() });
  };

  const sendReaction = (emoji: string) => {
    if (!firestore || !user || battle?.status === 'ended') return;
    addDoc(collection(firestore, 'arena_battles', battleId, 'reactions'), { emoji, userId: user.id, createdAt: serverTimestamp() });
  };

  const handleVote = async (target: 'A' | 'B') => {
    if (!firestore || !user || hasVoted || isVoting || !battle || battle.status === 'ended') return;
    setIsVoting(true);
    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    if (!targetUserId) return;

    try {
      await setDoc(doc(firestore, 'arena_battles', battleId, 'user_votes', user.id), { votedFor: targetUserId, targetSide: target, timestamp: serverTimestamp() });
      await updateDoc(doc(firestore, 'arena_battles', battleId), { [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(1), [`votes.${targetUserId}`]: increment(1) });
      setHasVoted(true);
      toast({ title: "Vote Authenticated! 🗳️" });
    } finally { setIsVoting(false); }
  };

  if (!battle || !battle.opponentA || !battle.opponentB) {
    return <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;
  }

  const { opponentA, opponentB, participantInfo = {}, aiVerdict } = battle;
  const p1 = participantInfo[opponentA.userId];
  const p2 = participantInfo[opponentB.userId];
  const totalVotes = (opponentA.votes || 0) + (opponentB.votes || 0);
  const p1Pct = totalVotes > 0 ? ((opponentA.votes || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;
  const isEnded = battle.status === 'ended';
  const winner = opponentA.votes > opponentB.votes ? p1 : (opponentB.votes > opponentA.votes ? p2 : null);

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      
      {/* THE STAGE */}
      <div className="flex-[3] relative bg-slate-950 flex flex-col">
        {/* REACTION BURSTS */}
        <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
            {bursts.map(b => (
                <div key={b.id} className="absolute text-5xl transition-all duration-[3000ms] ease-out animate-bounce-slow" style={{ left: `${b.x}%`, bottom: '20px', transform: 'translateY(-100vh)' }}>{b.emoji}</div>
            ))}
        </div>

        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center">
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60"><X size={24}/></button>
          <div className={cn("px-4 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] backdrop-blur-md border border-white/10 shadow-2xl", isEnded ? "bg-amber-500" : "bg-red-600 animate-pulse")}>
            {isEnded ? "NATIONAL VERDICT" : "LIVE SHOWDOWN"}
          </div>
        </div>

        {/* 🏆 VICTORY THEATER OVERLAY */}
        {isEnded && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in zoom-in duration-700">
                <div className="max-w-xl w-full text-center space-y-8">
                    <div className="flex justify-center">
                        <div className="p-8 bg-amber-500 rounded-full shadow-[0_0_100px_rgba(245,158,11,0.4)] animate-bounce">
                            <Trophy size={80} className="text-slate-950" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="text-5xl font-black italic tracking-tighter uppercase text-amber-500">Victory Declared</h1>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Official Liaison Outcome</p>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Crown size={150}/></div>
                        <div className="flex flex-col items-center gap-4 relative z-10">
                            <Avatar className="h-24 w-24 border-4 border-amber-500 shadow-2xl">
                                <AvatarImage src={winner?.avatarUrl} />
                                <AvatarFallback className="text-2xl font-black">{winner?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-3xl font-black text-white">{winner?.name || 'A Legend'}</h2>
                                <p className="text-amber-500 font-black uppercase text-xs tracking-widest mt-1">{winner?.campusAcronym} CHAMPION</p>
                            </div>
                        </div>
                    </div>

                    {/* AI REFEREE VERDICT PANEL */}
                    <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[2.5rem] text-left relative overflow-hidden">
                        {verdictLoading ? (
                            <div className="flex items-center gap-4 py-4">
                                <Loader2 className="animate-spin text-amber-500" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Referee is auditing comebacks...</p>
                            </div>
                        ) : aiVerdict ? (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-500 rounded-xl text-slate-950"><Bot size={18} /></div>
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">AI Referee Verdict</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                                        <Flame size={12} className="text-red-500" />
                                        <span className="text-[10px] font-black text-red-500 uppercase">Burn: {aiVerdict.burnLevel}/10</span>
                                    </div>
                                </div>
                                <p className="text-lg font-black italic text-indigo-50 leading-tight">"{aiVerdict.verdict}"</p>
                                <div className="pt-4 border-t border-white/5">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Advice: {aiVerdict.refereeAdvice}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic text-center py-4">Awaiting Liaison Verdict...</p>
                        )}
                    </div>

                    <Button onClick={onClose} className="w-full py-8 bg-white text-slate-950 font-black rounded-3xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl">Salute the Yard</Button>
                </div>
            </div>
        )}

        {/* HUD: DUAL SCOREBOARD */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-8">
                <div className="text-center flex-1">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{p1?.campusAcronym}</p>
                    <p className="text-2xl font-black text-white">{opponentA.votes || 0}</p>
                </div>
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"><Swords size={18} className="text-white" /></div>
                <div className="text-center flex-1">
                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">{p2?.campusAcronym}</p>
                    <p className="text-2xl font-black text-white">{opponentB.votes || 0}</p>
                </div>
            </div>
        </div>

        {/* SIDE-BY-SIDE STREAMS */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
          <div className="relative rounded-[2rem] overflow-hidden border-4 border-white/5 bg-black">
            <ReactPlayer url={opponentA.videoUrl} playing={!isEnded} muted={soundOn} width="100%" height="100%" />
            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-white shadow-xl"><AvatarImage src={p1?.avatarUrl} /><AvatarFallback>A</AvatarFallback></Avatar>
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white"><p className="text-[9px] font-black uppercase tracking-widest">{p1?.campusAcronym}</p><p className="text-xs font-bold">{p1?.name}</p></div>
            </div>
          </div>
          <div className="relative rounded-[2rem] overflow-hidden border-4 border-white/5 bg-black">
            <ReactPlayer url={opponentB.videoUrl} playing={!isEnded} muted={soundOn} width="100%" height="100%" />
            <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3 flex-row-reverse">
                <Avatar className="h-10 w-10 border-2 border-white shadow-xl"><AvatarImage src={p2?.avatarUrl} /><AvatarFallback>B</AvatarFallback></Avatar>
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-right"><p className="text-[9px] font-black uppercase tracking-widest">{p2?.campusAcronym}</p><p className="text-xs font-bold">{p2?.name}</p></div>
            </div>
          </div>
        </div>

        {/* BOTTOM HUD: ENERGY & VOTING */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
          <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
            <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
            </div>

            {!hasVoted && !isEnded ? (
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleVote('A')} disabled={isVoting} className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-lg hover:bg-blue-500">{isVoting ? <Loader2 className="animate-spin mx-auto" /> : `VOTE ${p1?.campusAcronym}`}</button>
                    <button onClick={() => handleVote('B')} disabled={isVoting} className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-lg hover:bg-amber-400">{isVoting ? <Loader2 className="animate-spin mx-auto" /> : `VOTE ${p2?.campusAcronym}`}</button>
                </div>
            ) : (
                <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in-95">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" /> Vote Authenticated
                    </p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* CHAT SIDEBAR */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex justify-between items-center flex-shrink-0">
          <div><h3 className="text-white font-black italic tracking-tight uppercase truncate max-w-[180px]">{battle.title}</h3><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Comeback Hub</span></div>
          <div className="flex gap-2">
            <button onClick={() => setInputMode('chat')} className={cn("p-2 rounded-xl transition-all", inputMode === 'chat' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white")}><MessageSquare size={18}/></button>
            <button onClick={() => setInputMode('artillery')} className={cn("p-2 rounded-xl transition-all", inputMode === 'artillery' ? "bg-red-600 text-white" : "text-slate-500 hover:text-white")}><Swords size={18}/></button>
          </div>
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

        {/* LIVE REACTIONS */}
        <div className="px-6 py-3 bg-slate-950/30 flex justify-between items-center border-t border-white/5">
            <div className="flex gap-2">
                {REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => sendReaction(emoji)} className="text-xl hover:scale-125 transition-transform active:scale-90 p-1">{emoji}</button>
                ))}
            </div>
            <div className="p-2 bg-white/5 rounded-lg border border-white/10"><Smile size={14} className="text-slate-500" /></div>
        </div>

        {!isEnded && (
            <div className="p-6 bg-slate-950/80 border-t border-white/10">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Drop a live shade..." className="flex-1 bg-white/5 rounded-[1.5rem] px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold shadow-inner" />
                    <button type="submit" disabled={!message.trim()} className="p-4 bg-blue-600 text-white rounded-full active:scale-90 shadow-lg"><Send size={20} /></button>
                </form>
            </div>
        )}
      </div>
    </div>
  );
}
