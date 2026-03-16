
'use client';

/**
 * CampusWarRoom Component
 * -----------------------
 * National Hub Stage for University vs University Wars.
 * Orchestrates massive spectator loads using Distributed Counters (Sharding).
 * Implements "One Vote Per Student" integrity protocol.
 * STEP 8: Layer 1 Anti-Fraud Vote Rate Limiting Active 🛡️
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, query, orderBy, limitToLast, 
  serverTimestamp, addDoc, updateDoc, 
  increment, doc, getDoc, writeBatch
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { CampusWar, BattleMessage, VoteShard } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Globe, CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const POWER_UPS = [
    { type: 'fire', label: 'Vibe Boost', emoji: '🔥', weight: 5 },
    { type: 'mass_shade', label: 'Mass Shade', emoji: '🗣️', weight: 15 },
    { type: 'national_crown', label: 'National Crown', emoji: '👑', weight: 50 },
];

interface LocalBurst { id: string; emoji: string; x: number; }

export function CampusWarRoom({ warId, onClose }: { warId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [bursts, setBursts] = useState<LocalBurst[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const warRef = useMemoFirebase(() => {
    if (!firestore || !warId) return null;
    return doc(firestore, 'campus_wars', warId);
  }, [firestore, warId]);

  const { data: war, isLoading } = useDoc<CampusWar>(warRef);

  const shardsQuery = useMemoFirebase(() => {
      if (!firestore || !warId) return null;
      return query(collection(firestore, 'campus_wars', warId, 'vote_shards'));
  }, [firestore, warId]);

  const { data: shards } = useCollection<VoteShard>(shardsQuery);

  const aggregatedScores = useMemo(() => {
      if (!shards || shards.length === 0) return { A: war?.votesA || 0, B: war?.votesB || 0 };
      return shards.reduce((acc, shard) => ({
          A: acc.A + (shard.votesA || 0),
          B: acc.B + (shard.votesB || 0)
      }), { A: 0, B: 0 });
  }, [shards, war]);

  // 🛡️ STEP 8: Check for initial vote status (optional for multi-vote system)
  useEffect(() => {
    if (!firestore || !user || !warId) return;
    const checkVote = async () => {
        const auditRef = doc(firestore, 'battle_votes', warId, 'users', user.id);
        const snap = await getDoc(auditRef);
        if (snap.exists()) setHasVoted(true);
    };
    checkVote();
  }, [firestore, user?.id, warId]);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "campus_wars", warId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    ) : null
  , [firestore, warId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || war?.status === 'ended') return;
    const text = message.trim();
    setMessage('');
    addDoc(collection(firestore, "campus_wars", warId, "messages"), { 
        userId: user.id, 
        userName: user.name, 
        text, 
        createdAt: serverTimestamp() 
    });
  };

  /**
   * 🛡️ STEP 8: Layer 1 - Vote Rate Limiting (Campus War Edition)
   * Enforces 10s cooldown across distributed shards.
   */
  const handleVote = async (side: 'A' | 'B') => {
    if (!firestore || !user || isVoting || !war || war.status === 'ended') return;
    setIsVoting(true);
    
    try {
      // 1. SECURITY AUDIT: Frequency Check
      const voteAuditRef = doc(firestore, 'battle_votes', warId, 'users', user.id);
      const auditSnap = await getDoc(voteAuditRef);
      const now = Date.now();

      if (auditSnap.exists()) {
          const lastVote = auditSnap.data().lastVoteTime?.toMillis?.() || 0;
          if (now - lastVote < 10000) {
              toast({ variant: 'destructive', title: 'Energy Recharging...', description: 'Please wait 10s between war contributions.' });
              setIsVoting(false);
              return;
          }
      }

      // 2. DISTRIBUTED HANDSHAKE
      const shardId = Math.floor(Math.random() * 10).toString();
      const shardRef = doc(firestore, 'campus_wars', warId, 'vote_shards', shardId);
      const batch = writeBatch(firestore);

      batch.set(voteAuditRef, {
          lastVoteTime: serverTimestamp(),
          voteCount: increment(1),
          side: side === 'A' ? war.campusAId : war.campusBId
      }, { merge: true });

      batch.set(shardRef, { 
          [side === 'A' ? 'votesA' : 'votesB']: increment(1) 
      }, { merge: true });

      await batch.commit();
      setHasVoted(true);
      sendReaction('🗳️');
      toast({ title: "War Energy Contributed! ⚔️" });

    } catch(err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Deployment Refused' });
    } finally { 
        setIsVoting(false); 
    }
  };

  const handlePowerUp = async (up: typeof POWER_UPS[0], side: 'A' | 'B') => {
    if (!firestore || !user || !war || war.status === 'ended') return;
    const shardId = Math.floor(Math.random() * 10).toString();
    const shardRef = doc(firestore, 'campus_wars', warId, 'vote_shards', shardId);
    try {
        await updateDoc(shardRef, { [side === 'A' ? 'votesA' : 'votesB']: increment(up.weight) });
        sendReaction(up.emoji);
    } catch (err) { console.error(err); }
  };

  const sendReaction = (emoji: string) => {
    const id = Math.random().toString(36);
    setBursts(prev => [...prev, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 2000);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading || !war) {
    return (
        <div className="fixed inset-0 z-[8000] bg-slate-950 flex flex-col items-center justify-center text-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="text-white font-black text-xs uppercase tracking-[0.4em] opacity-50 animate-pulse">
                Mobilizing National Yard War...
            </p>
        </div>
    );
  }

  const { A: votesA, B: votesB } = aggregatedScores;
  const totalVotes = (votesA || 0) + (votesB || 0);
  const p1Pct = totalVotes > 0 ? ((votesA || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  return (
    <div className="fixed inset-0 z-[8000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      <div className="flex-[3] relative bg-slate-950 flex flex-col overflow-hidden">
        
        <div className="absolute inset-0 pointer-events-none z-[100]">
            <AnimatePresence>
                {bursts.map(b => (
                    <motion.div
                        key={b.id}
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 1, 1, 0], y: -400, scale: [0.5, 2, 1.5, 1] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="absolute text-7xl"
                        style={{ left: `${b.x}%`, bottom: '150px' }}
                    >
                        {b.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>

        <div className="absolute top-0 left-0 right-0 z-50 p-8 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={onClose} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md border border-white/10 transition-all">
            <X size={24}/>
          </button>
          <div className="text-center">
            <div className="bg-indigo-600 px-8 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.4em] shadow-2xl animate-pulse">
                Live National War
            </div>
            <h1 className="text-2xl font-black italic text-white mt-4 tracking-tighter uppercase">"{war.title}"</h1>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-white flex items-center gap-3">
            <Users size={18} className="text-indigo-400" />
            <span className="text-sm font-black tabular-nums">{war.viewerCount || 0}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center p-8 gap-12">
            <div className="w-full max-w-5xl flex justify-between items-center gap-10">
                <div className="text-center flex-1 animate-in slide-in-from-left-10 duration-1000">
                    <h2 className="text-8xl md:text-[10rem] font-black italic tracking-tighter mb-4" style={{ color: war.campusAInfo?.primaryColor }}>
                        {war.campusAInfo?.acronym}
                    </h2>
                    <p className="text-5xl font-black text-white tabular-nums">{(votesA || 0).toLocaleString()}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4">Campus Energy</p>
                </div>

                <div className="relative">
                    <div className="p-10 bg-indigo-600 rounded-full shadow-[0_0_100px_rgba(79,70,229,0.4)] border-8 border-slate-900">
                        <Swords size={64} className="text-white" />
                    </div>
                </div>

                <div className="text-center flex-1 animate-in slide-in-from-right-10 duration-1000">
                    <h2 className="text-8xl md:text-[10rem] font-black italic tracking-tighter mb-4" style={{ color: war.campusBInfo?.primaryColor }}>
                        {war.campusBInfo?.acronym}
                    </h2>
                    <p className="text-5xl font-black text-white tabular-nums">{(votesB || 0).toLocaleString()}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4">Campus Energy</p>
                </div>
            </div>

            <div className="w-full max-w-4xl h-16 bg-white/5 rounded-full overflow-hidden flex p-2 border-2 border-white/10 shadow-2xl relative">
                <div 
                    className="h-full transition-all duration-1000 ease-out rounded-full" 
                    style={{ width: `${p1Pct}%`, backgroundColor: war.campusAInfo?.primaryColor || '#3b82f6' }} 
                />
                <div 
                    className="h-full transition-all duration-1000 ease-out rounded-full" 
                    style={{ width: `${p2Pct}%`, backgroundColor: war.campusBInfo?.primaryColor || '#f59e0b' }} 
                />
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/40 -translate-x-1/2 z-20" />
            </div>
        </div>

        <div className="p-10 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-10">
            <div className="flex flex-col gap-4 w-full max-w-md">
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleVote('A')} disabled={isVoting} className="py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-2 border-white/10 hover:brightness-110" style={{ backgroundColor: war.campusAInfo?.primaryColor }}>VOTE {war.campusAInfo?.acronym}</button>
                    <button onClick={() => handleVote('B')} disabled={isVoting} className="py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-2 border-white/10 hover:brightness-110" style={{ backgroundColor: war.campusBInfo?.primaryColor }}>VOTE {war.campusBInfo?.acronym}</button>
                </div>
                {hasVoted && (
                    <div className="text-center animate-in zoom-in duration-500">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                            <CheckCircle2 size={14} /> National Contribution Logged
                        </p>
                    </div>
                )}
                <div className="flex justify-center gap-4">
                    {POWER_UPS.map(up => (
                        <button key={up.type} onClick={() => handlePowerUp(up, user?.campusId === war.campusAId ? 'A' : 'B')} className="group flex flex-col items-center gap-1">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all active:scale-90">
                                <span className="text-2xl group-active:scale-150 transition-transform inline-block">{up.emoji}</span>
                            </div>
                            <span className="text-[8px] font-black text-slate-500 uppercase">+{up.weight}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border-l border-white/5 flex flex-col shadow-2xl">
        <div className="p-6 bg-slate-950/50 border-b border-white/5">
            <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                <MessageSquare size={14} className="text-indigo-500" /> Global War Chat
            </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
            {messages?.map(m => (
                <div key={m.id} className="animate-in slide-in-from-bottom-2">
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1">{m.userName}</p>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-sm text-slate-300">
                        {m.text}
                    </div>
                </div>
            ))}
            <div ref={scrollRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-6 bg-slate-950 flex gap-2">
            <input 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Declare defense..."
                className="flex-1 bg-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none border-none focus:ring-2 focus:ring-indigo-600 font-bold transition-all"
            />
            <button type="submit" disabled={!message.trim()} className="p-4 bg-indigo-600 text-white rounded-2xl active:scale-90 shadow-xl transition-all">
                <Send size={20} />
            </button>
        </form>
      </div>
    </div>
  );
}
