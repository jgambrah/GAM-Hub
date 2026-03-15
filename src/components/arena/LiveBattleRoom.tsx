
'use client';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Elite National Arena Stage.
 * Features:
 * 1. Dual-Video Side-by-Side Competitive Grid.
 * 2. Audience Power-Ups (Weighted Voting Artillery).
 * 3. Battle Hype Meter (Momentum calculation).
 * 4. Multimedia Comeback Feed (Video Replies).
 * 5. AI Referee Verdict Theater.
 * 6. Spectator Mode (Scalable Document sync).
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, query, orderBy, limitToLast, 
  serverTimestamp, addDoc, updateDoc, 
  increment, setDoc, doc, getDoc, onSnapshot
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/context/SoundContext';
import type { ArenaBattle, BattleMessage } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, Flame, Crown, Youtube, CheckCircle2, Mic, Video, Plus, Play, Heart, Smile, Scale, Bot, Star, Volume2, VolumeX, AlertTriangle
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
import { getBattleVerdict } from '@/ai/flows/arena-referee-flow';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
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

const REACTIONS: ('🔥' | '😂' | '😱' | '💯' | '👑')[] = ['🔥', '😂', '😱', '💯', '👑'];

const POWER_UPS = [
    { type: 'fire', label: 'Fire Boost', emoji: '🔥', weight: 5, color: 'text-orange-500' },
    { type: 'mic_drop', label: 'Mic Drop', emoji: '🎤', weight: 10, color: 'text-blue-500' },
    { type: 'crown', label: 'Crown Boost', emoji: '👑', weight: 25, color: 'text-amber-500' },
];

interface LocalBurst {
    id: string;
    emoji: string;
    x: number;
}

