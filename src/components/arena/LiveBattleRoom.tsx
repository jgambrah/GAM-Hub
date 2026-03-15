
'use client';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Elite National Arena Stage.
 * Handshake Lifecycle: WAITING (Challenge Mode) -> LIVE (Showdown Mode) -> ENDED (Verdict Mode)
 * Includes Creator Selection logic and Direct Rivalry Acceptance.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, query, orderBy, limitToLast, 
  serverTimestamp, addDoc, updateDoc, 
  increment, doc, getDoc, onSnapshot, writeBatch
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/context/SoundContext';
import type { ArenaBattle, BattleMessage, ArenaChallenger } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, Flame, PlayCircle, ShieldCheck, Star, Bot, Scale, Volume2, VolumeX, AlertTriangle, UserPlus, CheckCircle2, Target
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
import { Button } from '@/components/ui/button';
import { JoinBattleModal } from './JoinBattleModal';

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

const POWER_UPS = [
    { type: 'fire', label: 'Fire Boost', emoji: '🔥', weight: 5 },
    { type: 'mic_drop', label: 'Mic Drop', emoji: '🎤', weight: 10 },
    { type: 'crown', label: 'Crown Boost', emoji: '👑', weight: 25 },
];

export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user, campus } = useAuth();
  const { soundOn, toggleSound } = useSound();
  const { toast } = useToast();
  
  const [inputMode, setInputMode] = useState<'chat' | 'boost'>('chat');
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectingOpponentId, setSelectingOpponentId] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const battleRef = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return doc(firestore, 'arena_battles', battleId);
  }, [firestore, battleId]);

  const { data: battle, isLoading: isLoadingBattle } = useDoc<ArenaBattle>(battleRef);

  const challengersQuery = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return query(collection(firestore, 'arena_battles', battleId, 'challengers'), orderBy('createdAt', 'desc'));
  }, [firestore, battleId]);

  const { data: challengers } = useCollection<ArenaChallenger>(challengersQuery);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { 
        if (snap.exists()) setHasVoted(true); 
    });
  }, [firestore, user?.id, battleId]);

  const handleSelectOpponent = async (challenger: ArenaChallenger) => {
    if (!firestore || !battle || !user || battle.creatorId !== user.id) return;
    setSelectingOpponentId(challenger.id);

    try {
        const batch = writeBatch(firestore);
        const bRef = doc(firestore, 'arena_battles', battleId);
        batch.update(bRef, {
            status: 'live',
            opponentB: {
                userId: challenger.userId,
                videoUrl: challenger.videoUrl,
                votes: 0
            },
            participants: [battle.creatorId, challenger.userId],
            [`participantInfo.${challenger.userId}`]: {
                name: challenger.userName,
                avatarUrl: challenger.avatarUrl,
                campusAcronym: challenger.campusAcronym,
                primaryColor: '#3b82f6' 
            },
            [`votes.${challenger.userId}`]: 0,
            createdAt: serverTimestamp(),
            endsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() 
        });
        await batch.commit();
        toast({ title: "Battle Activated! ⚔️" });
    } catch (err) {
        toast({ variant: 'destructive', title: 'Activation failed' });
    } finally {
        setSelectingOpponentId(null);
    }
  };

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

  const handleVote = async (target: 'A' | 'B') => {
    if (!firestore || !user || hasVoted || isVoting || !battle || battle.status !== 'live') return;
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
      toast({ title: "Energy Logged!" });
    } catch(err) {
        toast({ variant: 'destructive', title: 'Action Refused' });
    } finally { setIsVoting(false); }
  };

  const handlePowerUp = async (powerup: typeof POWER_UPS[0], target: 'A' | 'B') => {
    if (!firestore || !user || !battle || battle.status !== 'live') return;
    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    if (!targetUserId) return;

    try {
        addDoc(collection(firestore, 'arena_battles', battleId, 'powerups'), {
            userId: user.id, target, type: powerup.type, weight: powerup.weight, createdAt: serverTimestamp()
        });
        await updateDoc(doc(firestore, 'arena_battles', battleId), { 
            [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(powerup.weight), 
            [`votes.${targetUserId}`]: increment(powerup.weight) 
        });
    } catch (err) { toast({ variant: 'destructive', title: 'Power-Up Refused' }); }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoadingBattle || !battle) {
    return <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;
  }

  const isCreator = user?.id === battle.creatorId;
  const isTarget = user?.id === battle.targetUserId;
  const isWaiting = battle.status === 'waiting';
  const isLive = battle.status === 'live';
  const isEnded = battle.status === 'ended';

  const p1 = battle.participantInfo[battle.opponentA.userId];
  const p2 = battle.opponentB ? battle.participantInfo[battle.opponentB.userId] : null;

  const totalVotes = (battle.opponentA.votes || 0) + (battle.opponentB?.votes || 0);
  const p1Pct = totalVotes > 0 ? ((battle.opponentA.votes || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      <div className="flex-[3] relative bg-slate-950 flex flex-col border-r border-white/5">
        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center">
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 shadow-xl"><X size={24}/></button>
          <div className={cn(
              "px-6 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] backdrop-blur-md border border-white/10",
              isWaiting ? "bg-indigo-600" : isLive ? "bg-red-600 animate-pulse" : "bg-amber-500"
          )}>
            {isWaiting ? "DEPLOYMENT OPEN" : isLive ? "LIVE SHOWDOWN" : "CONCLUDED"}
          </div>
          <button onClick={toggleSound} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10">
            {soundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>

        {isWaiting && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 overflow-y-auto no-scrollbar">
                <div className="max-w-2xl w-full space-y-8 py-20">
                    {battle.targetUserId && (
                        <div className="bg-indigo-600 p-6 rounded-[2.5rem] flex items-center gap-4 shadow-2xl animate-in slide-in-from-top-4">
                            <div className="p-3 bg-white/20 rounded-2xl"><Target size={24} className="text-white" /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-indigo-100 tracking-widest">Personal Challenge</p>
                                <h4 className="text-lg font-black text-white">{battle.creatorName} called out {battle.targetUserName}</h4>
                            </div>
                        </div>
                    )}

                    <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-black">
                        <ReactPlayer url={previewVideoUrl || battle.opponentA.videoUrl} playing={!isEnded} muted={!soundOn} width="100%" height="100%" />
                        <div className="absolute bottom-6 left-6 z-20 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white">
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                                {previewVideoUrl ? 'CONTENDER PREVIEW' : p1?.campusAcronym}
                            </p>
                            <p className="text-xs font-black">{previewVideoUrl ? 'Previewing rival...' : p1?.name}</p>
                        </div>
                        {previewVideoUrl && (
                            <button onClick={() => setPreviewVideoUrl(null)} className="absolute top-6 right-6 p-2 bg-red-600 text-white rounded-lg"><X size={16} /></button>
                        )}
                    </div>

                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">"{battle.title}"</h2>
                        {isTarget ? (
                            <Button onClick={() => setIsJoinModalOpen(true)} className="bg-amber-500 text-slate-950 px-12 py-8 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all">
                                ACCEPT CALL OUT <Swords className="ml-2" />
                            </Button>
                        ) : isCreator ? (
                            <div className="p-6 bg-white/5 border-2 border-dashed border-white/10 rounded-3xl animate-pulse">
                                <p className="text-indigo-400 font-black uppercase text-xs">Waiting for rival to accept...</p>
                            </div>
                        ) : (
                            <Button onClick={() => setIsJoinModalOpen(true)} className="bg-indigo-600 text-white px-12 py-8 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all">
                                JOIN CHALLENGE <UserPlus className="ml-2" />
                            </Button>
                        )}
                    </div>

                    {isCreator && (
                        <div className="space-y-4 pt-10">
                            <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                                <Swords size={16} className="text-indigo-500" /> Rival Queue ({challengers?.length || 0})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {challengers?.map(c => (
                                    <div key={c.id} className="p-4 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-all">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="border-2 border-white/20"><AvatarImage src={c.avatarUrl}/></Avatar>
                                            <div>
                                                <p className="text-sm font-black text-white">{c.userName}</p>
                                                <p className="text-[9px] font-bold text-indigo-400 uppercase">{c.campusAcronym}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" className="text-[9px] font-black uppercase text-slate-400" onClick={() => setPreviewVideoUrl(c.videoUrl)}>Preview</Button>
                                            <Button size="sm" disabled={!!selectingOpponentId} onClick={() => handleSelectOpponent(c)} className="rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase shadow-lg">
                                                {selectingOpponentId === c.id ? <Loader2 className="animate-spin" /> : "FIGHT"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {isLive && (
            <div className="flex-1 flex flex-col">
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                    <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-8">
                        <div className="text-center flex-1">
                            <p className="text-[8px] font-black text-blue-400 uppercase">{p1?.campusAcronym}</p>
                            <p className="text-2xl font-black text-white tabular-nums">{battle.opponentA.votes || 0}</p>
                        </div>
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"><Swords size={18} className="text-white" /></div>
                        <div className="text-center flex-1">
                            <p className="text-[8px] font-black text-amber-400 uppercase">{p2?.campusAcronym}</p>
                            <p className="text-2xl font-black text-white tabular-nums">{battle.opponentB?.votes || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
                        <ReactPlayer url={battle.opponentA.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" />
                    </div>
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
                        <ReactPlayer url={battle.opponentB?.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" />
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                    <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
                        <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                            <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                            <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
                        </div>
                        {!hasVoted ? (
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => handleVote('A')} disabled={isVoting} className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-500">VOTE {p1?.campusAcronym}</button>
                                <button onClick={() => handleVote('B')} disabled={isVoting} className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-amber-400">VOTE {p2?.campusAcronym}</button>
                            </div>
                        ) : (
                            <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2"><CheckCircle2 size={14} /> Vote Authenticated</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {isEnded && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
                <Trophy size={80} className="text-amber-500 mb-8 animate-bounce" />
                <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-10">Concluded</h1>
                {battle.aiVerdict && (
                    <div className="max-w-xl p-10 bg-slate-900 border-4 border-amber-500/30 rounded-[3rem] text-center shadow-2xl">
                        <Bot size={32} className="text-amber-500 mx-auto mb-4" />
                        <p className="text-xl font-black italic text-indigo-50 leading-tight mb-6">"{battle.aiVerdict.verdict}"</p>
                        <Button onClick={onClose} className="w-full bg-white text-slate-900 font-black rounded-2xl h-14">Return to Arena</Button>
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="flex-1 bg-slate-900 flex flex-col shadow-2xl max-h-screen">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
          <h3 className="text-white font-black italic uppercase truncate max-w-[180px]">{battle.title}</h3>
          <div className="flex gap-2">
            <button onClick={() => setInputMode('chat')} className={cn("p-2 rounded-xl transition-all", inputMode === 'chat' ? "bg-blue-600 text-white" : "text-slate-500")}><MessageSquare size={18}/></button>
            <button onClick={() => setInputMode('boost')} className={cn("p-2 rounded-xl transition-all", inputMode === 'boost' ? "bg-amber-500 text-slate-950" : "text-slate-500")}><Zap size={18}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
          {messages?.map((m) => (
            <div key={m.id} className="animate-in slide-in-from-bottom-2">
              <p className="text-[9px] font-black uppercase text-slate-500 mb-1">{m.userName}</p>
              <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-slate-300 text-sm">{m.text}</div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 bg-slate-950 border-t border-white/5">
            {inputMode === 'chat' ? (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Drop a shade..." className="flex-1 bg-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none" />
                    <button type="submit" disabled={!message.trim()} className="p-4 bg-blue-600 text-white rounded-full"><Send size={20} /></button>
                </form>
            ) : (
                <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-bottom-4">
                    {POWER_UPS.map(up => (
                        <button key={up.type} onClick={() => handlePowerUp(up, 'A')} className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-xl hover:bg-blue-600 transition-all active:scale-95 group">
                            <span className="text-xl group-active:scale-150 transition-transform inline-block">{up.emoji}</span>
                            <p className="text-[8px] font-black text-white mt-1 uppercase">+{up.weight}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <JoinBattleModal battle={battle} isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </div>
  );
}
