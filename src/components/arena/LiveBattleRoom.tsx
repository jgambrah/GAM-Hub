
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limitToLast, serverTimestamp, addDoc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { ArenaBattle, BattleMessage, CounterAttack, BattleReaction } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, Flame, Crown, AlertCircle, Youtube, CheckCircle2, Mic, Video, Plus, Play, Heart, Smile
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
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
 * Features a Dual-Stream side-by-side grid, video counter-attacks,
 * a real-time scoreboard, and a live emoji reaction burst system.
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
  const [bursts, setBursts] = useState<{ id: string, emoji: string, x: number }[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const artilleryRef = useRef<HTMLDivElement>(null);

  // 1. REAL-TIME BATTLE SYNC & SCOREBOARD
  useEffect(() => {
    if (!firestore || !battleId) return;
    const unsub = onSnapshot(doc(firestore, 'arena_battles', battleId), (snap) => {
      if (snap.exists()) setBattle({ id: snap.id, ...snap.data() } as ArenaBattle);
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 2. LIVE COMEBACK STREAM (CHAT)
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  // 3. LIVE ARTILLERY STREAM (VIDEO COUNTER-ATTACKS)
  const artilleryQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "counter_attacks"),
      orderBy("createdAt", "asc"),
      limitToLast(10)
    ) : null
  , [firestore, battleId]);

  const { data: counterAttacks } = useCollection<CounterAttack>(artilleryQuery);

  // 4. LIVE REACTION LISTENER (BURSTS)
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
                const reaction = change.doc.data() as BattleReaction;
                // Add to local burst list
                const id = Math.random().toString(36).substring(7);
                setBursts(prev => [...prev, { id, emoji: reaction.emoji, x: 20 + Math.random() * 60 }]);
                // Remove after animation duration
                setTimeout(() => {
                    setBursts(prev => prev.filter(b => b.id !== id));
                }, 3000);
            }
        });
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 5. VOTE AUDIT
  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { if (snap.exists()) setHasVoted(true); });
  }, [firestore, user, battleId]);

  // 6. AUTO-SCROLL
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

  const handleLaunchArtillery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim() || !firestore || !user || battle?.status === 'ended') return;
    const url = videoUrl.trim();
    setVideoUrl('');
    setInputMode('chat');

    const type = url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'tiktok';

    addDoc(collection(firestore, 'arena_battles', battleId, 'counter_attacks'), {
      userId: user.id,
      userName: user.name,
      videoUrl: url,
      type,
      createdAt: serverTimestamp()
    });

    toast({ title: "Artillery Launched! 🔥" });
  };

  const sendReaction = (emoji: string) => {
    if (!firestore || !user || battle?.status === 'ended') return;
    addDoc(collection(firestore, 'arena_battles', battleId, 'reactions'), {
        emoji,
        userId: user.id,
        createdAt: serverTimestamp()
    });
  };

  const handleVote = async (target: 'A' | 'B') => {
    if (!firestore || !user || hasVoted || isVoting || !battle || battle.status === 'ended') return;
    
    setIsVoting(true);
    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    
    if (!targetUserId) {
        setIsVoting(false);
        return;
    }

    try {
      const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
      await setDoc(voteRef, { 
        votedFor: targetUserId, 
        targetSide: target,
        timestamp: serverTimestamp() 
      });

      const battleRef = doc(firestore, 'arena_battles', battleId);
      await updateDoc(battleRef, {
        [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(1),
        [`votes.${targetUserId}`]: increment(1)
      });

      setHasVoted(true);
      toast({ title: "Vote Authenticated! 🗳️" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Vote Refused" });
    } finally {
      setIsVoting(false);
    }
  };

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
        
        {/* REACTION BURST LAYER */}
        <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
            {bursts.map(b => (
                <div 
                    key={b.id} 
                    className="absolute text-5xl animate-bounce-slow" 
                    style={{ left: `${b.x}%`, bottom: '20px', transition: 'all 3s linear', transform: 'translateY(-100vh)' }}
                >
                    {b.emoji}
                </div>
            ))}
        </div>

        {/* OVERLAY CONTROLS */}
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

        {/* 🏆 LIVE SCOREBOARD HUD */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-8">
                <div className="text-center flex-1">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{p1?.campusAcronym || 'A'}</p>
                    <p className="text-2xl font-black text-white tabular-nums">{opponentA.votes || 0}</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                        <Swords size={18} className="text-white" />
                    </div>
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-1">LIVE SCORE</p>
                </div>
                <div className="text-center flex-1">
                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">{p2?.campusAcronym || 'B'}</p>
                    <p className="text-2xl font-black text-white tabular-nums">{opponentB.votes || 0}</p>
                </div>
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

        {/* HUD: ENERGY TALLY & ARTILLERY SHELF */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
          <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
            
            <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
            </div>

            {/* 🔥 COUNTER-ATTACK SHELF */}
            {counterAttacks && counterAttacks.length > 0 && (
                <div className="mb-8 space-y-3">
                    <div className="flex items-center gap-2 px-2">
                        <Flame size={14} className="text-red-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Artillery</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {counterAttacks.map((attack) => (
                            <button 
                                key={attack.id}
                                className="flex-shrink-0 flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-95 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center border border-white/5 group-hover:border-red-500 transition-all">
                                    <Play size={16} fill="white" className="text-white" />
                                </div>
                                <div className="text-left pr-4">
                                    <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Attack</p>
                                    <p className="text-[10px] font-bold text-white truncate max-w-[80px]">{attack.userName}</p>
                                </div>
                            </button>
                        ))}
                        <div ref={artilleryRef} />
                    </div>
                </div>
            )}
            
            {!hasVoted && !isEnded ? (
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleVote('A')} 
                        disabled={isVoting}
                        className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-lg hover:bg-blue-500"
                    >
                        {isVoting ? <Loader2 className="animate-spin mx-auto" /> : `VOTE ${p1?.campusAcronym || 'A'}`}
                    </button>
                    <button 
                        onClick={() => handleVote('B')} 
                        disabled={isVoting}
                        className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-lg hover:bg-amber-400"
                    >
                        {isVoting ? <Loader2 className="animate-spin mx-auto" /> : `VOTE ${p2?.campusAcronym || 'B'}`}
                    </button>
                </div>
            ) : (
                <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in-95">
                    {isEnded ? (
                        <div className="flex flex-col items-center gap-2">
                            <Trophy size={24} className="text-amber-500" />
                            <p className="text-lg font-black text-white italic uppercase tracking-tighter">
                                Winner: {opponentA.votes > opponentB.votes ? (p1?.campusAcronym || 'A') : (p2?.campusAcronym || 'B')}
                            </p>
                        </div>
                    ) : (
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500" /> Vote Authenticated by Liaison
                        </p>
                    )}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* --- SIDEBAR: LIVE CHAT & DISPATCH --- */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black italic tracking-tight uppercase truncate max-w-[180px]">{battle.title}</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Combat Hub</span>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={() => setInputMode('chat')}
                className={cn("p-2 rounded-xl transition-all", inputMode === 'chat' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white")}
            >
                <MessageSquare size={18} />
            </button>
            <button 
                onClick={() => setInputMode('artillery')}
                className={cn("p-2 rounded-xl transition-all", inputMode === 'artillery' ? "bg-red-600 text-white" : "text-slate-500 hover:text-white")}
            >
                <Swords size={18} />
            </button>
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

        {/* 🚀 LIVE REACTION BAR */}
        <div className="px-6 py-3 bg-slate-950/30 flex justify-between items-center border-t border-white/5">
            <div className="flex gap-2">
                {REACTIONS.map(emoji => (
                    <button 
                        key={emoji} 
                        onClick={() => sendReaction(emoji)}
                        className="text-xl hover:scale-125 transition-transform active:scale-90 p-1"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                <Smile size={14} className="text-slate-500" />
            </div>
        </div>

        {!isEnded && (
            <div className="p-6 bg-slate-950/80 border-t border-white/10">
                {inputMode === 'chat' ? (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input 
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Drop a live shade..."
                            className="flex-1 bg-white/5 rounded-[1.5rem] px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold shadow-inner"
                        />
                        <button type="submit" disabled={!message.trim()} className="p-4 bg-blue-600 text-white rounded-full active:scale-90 transition-transform shadow-lg"><Send size={20} /></button>
                    </form>
                ) : (
                    <form onSubmit={handleLaunchArtillery} className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-2">
                            <Video size={14} className="text-red-500" />
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Video Counter-Attack</span>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                value={videoUrl}
                                onChange={e => setVideoUrl(e.target.value)}
                                placeholder="Paste TikTok/YT link..."
                                className="flex-1 bg-red-900/20 rounded-[1.5rem] px-5 py-4 text-xs text-red-300 outline-none border border-red-900/50 focus:border-red-500 transition-all font-mono"
                            />
                            <button type="submit" disabled={!videoUrl.trim()} className="p-4 bg-red-600 text-white rounded-full active:scale-90 transition-transform shadow-lg"><Zap size={20} fill="white" /></button>
                        </div>
                    </form>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