export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { soundOn, toggleSound } = useSound();
  const { toast } = useToast();
  
  const [inputMode, setInputMode] = useState<'chat' | 'boost' | 'artillery'>('chat');
  const [message, setMessage] = useState('');
  const [artilleryUrl, setArtilleryUrl] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [bursts, setBursts] = useState<LocalBurst[]>([]);
  
  // 🛡️ MOMENTUM STATE
  const [prevVotes, setPrevVotes] = useState({ A: 0, B: 0 });
  const [momentum, setHype] = useState<'A' | 'B' | 'neutral'>('neutral');

  // 🛡️ ANTI-SPAM PROTOCOL STATE
  const [lastPowerUpTime, setLastPowerUpTime] = useState(0);
  const [userBoostCount, setUserBoostCount] = useState(0);
  const MAX_BOOSTS_PER_BATTLE = 10;
  const COOLDOWN_MS = 5000;
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. 🏎️ SPECTATOR OPTIMIZATION: Real-time sync with main battle doc ONLY
  const battleRef = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return doc(firestore, 'arena_battles', battleId);
  }, [firestore, battleId]);

  const { data: rawBattle, isLoading: isLoadingBattle } = useDoc<ArenaBattle>(battleRef);

  // 🧬 LEGACY RECONCILIATION LAYER
  const battle = useMemo(() => {
    if (!rawBattle) return null;
    if (rawBattle.opponentA && rawBattle.opponentB) return rawBattle;

    const pIds = rawBattle.participants || [];
    if (pIds.length >= 2) {
        return {
            ...rawBattle,
            opponentA: { userId: pIds[0], videoUrl: '', votes: rawBattle.votes?.[pIds[0]] || 0 },
            opponentB: { userId: pIds[1], videoUrl: '', votes: rawBattle.votes?.[pIds[1]] || 0 }
        } as ArenaBattle;
    }
    return rawBattle;
  }, [rawBattle]);

  // Derived participants info
  const p1 = battle?.participantInfo[battle.opponentA.userId] || { name: 'Warrior A', campusAcronym: 'HUB', primaryColor: '#3b82f6' };
  const p2 = battle?.participantInfo[battle.opponentB.userId] || { name: 'Warrior B', campusAcronym: 'RIVAL', primaryColor: '#f59e0b' };

  // 📈 HYPE METER CALCULATION
  useEffect(() => {
    if (!battle) return;
    const interval = setInterval(() => {
        const deltaA = (battle.opponentA.votes || 0) - prevVotes.A;
        const deltaB = (battle.opponentB.votes || 0) - prevVotes.B;
        
        if (deltaA > deltaB + 5) setHype('A');
        else if (deltaB > deltaA + 5) setHype('B');
        else setHype('neutral');

        setPrevVotes({ A: battle.opponentA.votes || 0, B: battle.opponentB.votes || 0 });
    }, 10000);
    return () => clearInterval(interval);
  }, [battle, prevVotes]);

  // 2. LIVE COMEBACK STREAM
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  // 3. 📡 VISUAL BURST LISTENER: Ephemeral ephemeral burst detection
  useEffect(() => {
    if (!firestore || !battleId) return;
    const q = query(
        collection(firestore, 'arena_battles', battleId, 'reactions'),
        orderBy('createdAt', 'desc'),
        limitToLast(5)
    );
    const unsub = onSnapshot(q, (snap) => {
        snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const isRecent = data.createdAt ? (Date.now() - (data.createdAt?.toMillis?.() || Date.now()) < 3000) : true;
                if (isRecent) {
                    const newBurst = {
                        id: change.doc.id,
                        emoji: data.emoji,
                        x: 20 + Math.random() * 60
                    };
                    setBursts(prev => [...prev, newBurst]);
                    setTimeout(() => {
                        setBursts(prev => prev.filter(b => b.id !== newBurst.id));
                    }, 2000);
                }
            }
        });
    });
    return () => unsub();
  }, [firestore, battleId]);

  // 4. JUDGMENT PROTOCOL: Liaison AI Referee
  useEffect(() => {
    if (!battle || battle.status !== 'ended' || battle.aiVerdict || !user || !firestore) return;

    if (battle.creatorId === user.id) {
        const runReferee = async () => {
            setVerdictLoading(true);
            try {
                const verdictResult = await getBattleVerdict({
                    originalShade: battle.title,
                    comebacks: messages?.map(m => m.text || "") || ["Silence in the Yard."],
                    originalCampus: p1?.campusAcronym || 'GH',
                    targetCampus: p2?.campusAcronym || 'Rival'
                });

                await updateDoc(doc(firestore, 'arena_battles', battleId), {
                    aiVerdict: verdictResult
                });

                toast({ title: "Verdict Logged! ⚖️" });
            } catch (err) {
                console.error("Liaison Referee Error:", err);
            } finally {
                setVerdictLoading(false);
            }
        };
        runReferee();
    }
  }, [battle?.status, battle?.aiVerdict, user?.id, firestore, battleId, messages, p1.campusAcronym, p2.campusAcronym, toast]);

  // 5. VOTE AUDIT
  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { 
        if (snap.exists()) setHasVoted(true); 
    });
  }, [firestore, user, battleId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || battle?.status === 'ended') return;
    const text = message.trim();
    setMessage('');
    addDoc(collection(firestore, "arena_battles", battleId, "messages"), { 
        userId: user.id, 
        userName: user.name, 
        text, 
        createdAt: serverTimestamp() 
    });
  };

  const handleSendArtillery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artilleryUrl.trim() || !firestore || !user || battle?.status === 'ended') return;
    const url = artilleryUrl.trim();
    setArtilleryUrl('');
    setInputMode('chat');
    
    addDoc(collection(firestore, "arena_battles", battleId, "messages"), { 
        userId: user.id, 
        userName: user.name, 
        text: "🔥 Live Artillery Deployed!",
        mediaUrl: url,
        mediaType: url.includes('youtube') || url.includes('youtu.be') ? 'youtube' : 'tiktok',
        createdAt: serverTimestamp() 
    });
    
    toast({ title: "Artillery Launched! 🚀" });
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
    if (!targetUserId) return;

    try {
      await setDoc(doc(firestore, 'arena_battles', battleId, 'user_votes', user.id), { 
          votedFor: targetUserId, 
          targetSide: target, 
          timestamp: serverTimestamp() 
      });
      await updateDoc(doc(firestore, 'arena_battles', battleId), { 
          [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(1), 
          [`votes.${targetUserId}`]: increment(1) 
      });
      setHasVoted(true);
      toast({ title: "Vote Authenticated! 🗳️" });
    } catch(err) {
        toast({ variant: 'destructive', title: 'Vote Refused' });
    } finally { setIsVoting(false); }
  };

  const handlePowerUp = async (powerup: typeof POWER_UPS[0], target: 'A' | 'B') => {
    if (!firestore || !user || !battle || battle.status === 'ended') return;
    
    const now = Date.now();
    if (now - lastPowerUpTime < COOLDOWN_MS) {
        toast({ variant: 'destructive', title: 'Handshake protocol in cooldown.' });
        return;
    }

    if (userBoostCount >= MAX_BOOSTS_PER_BATTLE) {
        toast({ variant: 'destructive', title: 'Energy Exhausted' });
        return;
    }

    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    if (!targetUserId) return;

    setLastPowerUpTime(now);
    setUserBoostCount(prev => prev + 1);

    try {
        addDoc(collection(firestore, 'arena_battles', battleId, 'powerups'), {
            userId: user.id,
            target: target,
            type: powerup.type,
            weight: powerup.weight,
            createdAt: serverTimestamp()
        });

        await updateDoc(doc(firestore, 'arena_battles', battleId), { 
            [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(powerup.weight), 
            [`votes.${targetUserId}`]: increment(powerup.weight) 
        });

        sendReaction(powerup.emoji);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Power-Up Refused' });
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoadingBattle || !battle || !battle.opponentA || !battle.opponentB) {
    return (
        <div className="fixed inset-0 z-[7000] bg-black flex flex-col items-center justify-center text-center gap-4">
            <Loader2 className="animate-spin text-red-600" size={48} />
            <p className="text-white font-black text-xs uppercase tracking-[0.4em] opacity-50 animate-pulse">
                Authenticating Battle Frequency...
            </p>
        </div>
    );
  }

  const { opponentA, opponentB, aiVerdict } = battle;
  const totalVotes = (opponentA.votes || 0) + (opponentB.votes || 0);
  const p1Pct = totalVotes > 0 ? ((opponentA.votes || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;
  const isEnded = battle.status === 'ended';
  const winner = opponentA.votes > opponentB.votes ? p1 : (opponentB.votes > opponentA.votes ? p2 : null);

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      
      <div className="flex-[3] relative bg-slate-950 flex flex-col border-r border-white/5">
        
        {/* REACTION LAYER (Visual Bursts) */}
        <div className="absolute inset-0 pointer-events-none z-[60]">
            <AnimatePresence>
                {bursts.map(b => (
                    <motion.div
                        key={b.id}
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 1, 1, 0], y: -300, scale: [0.5, 2, 1.5, 1] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="absolute text-6xl select-none"
                        style={{ left: `${b.x}%`, bottom: '150px' }}
                    >
                        {b.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>

        {/* CONTROLS HUB */}
        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center">
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 shadow-xl">
            <X size={24}/>
          </button>
          <div className={cn(
              "px-6 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] backdrop-blur-md border border-white/10 shadow-2xl transition-all",
              isEnded ? "bg-amber-500" : "bg-red-600 animate-pulse"
          )}>
            {isEnded ? "NATIONAL VERDICT" : "LIVE SHOWDOWN"}
          </div>
          <button onClick={toggleSound} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 shadow-xl">
            {soundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>

        {/* END GAME OVERLAY */}
        {isEnded && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl animate-in zoom-in duration-700 overflow-y-auto">
                <div className="max-w-xl w-full text-center space-y-8 py-10">
                    <div className="p-8 bg-amber-500 rounded-full shadow-[0_0_100px_rgba(245,158,11,0.4)] animate-bounce mx-auto w-fit">
                        <Trophy size={80} className="text-slate-950" />
                    </div>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase text-amber-500">Victory Declared</h1>
                    <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                        <Avatar className="h-24 w-24 border-4 border-amber-500 shadow-2xl mx-auto mb-4">
                            <AvatarImage src={winner?.avatarUrl} />
                            <AvatarFallback className="text-2xl font-black">{winner?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-3xl font-black text-white">{winner?.name || 'A Legend'}</h2>
                        <p className="text-amber-500 font-black uppercase text-xs tracking-widest mt-1">{winner?.campusAcronym} CHAMPION</p>
                    </div>
                    {aiVerdict && (
                        <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[2.5rem] text-left">
                            <div className="flex items-center gap-3 mb-4">
                                <Bot size={18} className="text-amber-500" />
                                <span className="text-[10px] font-black text-amber-500 uppercase">AI Referee Verdict</span>
                            </div>
                            <p className="text-lg font-black italic text-indigo-50 leading-tight">"{aiVerdict.verdict}"</p>
                        </div>
                    )}
                    <Button onClick={onClose} className="w-full py-8 bg-white text-slate-950 font-black rounded-3xl uppercase tracking-widest">Salute the Yard</Button>
                </div>
            </div>
        )}

        {/* REAL-TIME SCOREBOARD */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-8">
                <div className="text-center flex-1">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{p1?.campusAcronym}</p>
                    <p className="text-2xl font-black text-white tabular-nums">{opponentA.votes || 0}</p>
                </div>
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"><Swords size={18} className="text-white" /></div>
                <div className="text-center flex-1">
                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">{p2?.campusAcronym}</p>
                    <p className="text-2xl font-black text-white tabular-nums">{opponentB.votes || 0}</p>
                </div>
            </div>
            
            {/* HYPE METER HUD */}
            {momentum !== 'neutral' && (
                <div className="mt-4 flex justify-center animate-in slide-in-from-top-2">
                    <div className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg animate-bounce border-2",
                        momentum === 'A' ? "bg-blue-600 border-blue-400 text-white" : "bg-amber-500 border-amber-300 text-slate-950"
                    )}>
                        🔥🔥🔥 {momentum === 'A' ? p1.campusAcronym : p2.campusAcronym} DOMINATING
                    </div>
                </div>
            )}
        </div>

        {/* DUAL STREAM GRID */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
          <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
            <ReactPlayer url={opponentA.videoUrl} playing={!isEnded} muted={!soundOn} width="100%" height="100%" playsinline />
            <div className="absolute bottom-6 left-6 z-20 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white">
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">{p1?.campusAcronym}</p>
                <p className="text-xs font-black">{p1?.name}</p>
            </div>
          </div>
          <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
            <ReactPlayer url={opponentB.videoUrl} playing={!isEnded} muted={!soundOn} width="100%" height="100%" playsinline />
            <div className="absolute bottom-6 right-6 z-20 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">{p2?.campusAcronym}</p>
                <p className="text-xs font-black">{p2?.name}</p>
            </div>
          </div>
        </div>

        {/* ACTION HUD */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
          <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
            <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
            </div>

            {!hasVoted && !isEnded ? (
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleVote('A')} disabled={isVoting} className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-500">VOTE {p1?.campusAcronym}</button>
                    <button onClick={() => handleVote('B')} disabled={isVoting} className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-amber-400">VOTE {p2?.campusAcronym}</button>
                </div>
            ) : !isEnded && (
                <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        <CheckCircle2 size={14} /> Vote Authenticated
                    </p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* CHAT & BOOST SIDEBAR */}
      <div className="flex-1 bg-slate-900 flex flex-col shadow-2xl max-h-screen">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
          <h3 className="text-white font-black italic tracking-tight uppercase truncate max-w-[180px]">{battle.title}</h3>
          <div className="flex gap-2">
            <button onClick={() => setInputMode('chat')} className={cn("p-2 rounded-xl transition-all", inputMode === 'chat' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white")}><MessageSquare size={18}/></button>
            <button onClick={() => setInputMode('artillery')} className={cn("p-2 rounded-xl transition-all", inputMode === 'artillery' ? "bg-red-600 text-white" : "text-slate-500 hover:text-white")}><Video size={18}/></button>
            <button onClick={() => setInputMode('boost')} className={cn("p-2 rounded-xl transition-all", inputMode === 'boost' ? "bg-amber-500 text-slate-950" : "text-slate-500 hover:text-white")}><Zap size={18}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
          {messages?.map((m) => (
            <div key={m.id} className="animate-in slide-in-from-bottom-2">
              <p className="text-[9px] font-black uppercase text-slate-500 mb-1">{m.userName}</p>
              <div className={cn(
                  "p-3 rounded-2xl rounded-tl-none border shadow-sm",
                  m.userId === opponentA.userId || m.userId === opponentB.userId ? "bg-white/10 border-amber-500/30 text-amber-100" : "bg-white/5 border-white/5 text-slate-300"
              )}>
                <p className="text-sm font-medium">{m.text}</p>
                {m.mediaUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden aspect-video border border-white/10">
                        {m.mediaType === 'youtube' ? <YouTube videoId={getYouTubeId(m.mediaUrl) || ''} opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 } }} className="w-full h-full" /> : <TikTokEmbed url={m.mediaUrl} />}
                    </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 bg-slate-950 border-t border-white/5">
            {inputMode === 'chat' ? (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Drop a shade..." className="flex-1 bg-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold" />
                    <button type="submit" disabled={!message.trim()} className="p-4 bg-blue-600 text-white rounded-2xl active:scale-90 transition-all"><Send size={20} /></button>
                </form>
            ) : inputMode === 'artillery' ? (
                <form onSubmit={handleSendArtillery} className="space-y-3">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest px-2">Launch Video Artillery</p>
                    <div className="flex gap-2">
                        <input value={artilleryUrl} onChange={e => setArtilleryUrl(e.target.value)} placeholder="YouTube/TikTok Link..." className="flex-1 bg-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none border-2 border-red-600/30 focus:border-red-600 transition-all font-bold" />
                        <button type="submit" disabled={!artilleryUrl.trim()} className="p-4 bg-red-600 text-white rounded-2xl active:scale-90 shadow-lg transition-all"><Plus size={20} /></button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">⚡ Audience Power-Ups</p>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Limit: {userBoostCount}/{MAX_BOOSTS_PER_BATTLE}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {POWER_UPS.map(up => (
                            <div key={up.type} className="flex flex-col gap-2">
                                <button onClick={() => handlePowerUp(up, 'A')} className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-xl hover:bg-blue-600 transition-all active:scale-95 group">
                                    <span className="text-xl group-active:scale-150 transition-transform inline-block">{up.emoji}</span>
                                    <p className="text-[8px] font-black text-white mt-1 uppercase">+{up.weight}</p>
                                </button>
                                <button onClick={() => handlePowerUp(up, 'B')} className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl hover:bg-amber-500 transition-all active:scale-95 group">
                                    <span className="text-xl group-active:scale-150 transition-transform inline-block">{up.emoji}</span>
                                    <p className="text-[8px] font-black text-white mt-1 uppercase">+{up.weight}</p>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="px-6 py-3 bg-slate-950/30 flex justify-center gap-4 border-t border-white/5">
            {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-150 transition-all active:scale-90 p-1">{emoji}</button>
            ))}
        </div>
      </div>
    </div>
  );
}
